import { GoogleGenAI } from "@google/genai";
import type { ProjectInboxItem, ProjectInboxLink } from "@/lib/types";

export async function generateInboxAiChatResponse({
  item,
  links = [],
  history = [],
  prompt,
}: {
  item: Pick<
    ProjectInboxItem,
    "title" | "description" | "type" | "status" | "priority" | "notes" | "research_notes"
  >;
  links?: ProjectInboxLink[];
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  prompt: string;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const linksContext = links.length
    ? links.map((l) => `- ${l.title}: ${l.url}`).join("\n")
    : "None recorded yet.";

  const systemInstruction = `
You are StoryBoard AI, a senior product strategy and technical brainstorming partner for the Super Admin / creator.
You are helping the creator evaluate and think through an early-stage project idea before it is formalized into a project.

YOUR ROLE & BEHAVIOR:
- Act as an objective, analytical thinking partner.
- Do NOT blindly validate every idea. Point out risks, competitive alternatives, technical bottlenecks, and unit economics where relevant.
- Advise on minimal MVP scope: what to build first versus what to defer.
- Answer questions on technical feasibility, architecture choices, competitor landscapes, and phased development roadmaps.
- Maintain a concise, direct, professional, and clear tone.
- Keep formatting clean with clear headings, bullet points, and actionable next steps.

CURRENT IDEA CONTEXT:
- Title: ${item.title}
- Type: ${item.type}
- Status: ${item.status}
- Priority: ${item.priority}
- Description: ${item.description || "None provided yet."}
- Private Notes:
${item.notes || "None recorded yet."}
- Research & Open Questions:
${item.research_notes || "None recorded yet."}
- Reference Links:
${linksContext}

Always ground your answers in the context of THIS idea. The user is in an active thinking workspace.
`.trim();

  // Format conversation history for Gemini contents
  // Build alternating conversation items
  const conversationParts: string[] = [];

  for (const msg of history) {
    const speaker = msg.role === "user" ? "User" : "StoryBoard AI";
    conversationParts.push(`${speaker}: ${msg.content}`);
  }

  conversationParts.push(`User: ${prompt}`);

  const fullPrompt = `${systemInstruction}\n\n=== CONVERSATION HISTORY ===\n${conversationParts.join("\n\n")}\n\nStoryBoard AI:`;

  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: fullPrompt,
      });

      const responseText = response.text;
      if (responseText && responseText.trim()) {
        return responseText.trim();
      }
      throw new Error("Gemini returned an empty response.");
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Failed to generate AI response.");
}

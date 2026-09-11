import { GoogleGenAI } from "@google/genai";
import type { ProjectInboxInsightType, ProjectInboxItem, ProjectInboxLink } from "@/lib/types";

export interface GeneratedInboxAiResponse {
  response: string;
  question_summary: string;
  ai_response_summary: string;
  suggested_type: ProjectInboxInsightType;
}

export async function generateInboxAiChatResponse({
  item,
  links = [],
  history = [],
  prompt,
  userName = "Team Member",
}: {
  item: Pick<
    ProjectInboxItem,
    "title" | "description" | "type" | "status" | "priority" | "notes" | "research_notes"
  >;
  links?: Array<{ title: string; url: string }>;
  history?: Array<{ role: "user" | "assistant"; content: string; userName?: string }>;
  prompt: string;
  userName?: string;
}): Promise<GeneratedInboxAiResponse> {
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
You are Reqly AI, a senior product strategy and technical brainstorming partner for the project team.
You are collaborating with team members on evaluating and researching an idea before it is formalized into a project.

YOUR BEHAVIOR:
- Act as an objective, analytical thinking partner.
- Do NOT blindly validate every idea. Point out risks, competitive alternatives, technical bottlenecks, and unit economics where relevant.
- Advise on minimal MVP scope: what to build first versus what to defer.
- Answer questions on technical feasibility, architecture choices, competitor landscapes, and phased development roadmaps.
- Maintain a concise, direct, professional, and clear tone with rich GitHub-flavored markdown.
- Ground your answers in the context of THIS idea.
- At the very end of your response, ALWAYS include a single-line hidden metadata block in this EXACT format:
<!--INSIGHT_META:{"question_summary":"...","ai_response_summary":"...","suggested_type":"..."}-->
Rules for metadata:
- "question_summary": Under 12 words capturing the core question.
- "ai_response_summary": 1-2 punchy sentences summarizing your main takeaway (under 35 words).
- "suggested_type": Pick the single most accurate tag: 'insight', 'research', 'hook', 'risk', 'decision', 'mvp_idea', 'competitor', 'technical_finding', 'question', 'reference'.

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
`.trim();

  // Bounded recent message window (last 12 messages)
  const BOUNDED_WINDOW = 12;
  const recentHistory = history.slice(-BOUNDED_WINDOW);
  const olderMessages = history.slice(0, -BOUNDED_WINDOW);

  const conversationParts: string[] = [];

  if (olderMessages.length > 0) {
    conversationParts.push(
      `[Earlier conversation context: ${olderMessages.length} prior messages discussing ${olderMessages
        .slice(-3)
        .map((m) => m.content.slice(0, 60))
        .join(" | ")}...]`
    );
  }

  for (const msg of recentHistory) {
    const speaker = msg.role === "user" ? msg.userName || "User" : "AI Thinking Partner";
    conversationParts.push(`${speaker}: ${msg.content}`);
  }

  conversationParts.push(`${userName}: ${prompt}`);

  const fullPrompt = `${systemInstruction}\n\n=== CONVERSATION HISTORY ===\n${conversationParts.join(
    "\n\n"
  )}\n\nAI Thinking Partner:`;

  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await ai.models.generateContent({
        model,
        contents: fullPrompt,
      });

      const rawText = result.text;
      if (rawText && rawText.trim()) {
        return parseAiResponseWithMetadata(rawText.trim(), prompt);
      }
      throw new Error("Gemini returned an empty response.");
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Failed to generate AI response.");
}

function parseAiResponseWithMetadata(rawText: string, prompt: string): GeneratedInboxAiResponse {
  const metaRegex = /<!--INSIGHT_META:(\{[\s\S]*?\})-->/;
  const match = rawText.match(metaRegex);

  let cleanResponse = rawText;
  let question_summary = prompt.length > 80 ? prompt.slice(0, 77) + "..." : prompt;
  let ai_response_summary = "";
  let suggested_type: ProjectInboxInsightType = "insight";

  if (match) {
    cleanResponse = rawText.replace(metaRegex, "").trim();
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.question_summary) question_summary = String(parsed.question_summary).trim();
      if (parsed.ai_response_summary) ai_response_summary = String(parsed.ai_response_summary).trim();
      if (parsed.suggested_type) suggested_type = parsed.suggested_type as ProjectInboxInsightType;
    } catch {}
  }

  // Fallback summary if not extracted
  if (!ai_response_summary) {
    const lines = cleanResponse
      .split("\n")
      .map((l) => l.replace(/^#+\s*/, "").replace(/^[-*]\s*/, "").trim())
      .filter((l) => l.length > 20);
    ai_response_summary = lines[0] ? lines[0].slice(0, 160) : cleanResponse.slice(0, 160);
  }

  return {
    response: cleanResponse,
    question_summary,
    ai_response_summary,
    suggested_type,
  };
}

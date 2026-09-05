import { GoogleGenAI } from "@google/genai";
import { generatedStorySchema } from "./story-schema";

const systemPrompt = `
You are a senior product requirements analyst helping a freelance software developer.
Convert a client's short, often vague requirement into a practical feature story that can be reviewed by both the developer and client.

Rules:
- Preserve the client's intent. Do not invent major functionality.
- Expand implied behavior only when it is a reasonable consequence of the requirement.
- Acceptance criteria must be concrete, testable, and written as simple statements.
- Put uncertain decisions in clarifications instead of silently deciding them.
- Put reasonable implementation-independent assumptions in assumptions.
- Do not include technical architecture, database schema, code, estimates, or subtasks.
- Keep the language professional and easy for a non-technical client to understand.
- If the requirement is already clear, clarifications may be an empty array.
- Based on the requirement, optionally suggest an Epic category (e.g., "Authentication & Accounts", "Orders").
- Return only the requested JSON structure.
`;

export async function generateStory(requirement: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const response = await ai.models.generateContent({
    model,
    contents: `${systemPrompt}\n\nClient requirement:\n${requirement}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          acceptanceCriteria: { type: "array", items: { type: "string" } },
          assumptions: { type: "array", items: { type: "string" } },
          clarifications: { type: "array", items: { type: "string" } },
          status: { type: "string", enum: ["draft"] },
          suggestedEpic: { type: "string", nullable: true }
        },
        required: ["title", "description", "acceptanceCriteria", "assumptions", "clarifications", "status"]
      }
    }
  });

  const parsed = JSON.parse(response.text || "{}");
  return generatedStorySchema.parse(parsed);
}

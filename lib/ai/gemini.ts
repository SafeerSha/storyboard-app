import { GoogleGenAI } from "@google/genai";
import { generatedStoriesSchema } from "./story-schema";

const systemPrompt = `
You are a senior product requirements analyst helping a freelance software developer.
Convert a client's short, often vague requirement into one or more practical feature stories.

CRITICAL INSTRUCTION ON STORY SPLITTING:
- A user requirement is an input. A story is an independently implementable unit.
- If the requirement contains clearly separable functionality that can be independently implemented, tested, and reviewed, you MUST split it into multiple stories.
- Example: "User profile and credentials management" -> Story 1: "Manage User Profile", Story 2: "Manage User Credentials".
- Do NOT split unnecessarily into implementation tasks. (e.g. "Upload photo" and "Save photo" are NOT separate stories, they belong in one story).
- Split by independently deliverable functionality, not by sentence grammar.
- Each generated story must be understandable on its own.

Rules for each story:
- Preserve the client's intent. Do not invent major unrelated functionality.
- Expand implied behavior only when it is a reasonable consequence of the requirement.
- Acceptance criteria must be concrete, testable, and written as simple statements.
- Put uncertain decisions in clarifications instead of silently deciding them.
- Put reasonable implementation-independent assumptions in assumptions.
- Do not include technical architecture, database schema, code, estimates, or subtasks.
- Keep the language professional and easy for a non-technical client to understand.
- Return ONLY the requested JSON structure containing an array of stories.
`;

export async function generateStories(requirement: string) {
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
          stories: {
            type: "array",
            items: {
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
        },
        required: ["stories"]
      }
    }
  });

  const parsed = JSON.parse(response.text || "{}");
  return generatedStoriesSchema.parse(parsed);
}

const correctEpicPrompt = `
You are a senior agile product manager and software architecture specialist.
Your task is to take a draft, informal, misspelled, or poorly worded Epic name and transform it into a standardized, professional, industry-standard Epic title.

Rules:
- Correct all spelling, grammar, and casing mistakes.
- Use Title Case (e.g. "User Authentication & Authorization", "Checkout & Payment Gateway", "Inventory & Stock Management").
- Keep it concise (typically 2 to 5 words).
- Preserve the core domain and scope of the given epic name.
- Provide the primary corrected name and 2-3 alternate naming suggestions.
- Provide a concise 1-2 sentence description explaining the scope of this Epic.
- Return only the requested JSON structure.
`;

export async function correctEpicName(rawName: string, currentDescription?: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const prompt = `Draft Epic Name: "${rawName}"${currentDescription ? `\nExisting Description: "${currentDescription}"` : ""}`;

  const response = await ai.models.generateContent({
    model,
    contents: `${correctEpicPrompt}\n\n${prompt}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          correctedName: { type: "string" },
          alternatives: { type: "array", items: { type: "string" } },
          suggestedDescription: { type: "string" }
        },
        required: ["correctedName", "alternatives", "suggestedDescription"]
      }
    }
  });

  const parsed = JSON.parse(response.text || "{}");
  return {
    correctedName: String(parsed.correctedName || rawName).trim(),
    alternatives: Array.isArray(parsed.alternatives) ? parsed.alternatives.map(String) : [],
    suggestedDescription: String(parsed.suggestedDescription || "").trim()
  };
}

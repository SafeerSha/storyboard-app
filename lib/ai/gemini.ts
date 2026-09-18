import { GoogleGenAI } from "@google/genai";
import { generatedStoriesSchema, convertedRequirementsSchema } from "./story-schema";

const systemPrompt = `
You are a senior product requirements analyst helping a freelance software developer produce clear, practical, and client-friendly feature stories.
Convert a client's short, often vague requirement into one or more practical feature stories with CONCISE, HIGH-QUALITY ACCEPTANCE CRITERIA.

==================================================
1. CRITICAL INSTRUCTION ON STORY SPLITTING
==================================================
- A user requirement is an input. A story is an independently deliverable unit of value.
- If the requirement contains clearly separable capabilities that can be independently implemented, tested, and reviewed, you MUST split it into multiple stories.
  Example: "User profile and credentials management" -> Story 1: "Manage User Profile", Story 2: "Manage User Credentials".
  Example: "Users can register, log in, and reset their password" -> Story 1: "User Registration", Story 2: "User Login", Story 3: "Password Reset".
- Do NOT split unnecessarily into tiny implementation tasks (e.g. "Upload photo" and "Save photo" are NOT separate stories; they belong in one story).
- Split by independently deliverable business functionality, not by sentence grammar.
- Each generated story must be cohesive and understandable on its own.

==================================================
2. ACCEPTANCE CRITERIA CONSOLIDATION & CORE PRINCIPLES
==================================================
The goal is NOT to generate as many acceptance criteria as possible.
The goal is to generate the MINIMUM number of clear, complete, independently meaningful acceptance criteria needed to define and validate the story.

Acceptance criteria must be optimized for:
- Client understanding & quick review
- Easy approval without cognitive overload
- Clear functional scope
- Testability and completeness

Follow this internal reasoning pipeline before finalizing criteria:
1. Identify essential behaviors and outcomes for the story.
2. Draft initial criteria, then perform an AGGRESSIVE CONSOLIDATION PASS:
   - MERGE SIMILAR CRITERIA: When multiple criteria describe variations of the same behavior, merge them into a single criterion using natural lists (e.g. "Users can view and update their profile information, including their name, email, and phone number.").
   - MERGE RELATED VALIDATION RULES: Never write one criterion per field validation. Combine standard field checks into cohesive statements (e.g. "The system validates required profile fields and field-specific formats, and clearly indicates any invalid or missing values.").
   - MERGE CRUD OPERATIONS WHEN COHESIVE: When a story represents a cohesive management capability (e.g. "Manage Products"), group basic operations: "Admin can create, view, edit, and delete products" and "The system validates product information and prevents invalid data from being saved."
   - COMBINE ACTION + RESULT: Instead of separating submission, persistence, and feedback into separate steps, combine them into an outcome statement: "When the user submits valid profile information, the changes are saved successfully and the updated information is displayed."
   - CONSOLIDATE NEGATIVE CASES & ERRORS: Group related error handling and validation failures (e.g. "If the update cannot be completed, the system informs the user that the change was not saved and allows them to retry.").
   - DO NOT OVER-MERGE UNRELATED BEHAVIORS: Keep materially different business workflows or security levels separate (e.g. authenticated password change vs. unauthenticated password recovery are distinct workflows and must remain separate).
   - ZERO IMPLEMENTATION DETAILS: Do NOT mention UI buttons ("has a submit button"), React components, database tables, APIs, endpoints, CSS, or internal code. Express criteria purely in terms of user and system behavior.
   - CLIENT-FIRST LANGUAGE: Use simple, professional, non-technical phrasing with consistent behavioral stems ("Users can...", "The system...", "Admins can...", "When..., the system...").

==================================================
3. TARGET ACCEPTANCE CRITERIA COUNT GUIDELINES
==================================================
- Small / simple story: approximately 2–4 criteria
- Normal story: approximately 3–6 criteria
- Complex story: approximately 5–8 criteria
Prioritize complete functional coverage without bloat. Do NOT artificially inflate criteria counts.

==================================================
4. STORY FIELDS SPECIFICATION
==================================================
For each story:
- title: Concise, action-oriented feature title (e.g. "User Profile Management", "Password Reset via Email").
- description: 1–2 sentence summary explaining who benefits and the main outcome.
- acceptanceCriteria: Array of consolidated, client-friendly criteria strings adhering strictly to the consolidation rules.
- assumptions: Reasonable implementation-independent business assumptions (empty array if none).
- clarifications: Open questions or ambiguities about business rules (empty array if none).
- status: Always "draft".
- suggestedEpic: Optional name of the relevant epic category.

Return ONLY the requested JSON structure containing the array of stories.
`;

export async function generateStories(requirement: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  let response;
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      response = await ai.models.generateContent({
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
      break;
    } catch (err: unknown) {
      lastError = err;
      const status = (err as { status?: number })?.status;
      const message = String((err as Error)?.message || "");
      const isTransient = status === 503 || status === 429 || message.includes("503") || message.includes("high demand");
      if (isTransient && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
        continue;
      }
      throw err;
    }
  }

  if (!response) {
    throw lastError || new Error("Failed to generate response from AI");
  }

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

const convertNotePrompt = `
You are an expert agile product manager and senior business analyst.
Your task is to take informal discussion notes, meeting minutes, brainstorming bullets, or client discussion points and convert them into a structured, client-ready Epic and User Stories.

CORE INSTRUCTIONS:
1. EPIC SYNTHESIS:
- If a Target Epic is NOT specified, identify the overarching theme or feature module represented in the notes.
- Formulate a clear, professional, Title-Cased Epic Name (2-5 words, e.g., "User Authentication & Authorization", "Checkout & Payment Flow", "Order Tracking & Fulfillment").
- Write a 1-2 sentence Epic Description summarizing the business scope and user value.
- If a Target Epic IS specified, keep that Epic Name and formulate a description aligned with the note's scope.

2. STORY DECOMPOSITION:
- Break down the notes, decisions, and discussion items into cohesive, independently deliverable User Stories.
- Avoid combining disparate workflows into a single story. Split by business capability (e.g., registration vs. password reset vs. profile editing).
- Avoid micro-splitting trivial tasks; group cohesive CRUD or operational flows into a meaningful feature unit.

3. ACCEPTANCE CRITERIA CONSOLIDATION:
- Each story must have 2 to 6 concise, outcome-oriented acceptance criteria.
- Client-friendly language (e.g. "Users can...", "The system validates...", "Admins can...").
- ZERO technical code/implementation details (no React components, endpoints, database schemas, CSS).
- Combine related validations and error cases into unified outcome statements.

4. ASSUMPTIONS & CLARIFICATIONS:
- Extract sensible business assumptions discussed or implied by the notes.
- Flag any ambiguities, unresolved questions, or edge cases from the meeting notes as clarifications.
- Status must always be "draft".
`;

export async function convertNoteToRequirements(
  noteTitle: string,
  noteContent: string,
  options?: { targetEpicName?: string }
) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  let promptContext = `Note Title: "${noteTitle}"\nNote Content / Discussion Points:\n${noteContent}`;
  if (options?.targetEpicName) {
    promptContext += `\n\nTarget Epic: "${options.targetEpicName}" (Generate stories directly belonging to this existing Epic)`;
  }

  let response;
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      response = await ai.models.generateContent({
        model,
        contents: `${convertNotePrompt}\n\n${promptContext}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              epic: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" }
                },
                required: ["name", "description"]
              },
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
            required: ["epic", "stories"]
          }
        }
      });
      break;
    } catch (err: unknown) {
      lastError = err;
      const status = (err as { status?: number })?.status;
      const message = String((err as Error)?.message || "");
      const isTransient =
        status === 503 ||
        status === 429 ||
        message.includes("503") ||
        message.includes("high demand");
      if (isTransient && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
        continue;
      }
      throw err;
    }
  }

  if (!response) {
    throw lastError || new Error("Failed to generate response from AI");
  }

  const parsed = JSON.parse(response.text || "{}");
  return convertedRequirementsSchema.parse(parsed);
}


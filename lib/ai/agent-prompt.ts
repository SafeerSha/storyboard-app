import { GoogleGenAI } from "@google/genai";

export type AgentPromptPreset = "fullstack" | "frontend" | "backend" | "tdd";

export interface StoryPromptInput {
  title: string;
  description?: string;
  epicName?: string;
  epicDescription?: string;
  acceptanceCriteria: string[];
  assumptions?: string[];
  clarifications?: string[];
  techStackHint?: string;
  preset?: AgentPromptPreset;
}

/**
 * Builds a deterministic, comprehensive, high-fidelity prompt tailored for AI coding agents
 * (Cursor, Claude Code, GitHub Copilot Workspace, Antigravity, Devin).
 */
export function buildDeterministicAgentPrompt(input: StoryPromptInput): string {
  const {
    title,
    description = "",
    epicName = "Core Application",
    epicDescription = "",
    acceptanceCriteria = [],
    assumptions = [],
    clarifications = [],
    techStackHint = "Next.js (App Router), TypeScript, Tailwind CSS, Supabase",
    preset = "fullstack",
  } = input;

  const presetGuides: Record<AgentPromptPreset, { title: string; focus: string; instructions: string[] }> = {
    fullstack: {
      title: "End-to-End Full-Stack Feature Implementation",
      focus: "Balanced implementation spanning UI components, responsive design, data models, API endpoints, and validation.",
      instructions: [
        "Inspect existing codebase patterns, types, and reusable UI components before creating new ones.",
        "Implement end-to-end data flow: database/schema -> backend API / server actions -> frontend UI state.",
        "Ensure resilient error boundaries, loading skeletons, and form validation using Zod/TypeScript.",
        "Verify all acceptance criteria in both happy-path and edge-case scenarios.",
      ],
    },
    frontend: {
      title: "Frontend UI & Component Implementation",
      focus: "Pixel-perfect interface, accessible UI states, interactive animations, and responsive layout.",
      instructions: [
        "Follow the project's design system tokens (colors, typography, rounded corners, shadows).",
        "Implement comprehensive component states: idle, loading, active, disabled, success, and error.",
        "Guarantee mobile responsiveness, keyboard accessibility, and screen reader labels.",
        "Use optimistic UI updates where appropriate and handle network latency cleanly.",
      ],
    },
    backend: {
      title: "Backend Architecture & Data Layer Implementation",
      focus: "Robust API endpoints, database schemas, access controls, data integrity, and error handling.",
      instructions: [
        "Design schema migrations, foreign keys, cascade rules, and indexes if database changes are needed.",
        "Enforce strict input validation using schemas (e.g. Zod) and sanitize user inputs.",
        "Enforce authentication, authorization (RLS/session checks), and tenant isolation.",
        "Return structured, predictable JSON error responses with meaningful HTTP status codes.",
      ],
    },
    tdd: {
      title: "Test-Driven Development (TDD) Implementation",
      focus: "Comprehensive unit, integration, and verification test specifications matching acceptance criteria.",
      instructions: [
        "Author failing tests corresponding to each acceptance criterion before implementing business logic.",
        "Cover boundary conditions: empty states, invalid formats, unauthorized requests, and network timeouts.",
        "Refactor cleanly while ensuring 100% of test suites pass.",
        "Document test fixtures and mock behaviors clearly.",
      ],
    },
  };

  const selectedPreset = presetGuides[preset] || presetGuides.fullstack;

  let prompt = `# 🤖 AI Coding Agent Feature Specification: ${title.trim()}\n\n`;

  prompt += `> **Task Objective**: Implement the following feature story in the application with highest fidelity, strict type-safety, and complete test verification.\n`;
  prompt += `> **Implementation Focus**: ${selectedPreset.title} (${preset})\n\n`;

  prompt += `## 1. Feature Identity & Domain Context\n`;
  prompt += `- **Feature Title**: ${title.trim()}\n`;
  prompt += `- **Parent Epic / Domain**: ${epicName.trim()}${epicDescription ? ` — ${epicDescription.trim()}` : ""}\n`;
  if (description.trim()) {
    prompt += `- **Business Value & User Goal**: ${description.trim()}\n`;
  }
  if (techStackHint.trim()) {
    prompt += `- **Target Tech Stack**: ${techStackHint.trim()}\n`;
  }
  prompt += `\n`;

  prompt += `## 2. Mandatory Acceptance Criteria (Verification Matrix)\n`;
  prompt += `The implementation is considered complete **ONLY** when every single numbered criterion below passes:\n\n`;

  if (acceptanceCriteria.length === 0) {
    prompt += `*(No specific criteria provided. Implement standard industry best practices for "${title}").*\n\n`;
  } else {
    acceptanceCriteria.forEach((criterion, idx) => {
      prompt += `### AC-${idx + 1}: ${criterion.trim()}\n`;
      prompt += `- **Behavior**: When triggered, the system must conform precisely to this requirement.\n`;
      prompt += `- **Validation**: Test both happy path and failure/rejection handling.\n\n`;
    });
  }

  if (assumptions.length > 0) {
    prompt += `## 3. Technical & Product Assumptions\n`;
    assumptions.forEach((a) => {
      prompt += `- ${a.trim()}\n`;
    });
    prompt += `\n`;
  }

  if (clarifications.length > 0) {
    prompt += `## 4. Clarifications & Business Rules\n`;
    clarifications.forEach((c) => {
      prompt += `- ${c.trim()}\n`;
    });
    prompt += `\n`;
  }

  prompt += `## 5. Architectural & Implementation Guidelines\n`;
  prompt += `**Focus Area**: ${selectedPreset.focus}\n\n`;
  selectedPreset.instructions.forEach((inst, i) => {
    prompt += `${i + 1}. **${inst}**\n`;
  });
  prompt += `\n`;

  prompt += `## 6. Step-by-Step AI Agent Execution Plan\n`;
  prompt += `1. **Reconnaissance**: Review existing relevant files, types, and components in the repository to maintain architectural consistency.\n`;
  prompt += `2. **Data Contracts & Types**: Define or update TypeScript types/interfaces and validation schemas.\n`;
  prompt += `3. **Backend / Logic**: Implement core endpoints, server actions, or business algorithms with appropriate error handling.\n`;
  prompt += `4. **UI & User Flow**: Build or integrate the interactive UI components, loading states, and feedback toasts.\n`;
  prompt += `5. **Edge Case Hardening**: Ensure resilience against empty inputs, race conditions, and network failures.\n`;
  prompt += `6. **Self-Verification**: Validate the implementation against each acceptance criterion listed below.\n\n`;

  prompt += `## 7. Verification Checklist (Agent Sign-off)\n`;
  if (acceptanceCriteria.length > 0) {
    acceptanceCriteria.forEach((_, idx) => {
      prompt += `- [ ] AC-${idx + 1} fully verified\n`;
    });
  } else {
    prompt += `- [ ] Feature fully functional and verified\n`;
  }
  prompt += `- [ ] Responsive across screen sizes and accessible\n`;
  prompt += `- [ ] No regression introduced into adjacent modules\n`;
  prompt += `- [ ] Code builds cleanly without TypeScript or lint errors\n`;

  return prompt;
}

const geminiEnhanceSystemPrompt = `
You are a Staff Principal Software Engineer and AI Coding Agent Prompter.
Your task is to take a product story (Title, Description, Epic, Acceptance Criteria, Assumptions, Clarifications) and transform it into an ultra-detailed, highly actionable specification prompt for an autonomous AI coding agent (like Cursor Composer, Claude Code, GitHub Copilot Workspace, Antigravity, or Devin).

REQUIREMENTS FOR YOUR GENERATED PROMPT:
1. Output in pristine GitHub Markdown.
2. Structure the prompt logically:
   - Feature Overview & Scope
   - Domain Context & Architectural Placement
   - Numbered Acceptance Criteria with concrete expected inputs, behaviors, and outputs
   - Assumptions, Boundary Conditions & Invariants
   - Clarifications & Resolved Ambiguities
   - Concrete File & Component Architecture Recommendations (suggest plausible file paths and component modularity)
   - Data Models & TypeScript Schema specifications
   - Security, Auth, and Input Sanitization rules
   - Step-by-Step Agent Execution Sequence
   - Complete Acceptance Criteria Verification Checklist
3. Tailor instructions to the requested preset (fullstack, frontend, backend, or tdd).
4. Be explicit, thorough, and unambiguous so an AI agent can execute without hallucinating missing business logic.
5. Return ONLY the markdown prompt content. Do NOT wrap in conversational greetings or markdown meta-fences.
`;

/**
 * Deeply synthesizes and enriches the story into an AI Agent Prompt using Gemini.
 */
export async function generateGeminiAgentPrompt(input: StoryPromptInput): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Fall back to deterministic prompt if API key not available
    return buildDeterministicAgentPrompt(input);
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const contextData = {
    featureTitle: input.title,
    description: input.description || "None provided",
    epicName: input.epicName || "Core Application",
    epicDescription: input.epicDescription || "",
    acceptanceCriteria: input.acceptanceCriteria,
    assumptions: input.assumptions || [],
    clarifications: input.clarifications || [],
    preset: input.preset || "fullstack",
    techStack: input.techStackHint || "Next.js, TypeScript, Tailwind CSS, Supabase",
  };

  const userPrompt = `Please synthesize an in-depth AI coding agent prompt for this feature story:

${JSON.stringify(contextData, null, 2)}
`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: `${geminiEnhanceSystemPrompt}\n\n${userPrompt}`,
    });

    const text = response.text?.trim();
    if (!text) {
      return buildDeterministicAgentPrompt(input);
    }
    return text;
  } catch (error) {
    console.error("Gemini agent prompt enhancement failed, falling back to deterministic:", error);
    return buildDeterministicAgentPrompt(input);
  }
}

export interface EpicPromptInput {
  epic: {
    name: string;
    description?: string;
  };
  stories: {
    title: string;
    description?: string;
    acceptanceCriteria: string[];
  }[];
  techStackHint?: string;
  preset?: AgentPromptPreset;
}

export function buildDeterministicEpicAgentPrompt(input: EpicPromptInput): string {
  const {
    epic,
    stories,
    techStackHint = "Next.js (App Router), TypeScript, Tailwind CSS, Supabase",
    preset = "fullstack",
  } = input;

  let prompt = `# 🚀 AI Coding Agent Epic Specification: ${epic.name.trim()}\n\n`;

  prompt += `> **Task Objective**: Implement the following Epic, comprising multiple related feature stories, with highest fidelity, strict type-safety, and complete test verification.\n`;
  prompt += `> **Implementation Focus**: ${preset} architecture.\n\n`;

  prompt += `## 1. Epic Overview\n`;
  prompt += `- **Epic Name**: ${epic.name.trim()}\n`;
  if (epic.description?.trim()) {
    prompt += `- **Description**: ${epic.description.trim()}\n`;
  }
  if (techStackHint.trim()) {
    prompt += `- **Target Tech Stack**: ${techStackHint.trim()}\n`;
  }
  prompt += `\n`;

  prompt += `## 2. Feature Stories (${stories.length})\n`;
  prompt += `The implementation must fulfill the following stories and their acceptance criteria:\n\n`;

  stories.forEach((story, idx) => {
    prompt += `### Story ${idx + 1}: ${story.title.trim()}\n`;
    if (story.description?.trim()) {
      prompt += `**Goal**: ${story.description.trim()}\n`;
    }
    if (story.acceptanceCriteria.length > 0) {
      prompt += `**Acceptance Criteria**:\n`;
      story.acceptanceCriteria.forEach((ac, acIdx) => {
        prompt += `- [ ] AC-${idx + 1}.${acIdx + 1}: ${ac.trim()}\n`;
      });
    } else {
      prompt += `*(No specific criteria provided. Implement standard industry best practices).* \n`;
    }
    prompt += `\n`;
  });

  prompt += `## 3. Step-by-Step AI Agent Execution Plan\n`;
  prompt += `1. **Reconnaissance**: Review existing relevant files, types, and components in the repository to maintain architectural consistency.\n`;
  prompt += `2. **Data Contracts & Types**: Define or update TypeScript types/interfaces and validation schemas required across the Epic.\n`;
  prompt += `3. **Backend / Logic**: Implement core endpoints, server actions, or business algorithms with appropriate error handling.\n`;
  prompt += `4. **UI & User Flow**: Build or integrate the interactive UI components, loading states, and feedback toasts.\n`;
  prompt += `5. **Edge Case Hardening**: Ensure resilience against empty inputs, race conditions, and network failures.\n`;
  prompt += `6. **Self-Verification**: Validate the implementation against all acceptance criteria listed above.\n\n`;

  prompt += `## 4. Verification Checklist (Agent Sign-off)\n`;
  prompt += `- [ ] All stories fully implemented and verified\n`;
  prompt += `- [ ] Responsive across screen sizes and accessible\n`;
  prompt += `- [ ] No regression introduced into adjacent modules\n`;
  prompt += `- [ ] Code builds cleanly without TypeScript or lint errors\n`;

  return prompt;
}

const geminiEpicEnhanceSystemPrompt = `
You are a Staff Principal Software Engineer and AI Coding Agent Prompter.
Your task is to take an Epic (Title, Description) and its associated Stories (Titles, Descriptions, Acceptance Criteria) and transform it into an ultra-detailed, highly actionable specification prompt for an autonomous AI coding agent (like Cursor Composer, Claude Code, GitHub Copilot Workspace, Antigravity, or Devin).

REQUIREMENTS FOR YOUR GENERATED PROMPT:
1. Output in pristine GitHub Markdown.
2. Structure the prompt logically:
   - Epic Overview & Scope
   - Feature Breakdown (Stories and their specific ACs)
   - Concrete File & Component Architecture Recommendations for the Epic
   - Data Models & TypeScript Schema specifications
   - Security, Auth, and Input Sanitization rules
   - Step-by-Step Agent Execution Sequence
   - Complete Acceptance Criteria Verification Checklist
3. Tailor instructions to the requested preset (fullstack, frontend, backend, or tdd).
4. Be explicit, thorough, and unambiguous so an AI agent can execute without hallucinating missing business logic.
5. Return ONLY the markdown prompt content. Do NOT wrap in conversational greetings or markdown meta-fences.
`;

export async function generateGeminiEpicAgentPrompt(input: EpicPromptInput): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return buildDeterministicEpicAgentPrompt(input);
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const contextData = {
    epicName: input.epic.name,
    epicDescription: input.epic.description || "None provided",
    stories: input.stories,
    preset: input.preset || "fullstack",
    techStack: input.techStackHint || "Next.js, TypeScript, Tailwind CSS, Supabase",
  };

  const userPrompt = `Please synthesize an in-depth AI coding agent prompt for this Epic and its stories:

${JSON.stringify(contextData, null, 2)}
`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: `${geminiEpicEnhanceSystemPrompt}\n\n${userPrompt}`,
    });

    const text = response.text?.trim();
    if (!text) {
      return buildDeterministicEpicAgentPrompt(input);
    }
    return text;
  } catch (error) {
    console.error("Gemini epic agent prompt enhancement failed, falling back to deterministic:", error);
    return buildDeterministicEpicAgentPrompt(input);
  }
}


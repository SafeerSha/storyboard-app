import { NextResponse } from "next/server";
import {
  generateGeminiEpicAgentPrompt,
  buildDeterministicEpicAgentPrompt,
  type EpicPromptInput,
  type AgentPromptPreset,
} from "@/lib/ai/agent-prompt";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      epic,
      stories,
      techStackHint,
      preset = "fullstack",
      enhanceWithAi = false,
    } = body;

    if (!epic || !epic.name || typeof epic.name !== "string" || !epic.name.trim()) {
      return NextResponse.json(
        { error: "Epic name is required to generate an agent prompt." },
        { status: 400 }
      );
    }

    if (!Array.isArray(stories)) {
      return NextResponse.json(
        { error: "Stories array is required." },
        { status: 400 }
      );
    }

    const input: EpicPromptInput = {
      epic: {
        name: epic.name.trim(),
        description: typeof epic.description === "string" ? epic.description.trim() : "",
      },
      stories: stories.map((s: any) => ({
        title: typeof s.title === "string" ? s.title.trim() : "Untitled Story",
        description: typeof s.description === "string" ? s.description.trim() : "",
        acceptanceCriteria: Array.isArray(s.acceptanceCriteria)
          ? s.acceptanceCriteria.map((c: any) => String(c).trim()).filter(Boolean)
          : [],
      })),
      techStackHint: typeof techStackHint === "string" ? techStackHint.trim() : undefined,
      preset: (["fullstack", "frontend", "backend", "tdd"].includes(preset)
        ? preset
        : "fullstack") as AgentPromptPreset,
    };

    let prompt: string;
    if (enhanceWithAi) {
      prompt = await generateGeminiEpicAgentPrompt(input);
    } else {
      prompt = buildDeterministicEpicAgentPrompt(input);
    }

    return NextResponse.json({
      prompt,
      preset: input.preset,
      enhanced: Boolean(enhanceWithAi),
    });
  } catch (error: any) {
    console.error("Failed to generate AI agent prompt for Epic:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate AI agent prompt for Epic." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import {
  generateGeminiAgentPrompt,
  buildDeterministicAgentPrompt,
  type StoryPromptInput,
  type AgentPromptPreset,
} from "@/lib/ai/agent-prompt";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTeamUser } from "@/lib/team-session";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    // 1. Authenticate caller (Freelancer or Team User)
    const auth = await createClient();
    const {
      data: { user },
    } = await auth.auth.getUser();

    const teamUser = !user ? await getAuthenticatedTeamUser() : null;
    if (!user && !teamUser) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }

    // 2. Abuse prevention rate limiting (max 20 prompt generations per minute)
    const actorId = user ? user.id : teamUser!.id;
    const ip = getClientIp(req);
    const rateLimit = checkRateLimit(`ai-agent-prompt:${actorId}:${ip}`, {
      limit: 20,
      windowSeconds: 60,
    });
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: `Too many AI prompt requests. Please wait ${rateLimit.resetInSeconds} seconds.` },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      title,
      description,
      epicName,
      epicDescription,
      acceptanceCriteria,
      assumptions,
      clarifications,
      techStackHint,
      preset = "fullstack",
      enhanceWithAi = false,
    } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { error: "Story title is required to generate an agent prompt." },
        { status: 400 }
      );
    }

    const input: StoryPromptInput = {
      title: title.trim(),
      description: typeof description === "string" ? description.trim() : "",
      epicName: typeof epicName === "string" ? epicName.trim() : undefined,
      epicDescription: typeof epicDescription === "string" ? epicDescription.trim() : undefined,
      acceptanceCriteria: Array.isArray(acceptanceCriteria)
        ? acceptanceCriteria.map((c) => String(c).trim()).filter(Boolean)
        : [],
      assumptions: Array.isArray(assumptions)
        ? assumptions.map((a) => String(a).trim()).filter(Boolean)
        : [],
      clarifications: Array.isArray(clarifications)
        ? clarifications.map((c) => String(c).trim()).filter(Boolean)
        : [],
      techStackHint: typeof techStackHint === "string" ? techStackHint.trim() : undefined,
      preset: (["fullstack", "frontend", "backend", "tdd"].includes(preset)
        ? preset
        : "fullstack") as AgentPromptPreset,
    };

    let prompt: string;
    if (enhanceWithAi) {
      prompt = await generateGeminiAgentPrompt(input);
    } else {
      prompt = buildDeterministicAgentPrompt(input);
    }

    return NextResponse.json({
      prompt,
      preset: input.preset,
      enhanced: Boolean(enhanceWithAi),
    });
  } catch (error: any) {
    console.error("Failed to generate AI agent prompt:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate AI agent prompt." },
      { status: 500 }
    );
  }
}

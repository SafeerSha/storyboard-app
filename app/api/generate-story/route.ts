import { NextResponse } from "next/server";
import { generateStory } from "@/lib/ai/gemini";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const requirement = String(body.requirement || "").trim();
    if (!requirement) return NextResponse.json({ error: "Requirement is required." }, { status: 400 });
    if (requirement.length > 5000) return NextResponse.json({ error: "Requirement is too long." }, { status: 400 });

    const story = await generateStory(requirement);
    return NextResponse.json(story);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not generate the story. Check your Gemini configuration and try again." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { generateStories } from "@/lib/ai/gemini";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        }
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const requirement = String(body.requirement || "").trim();
    const projectId = String(body.projectId || "");
    const epicId = String(body.epicId || "");

    if (!requirement) return NextResponse.json({ error: "Requirement is required." }, { status: 400 });
    if (!projectId || !epicId) return NextResponse.json({ error: "Project and Epic are required." }, { status: 400 });
    if (requirement.length > 5000) return NextResponse.json({ error: "Requirement is too long." }, { status: 400 });

    // Validate ownership
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("owner_id", user.id)
      .single();

    if (!project) return NextResponse.json({ error: "Project not found or unauthorized." }, { status: 403 });

    const { data: epic } = await supabase
      .from("epics")
      .select("id")
      .eq("id", epicId)
      .eq("project_id", projectId)
      .single();

    if (!epic) return NextResponse.json({ error: "Epic not found or unauthorized." }, { status: 403 });

    // Generate stories using AI
    const result = await generateStories(requirement);
    
    if (!result.stories || !Array.isArray(result.stories) || result.stories.length === 0) {
      return NextResponse.json({ error: "AI failed to generate stories." }, { status: 500 });
    }

    // Atomic Bulk Insert
    const adminDb = createAdminClient();
    
    const storiesToInsert = result.stories.map((story) => ({
      project_id: projectId,
      epic_id: epicId,
      title: story.title,
      description: story.description,
      acceptance_criteria: story.acceptanceCriteria,
      assumptions: story.assumptions,
      clarifications: story.clarifications,
      status: story.status || "draft",
      raw_requirement: requirement,
    }));

    const { data: insertedStories, error: insertError } = await adminDb
      .from("stories")
      .insert(storiesToInsert)
      .select();

    if (insertError) {
      console.error("Bulk insert error:", insertError);
      return NextResponse.json({ error: "Failed to save the generated stories." }, { status: 500 });
    }

    return NextResponse.json({ stories: insertedStories });
  } catch (error) {
    console.error("Story generation error:", error);
    return NextResponse.json({ error: "Could not generate the stories. Check your Gemini configuration and try again." }, { status: 500 });
  }
}

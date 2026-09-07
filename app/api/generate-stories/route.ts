import { NextResponse } from "next/server";
import { generateStories } from "@/lib/ai/gemini";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedTeamUser } from "@/lib/team-session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const requirement = String(body.requirement || "").trim();
    let projectId = String(body.projectId || "");
    const epicId = String(body.epicId || "");

    if (!requirement) return NextResponse.json({ error: "Requirement is required." }, { status: 400 });
    if (!epicId) return NextResponse.json({ error: "Epic is required." }, { status: 400 });
    if (requirement.length > 5000) return NextResponse.json({ error: "Requirement is too long." }, { status: 400 });

    const adminDb = createAdminClient();
    let isAuthorized = false;

    // 1. Check if authenticated as Team User
    const teamUser = await getAuthenticatedTeamUser();
    if (teamUser) {
      // Force projectId to assigned project
      projectId = teamUser.project_id;
      isAuthorized = true;
    }

    // 2. Check if authenticated as Freelancer / Super Admin
    if (!isAuthorized) {
      const cookieStore = await cookies();
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
          cookies: {
            getAll: () => cookieStore.getAll(),
            setAll: () => {},
          },
        }
      );

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Check super admin or project ownership
        const { data: profile } = await adminDb
          .from("freelancer_profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.role === "super_admin") {
          isAuthorized = true;
        } else {
          const { data: project } = await adminDb
            .from("projects")
            .select("id")
            .eq("id", projectId)
            .eq("owner_id", user.id)
            .maybeSingle();

          if (project) isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized or project access denied." }, { status: 403 });
    }

    // Validate that the epic belongs to this project
    const { data: epic } = await adminDb
      .from("epics")
      .select("id")
      .eq("id", epicId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (!epic) {
      return NextResponse.json({ error: "Epic not found or does not belong to project." }, { status: 403 });
    }

    // Generate stories using AI
    const result = await generateStories(requirement);

    if (!result.stories || !Array.isArray(result.stories) || result.stories.length === 0) {
      return NextResponse.json({ error: "AI failed to generate stories." }, { status: 500 });
    }

    // Mapped stories for current epic
    const storiesToProcess = result.stories.map((story) => ({
      project_id: projectId,
      epic_id: epicId,
      title: story.title,
      description: story.description,
      acceptance_criteria: story.acceptanceCriteria || [],
      assumptions: story.assumptions || [],
      clarifications: story.clarifications || [],
      status: story.status || "draft",
      raw_requirement: requirement,
    }));

    // If caller requested preview without saving immediately
    if (body.save === false) {
      return NextResponse.json({ stories: storiesToProcess });
    }

    const { data: insertedStories, error: insertError } = await adminDb
      .from("stories")
      .insert(storiesToProcess)
      .select();

    if (insertError) {
      console.error("Bulk insert error:", insertError);
      return NextResponse.json({ error: "Failed to save the generated stories." }, { status: 500 });
    }

    return NextResponse.json({ stories: insertedStories });
  } catch (error) {
    console.error("Story generation error:", error);
    return NextResponse.json(
      { error: "Could not generate stories. Check your Gemini configuration and try again." },
      { status: 500 }
    );
  }
}

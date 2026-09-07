import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedTeamUser } from "@/lib/team-session";
import { isTeamUserProjectMember } from "@/lib/story-reviewer-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const teamUser = await getAuthenticatedTeamUser();
  if (!teamUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const requestedProjectId = searchParams.get("projectId") || undefined;

  const db = createAdminClient();

  // Resolve active project ID with multi-project membership verification
  let activeProjectId = teamUser.project_id;
  if (requestedProjectId) {
    const isMember =
      requestedProjectId === teamUser.project_id ||
      (await isTeamUserProjectMember(teamUser.id, requestedProjectId));
    if (isMember) {
      activeProjectId = requestedProjectId;
    }
  }

  if (!activeProjectId) {
    const { data: firstMembership } = await db
      .from("project_team_members")
      .select("project_id")
      .eq("team_user_id", teamUser.id)
      .limit(1)
      .maybeSingle();
    activeProjectId = firstMembership?.project_id || "";
  }

  if (!activeProjectId) {
    return NextResponse.json({ epics: [] });
  }

  try {
    // Parallel fetch: epics sorted by created_at DESC, and story epic_ids for aggregate counts
    const [{ data: epicsData, error: epicsError }, { data: storyRows, error: storiesError }] =
      await Promise.all([
        db
          .from("epics")
          .select("id, name, description, created_at")
          .eq("project_id", activeProjectId)
          .order("created_at", { ascending: false }),
        db
          .from("stories")
          .select("epic_id")
          .eq("project_id", activeProjectId),
      ]);

    if (epicsError) throw epicsError;
    if (storiesError) throw storiesError;

    // Count stories per epic
    const countsMap: Record<string, number> = {};
    (storyRows || []).forEach((s) => {
      if (s.epic_id) {
        countsMap[s.epic_id] = (countsMap[s.epic_id] || 0) + 1;
      }
    });

    const epics = (epicsData || []).map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      created_at: e.created_at,
      storyCount: countsMap[e.id] || 0,
    }));

    return NextResponse.json({ epics });
  } catch (err: unknown) {
    console.error("Failed to fetch team epics:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load epics" },
      { status: 500 }
    );
  }
}

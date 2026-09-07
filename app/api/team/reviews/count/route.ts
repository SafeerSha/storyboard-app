import { NextResponse } from "next/server";
import { getAuthenticatedTeamUser } from "@/lib/team-session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const teamUser = await getAuthenticatedTeamUser();
  if (!teamUser) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();

  // 1. Get all active projects the user belongs to
  const { data: memberships } = await admin
    .from("project_team_members")
    .select("project_id")
    .eq("team_user_id", teamUser.id);

  const projectIds = Array.from(
    new Set((memberships || []).map((m) => m.project_id).filter(Boolean))
  );

  // Fallback for legacy assignment if not yet backfilled
  if (projectIds.length === 0 && teamUser.project_id) {
    projectIds.push(teamUser.project_id);
  }

  if (projectIds.length === 0) {
    return NextResponse.json({ count: 0 });
  }

  // 2. Count actionable review stories assigned to this reviewer
  const { count, error } = await admin
    .from("story_reviewers")
    .select("story_id, stories!inner(id, project_id, team_review_status)", {
      count: "exact",
      head: true,
    })
    .eq("team_user_id", teamUser.id)
    .in("stories.project_id", projectIds)
    .in("stories.team_review_status", ["pending", "changes_requested"]);

  if (error) {
    console.error("Failed to fetch pending review count:", error);
    return NextResponse.json({ count: 0 });
  }

  return NextResponse.json({ count: count || 0 });
}

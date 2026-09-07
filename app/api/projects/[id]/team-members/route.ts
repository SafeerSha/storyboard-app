import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedTeamUser } from "@/lib/team-session";
import { isTeamUserProjectMember } from "@/lib/story-reviewer-auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  if (!projectId) {
    return NextResponse.json({ error: "Project ID is required." }, { status: 400 });
  }

  const admin = createAdminClient();
  let isAuthorized = false;

  // 1. Team User authorization
  const teamUser = await getAuthenticatedTeamUser();
  if (teamUser) {
    const isMember = await isTeamUserProjectMember(teamUser.id, projectId);
    if (isMember || teamUser.project_id === projectId) {
      isAuthorized = true;
    }
  }

  // 2. Freelancer / Super Admin authorization
  if (!isAuthorized) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await admin
        .from("freelancer_profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.role === "super_admin") {
        isAuthorized = true;
      } else {
        const { data: project } = await admin
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
    return NextResponse.json({ error: "Unauthorized or access denied." }, { status: 403 });
  }

  // Query project_team_members joined with team_users
  const memberMap = new Map<string, { id: string; name: string; username: string; role: string }>();

  const { data: records, error } = await admin
    .from("project_team_members")
    .select(`
      team_user_id,
      team_user:team_users!inner (
        id,
        name,
        username,
        role,
        status
      )
    `)
    .eq("project_id", projectId)
    .eq("team_users.status", "active");

  if (!error && records) {
    for (const r of records) {
      const u = (r as any).team_user;
      if (u && u.id && u.status === "active") {
        memberMap.set(u.id, {
          id: u.id,
          name: u.name,
          username: u.username,
          role: u.role || "member",
        });
      }
    }
  }

  // Seamless fallback for legacy unmigrated rows
  const { data: legacyUsers } = await admin
    .from("team_users")
    .select("id, name, username, role, status")
    .eq("project_id", projectId)
    .eq("status", "active");

  if (legacyUsers) {
    for (const u of legacyUsers) {
      if (!memberMap.has(u.id)) {
        memberMap.set(u.id, {
          id: u.id,
          name: u.name,
          username: u.username,
          role: (u as any).role || "member",
        });
      }
    }
  }

  const teamMembers = Array.from(memberMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return NextResponse.json({
    teamMembers,
    members: teamMembers,
  });
}

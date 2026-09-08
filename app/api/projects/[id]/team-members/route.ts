import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedTeamUser } from "@/lib/team-session";
import { isTeamUserProjectMember, syncFreelancerToTeam } from "@/lib/story-reviewer-auth";

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

  const memberMap = new Map<string, { id: string; name: string; username: string; role: string }>();

  // 3. Include Project Creator / Owner and Super Admins from freelancer_profiles
  try {
    const profileIds = new Set<string>();
    const { data: project } = await admin
      .from("projects")
      .select("id, owner_id")
      .eq("id", projectId)
      .maybeSingle();

    if (project?.owner_id) {
      profileIds.add(project.owner_id);
    }

    const { data: superAdmins } = await admin
      .from("freelancer_profiles")
      .select("id, name, email, role, status")
      .eq("role", "super_admin")
      .eq("status", "active");

    (superAdmins || []).forEach((sa) => profileIds.add(sa.id));

    if (profileIds.size > 0) {
      const { data: profiles } = await admin
        .from("freelancer_profiles")
        .select("id, name, email, role, status")
        .in("id", Array.from(profileIds))
        .eq("status", "active");

      for (const p of profiles || []) {
        const roleTitle = p.role === "super_admin" ? "Super Admin" : "Project Creator";
        try {
          const synced = await syncFreelancerToTeam(admin, p, projectId);
          memberMap.set(p.id, {
            id: p.id,
            name: synced.name,
            username: synced.username,
            role: roleTitle,
          });
        } catch (syncErr) {
          console.error("Failed to sync freelancer to team_users:", syncErr);
          memberMap.set(p.id, {
            id: p.id,
            name: p.name || roleTitle,
            username: p.email ? p.email.split("@")[0] : "admin",
            role: roleTitle,
          });
        }
      }
    }
  } catch (err) {
    console.error("Failed to fetch project creator or super admin profiles:", err);
  }

  // 4. Query project_team_members joined with team_users
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
        if (!memberMap.has(u.id)) {
          memberMap.set(u.id, {
            id: u.id,
            name: u.name,
            username: u.username,
            role: u.role || "member",
          });
        }
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

  // Sort: Super Admin & Project Creator first, then alphabetically
  const teamMembers = Array.from(memberMap.values()).sort((a, b) => {
    const aIsAdminOrOwner = a.role === "Super Admin" || a.role === "Project Creator";
    const bIsAdminOrOwner = b.role === "Super Admin" || b.role === "Project Creator";
    if (aIsAdminOrOwner && !bIsAdminOrOwner) return -1;
    if (!aIsAdminOrOwner && bIsAdminOrOwner) return 1;
    return a.name.localeCompare(b.name);
  });

  return NextResponse.json({
    teamMembers,
    members: teamMembers,
  });
}

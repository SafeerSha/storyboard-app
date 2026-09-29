import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeProjectMember } from "@/lib/project-auth";
import type { TaskAssigneeOption } from "@/lib/types/task";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const admin = createAdminClient();

    // 1. Verify project exists
    const { data: project, error: projErr } = await admin
      .from("projects")
      .select("id, name, owner_id")
      .eq("id", projectId)
      .maybeSingle();

    if (projErr || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const assignees: TaskAssigneeOption[] = [];
    const seenIds = new Set<string>();

    const addAssignee = (opt: TaskAssigneeOption) => {
      if (!opt.id || seenIds.has(opt.id)) return;
      seenIds.add(opt.id);
      assignees.push(opt);
    };

    // 2. Fetch Project Owner (Freelancer/Super Admin)
    if (project.owner_id) {
      const { data: ownerProfile } = await admin
        .from("freelancer_profiles")
        .select("id, name, email, role")
        .eq("id", project.owner_id)
        .maybeSingle();

      if (ownerProfile) {
        addAssignee({
          id: ownerProfile.id,
          name: ownerProfile.name || ownerProfile.email.split("@")[0] || "Project Owner",
          type: "freelancer",
          email: ownerProfile.email,
          role: ownerProfile.role === "super_admin" ? "Super Admin" : "Owner / Freelancer",
        });
      }
    }

    // 3. Fetch Team Members connected to this project
    // Check both project_team_members and legacy team_users.project_id
    const [ptmRes, legacyTeamRes] = await Promise.all([
      admin
        .from("project_team_members")
        .select("team_user_id, team_users:team_users(id, name, username, role, status)")
        .eq("project_id", projectId),
      admin
        .from("team_users")
        .select("id, name, username, role, status")
        .eq("project_id", projectId),
    ]);

    if (ptmRes.data) {
      for (const row of ptmRes.data) {
        const u = (row as any).team_users;
        if (u && u.status !== "disabled") {
          addAssignee({
            id: u.id,
            name: u.name,
            type: "team_user",
            email: u.username?.includes("@") ? u.username : null,
            username: u.username,
            role: u.role || "Team Member",
          });
        }
      }
    }

    if (legacyTeamRes.data) {
      for (const u of legacyTeamRes.data) {
        if (u && u.status !== "disabled") {
          addAssignee({
            id: u.id,
            name: u.name,
            type: "team_user",
            email: u.username?.includes("@") ? u.username : null,
            username: u.username,
            role: u.role || "Team Member",
          });
        }
      }
    }

    // 4. Fetch Clients connected to this project
    const { data: clients } = await admin
      .from("clients")
      .select("id, name, login_id, email, status")
      .eq("project_id", projectId)
      .neq("status", "disabled");

    if (clients) {
      for (const c of clients) {
        addAssignee({
          id: c.id,
          name: c.name,
          type: "client",
          email: c.email || null,
          loginId: c.login_id,
          role: "Client",
        });
      }
    }

    return NextResponse.json({ assignees });
  } catch (err: any) {
    console.error("GET /api/projects/[id]/assignees error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch assignees" }, { status: 500 });
  }
}

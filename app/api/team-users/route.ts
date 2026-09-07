import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySuperAdmin } from "@/lib/super-admin";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await verifySuperAdmin();
  if (!admin) {
    return new NextResponse("Unauthorized. Super Admin access required.", { status: 403 });
  }

  const adminClient = createAdminClient();
  const { data: users, error } = await adminClient
    .from("team_users")
    .select("id, project_id, name, username, role, status, created_at, updated_at, projects(id, name)")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const userList = users || [];
  const userIds = userList.map((u) => u.id);

  // Fetch all project_team_members joined with projects
  const memberMap: Record<string, Array<{ id: string; name: string }>> = {};
  if (userIds.length > 0) {
    const { data: memberships } = await adminClient
      .from("project_team_members")
      .select("team_user_id, project_id, projects(id, name)")
      .in("team_user_id", userIds);

    (memberships || []).forEach((m: any) => {
      if (!memberMap[m.team_user_id]) memberMap[m.team_user_id] = [];
      if (m.projects) {
        memberMap[m.team_user_id].push({
          id: m.project_id,
          name: m.projects.name,
        });
      }
    });
  }

  const enrichedUsers = userList.map((u: any) => {
    let projs = memberMap[u.id] || [];
    // Backwards compatibility fallback if not yet in project_team_members
    if (projs.length === 0 && u.project_id && u.projects?.name) {
      projs = [{ id: u.project_id, name: u.projects.name }];
    }
    return {
      ...u,
      project_ids: projs.map((p) => p.id),
      assigned_projects: projs,
      projects: projs.length > 0 ? { name: projs.map((p) => p.name).join(", ") } : null,
    };
  });

  return NextResponse.json({ users: enrichedUsers });
}

export async function POST(req: Request) {
  const admin = await verifySuperAdmin();
  if (!admin) {
    return new NextResponse("Unauthorized. Super Admin access required.", { status: 403 });
  }

  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    const role = String(body.role || "member").trim();
    const status = body.status === "disabled" ? "disabled" : "active";

    const rawProjectIds = body.projectIds || (body.projectId ? [body.projectId] : []);
    const projectIds = Array.isArray(rawProjectIds)
      ? Array.from(new Set(rawProjectIds.map(String).map((s) => s.trim()).filter(Boolean)))
      : [];

    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    if (!username || username.length < 3) {
      return NextResponse.json({ error: "Username must be at least 3 characters long." }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
      return NextResponse.json({ error: "Username may only contain letters, numbers, hyphens, periods, or underscores." }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters long." }, { status: 400 });
    }
    if (projectIds.length === 0) {
      return NextResponse.json({ error: "At least one project must be assigned." }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Verify all projects exist in database
    const { data: validProjects, error: projectError } = await adminClient
      .from("projects")
      .select("id, name")
      .in("id", projectIds);

    if (projectError || !validProjects || validProjects.length !== projectIds.length) {
      return NextResponse.json({ error: "One or more selected projects were not found in the database." }, { status: 400 });
    }

    // Hash password securely with bcrypt
    const passwordHash = await bcrypt.hash(password, 12);

    // Insert into team_users
    const { data: newUser, error: insertError } = await adminClient
      .from("team_users")
      .insert({
        name,
        username,
        password_hash: passwordHash,
        project_id: projectIds[0], // primary/legacy project fallback
        role,
        status,
      })
      .select("id, project_id, name, username, role, status, created_at, updated_at")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json({ error: `Username '${username}' is already taken. Please choose another.` }, { status: 400 });
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Insert all project memberships into project_team_members
    const ptmRows = projectIds.map((pid) => ({
      project_id: pid,
      team_user_id: newUser.id,
      assigned_by: admin.id,
    }));
    await adminClient.from("project_team_members").insert(ptmRows);

    // Audit log
    await logAudit({
      action: "team_user_created",
      actorId: admin.id,
      actorType: "super_admin",
      actorName: admin.name,
      targetType: "team_user",
      targetId: newUser.id,
      details: {
        username: newUser.username,
        name: newUser.name,
        projectIds,
        projectNames: validProjects.map((p) => p.name),
        status: newUser.status,
      },
    });

    const assignedProjects = validProjects.map((p) => ({ id: p.id, name: p.name }));

    return NextResponse.json(
      {
        success: true,
        user: {
          ...newUser,
          project_ids: projectIds,
          assigned_projects: assignedProjects,
          projects: { name: assignedProjects.map((p) => p.name).join(", ") },
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create team user." }, { status: 500 });
  }
}

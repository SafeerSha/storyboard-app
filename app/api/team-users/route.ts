import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAnyFreelancer } from "@/lib/super-admin";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await verifyAnyFreelancer();
  if (!actor) {
    return new NextResponse("Unauthorized. Please log in.", { status: 401 });
  }

  const adminClient = createAdminClient();

  // Scope to only this actor's own team members
  const { data: users, error } = await adminClient
    .from("team_users")
    .select("id, project_id, name, username, role, status, created_at, updated_at, projects(id, name)")
    .eq("owner_id", actor.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const userList = users || [];
  const userIds = userList.map((u) => u.id);

  // Fetch project memberships for this actor's team members
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
  const actor = await verifyAnyFreelancer();
  if (!actor) {
    return new NextResponse("Unauthorized. Please log in.", { status: 401 });
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

    // Verify all projects exist AND belong to this actor
    const { data: validProjects, error: projectError } = await adminClient
      .from("projects")
      .select("id, name")
      .in("id", projectIds)
      .eq("owner_id", actor.id);

    if (projectError || !validProjects || validProjects.length !== projectIds.length) {
      return NextResponse.json({ error: "One or more selected projects were not found or do not belong to you." }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Insert into team_users with owner_id scoped to this actor
    const { data: newUser, error: insertError } = await adminClient
      .from("team_users")
      .insert({
        owner_id: actor.id,
        name,
        username,
        password_hash: passwordHash,
        project_id: projectIds[0],
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

    // Insert all project memberships
    const ptmRows = projectIds.map((pid) => ({
      project_id: pid,
      team_user_id: newUser.id,
      assigned_by: actor.id,
    }));
    await adminClient.from("project_team_members").insert(ptmRows);

    await logAudit({
      action: "team_user_created",
      actorId: actor.id,
      actorType: actor.isSuperAdmin ? "super_admin" : "freelancer",
      actorName: actor.name,
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

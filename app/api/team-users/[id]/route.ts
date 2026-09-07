import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySuperAdmin } from "@/lib/super-admin";
import { invalidateAllTeamSessions } from "@/lib/team-session";
import { logAudit } from "@/lib/audit";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifySuperAdmin();
  if (!admin) {
    return new NextResponse("Unauthorized. Super Admin access required.", { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const adminClient = createAdminClient();

    // Check existing team user
    const { data: existingUser, error: fetchError } = await adminClient
      .from("team_users")
      .select("id, name, username, project_id, status")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !existingUser) {
      return NextResponse.json({ error: "Team user not found." }, { status: 404 });
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 });
      updates.name = name;
    }

    if (body.projectIds !== undefined || body.projectId !== undefined) {
      const rawProjectIds = body.projectIds !== undefined
        ? body.projectIds
        : (body.projectId ? [body.projectId] : []);
      const projectIds = Array.isArray(rawProjectIds)
        ? Array.from(new Set(rawProjectIds.map(String).map((s) => s.trim()).filter(Boolean)))
        : [];

      if (projectIds.length === 0) {
        return NextResponse.json({ error: "At least one project must be assigned." }, { status: 400 });
      }

      // Verify all projects exist
      const { data: validProjects, error: projErr } = await adminClient
        .from("projects")
        .select("id, name")
        .in("id", projectIds);

      if (projErr || !validProjects || validProjects.length !== projectIds.length) {
        return NextResponse.json({ error: "One or more selected projects do not exist." }, { status: 400 });
      }

      // Sync project_team_members
      await adminClient.from("project_team_members").delete().eq("team_user_id", id);
      const ptmRows = projectIds.map((pid) => ({
        project_id: pid,
        team_user_id: id,
        assigned_by: admin.id,
      }));
      await adminClient.from("project_team_members").insert(ptmRows);

      updates.project_id = projectIds[0]; // fallback primary project
    }

    if (body.role !== undefined) {
      updates.role = String(body.role).trim() || "member";
    }

    if (body.status !== undefined) {
      if (body.status !== "active" && body.status !== "disabled") {
        return NextResponse.json({ error: "Status must be 'active' or 'disabled'." }, { status: 400 });
      }
      updates.status = body.status;
    }

    const { data: updatedUser, error: updateError } = await adminClient
      .from("team_users")
      .update(updates)
      .eq("id", id)
      .select("id, project_id, name, username, role, status, created_at, updated_at")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Fetch all current project memberships for user
    const { data: currentMemberships } = await adminClient
      .from("project_team_members")
      .select("project_id, projects(id, name)")
      .eq("team_user_id", id);

    const assignedProjects = (currentMemberships || [])
      .filter((m: any) => m.projects)
      .map((m: any) => ({
        id: m.project_id,
        name: m.projects.name,
      }));

    // If disabled, immediately invalidate all active sessions
    if (updates.status === "disabled") {
      await invalidateAllTeamSessions(id);
      await logAudit({
        action: "team_user_disabled",
        actorId: admin.id,
        actorType: "super_admin",
        actorName: admin.name,
        targetType: "team_user",
        targetId: id,
        details: { username: existingUser.username },
      });
    } else if (updates.status === "active" && existingUser.status === "disabled") {
      await logAudit({
        action: "team_user_enabled",
        actorId: admin.id,
        actorType: "super_admin",
        actorName: admin.name,
        targetType: "team_user",
        targetId: id,
        details: { username: existingUser.username },
      });
    }

    await logAudit({
      action: "team_user_updated",
      actorId: admin.id,
      actorType: "super_admin",
      actorName: admin.name,
      targetType: "team_user",
      targetId: id,
      details: {
        username: existingUser.username,
        name: updatedUser.name,
        assignedProjects: assignedProjects.map((p) => p.name),
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        ...updatedUser,
        project_ids: assignedProjects.map((p) => p.id),
        assigned_projects: assignedProjects,
        projects: { name: assignedProjects.map((p) => p.name).join(", ") },
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update team user." }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifySuperAdmin();
  if (!admin) {
    return new NextResponse("Unauthorized. Super Admin access required.", { status: 403 });
  }

  const { id } = await params;

  try {
    const adminClient = createAdminClient();

    // Check existing team user
    const { data: existingUser, error: fetchError } = await adminClient
      .from("team_users")
      .select("id, name, username")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !existingUser) {
      return NextResponse.json({ error: "Team user not found." }, { status: 404 });
    }

    // Invalidate sessions first
    await invalidateAllTeamSessions(id);

    // Delete team user
    const { error: deleteError } = await adminClient
      .from("team_users")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    await logAudit({
      action: "team_user_deleted",
      actorId: admin.id,
      actorType: "super_admin",
      actorName: admin.name,
      targetType: "team_user",
      targetId: id,
      details: { username: existingUser.username, name: existingUser.name },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete team user." }, { status: 500 });
  }
}


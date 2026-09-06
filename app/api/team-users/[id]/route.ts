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

    if (body.projectId !== undefined) {
      const projectId = String(body.projectId).trim();
      if (!projectId) return NextResponse.json({ error: "Project cannot be empty." }, { status: 400 });

      // Verify project exists
      const { data: proj, error: projErr } = await adminClient
        .from("projects")
        .select("id, name")
        .eq("id", projectId)
        .maybeSingle();

      if (projErr || !proj) {
        return NextResponse.json({ error: "Selected project does not exist." }, { status: 400 });
      }

      updates.project_id = projectId;
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
      .select("id, project_id, name, username, status, created_at, updated_at, projects(name)")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

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

    // If project changed, log project reassignment
    if (updates.project_id && updates.project_id !== existingUser.project_id) {
      await logAudit({
        action: "team_user_project_changed",
        actorId: admin.id,
        actorType: "super_admin",
        actorName: admin.name,
        targetType: "team_user",
        targetId: id,
        details: {
          username: existingUser.username,
          oldProjectId: existingUser.project_id,
          newProjectId: updates.project_id,
        },
      });
    }

    return NextResponse.json({ success: true, user: updatedUser });
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


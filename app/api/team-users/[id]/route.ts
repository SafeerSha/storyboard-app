import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAnyFreelancer } from "@/lib/super-admin";
import { invalidateAllTeamSessions } from "@/lib/team-session";
import { logAudit } from "@/lib/audit";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await verifyAnyFreelancer();
  if (!actor) {
    return new NextResponse("Unauthorized. Please log in.", { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const adminClient = createAdminClient();

    // Verify team user exists (scoped by owner_id for non-super-admins)
    let userQuery = adminClient
      .from("team_users")
      .select("id, name, username, project_id, status, owner_id")
      .eq("id", id);
    if (!actor.isSuperAdmin) {
      userQuery = userQuery.eq("owner_id", actor.id);
    }
    const { data: existingUser, error: fetchError } = await userQuery.maybeSingle();

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
        ? Array.from(new Set(rawProjectIds.map(String).map((s: string) => s.trim()).filter(Boolean)))
        : [];

      if (projectIds.length === 0) {
        return NextResponse.json({ error: "At least one project must be assigned." }, { status: 400 });
      }

      // Verify all projects exist (and belong to actor if not super admin)
      let projectQuery = adminClient
        .from("projects")
        .select("id, name")
        .in("id", projectIds);
      if (!actor.isSuperAdmin) {
        projectQuery = projectQuery.eq("owner_id", actor.id);
      }
      const { data: validProjects, error: projErr } = await projectQuery;

      if (projErr || !validProjects || validProjects.length !== projectIds.length) {
        return NextResponse.json({
          error: actor.isSuperAdmin
            ? "One or more selected projects were not found."
            : "One or more selected projects do not belong to you.",
        }, { status: 400 });
      }

      // Sync project_team_members
      await adminClient.from("project_team_members").delete().eq("team_user_id", id);
      const ptmRows = projectIds.map((pid) => ({
        project_id: pid,
        team_user_id: id,
        assigned_by: actor.id,
      }));
      await adminClient.from("project_team_members").insert(ptmRows);

      updates.project_id = projectIds[0];
    }

    if (body.email !== undefined) {
      const emailRaw = body.email ? String(body.email).trim().toLowerCase() : null;
      const email = emailRaw && emailRaw.length > 0 ? emailRaw : null;
      if (email && (!email.includes("@") || !email.includes("."))) {
        return NextResponse.json({ error: "Invalid email address format." }, { status: 400 });
      }
      updates.email = email;
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

    let { data: updatedUser, error: updateError } = await adminClient
      .from("team_users")
      .update(updates)
      .eq("id", id)
      .select("id, project_id, name, username, email, role, status, created_at, updated_at")
      .single();

    if (updateError && (updateError.code === "42703" || updateError.message?.includes("email"))) {
      const safeUpdates = { ...updates };
      delete safeUpdates.email;
      const fallbackUpdate = await adminClient
        .from("team_users")
        .update(safeUpdates)
        .eq("id", id)
        .select("id, project_id, name, username, role, status, created_at, updated_at")
        .single();
      updatedUser = fallbackUpdate.data ? { ...fallbackUpdate.data, email: updates.email || null } : null;
      updateError = fallbackUpdate.error;
    }

    if (updateError || !updatedUser) {
      return NextResponse.json({ error: updateError?.message || "Failed to update team user." }, { status: 500 });
    }

    const { data: currentMemberships } = await adminClient
      .from("project_team_members")
      .select("project_id, projects(id, name)")
      .eq("team_user_id", id);

    const rawAssigned = (currentMemberships || [])
      .filter((m: any) => m.projects)
      .map((m: any) => ({
        id: m.project_id,
        name: m.projects.name,
      }));
    const assignedProjects = Array.from(new Map(rawAssigned.map((p: any) => [p.id, p])).values());

    if (updates.status === "disabled") {
      await invalidateAllTeamSessions(id);
      await logAudit({
        action: "team_user_disabled",
        actorId: actor.id,
        actorType: actor.isSuperAdmin ? "super_admin" : "freelancer",
        actorName: actor.name,
        targetType: "team_user",
        targetId: id,
        details: { username: existingUser.username },
      });
    } else if (updates.status === "active" && existingUser.status === "disabled") {
      await logAudit({
        action: "team_user_enabled",
        actorId: actor.id,
        actorType: actor.isSuperAdmin ? "super_admin" : "freelancer",
        actorName: actor.name,
        targetType: "team_user",
        targetId: id,
        details: { username: existingUser.username },
      });
    }

    await logAudit({
      action: "team_user_updated",
      actorId: actor.id,
      actorType: actor.isSuperAdmin ? "super_admin" : "freelancer",
      actorName: actor.name,
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
  const actor = await verifyAnyFreelancer();
  if (!actor) {
    return new NextResponse("Unauthorized. Please log in.", { status: 401 });
  }

  const { id } = await params;

  try {
    const adminClient = createAdminClient();

    // Verify team user exists (scoped by owner_id for non-super-admins)
    let deleteQuery = adminClient
      .from("team_users")
      .select("id, name, username, owner_id")
      .eq("id", id);
    if (!actor.isSuperAdmin) {
      deleteQuery = deleteQuery.eq("owner_id", actor.id);
    }
    const { data: existingUser, error: fetchError } = await deleteQuery.maybeSingle();

    if (fetchError || !existingUser) {
      return NextResponse.json({ error: "Team user not found." }, { status: 404 });
    }

    await invalidateAllTeamSessions(id);

    const { error: deleteError } = await adminClient
      .from("team_users")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    await logAudit({
      action: "team_user_deleted",
      actorId: actor.id,
      actorType: actor.isSuperAdmin ? "super_admin" : "freelancer",
      actorName: actor.name,
      targetType: "team_user",
      targetId: id,
      details: { username: existingUser.username, name: existingUser.name },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete team user." }, { status: 500 });
  }
}

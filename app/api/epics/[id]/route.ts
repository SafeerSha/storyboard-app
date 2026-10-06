import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedTeamUser } from "@/lib/team-session";
import { isTeamUserProjectMember } from "@/lib/story-reviewer-auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: epicId } = await params;
    const body = await req.json();
    const admin = createAdminClient();

    // Check existing epic
    const { data: epic } = await admin
      .from("epics")
      .select("id, project_id, description, projects(owner_id)")
      .eq("id", epicId)
      .maybeSingle();

    if (!epic) {
      return NextResponse.json({ error: "Epic not found." }, { status: 404 });
    }

    let isAuthorized = false;

    // 1. Team User authorization
    const teamUser = await getAuthenticatedTeamUser();
    if (teamUser) {
      const isMember =
        teamUser.project_id === epic.project_id ||
        (await isTeamUserProjectMember(teamUser.id, epic.project_id));
      if (isMember) {
        isAuthorized = true;
      }
    }

    // 2. Freelancer / Super Admin authorization
    if (!isAuthorized) {
      const auth = await createClient();
      const {
        data: { user },
      } = await auth.auth.getUser();

      if (user) {
        const { data: profile } = await admin
          .from("freelancer_profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.role === "super_admin") {
          isAuthorized = true;
        } else {
          const projectData = Array.isArray(epic.projects) ? epic.projects[0] : epic.projects;
          if ((projectData as any)?.owner_id === user.id) {
            isAuthorized = true;
          }
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized or project access denied." }, { status: 403 });
    }

    const updateData: any = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) updateData.name = String(body.name).trim();
    if (body.description !== undefined) updateData.description = String(body.description).trim();
    if (body.status !== undefined) updateData.status = String(body.status).trim();
    if (body.sortOrder !== undefined) updateData.sort_order = Number(body.sortOrder);
    
    let requestedPriority: "low" | "medium" | "high" | null = null;
    if (body.priority !== undefined) {
      const p = String(body.priority).toLowerCase().trim();
      if (p === "low" || p === "medium" || p === "high") {
        requestedPriority = p;
        updateData.priority = p;
      }
    }

    let { data: updatedEpic, error } = await admin
      .from("epics")
      .update(updateData)
      .eq("id", epicId)
      .select()
      .maybeSingle();

    // Fallback if priority column has not been migrated yet in Supabase
    if (error && (error.code === "42703" || error.message?.includes("priority"))) {
      delete updateData.priority;
      if (requestedPriority) {
        const baseDesc = updateData.description !== undefined ? updateData.description : (epic.description || "");
        const cleanDesc = baseDesc.replace(/<!--priority:(low|medium|high)-->/gi, "").trim();
        updateData.description = cleanDesc ? `${cleanDesc} <!--priority:${requestedPriority}-->` : `<!--priority:${requestedPriority}-->`;
      }
      const retry = await admin
        .from("epics")
        .update(updateData)
        .eq("id", epicId)
        .select()
        .maybeSingle();
      updatedEpic = retry.data;
      error = retry.error;
    }

    if (error) throw error;

    if (updatedEpic) {
      // Ensure priority property is set on the return object
      if (requestedPriority && !updatedEpic.priority) {
        updatedEpic.priority = requestedPriority;
      } else if (!updatedEpic.priority && updatedEpic.description) {
        const match = updatedEpic.description.match(/<!--priority:(low|medium|high)-->/i);
        if (match && match[1]) {
          updatedEpic.priority = match[1].toLowerCase();
        }
      }
      if (!updatedEpic.priority) {
        updatedEpic.priority = "medium";
      }
      if (updatedEpic.description) {
        updatedEpic.description = updatedEpic.description.replace(/<!--priority:(low|medium|high)-->/gi, "").trim();
      }
    }

    return NextResponse.json(updatedEpic);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update Epic." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: epicId } = await params;
    const admin = createAdminClient();

    // Check existing epic
    const { data: epic } = await admin
      .from("epics")
      .select("project_id, projects(owner_id)")
      .eq("id", epicId)
      .maybeSingle();

    if (!epic) {
      return NextResponse.json({ error: "Epic not found or access denied." }, { status: 404 });
    }

    let isAuthorized = false;

    // 1. Team User authorization
    const teamUser = await getAuthenticatedTeamUser();
    if (teamUser) {
      const isMember =
        teamUser.project_id === epic.project_id ||
        (await isTeamUserProjectMember(teamUser.id, epic.project_id));
      if (isMember) {
        isAuthorized = true;
      }
    }

    // 2. Freelancer / Super Admin authorization
    if (!isAuthorized) {
      const auth = await createClient();
      const {
        data: { user },
      } = await auth.auth.getUser();

      if (user) {
        const { data: profile } = await admin
          .from("freelancer_profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        const isSuperAdmin = profile?.role === "super_admin";
        const projectData = Array.isArray(epic.projects) ? epic.projects[0] : epic.projects;
        if (isSuperAdmin || (projectData as any)?.owner_id === user.id) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized or access denied." }, { status: 403 });
    }

    // Deletion safeguard: Cannot delete an epic that contains stories
    const { count } = await admin
      .from("stories")
      .select("id", { count: "exact", head: true })
      .eq("epic_id", epicId);

    if (count && count > 0) {
      return NextResponse.json(
        { error: "Cannot delete an Epic that contains stories. Move or remove its stories first." },
        { status: 400 }
      );
    }

    const { error } = await admin.from("epics").delete().eq("id", epicId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete Epic." },
      { status: 500 }
    );
  }
}

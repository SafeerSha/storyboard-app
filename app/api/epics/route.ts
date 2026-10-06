import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedTeamUser } from "@/lib/team-session";
import { isTeamUserProjectMember } from "@/lib/story-reviewer-auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let projectId = String(body.projectId || "").trim();
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    const status = String(body.status || "active").trim();
    const sortOrder = Number(body.sortOrder || 0);

    if (!name) {
      return NextResponse.json({ error: "Epic name is required." }, { status: 400 });
    }

    const admin = createAdminClient();
    let isAuthorized = false;

    // 1. Team User authorization
    const teamUser = await getAuthenticatedTeamUser();
    if (teamUser) {
      const targetProjectId = projectId || teamUser.project_id;
      const isMember =
        targetProjectId === teamUser.project_id ||
        (await isTeamUserProjectMember(teamUser.id, targetProjectId));
      if (isMember) {
        projectId = targetProjectId;
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
        // Super admin check
        const { data: profile } = await admin
          .from("freelancer_profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.role === "super_admin") {
          isAuthorized = true;
        } else {
          // Project owner check
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

    if (!isAuthorized || !projectId) {
      return NextResponse.json({ error: "Unauthorized or project access denied." }, { status: 403 });
    }

    let creatorId: string | null = null;
    if (teamUser) {
      creatorId = teamUser.id;
    } else {
      const auth = await createClient();
      const { data: { user } } = await auth.auth.getUser();
      if (user) creatorId = user.id;
    }

    const priority = body.priority ? String(body.priority).toLowerCase().trim() : "medium";

    const insertPayload: any = {
      project_id: projectId,
      name,
      description,
      status,
      sort_order: sortOrder,
      created_by_id: creatorId,
      priority,
    };

    let { data: epic, error } = await admin
      .from("epics")
      .insert(insertPayload)
      .select()
      .maybeSingle();

    if (error && (error.code === "42703" || error.message?.includes("priority"))) {
      delete insertPayload.priority;
      if (priority) {
        insertPayload.description = description
          ? `${description} <!--priority:${priority}-->`
          : `<!--priority:${priority}-->`;
      }
      const retry = await admin
        .from("epics")
        .insert(insertPayload)
        .select()
        .maybeSingle();
      epic = retry.data;
      error = retry.error;
    }

    if (error) throw error;

    if (epic) {
      if (!epic.priority) {
        epic.priority = priority;
      }
      if (epic.description) {
        epic.description = epic.description.replace(/<!--priority:(low|medium|high)-->/gi, "").trim();
      }
    }

    return NextResponse.json(epic, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create Epic." },
      { status: 500 }
    );
  }
}

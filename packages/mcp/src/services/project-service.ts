import { ActorContext, PaginatedResult, ProjectEntity, ServiceError } from "../types/context.js";
import { getAdminDb } from "../db/supabase.js";

export class ProjectService {
  /**
   * Lists projects accessible to the actor with pagination and story/epic metrics.
   */
  static async listProjects(
    actor: ActorContext,
    params: { status?: string; limit?: number; offset?: number } = {}
  ): Promise<PaginatedResult<ProjectEntity & { totalStories: number; approvedStories: number; epicCount: number }>> {
    const db = getAdminDb();
    const limit = Math.min(Math.max(params.limit || 20, 1), 50);
    const offset = Math.max(params.offset || 0, 0);

    let query = db
      .from("projects")
      .select("id, name, description, status, created_at, updated_at, owner_id", { count: "exact" })
      .order("created_at", { ascending: false });

    // Non-super-admins can only see their own projects
    if (!actor.isSuperAdmin) {
      query = query.eq("owner_id", actor.id);
    }

    if (params.status && params.status !== "all") {
      query = query.eq("status", params.status);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: projects, error, count } = await query;

    if (error) {
      throw new ServiceError(`Failed to fetch projects: ${error.message}`, "DATABASE_ERROR", 500);
    }

    const projectList = (projects || []) as ProjectEntity[];
    const total = count || projectList.length;
    const projectIds = projectList.map((p) => p.id);

    // Compute epic and story counts
    const counts: Record<string, { totalStories: number; approvedStories: number; epicCount: number }> = {};
    for (const p of projectList) {
      counts[p.id] = { totalStories: 0, approvedStories: 0, epicCount: 0 };
    }

    if (projectIds.length > 0) {
      const [{ data: stories }, { data: epics }] = await Promise.all([
        db.from("stories").select("project_id, status").in("project_id", projectIds),
        db.from("epics").select("project_id").in("project_id", projectIds),
      ]);

      for (const s of stories || []) {
        if (counts[s.project_id]) {
          counts[s.project_id].totalStories += 1;
          if (s.status === "approved" || s.status === "done") {
            counts[s.project_id].approvedStories += 1;
          }
        }
      }

      for (const e of epics || []) {
        if (counts[e.project_id]) {
          counts[e.project_id].epicCount += 1;
        }
      }
    }

    const items = projectList.map((p) => ({
      ...p,
      totalStories: counts[p.id].totalStories,
      approvedStories: counts[p.id].approvedStories,
      epicCount: counts[p.id].epicCount,
    }));

    return {
      items,
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    };
  }

  /**
   * Retrieves comprehensive project details including story metrics, team members, and client status.
   */
  static async getProjectDetails(
    actor: ActorContext,
    projectId: string
  ): Promise<{
    id: string;
    name: string;
    description: string | null;
    status: "active" | "completed" | "archived";
    createdAt: string;
    updatedAt: string;
    metrics: {
      totalStories: number;
      approvedStories: number;
      pendingReviewStories: number;
      activeStories: number;
      newStories: number;
      doneStories: number;
      epicCount: number;
    };
    teamMembers: Array<{ id: string; name: string; role: string }>;
    client: { assigned: boolean; name?: string };
  }> {
    const db = getAdminDb();

    let query = db
      .from("projects")
      .select("id, name, description, status, created_at, updated_at, owner_id")
      .eq("id", projectId);

    if (!actor.isSuperAdmin) {
      query = query.eq("owner_id", actor.id);
    }

    const { data: project, error } = await query.maybeSingle();

    if (error || !project) {
      throw new ServiceError(
        `Project '${projectId}' not found or access denied.`,
        "PROJECT_NOT_FOUND",
        404
      );
    }

    // Execute parallel batched queries (Zero N+1)
    const [storiesRes, epicsRes, membersRes, clientRes] = await Promise.all([
      db.from("stories").select("status, team_review_status, client_review_status").eq("project_id", projectId),
      db.from("epics").select("id", { count: "exact", head: true }).eq("project_id", projectId),
      db
        .from("project_team_members")
        .select("team_user_id, team_users!inner(id, name, role, status)")
        .eq("project_id", projectId)
        .eq("team_users.status", "active"),
      db
        .from("clients")
        .select("id, name, status")
        .eq("project_id", projectId)
        .eq("status", "active")
        .maybeSingle(),
    ]);

    const storyList = storiesRes.data || [];
    let approvedCount = 0;
    let pendingReviewCount = 0;
    let activeCount = 0;
    let newCount = 0;
    let doneCount = 0;

    for (const s of storyList) {
      const status = (s.status || "").toLowerCase();
      if (status === "approved" || status === "done" || status === "completed") {
        approvedCount += 1;
        doneCount += 1;
      } else if (status === "active" || status === "in_development") {
        activeCount += 1;
      } else if (status === "new" || status === "draft") {
        newCount += 1;
      }

      if (
        s.team_review_status === "pending" ||
        s.client_review_status === "pending" ||
        status === "review"
      ) {
        pendingReviewCount += 1;
      }
    }

    const teamMembers = (membersRes.data || []).map((m: any) => ({
      id: m.team_users?.id || m.team_user_id,
      name: m.team_users?.name || "Team Member",
      role: m.team_users?.role || "member",
    }));

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
      metrics: {
        totalStories: storyList.length,
        approvedStories: approvedCount,
        pendingReviewStories: pendingReviewCount,
        activeStories: activeCount,
        newStories: newCount,
        doneStories: doneCount,
        epicCount: epicsRes.count || 0,
      },
      teamMembers,
      client: {
        assigned: Boolean(clientRes.data),
        name: clientRes.data?.name || undefined,
      },
    };
  }

  /**
   * Retrieves a single project after verifying access.
   */
  static async getProject(
    actor: ActorContext,
    projectId: string
  ): Promise<ProjectEntity & { totalStories: number; approvedStories: number; epicCount: number }> {
    const db = getAdminDb();

    let query = db
      .from("projects")
      .select("id, name, description, status, created_at, updated_at, owner_id")
      .eq("id", projectId);

    if (!actor.isSuperAdmin) {
      query = query.eq("owner_id", actor.id);
    }

    const { data: project, error } = await query.maybeSingle();

    if (error || !project) {
      throw new ServiceError(
        `Project '${projectId}' not found or access denied.`,
        "PROJECT_NOT_FOUND",
        404
      );
    }

    const [{ data: stories }, { data: epics }] = await Promise.all([
      db.from("stories").select("status").eq("project_id", projectId),
      db.from("epics").select("id").eq("project_id", projectId),
    ]);

    const storyList = stories || [];
    const totalStories = storyList.length;
    const approvedStories = storyList.filter((s) => s.status === "approved" || s.status === "done").length;
    const epicCount = (epics || []).length;

    return {
      ...(project as ProjectEntity),
      totalStories,
      approvedStories,
      epicCount,
    };
  }

  /**
   * Creates a new project owned by the actor.
   */
  static async createProject(
    actor: ActorContext,
    input: { name: string; description?: string }
  ): Promise<ProjectEntity> {
    const db = getAdminDb();
    const name = input.name.trim();

    if (!name) {
      throw new ServiceError("Project name cannot be empty.", "VALIDATION_ERROR", 400);
    }

    const { data: created, error } = await db
      .from("projects")
      .insert({
        owner_id: actor.id,
        name,
        description: input.description?.trim() || "",
        status: "active",
      })
      .select("id, name, description, status, created_at, updated_at, owner_id")
      .single();

    if (error) {
      throw new ServiceError(`Failed to create project: ${error.message}`, "DATABASE_ERROR", 500);
    }

    return created as ProjectEntity;
  }

  /**
   * Updates project details.
   */
  static async updateProject(
    actor: ActorContext,
    projectId: string,
    input: { name?: string; description?: string; status?: "active" | "completed" | "archived" }
  ): Promise<ProjectEntity> {
    const db = getAdminDb();

    // Verify ownership
    let checkQuery = db.from("projects").select("id, owner_id").eq("id", projectId);
    if (!actor.isSuperAdmin) {
      checkQuery = checkQuery.eq("owner_id", actor.id);
    }
    const { data: existing } = await checkQuery.maybeSingle();

    if (!existing) {
      throw new ServiceError(`Project '${projectId}' not found or access denied.`, "PROJECT_NOT_FOUND", 404);
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (input.name !== undefined) updatePayload.name = input.name.trim();
    if (input.description !== undefined) updatePayload.description = input.description.trim();
    if (input.status !== undefined) updatePayload.status = input.status;

    const { data: updated, error } = await db
      .from("projects")
      .update(updatePayload)
      .eq("id", projectId)
      .select("id, name, description, status, created_at, updated_at, owner_id")
      .single();

    if (error) {
      throw new ServiceError(`Failed to update project: ${error.message}`, "DATABASE_ERROR", 500);
    }

    return updated as ProjectEntity;
  }

  /**
   * Helper to verify project access for child resources (epics, stories).
   */
  static async verifyProjectAccess(actor: ActorContext, projectId: string): Promise<boolean> {
    const db = getAdminDb();
    let query = db.from("projects").select("id").eq("id", projectId);
    if (!actor.isSuperAdmin) {
      query = query.eq("owner_id", actor.id);
    }
    const { data } = await query.maybeSingle();
    return Boolean(data);
  }
}

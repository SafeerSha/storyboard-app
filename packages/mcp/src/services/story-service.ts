import { ActorContext, PaginatedResult, ServiceError, StoryEntity, StoryStatus, PendingReviewEntity, TeamUserEntity } from "../types/context.js";
import { getAdminDb } from "../db/supabase.js";
import { ProjectService } from "./project-service.js";
import { IdempotencyManager } from "../utils/idempotency.js";

export class StoryService {
  /**
   * Lists stories with project, epic, and review status scoping.
   */
  static async listStories(
    actor: ActorContext,
    params: {
      projectId: string;
      epicId?: string;
      status?: string;
      teamReviewStatus?: string;
      clientReviewStatus?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<PaginatedResult<{
    id: string;
    projectId: string;
    epicId: string | null;
    title: string;
    description: string;
    acceptanceCriteriaCount: number;
    assumptionsCount: number;
    clarificationsCount: number;
    status: StoryStatus;
    teamReviewStatus?: "pending" | "approved" | "changes_requested";
    clientReviewStatus?: "pending" | "approved" | "changes_requested";
    createdAt?: string;
    updatedAt?: string;
  }>> {
    const isAllowed = await ProjectService.verifyProjectAccess(actor, params.projectId);
    if (!isAllowed) {
      throw new ServiceError(`Project '${params.projectId}' not found or access denied.`, "PROJECT_NOT_FOUND", 404);
    }

    const db = getAdminDb();
    const limit = Math.min(Math.max(params.limit || 50, 1), 100);
    const offset = Math.max(params.offset || 0, 0);

    let query = db
      .from("stories")
      .select("*", { count: "exact" })
      .eq("project_id", params.projectId)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (params.epicId) {
      query = query.eq("epic_id", params.epicId);
    }

    if (params.status && params.status !== "all") {
      query = query.eq("status", params.status);
    }

    if (params.teamReviewStatus && params.teamReviewStatus !== "all") {
      query = query.eq("team_review_status", params.teamReviewStatus);
    }

    if (params.clientReviewStatus && params.clientReviewStatus !== "all") {
      query = query.eq("client_review_status", params.clientReviewStatus);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: stories, error, count } = await query;
    if (error) {
      throw new ServiceError(`Failed to fetch stories: ${error.message}`, "DATABASE_ERROR", 500);
    }

    const rawItems = (stories || []) as StoryEntity[];
    const total = count || rawItems.length;

    const items = rawItems.map((s) => ({
      id: s.id,
      projectId: s.project_id,
      epicId: s.epic_id,
      title: s.title,
      description: s.description,
      acceptanceCriteriaCount: Array.isArray(s.acceptance_criteria) ? s.acceptance_criteria.length : 0,
      assumptionsCount: Array.isArray(s.assumptions) ? s.assumptions.length : 0,
      clarificationsCount: Array.isArray(s.clarifications) ? s.clarifications.length : 0,
      status: s.status,
      teamReviewStatus: s.team_review_status,
      clientReviewStatus: s.client_review_status,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
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
   * Retrieves single story details including acceptance criteria, reviewer metadata, and revision history count.
   */
  static async getStoryDetails(
    actor: ActorContext,
    storyId: string
  ): Promise<{
    id: string;
    projectId: string;
    projectName: string;
    epicId: string | null;
    epicName: string | null;
    title: string;
    description: string;
    acceptanceCriteria: string[];
    assumptions: string[];
    clarifications: string[];
    rawRequirement: string | null;
    status: StoryStatus;
    teamReview: {
      status: "pending" | "approved" | "changes_requested";
      approvedByName: string | null;
      approvedAt: string | null;
    };
    clientReview: {
      status: "pending" | "approved" | "changes_requested";
      approvedByName: string | null;
      approvedAt: string | null;
    };
    reviewers: Array<{ id: string; name: string; role?: string }>;
    revisionCount: number;
    createdAt?: string;
    updatedAt?: string;
  }> {
    const db = getAdminDb();
    const { data: story, error } = await db.from("stories").select("*").eq("id", storyId).maybeSingle();

    if (error || !story) {
      throw new ServiceError(`Story '${storyId}' not found.`, "STORY_NOT_FOUND", 404);
    }

    const isAllowed = await ProjectService.verifyProjectAccess(actor, story.project_id);
    if (!isAllowed) {
      throw new ServiceError(`Access to story '${storyId}' denied.`, "FORBIDDEN", 403);
    }

    // Parallel batched lookup for project, epic, reviewers, and revisions (Zero N+1)
    const [projectRes, epicRes, reviewersRes, revisionsRes] = await Promise.all([
      db.from("projects").select("name").eq("id", story.project_id).maybeSingle(),
      story.epic_id
        ? db.from("epics").select("name").eq("id", story.epic_id).maybeSingle()
        : Promise.resolve({ data: null }),
      db
        .from("story_reviewers")
        .select("team_user_id, team_users(id, name, role)")
        .eq("story_id", storyId),
      db.from("story_revisions").select("id", { count: "exact", head: true }).eq("story_id", storyId),
    ]);

    const reviewers = (reviewersRes.data || []).map((r: any) => ({
      id: r.team_users?.id || r.team_user_id,
      name: r.team_users?.name || "Reviewer",
      role: r.team_users?.role || "member",
    }));

    return {
      id: story.id,
      projectId: story.project_id,
      projectName: projectRes.data?.name || "Unknown Project",
      epicId: story.epic_id,
      epicName: epicRes.data?.name || null,
      title: story.title,
      description: story.description || "",
      acceptanceCriteria: Array.isArray(story.acceptance_criteria) ? story.acceptance_criteria : [],
      assumptions: Array.isArray(story.assumptions) ? story.assumptions : [],
      clarifications: Array.isArray(story.clarifications) ? story.clarifications : [],
      rawRequirement: story.raw_requirement || null,
      status: story.status,
      teamReview: {
        status: story.team_review_status || "pending",
        approvedByName: story.team_approved_by_name || null,
        approvedAt: story.team_approved_at || null,
      },
      clientReview: {
        status: story.client_review_status || "pending",
        approvedByName: story.client_approved_by_name || null,
        approvedAt: story.client_approved_at || null,
      },
      reviewers,
      revisionCount: revisionsRes.count || 0,
      createdAt: story.created_at,
      updatedAt: story.updated_at,
    };
  }

  /**
   * Retrieves all pending reviews across accessible projects without N+1 queries.
   */
  static async getPendingReviews(
    actor: ActorContext,
    params: {
      projectId?: string;
      reviewType?: "team" | "client" | "any";
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<PaginatedResult<{
    storyId: string;
    projectId: string;
    projectName: string;
    epicId: string | null;
    epicName: string | null;
    title: string;
    status: StoryStatus;
    teamReviewStatus: "pending" | "approved" | "changes_requested";
    clientReviewStatus: "pending" | "approved" | "changes_requested";
    acceptanceCriteriaCount: number;
    updatedAt?: string;
  }>> {
    const db = getAdminDb();
    const limit = Math.min(Math.max(params.limit || 20, 1), 50);
    const offset = Math.max(params.offset || 0, 0);
    const reviewType = params.reviewType || "any";

    let accessibleProjectIds: string[] = [];

    if (params.projectId) {
      const isAllowed = await ProjectService.verifyProjectAccess(actor, params.projectId);
      if (!isAllowed) {
        throw new ServiceError(`Project '${params.projectId}' not found or access denied.`, "PROJECT_NOT_FOUND", 404);
      }
      accessibleProjectIds = [params.projectId];
    } else {
      // Find all accessible project IDs for the actor
      let projQuery = db.from("projects").select("id");
      if (!actor.isSuperAdmin) {
        projQuery = projQuery.eq("owner_id", actor.id);
      }
      const { data: ownedProjects } = await projQuery;
      accessibleProjectIds = (ownedProjects || []).map((p) => p.id);
    }

    if (accessibleProjectIds.length === 0) {
      return {
        items: [],
        total: 0,
        limit,
        offset,
        hasMore: false,
      };
    }

    let query = db
      .from("stories")
      .select("id, project_id, epic_id, title, status, team_review_status, client_review_status, acceptance_criteria, updated_at", { count: "exact" })
      .in("project_id", accessibleProjectIds)
      .order("updated_at", { ascending: false });

    if (reviewType === "team") {
      query = query.eq("team_review_status", "pending");
    } else if (reviewType === "client") {
      query = query.eq("client_review_status", "pending");
    } else {
      // "any" - stories awaiting either team review, client review, or in general review status
      query = query.or("team_review_status.eq.pending,client_review_status.eq.pending,status.eq.review");
    }

    query = query.range(offset, offset + limit - 1);

    const { data: stories, error, count } = await query;
    if (error) {
      throw new ServiceError(`Failed to fetch pending reviews: ${error.message}`, "DATABASE_ERROR", 500);
    }

    const storyList = stories || [];
    const total = count || storyList.length;

    // Batch fetch project names and epic names (Zero N+1)
    const distinctProjectIds = Array.from(new Set(storyList.map((s) => s.project_id)));
    const distinctEpicIds = Array.from(new Set(storyList.map((s) => s.epic_id).filter(Boolean))) as string[];

    const [projectsRes, epicsRes] = await Promise.all([
      distinctProjectIds.length > 0
        ? db.from("projects").select("id, name").in("id", distinctProjectIds)
        : Promise.resolve({ data: [] }),
      distinctEpicIds.length > 0
        ? db.from("epics").select("id, name").in("id", distinctEpicIds)
        : Promise.resolve({ data: [] }),
    ]);

    const projectMap = new Map((projectsRes.data || []).map((p) => [p.id, p.name]));
    const epicMap = new Map((epicsRes.data || []).map((e) => [e.id, e.name]));

    const items = storyList.map((s) => ({
      storyId: s.id,
      projectId: s.project_id,
      projectName: projectMap.get(s.project_id) || "Unknown Project",
      epicId: s.epic_id || null,
      epicName: s.epic_id ? epicMap.get(s.epic_id) || null : null,
      title: s.title,
      status: s.status as StoryStatus,
      teamReviewStatus: (s.team_review_status || "pending") as "pending" | "approved" | "changes_requested",
      clientReviewStatus: (s.client_review_status || "pending") as "pending" | "approved" | "changes_requested",
      acceptanceCriteriaCount: Array.isArray(s.acceptance_criteria) ? s.acceptance_criteria.length : 0,
      updatedAt: s.updated_at,
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
   * Retrieves single story details.
   */
  static async getStory(actor: ActorContext, storyId: string): Promise<StoryEntity> {
    const db = getAdminDb();
    const { data: story, error } = await db.from("stories").select("*").eq("id", storyId).maybeSingle();

    if (error || !story) {
      throw new ServiceError(`Story '${storyId}' not found.`, "STORY_NOT_FOUND", 404);
    }

    const isAllowed = await ProjectService.verifyProjectAccess(actor, story.project_id);
    if (!isAllowed) {
      throw new ServiceError(`Access to story '${storyId}' denied.`, "FORBIDDEN", 403);
    }

    return story as StoryEntity;
  }

  /**
   * Creates a feature story with acceptance criteria.
   */
  static async createStory(
    actor: ActorContext,
    input: {
      projectId: string;
      epicId: string;
      title: string;
      description?: string;
      acceptanceCriteria?: string[];
      assumptions?: string[];
      clarifications?: string[];
      status?: StoryStatus;
      storyType?: string;
      priority?: string;
      idempotencyKey?: string;
    }
  ): Promise<StoryEntity & { acceptanceCriteria: string[]; acceptanceCriteriaCount: number }> {
    // 1. Check idempotency if key provided
    if (input.idempotencyKey) {
      const cached = IdempotencyManager.get<StoryEntity & { acceptanceCriteria: string[]; acceptanceCriteriaCount: number }>(
        actor.id,
        "create_story",
        input.idempotencyKey
      );
      if (cached) {
        return cached;
      }
    }

    const isAllowed = await ProjectService.verifyProjectAccess(actor, input.projectId);
    if (!isAllowed) {
      throw new ServiceError(`Project '${input.projectId}' not found or access denied.`, "PROJECT_NOT_FOUND", 404);
    }

    const db = getAdminDb();

    // Verify epic belongs to this project
    const { data: epic } = await db
      .from("epics")
      .select("id, project_id")
      .eq("id", input.epicId)
      .maybeSingle();

    if (!epic || epic.project_id !== input.projectId) {
      throw new ServiceError(
        `Epic '${input.epicId}' does not belong to project '${input.projectId}'.`,
        "VALIDATION_ERROR",
        400
      );
    }

    const title = input.title?.trim();
    if (!title) {
      throw new ServiceError("Story title cannot be empty.", "VALIDATION_ERROR", 400);
    }

    // Format description, preserving metadata annotations if storyType or priority provided
    let description = input.description?.trim() || "";
    if (input.storyType || input.priority) {
      const tags: string[] = [];
      if (input.storyType) tags.push(`type:${input.storyType}`);
      if (input.priority) tags.push(`priority:${input.priority}`);
      const tagStr = `<!--meta:${tags.join(",")}-->`;
      if (!description.includes(tagStr)) {
        description = description ? `${description}\n\n${tagStr}` : tagStr;
      }
    }

    const criteriaList = Array.isArray(input.acceptanceCriteria)
      ? input.acceptanceCriteria.map((c) => (typeof c === "string" ? c.trim() : "")).filter((c) => c.length > 0)
      : [];

    const { data: created, error } = await db
      .from("stories")
      .insert({
        project_id: input.projectId,
        epic_id: input.epicId,
        title,
        description,
        acceptance_criteria: criteriaList,
        assumptions: input.assumptions || [],
        clarifications: input.clarifications || [],
        status: input.status || "new",
        created_by_id: actor.id,
      })
      .select()
      .single();

    if (error || !created) {
      throw new ServiceError(`Failed to create story: ${error?.message || "Unknown error"}`, "DATABASE_ERROR", 500);
    }

    const persisted = {
      ...(created as StoryEntity),
      acceptanceCriteria: created.acceptance_criteria || [],
      acceptanceCriteriaCount: (created.acceptance_criteria || []).length,
    };

    if (input.idempotencyKey) {
      IdempotencyManager.set(actor.id, "create_story", input.idempotencyKey, persisted);
    }

    return persisted;
  }

  /**
   * Updates story with automated revision snapshotting and status reset.
   */
  static async updateStory(
    actor: ActorContext,
    storyId: string,
    input: {
      title?: string;
      description?: string;
      acceptanceCriteria?: string[];
      assumptions?: string[];
      clarifications?: string[];
      epicId?: string;
      status?: StoryStatus;
    }
  ): Promise<StoryEntity & { revisionRecorded: boolean }> {
    const db = getAdminDb();
    const { data: story } = await db.from("stories").select("*").eq("id", storyId).maybeSingle();

    if (!story) {
      throw new ServiceError(`Story '${storyId}' not found.`, "STORY_NOT_FOUND", 404);
    }

    const isAllowed = await ProjectService.verifyProjectAccess(actor, story.project_id);
    if (!isAllowed) {
      throw new ServiceError(`Access to story '${storyId}' denied.`, "FORBIDDEN", 403);
    }

    if (input.epicId && input.epicId !== story.epic_id) {
      const { data: epic } = await db.from("epics").select("project_id").eq("id", input.epicId).maybeSingle();
      if (!epic || epic.project_id !== story.project_id) {
        throw new ServiceError("Target epic does not belong to this project.", "VALIDATION_ERROR", 400);
      }
    }

    // Material change detection
    let isMaterialChange = false;
    const materialChecks: Array<{ field: keyof typeof input; storyKey: keyof typeof story }> = [
      { field: "title", storyKey: "title" },
      { field: "description", storyKey: "description" },
      { field: "acceptanceCriteria", storyKey: "acceptance_criteria" },
      { field: "assumptions", storyKey: "assumptions" },
      { field: "clarifications", storyKey: "clarifications" },
    ];

    for (const check of materialChecks) {
      if (input[check.field] !== undefined) {
        const oldVal = JSON.stringify(story[check.storyKey] || "");
        const newVal = JSON.stringify(input[check.field]);
        if (oldVal !== newVal) {
          isMaterialChange = true;
          break;
        }
      }
    }

    // Record revision snapshot if materially altered
    if (isMaterialChange) {
      const { count } = await db
        .from("story_revisions")
        .select("id", { count: "exact", head: true })
        .eq("story_id", storyId);

      const revisionNumber = (count || 0) + 1;

      await db.from("story_revisions").insert({
        story_id: storyId,
        revision_number: revisionNumber,
        title: story.title,
        description: story.description,
        epic_id: story.epic_id,
        acceptance_criteria: story.acceptance_criteria,
        assumptions: story.assumptions,
        clarifications: story.clarifications,
        status: story.status,
        created_by: actor.id,
      });
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.title !== undefined) updatePayload.title = input.title.trim();
    if (input.description !== undefined) updatePayload.description = input.description.trim();
    if (input.acceptanceCriteria !== undefined) updatePayload.acceptance_criteria = input.acceptanceCriteria;
    if (input.assumptions !== undefined) updatePayload.assumptions = input.assumptions;
    if (input.clarifications !== undefined) updatePayload.clarifications = input.clarifications;
    if (input.epicId !== undefined) updatePayload.epic_id = input.epicId;
    if (input.status !== undefined) updatePayload.status = input.status;

    // Reset status to review if approved story had material changes and no status explicitly forced
    if (story.status === "approved" && isMaterialChange && !input.status) {
      updatePayload.status = "review";
    }

    const { data: updated, error } = await db
      .from("stories")
      .update(updatePayload)
      .eq("id", storyId)
      .select()
      .single();

    if (error || !updated) {
      throw new ServiceError(`Failed to update story: ${error?.message || "Unknown error"}`, "DATABASE_ERROR", 500);
    }

    return {
      ...(updated as StoryEntity),
      revisionRecorded: isMaterialChange,
    };
  }

  /**
   * Appends acceptance criteria to an existing story, tracking revisions and resetting approval if needed.
   */
  static async addAcceptanceCriteria(
    actor: ActorContext,
    storyId: string,
    input: {
      criteria: string | string[];
      idempotencyKey?: string;
    }
  ): Promise<{
    storyId: string;
    projectId: string;
    epicId: string | null;
    title: string;
    status: StoryStatus;
    previousCriteriaCount: number;
    addedCriteriaCount: number;
    totalCriteriaCount: number;
    addedCriteria: string[];
    acceptanceCriteria: string[];
    revisionRecorded: boolean;
    updatedAt: string;
  }> {
    if (input.idempotencyKey) {
      const cached = IdempotencyManager.get<any>(
        actor.id,
        "add_acceptance_criteria",
        input.idempotencyKey
      );
      if (cached) {
        return cached;
      }
    }

    const db = getAdminDb();
    const { data: story, error: fetchErr } = await db
      .from("stories")
      .select("*")
      .eq("id", storyId)
      .maybeSingle();

    if (fetchErr || !story) {
      throw new ServiceError(`Story '${storyId}' not found.`, "STORY_NOT_FOUND", 404);
    }

    const isAllowed = await ProjectService.verifyProjectAccess(actor, story.project_id);
    if (!isAllowed) {
      throw new ServiceError(`Access to story '${storyId}' denied.`, "FORBIDDEN", 403);
    }

    const rawList = Array.isArray(input.criteria) ? input.criteria : [input.criteria];
    const newItems = rawList
      .map((c) => (typeof c === "string" ? c.trim() : ""))
      .filter((c) => c.length > 0);

    if (newItems.length === 0) {
      throw new ServiceError("At least one non-empty acceptance criterion is required.", "VALIDATION_ERROR", 400);
    }

    const existingCriteria: string[] = Array.isArray(story.acceptance_criteria)
      ? (story.acceptance_criteria as string[])
      : [];

    const updatedCriteria = [...existingCriteria, ...newItems];

    // Snapshot existing story into story_revisions
    const { count } = await db
      .from("story_revisions")
      .select("id", { count: "exact", head: true })
      .eq("story_id", storyId);

    const revisionNumber = (count || 0) + 1;

    await db.from("story_revisions").insert({
      story_id: storyId,
      revision_number: revisionNumber,
      title: story.title,
      description: story.description,
      epic_id: story.epic_id,
      acceptance_criteria: story.acceptance_criteria,
      assumptions: story.assumptions,
      clarifications: story.clarifications,
      status: story.status,
      created_by: actor.id,
    });

    const updatePayload: Record<string, unknown> = {
      acceptance_criteria: updatedCriteria,
      updated_at: new Date().toISOString(),
    };

    let targetStatus = story.status;
    if (story.status === "approved") {
      targetStatus = "review";
      updatePayload.status = "review";
    }

    const { data: updated, error: updateErr } = await db
      .from("stories")
      .update(updatePayload)
      .eq("id", storyId)
      .select()
      .single();

    if (updateErr || !updated) {
      throw new ServiceError(
        `Failed to update story acceptance criteria: ${updateErr?.message || "Unknown error"}`,
        "DATABASE_ERROR",
        500
      );
    }

    const result = {
      storyId: story.id,
      projectId: story.project_id,
      epicId: story.epic_id,
      title: story.title,
      status: targetStatus,
      previousCriteriaCount: existingCriteria.length,
      addedCriteriaCount: newItems.length,
      totalCriteriaCount: updatedCriteria.length,
      addedCriteria: newItems,
      acceptanceCriteria: updatedCriteria,
      revisionRecorded: true,
      updatedAt: (updated as any).updated_at || new Date().toISOString(),
    };

    if (input.idempotencyKey) {
      IdempotencyManager.set(actor.id, "add_acceptance_criteria", input.idempotencyKey, result);
    }

    return result;
  }

  /**
   * Updates story status or review status.
   */
  static async updateStoryStatus(
    actor: ActorContext,
    storyId: string,
    input: {
      status?: StoryStatus;
      teamReviewStatus?: "pending" | "approved" | "changes_requested";
    }
  ): Promise<StoryEntity> {
    const db = getAdminDb();
    const { data: story } = await db.from("stories").select("id, project_id").eq("id", storyId).maybeSingle();

    if (!story) {
      throw new ServiceError(`Story '${storyId}' not found.`, "STORY_NOT_FOUND", 404);
    }

    const isAllowed = await ProjectService.verifyProjectAccess(actor, story.project_id);
    if (!isAllowed) {
      throw new ServiceError(`Access to story '${storyId}' denied.`, "FORBIDDEN", 403);
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.status !== undefined) {
      updatePayload.status = input.status;
    }

    if (input.teamReviewStatus !== undefined) {
      updatePayload.team_review_status = input.teamReviewStatus;
      if (input.teamReviewStatus === "approved") {
        updatePayload.team_approved_by_id = actor.id;
        updatePayload.team_approved_by_name = actor.name;
        updatePayload.team_approved_at = new Date().toISOString();
      }
    }

    const { data: updated, error } = await db
      .from("stories")
      .update(updatePayload)
      .eq("id", storyId)
      .select()
      .single();

    if (error || !updated) {
      throw new ServiceError(`Failed to update status: ${error?.message || "Unknown error"}`, "DATABASE_ERROR", 500);
    }

    return updated as StoryEntity;
  }
}


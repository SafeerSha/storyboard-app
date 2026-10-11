import { ActorContext, EpicEntity, EpicPriority, EpicStatus, ServiceError } from "../types/context.js";
import { getAdminDb } from "../db/supabase.js";
import { ProjectService } from "./project-service.js";
import { IdempotencyManager } from "../utils/idempotency.js";

function cleanEpicDescription(desc?: string | null): string {
  if (!desc) return "";
  return desc.replace(/<!--priority:(low|medium|high)-->/gi, "").trim();
}

function extractEpicPriority(epic: { priority?: string | null; description?: string | null }): EpicPriority {
  if (epic.priority && ["low", "medium", "high"].includes(epic.priority.toLowerCase())) {
    return epic.priority.toLowerCase() as EpicPriority;
  }
  if (epic.description) {
    const match = epic.description.match(/<!--priority:(low|medium|high)-->/i);
    if (match && match[1]) {
      return match[1].toLowerCase() as EpicPriority;
    }
  }
  return "medium";
}

export class EpicService {
  /**
   * Lists epics for a project ordered by created_at DESC (Reqly design invariant) with pagination.
   */
  static async listEpics(
    actor: ActorContext,
    params: {
      projectId: string;
      status?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{
    items: Array<EpicEntity & { storyCount: number }>;
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  }> {
    const isAllowed = await ProjectService.verifyProjectAccess(actor, params.projectId);
    if (!isAllowed) {
      throw new ServiceError(`Project '${params.projectId}' not found or access denied.`, "PROJECT_NOT_FOUND", 404);
    }

    const db = getAdminDb();
    const limit = Math.min(Math.max(params.limit || 50, 1), 100);
    const offset = Math.max(params.offset || 0, 0);

    let query = db
      .from("epics")
      .select("id, project_id, name, description, status, sort_order, priority, created_by_id, created_at, updated_at", { count: "exact" })
      .eq("project_id", params.projectId)
      .order("created_at", { ascending: false });

    if (params.status && params.status !== "all") {
      query = query.eq("status", params.status);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: epics, error, count } = await query;
    if (error) {
      throw new ServiceError(`Failed to fetch epics: ${error.message}`, "DATABASE_ERROR", 500);
    }

    const epicList = (epics || []) as EpicEntity[];
    const total = count || epicList.length;
    const epicIds = epicList.map((e) => e.id);

    // Fetch story counts per epic
    const countMap: Record<string, number> = {};
    if (epicIds.length > 0) {
      const { data: stories } = await db.from("stories").select("epic_id").in("epic_id", epicIds);
      for (const s of stories || []) {
        if (s.epic_id) {
          countMap[s.epic_id] = (countMap[s.epic_id] || 0) + 1;
        }
      }
    }

    const items = epicList.map((e) => ({
      ...e,
      priority: extractEpicPriority(e),
      description: cleanEpicDescription(e.description),
      storyCount: countMap[e.id] || 0,
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
   * Retrieves single epic details.
   */
  static async getEpic(actor: ActorContext, epicId: string): Promise<EpicEntity & { storyCount: number }> {
    const db = getAdminDb();
    const { data: epic, error } = await db
      .from("epics")
      .select("id, project_id, name, description, status, sort_order, priority, created_by_id, created_at, updated_at")
      .eq("id", epicId)
      .maybeSingle();

    if (error || !epic) {
      throw new ServiceError(`Epic '${epicId}' not found.`, "EPIC_NOT_FOUND", 404);
    }

    const isAllowed = await ProjectService.verifyProjectAccess(actor, epic.project_id);
    if (!isAllowed) {
      throw new ServiceError(`Access to epic '${epicId}' denied.`, "FORBIDDEN", 403);
    }

    const { count } = await db
      .from("stories")
      .select("id", { count: "exact", head: true })
      .eq("epic_id", epicId);

    return {
      ...(epic as EpicEntity),
      priority: extractEpicPriority(epic),
      description: cleanEpicDescription(epic.description),
      storyCount: count || 0,
    };
  }

  /**
   * Creates an epic with priority fallback support and idempotency.
   */
  static async createEpic(
    actor: ActorContext,
    input: {
      projectId: string;
      title?: string;
      name?: string;
      description?: string;
      priority?: EpicPriority;
      status?: EpicStatus;
      sortOrder?: number;
      idempotencyKey?: string;
    }
  ): Promise<EpicEntity & { title: string }> {
    // 1. Check idempotency if key provided
    if (input.idempotencyKey) {
      const cached = IdempotencyManager.get<EpicEntity & { title: string }>(
        actor.id,
        "create_epic",
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
    const title = (input.title || input.name || "").trim();
    if (!title) {
      throw new ServiceError("Epic title cannot be empty.", "VALIDATION_ERROR", 400);
    }

    const priority: EpicPriority = input.priority || "medium";
    const description = input.description?.trim() || "";
    const status: EpicStatus = input.status || "backlog";
    const sortOrder = typeof input.sortOrder === "number" ? input.sortOrder : 0;

    const insertPayload: Record<string, unknown> = {
      project_id: input.projectId,
      name: title,
      description,
      status,
      sort_order: sortOrder,
      created_by_id: actor.id,
      priority,
    };

    let { data: created, error } = await db.from("epics").insert(insertPayload).select().maybeSingle();

    // Migration compatibility fallback if priority column does not exist in target database
    if (error && (error.code === "42703" || error.message?.includes("priority"))) {
      delete insertPayload.priority;
      insertPayload.description = description
        ? `${description} <!--priority:${priority}-->`
        : `<!--priority:${priority}-->`;

      const retry = await db.from("epics").insert(insertPayload).select().maybeSingle();
      created = retry.data;
      error = retry.error;
    }

    if (error || !created) {
      throw new ServiceError(`Failed to create epic: ${error?.message || "Unknown error"}`, "DATABASE_ERROR", 500);
    }

    const persistedEpic = {
      ...(created as EpicEntity),
      title: created.name,
      priority,
      description: cleanEpicDescription(created.description),
    };

    if (input.idempotencyKey) {
      IdempotencyManager.set(actor.id, "create_epic", input.idempotencyKey, persistedEpic);
    }

    return persistedEpic;
  }

  /**
   * Updates an epic.
   */
  static async updateEpic(
    actor: ActorContext,
    epicId: string,
    input: {
      name?: string;
      description?: string;
      priority?: EpicPriority;
      status?: EpicStatus;
    }
  ): Promise<EpicEntity> {
    const db = getAdminDb();
    const { data: epic } = await db.from("epics").select("id, project_id, description").eq("id", epicId).maybeSingle();

    if (!epic) {
      throw new ServiceError(`Epic '${epicId}' not found.`, "EPIC_NOT_FOUND", 404);
    }

    const isAllowed = await ProjectService.verifyProjectAccess(actor, epic.project_id);
    if (!isAllowed) {
      throw new ServiceError(`Access to epic '${epicId}' denied.`, "FORBIDDEN", 403);
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (input.name !== undefined) updatePayload.name = input.name.trim();
    if (input.status !== undefined) updatePayload.status = input.status;

    let requestedPriority = input.priority;
    if (input.description !== undefined) {
      updatePayload.description = input.description.trim();
    }
    if (requestedPriority !== undefined) {
      updatePayload.priority = requestedPriority;
    }

    let { data: updated, error } = await db.from("epics").update(updatePayload).eq("id", epicId).select().maybeSingle();

    // Fallback if priority column missing
    if (error && (error.code === "42703" || error.message?.includes("priority"))) {
      delete updatePayload.priority;
      if (requestedPriority) {
        const baseDesc = updatePayload.description !== undefined ? String(updatePayload.description) : (epic.description || "");
        const clean = cleanEpicDescription(baseDesc);
        updatePayload.description = clean ? `${clean} <!--priority:${requestedPriority}-->` : `<!--priority:${requestedPriority}-->`;
      }
      const retry = await db.from("epics").update(updatePayload).eq("id", epicId).select().maybeSingle();
      updated = retry.data;
      error = retry.error;
    }

    if (error || !updated) {
      throw new ServiceError(`Failed to update epic: ${error?.message || "Unknown error"}`, "DATABASE_ERROR", 500);
    }

    return {
      ...(updated as EpicEntity),
      priority: requestedPriority || extractEpicPriority(updated),
      description: cleanEpicDescription(updated.description),
    };
  }
}

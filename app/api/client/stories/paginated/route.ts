import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedClient } from "@/lib/client-session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const client = await getAuthenticatedClient();
  if (!client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const tab = searchParams.get("tab") || "all";
  const epicId = searchParams.get("epicId");
  const status = searchParams.get("status");
  const search = searchParams.get("search")?.trim() || "";
  const sortBy = searchParams.get("sortBy") || "updated";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "15", 10)));
  const offset = (page - 1) * limit;

  const db = createAdminClient();

  try {
    let query = db
      .from("stories")
      .select(
        "id, project_id, epic_id, title, description, acceptance_criteria, assumptions, clarifications, status, team_review_status, team_approved_by_name, team_approved_at, client_review_status, client_approved_by_name, client_approved_at, created_at, updated_at",
        { count: "exact" }
      )
      .eq("project_id", client.project_id);

    // Filter by Tab
    if (tab === "needs_action") {
      query = query
        .neq("client_review_status", "approved")
        .neq("status", "approved");
    } else if (tab === "changes_requested") {
      query = query.or("client_review_status.eq.changes_requested,status.eq.changes_requested");
    } else if (tab === "approved") {
      query = query.or("client_review_status.eq.approved,status.eq.approved");
    }

    // Filter by Epic
    if (epicId && epicId !== "all") {
      if (epicId === "uncategorized") {
        query = query.is("epic_id", null);
      } else {
        query = query.eq("epic_id", epicId);
      }
    }

    // Filter by Story Status
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    // Search
    if (search) {
      const sanitized = search.replace(/[%_]/g, "\\$&");
      query = query.or(`title.ilike.%${sanitized}%,description.ilike.%${sanitized}%`);
    }

    // Sorting
    if (sortBy === "created") {
      query = query.order("created_at", { ascending: false });
    } else if (sortBy === "status") {
      query = query.order("status", { ascending: true }).order("updated_at", { ascending: false });
    } else {
      query = query.order("updated_at", { ascending: false }).order("created_at", { ascending: false });
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const [{ data: stories, count, error: storiesError }, { data: epicsData }] =
      await Promise.all([
        query,
        db
          .from("epics")
          .select("id, name, description, created_at")
          .eq("project_id", client.project_id)
          .order("created_at", { ascending: false }),
      ]);

    if (storiesError) {
      throw storiesError;
    }

    const storyList = stories || [];
    const storyIds = storyList.map((s) => s.id);

    // Zero N+1: Batch load open feedback counts
    const feedbackCountsMap: Record<string, number> = {};
    if (storyIds.length > 0) {
      const { data: openThreads } = await db
        .from("story_feedback_threads")
        .select("story_id")
        .in("story_id", storyIds)
        .eq("status", "open");

      (openThreads || []).forEach((t) => {
        feedbackCountsMap[t.story_id] = (feedbackCountsMap[t.story_id] || 0) + 1;
      });
    }

    // Map epic names
    const epicMap = new Map<string, string>();
    (epicsData || []).forEach((e) => epicMap.set(e.id, e.name));

    const enrichedStories = storyList.map((s) => ({
      ...s,
      epic_name: s.epic_id ? epicMap.get(s.epic_id) || "Epic" : "Uncategorized",
      open_feedback_count: feedbackCountsMap[s.id] || 0,
    }));

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      stories: enrichedStories,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      epics: epicsData || [],
      viewerId: client.id,
    });
  } catch (error: unknown) {
    console.error("Failed to load paginated stories:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load stories" },
      { status: 500 }
    );
  }
}

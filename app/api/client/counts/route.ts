import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedClient } from "@/lib/client-session";

export const dynamic = "force-dynamic";

export async function GET() {
  const client = await getAuthenticatedClient();
  if (!client) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();

  try {
    const [
      { count: allStories },
      { count: approved },
      { count: changesRequested },
      { count: needsAction },
      { count: feedback },
      { data: epicsData },
      { data: storyEpicIds },
    ] = await Promise.all([
      // 1. Total stories in project
      db
        .from("stories")
        .select("id", { count: "exact", head: true })
        .eq("project_id", client.project_id),

      // 2. Approved stories
      db
        .from("stories")
        .select("id", { count: "exact", head: true })
        .eq("project_id", client.project_id)
        .or("client_review_status.eq.approved,status.eq.approved"),

      // 3. Changes requested stories
      db
        .from("stories")
        .select("id", { count: "exact", head: true })
        .eq("project_id", client.project_id)
        .or("client_review_status.eq.changes_requested,status.eq.changes_requested"),

      // 4. Needs Action (not approved)
      db
        .from("stories")
        .select("id", { count: "exact", head: true })
        .eq("project_id", client.project_id)
        .neq("client_review_status", "approved")
        .neq("status", "approved"),

      // 5. Open feedback threads on project stories
      db
        .from("story_feedback_threads")
        .select("id, stories!inner(project_id)", { count: "exact", head: true })
        .eq("stories.project_id", client.project_id)
        .eq("status", "open"),

      // 6. Epics in project
      db
        .from("epics")
        .select("id, name, sort_order")
        .eq("project_id", client.project_id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),

      // 7. Story epic mapping for aggregate counts
      db
        .from("stories")
        .select("epic_id")
        .eq("project_id", client.project_id),
    ]);

    // Aggregate story count per epic
    const epicCounts: Record<string, number> = {};
    (storyEpicIds || []).forEach((s) => {
      const k = s.epic_id || "uncategorized";
      epicCounts[k] = (epicCounts[k] || 0) + 1;
    });

    const epics = (epicsData || []).map((e) => ({
      id: e.id,
      name: e.name,
      storyCount: epicCounts[e.id] || 0,
    }));

    if (epicCounts["uncategorized"]) {
      epics.push({
        id: "uncategorized",
        name: "Additional Requirements",
        storyCount: epicCounts["uncategorized"],
      });
    }

    return NextResponse.json({
      counts: {
        allStories: allStories ?? 0,
        approved: approved ?? 0,
        changesRequested: changesRequested ?? 0,
        needsAction: needsAction ?? 0,
        feedback: feedback ?? 0,
      },
      epics,
    });
  } catch (error: unknown) {
    console.error("Failed to load client counts:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load counts" },
      { status: 500 }
    );
  }
}

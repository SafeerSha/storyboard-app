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
  const filterStatus = searchParams.get("status") || "all";
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "30", 10)));

  const db = createAdminClient();

  try {
    let query = db
      .from("story_feedback_threads")
      .select(`
        id,
        story_id,
        section_type,
        item_id,
        item_text,
        status,
        created_by_type,
        created_by_name,
        created_at,
        updated_at,
        stories!inner (
          id,
          project_id,
          title,
          epic_id
        ),
        messages:story_feedback_messages (
          id,
          author_type,
          author_name,
          body,
          created_at
        )
      `)
      .eq("stories.project_id", client.project_id)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (filterStatus && filterStatus !== "all") {
      query = query.eq("status", filterStatus);
    }

    const [{ data: threads, error: threadsError }, { data: epicsData }] =
      await Promise.all([
        query,
        db
          .from("epics")
          .select("id, name")
          .eq("project_id", client.project_id),
      ]);

    if (threadsError) {
      throw threadsError;
    }

    const epicMap = new Map<string, string>();
    (epicsData || []).forEach((e) => epicMap.set(e.id, e.name));

    const enriched = (threads || []).map((t: any) => {
      const story = Array.isArray(t.stories) ? t.stories[0] : t.stories;
      const msgs = (t.messages || []).sort(
        (a: any, b: any) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const lastMsg = msgs[msgs.length - 1];

      // Client action is required if thread is open and team/freelancer was the last to reply
      const lastAuthorType = lastMsg ? lastMsg.author_type : t.created_by_type;
      const requiresClientAction =
        t.status === "open" &&
        (lastAuthorType === "team_user" || lastAuthorType === "freelancer");

      return {
        id: t.id,
        story_id: t.story_id,
        story_title: story?.title || "Story",
        epic_name: story?.epic_id ? epicMap.get(story.epic_id) || "Epic" : "Additional Requirements",
        section_type: t.section_type,
        item_id: t.item_id,
        item_text: t.item_text,
        status: t.status,
        created_by_type: t.created_by_type,
        created_by_name: t.created_by_name,
        created_at: t.created_at,
        updated_at: t.updated_at,
        message_count: msgs.length,
        last_message: lastMsg
          ? {
              body: lastMsg.body,
              author_name: lastMsg.author_name,
              author_type: lastMsg.author_type,
              created_at: lastMsg.created_at,
            }
          : null,
        requires_client_action: requiresClientAction,
      };
    });

    return NextResponse.json({ threads: enriched });
  } catch (error: unknown) {
    console.error("Failed to load feedback inbox:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load feedback" },
      { status: 500 }
    );
  }
}

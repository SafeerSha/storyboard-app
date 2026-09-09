import { createAdminClient } from "@/lib/supabase/admin";
import type { FeedbackThread, FeedbackMessage, FeedbackSectionType, FeedbackThreadStatus, FeedbackAuthorType } from "@/lib/types";

import { getAuthenticatedTeamUser } from "@/lib/team-session";
import { getAuthenticatedClient } from "@/lib/client-session";
import { createClient } from "@/lib/supabase/server";

const FALLBACK_PREFIX = "__FEEDBACK_THREAD__:";

export async function resolveSession(storyId: string) {
  const admin = createAdminClient();
  const { data: story } = await admin
    .from("stories")
    .select("id, project_id, status")
    .eq("id", storyId)
    .maybeSingle();

  if (!story) return { error: "Story not found", status: 404 };

  // 1. Try Team User session
  const teamUser = await getAuthenticatedTeamUser();
  if (teamUser && teamUser.project_id === story.project_id) {
    return {
      story,
      authorType: "team_user" as FeedbackAuthorType,
      authorId: teamUser.id,
      authorName: teamUser.name || "Team Member",
    };
  }

  // 2. Try Freelancer / Super Admin session
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await admin
      .from("freelancer_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role === "super_admin") {
      return {
        story,
        authorType: "freelancer" as FeedbackAuthorType,
        authorId: user.id,
        authorName: "Super Admin",
      };
    }

    const { data: project } = await admin
      .from("projects")
      .select("id, owner_id")
      .eq("id", story.project_id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (project) {
      return {
        story,
        authorType: "freelancer" as FeedbackAuthorType,
        authorId: user.id,
        authorName: "Freelancer",
      };
    }
  }

  // 3. Try Client session
  const client = await getAuthenticatedClient();
  if (client && client.project_id === story.project_id) {
    return {
      story,
      authorType: "client" as FeedbackAuthorType,
      authorId: client.id,
      authorName: client.name || "Client",
    };
  }

  return { error: "Unauthorized", status: 401 };
}

export async function getStoryFeedback(storyId: string): Promise<FeedbackThread[]> {
  const db = createAdminClient();

  try {
    // 1. Primary Strategy: Check dedicated tables
    const { data: threads, error } = await db
      .from("story_feedback_threads")
      .select("*, messages:story_feedback_messages(*)")
      .eq("story_id", storyId)
      .order("created_at", { ascending: true });

    if (!error && threads) {
      return threads.map((t: any) => ({
        id: t.id,
        story_id: t.story_id,
        section_type: t.section_type as FeedbackSectionType,
        item_id: t.item_id || null,
        item_text: t.item_text || null,
        status: t.status as FeedbackThreadStatus,
        created_by_type: t.created_by_type as FeedbackAuthorType,
        created_by_id: t.created_by_id,
        created_by_name: t.created_by_name,
        created_at: t.created_at,
        updated_at: t.updated_at,
        messages: ((t.messages || []) as any[])
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .map(m => ({
            id: m.id,
            thread_id: m.thread_id,
            author_type: m.author_type as FeedbackAuthorType,
            author_id: m.author_id,
            author_name: m.author_name,
            body: m.body,
            created_at: m.created_at,
          }))
      }));
    }
  } catch (err) {
    // Table may not exist yet, fallback to story_comments
  }

  // 2. Compatibility Fallback: Store & read from story_comments
  try {
    const { data: comments, error } = await db
      .from("story_comments")
      .select("*")
      .eq("story_id", storyId)
      .order("created_at", { ascending: true });

    if (error || !comments) return [];

    const threadMap = new Map<string, FeedbackThread>();

    for (const c of comments) {
      if (typeof c.body === "string" && c.body.startsWith(FALLBACK_PREFIX)) {
        try {
          const payload = JSON.parse(c.body.slice(FALLBACK_PREFIX.length));
          const threadId = payload.thread_id || c.id;

          if (!threadMap.has(threadId)) {
            threadMap.set(threadId, {
              id: threadId,
              story_id: c.story_id,
              section_type: (payload.section_type || "general") as FeedbackSectionType,
              item_id: payload.item_id || null,
              item_text: payload.item_text || null,
              status: (payload.status || "open") as FeedbackThreadStatus,
              created_by_type: (payload.author_type || "client") as FeedbackAuthorType,
              created_by_id: payload.author_id || c.id,
              created_by_name: c.author_name || payload.author_name || "Client",
              created_at: c.created_at,
              updated_at: c.created_at,
              messages: []
            });
          }

          const currentThread = threadMap.get(threadId)!;
          if (payload.status) currentThread.status = payload.status;
          currentThread.messages.push({
            id: c.id,
            thread_id: threadId,
            author_type: (payload.author_type || "client") as FeedbackAuthorType,
            author_id: payload.author_id || c.id,
            author_name: payload.author_name || c.author_name,
            body: payload.body || "",
            created_at: c.created_at,
          });
        } catch {
          // Parse error, treat as general comment
          addLegacyCommentAsThread(c, threadMap);
        }
      } else {
        // Legacy plain text comment
        addLegacyCommentAsThread(c, threadMap);
      }
    }

    return Array.from(threadMap.values());
  } catch {
    return [];
  }
}

function addLegacyCommentAsThread(c: any, map: Map<string, FeedbackThread>) {
  map.set(c.id, {
    id: c.id,
    story_id: c.story_id,
    section_type: "general",
    item_id: null,
    item_text: null,
    status: "open",
    created_by_type: "client",
    created_by_id: c.id,
    created_by_name: c.author_name || "Client",
    created_at: c.created_at,
    updated_at: c.created_at,
    messages: [
      {
        id: c.id,
        thread_id: c.id,
        author_type: "client",
        author_id: c.id,
        author_name: c.author_name || "Client",
        body: c.body,
        created_at: c.created_at,
      }
    ]
  });
}

export async function createFeedbackThread({
  storyId,
  sectionType,
  itemId,
  itemText,
  body,
  authorType,
  authorId,
  authorName
}: {
  storyId: string;
  sectionType: FeedbackSectionType;
  itemId?: string | null;
  itemText?: string | null;
  body: string;
  authorType: FeedbackAuthorType;
  authorId: string;
  authorName: string;
}): Promise<FeedbackThread> {
  const db = createAdminClient();

  // Try dedicated tables
  try {
    const { data: newThread, error: threadErr } = await db
      .from("story_feedback_threads")
      .insert({
        story_id: storyId,
        section_type: sectionType,
        item_id: itemId || null,
        item_text: itemText || null,
        status: "open",
        created_by_type: authorType,
        created_by_id: authorId,
        created_by_name: authorName
      })
      .select()
      .single();

    if (!threadErr && newThread) {
      const { data: newMsg, error: msgErr } = await db
        .from("story_feedback_messages")
        .insert({
          thread_id: newThread.id,
          author_type: authorType,
          author_id: authorId,
          author_name: authorName,
          body: body.trim()
        })
        .select()
        .single();

      if (!msgErr && newMsg) {
        return {
          id: newThread.id,
          story_id: newThread.story_id,
          section_type: newThread.section_type,
          item_id: newThread.item_id,
          item_text: newThread.item_text,
          status: newThread.status,
          created_by_type: newThread.created_by_type,
          created_by_id: newThread.created_by_id,
          created_by_name: newThread.created_by_name,
          created_at: newThread.created_at,
          updated_at: newThread.updated_at,
          messages: [newMsg]
        };
      }
    }
  } catch {
    // Fallback below
  }

  // Fallback via story_comments
  const threadId = crypto.randomUUID();
  const now = new Date().toISOString();
  const payload = {
    thread_id: threadId,
    section_type: sectionType,
    item_id: itemId || null,
    item_text: itemText || null,
    status: "open",
    author_type: authorType,
    author_id: authorId,
    author_name: authorName,
    body: body.trim()
  };

  const { data: comment, error } = await db
    .from("story_comments")
    .insert({
      story_id: storyId,
      author_name: authorName,
      body: FALLBACK_PREFIX + JSON.stringify(payload)
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: threadId,
    story_id: storyId,
    section_type: sectionType,
    item_id: itemId || null,
    item_text: itemText || null,
    status: "open",
    created_by_type: authorType,
    created_by_id: authorId,
    created_by_name: authorName,
    created_at: comment.created_at || now,
    updated_at: comment.created_at || now,
    messages: [
      {
        id: comment.id,
        thread_id: threadId,
        author_type: authorType,
        author_id: authorId,
        author_name: authorName,
        body: body.trim(),
        created_at: comment.created_at || now
      }
    ]
  };
}

export async function addFeedbackMessage({
  storyId,
  threadId,
  body,
  authorType,
  authorId,
  authorName
}: {
  storyId: string;
  threadId: string;
  body: string;
  authorType: FeedbackAuthorType;
  authorId: string;
  authorName: string;
}): Promise<FeedbackMessage> {
  const db = createAdminClient();

  // Try dedicated tables
  try {
    const { data: newMsg, error } = await db
      .from("story_feedback_messages")
      .insert({
        thread_id: threadId,
        author_type: authorType,
        author_id: authorId,
        author_name: authorName,
        body: body.trim()
      })
      .select()
      .single();

    if (!error && newMsg) {
      await db
        .from("story_feedback_threads")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", threadId);

      return {
        id: newMsg.id,
        thread_id: newMsg.thread_id,
        author_type: newMsg.author_type,
        author_id: newMsg.author_id,
        author_name: newMsg.author_name,
        body: newMsg.body,
        created_at: newMsg.created_at
      };
    }
  } catch {
    // Fallback below
  }

  // Fallback via story_comments
  const now = new Date().toISOString();
  const payload = {
    thread_id: threadId,
    author_type: authorType,
    author_id: authorId,
    author_name: authorName,
    body: body.trim()
  };

  const { data: comment, error } = await db
    .from("story_comments")
    .insert({
      story_id: storyId,
      author_name: authorName,
      body: FALLBACK_PREFIX + JSON.stringify(payload)
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: comment.id,
    thread_id: threadId,
    author_type: authorType,
    author_id: authorId,
    author_name: authorName,
    body: body.trim(),
    created_at: comment.created_at || now
  };
}

export async function updateFeedbackThreadStatus({
  storyId,
  threadId,
  status
}: {
  storyId: string;
  threadId: string;
  status: FeedbackThreadStatus;
}): Promise<{ ok: boolean }> {
  const db = createAdminClient();

  try {
    const { error } = await db
      .from("story_feedback_threads")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", threadId);

    if (!error) return { ok: true };
  } catch {
    // Fallback below
  }

  // Fallback via story_comments: update all records with this thread_id
  try {
    const { data: comments } = await db
      .from("story_comments")
      .select("id, body")
      .eq("story_id", storyId);

    if (comments) {
      for (const c of comments) {
        if (typeof c.body === "string" && c.body.startsWith(FALLBACK_PREFIX)) {
          try {
            const p = JSON.parse(c.body.slice(FALLBACK_PREFIX.length));
            if (p.thread_id === threadId) {
              p.status = status;
              await db
                .from("story_comments")
                .update({ body: FALLBACK_PREFIX + JSON.stringify(p) })
                .eq("id", c.id);
            }
          } catch {
            // ignore
          }
        }
      }
    }
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function updateFeedbackMessage({
  messageId,
  body
}: {
  messageId: string;
  body: string;
}): Promise<{ ok: boolean }> {
  const db = createAdminClient();

  // Try dedicated tables
  try {
    const { data: existing, error: fetchErr } = await db
      .from("story_feedback_messages")
      .select("id")
      .eq("id", messageId)
      .maybeSingle();

    if (!fetchErr && existing) {
      const { error } = await db
        .from("story_feedback_messages")
        .update({ body: body.trim() })
        .eq("id", messageId);
      if (!error) return { ok: true };
    }
  } catch {
    // Fallback below
  }

  // Fallback via story_comments
  try {
    const { data: comment } = await db
      .from("story_comments")
      .select("id, body")
      .eq("id", messageId)
      .maybeSingle();

    if (comment && typeof comment.body === "string" && comment.body.startsWith(FALLBACK_PREFIX)) {
      const payload = JSON.parse(comment.body.slice(FALLBACK_PREFIX.length));
      payload.body = body.trim();
      await db
        .from("story_comments")
        .update({ body: FALLBACK_PREFIX + JSON.stringify(payload) })
        .eq("id", messageId);
      return { ok: true };
    }
  } catch {
    // Ignored
  }

  return { ok: false };
}

export async function deleteFeedbackMessage(messageId: string): Promise<{ ok: boolean }> {
  const db = createAdminClient();

  // Try dedicated tables
  try {
    const { error } = await db
      .from("story_feedback_messages")
      .delete()
      .eq("id", messageId);

    // Also delete from story_comments in case it's in the fallback
    await db.from("story_comments").delete().eq("id", messageId);

    if (!error) return { ok: true };
  } catch {
    // Fallback below
  }

  return { ok: false };
}

export async function getOpenFeedbackCountForStories(storyIds: string[]): Promise<Record<string, number>> {
  if (!storyIds || storyIds.length === 0) return {};
  const db = createAdminClient();
  const counts: Record<string, number> = {};
  for (const id of storyIds) counts[id] = 0;

  try {
    const { data: threads, error } = await db
      .from("story_feedback_threads")
      .select("story_id, status")
      .in("story_id", storyIds)
      .eq("status", "open");

    if (!error && threads) {
      for (const t of threads) {
        counts[t.story_id] = (counts[t.story_id] || 0) + 1;
      }
      return counts;
    }
  } catch {
    // Fallback below
  }

  // Fallback via story_comments
  try {
    const { data: comments } = await db
      .from("story_comments")
      .select("id, story_id, body")
      .in("story_id", storyIds);

    if (comments) {
      const openThreads = new Set<string>();
      for (const c of comments) {
        if (typeof c.body === "string" && c.body.startsWith(FALLBACK_PREFIX)) {
          try {
            const p = JSON.parse(c.body.slice(FALLBACK_PREFIX.length));
            if (p.status === "open" && p.thread_id) {
              openThreads.add(`${c.story_id}:::${p.thread_id}`);
            }
          } catch {
            // treat legacy as 1 open
            openThreads.add(`${c.story_id}:::${c.id}`);
          }
        } else if (c.body) {
          openThreads.add(`${c.story_id}:::${c.id}`);
        }
      }

      for (const key of openThreads) {
        const [sid] = key.split(":::");
        if (counts[sid] !== undefined) counts[sid]++;
      }
    }
  } catch {
    // Return zeros on failure
  }

  return counts;
}

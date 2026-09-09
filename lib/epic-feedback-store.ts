import { createAdminClient } from "@/lib/supabase/admin";
import type { FeedbackThread, FeedbackMessage, FeedbackAuthorType } from "@/lib/types";

import { getAuthenticatedTeamUser } from "@/lib/team-session";
import { getAuthenticatedClient } from "@/lib/client-session";
import { createClient } from "@/lib/supabase/server";

export async function resolveEpicSession(epicId: string) {
  const admin = createAdminClient();
  const { data: epic } = await admin
    .from("epics")
    .select("id, project_id")
    .eq("id", epicId)
    .maybeSingle();

  if (!epic) return { error: "Epic not found", status: 404 };

  // 1. Try Team User session
  const teamUser = await getAuthenticatedTeamUser();
  if (teamUser && teamUser.project_id === epic.project_id) {
    return {
      epic,
      authorType: "team_user" as FeedbackAuthorType,
      authorId: teamUser.id,
      authorName: teamUser.name || "Team Member",
    };
  }

  // 2. Try Admin session
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
        epic,
        authorType: "admin" as FeedbackAuthorType,
        authorId: user.id,
        authorName: "Super Admin",
      };
    }

    const { data: project } = await admin
      .from("projects")
      .select("id, owner_id")
      .eq("id", epic.project_id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (project) {
      return {
        epic,
        authorType: "admin" as FeedbackAuthorType,
        authorId: user.id,
        authorName: "Project Owner",
      };
    }
  }

  // 3. Try Client session
  const clientUser = await getAuthenticatedClient();
  if (clientUser && clientUser.project_id === epic.project_id) {
    return {
      epic,
      authorType: "client" as FeedbackAuthorType,
      authorId: clientUser.id,
      authorName: clientUser.name || "Client",
    };
  }

  return { error: "Unauthorized access to epic", status: 403 };
}

export async function getEpicFeedbackThreads(epicId: string): Promise<FeedbackThread[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("epic_feedback_threads")
    .select(`
      id,
      status,
      created_by_type,
      created_by_id,
      created_by_name,
      created_at,
      updated_at,
      messages:epic_feedback_messages (
        id,
        author_type,
        author_id,
        author_name,
        body,
        created_at
      )
    `)
    .eq("epic_id", epicId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    console.error("Failed to fetch epic feedback threads", error);
    return [];
  }

  // Map to unified FeedbackThread type (we reuse the same TS interfaces)
  return data.map((t: any) => ({
    id: t.id,
    story_id: epicId, // mapped for frontend compatibility
    section_type: "general", // dummy for frontend
    item_id: null,
    item_text: null,
    status: t.status,
    created_by_type: t.created_by_type,
    created_by_id: t.created_by_id,
    created_by_name: t.created_by_name,
    created_at: t.created_at,
    updated_at: t.updated_at,
    messages: (t.messages || [])
      .sort(
        (a: any, b: any) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      .map((m: any) => ({
        id: m.id,
        thread_id: t.id,
        author_type: m.author_type,
        author_id: m.author_id,
        author_name: m.author_name,
        body: m.body,
        created_at: m.created_at,
      })),
  }));
}

export async function addEpicFeedbackThread({
  epicId,
  authorType,
  authorId,
  authorName,
  body,
}: {
  epicId: string;
  authorType: FeedbackAuthorType;
  authorId: string;
  authorName: string;
  body: string;
}) {
  const db = createAdminClient();

  const { data: thread, error: threadErr } = await db
    .from("epic_feedback_threads")
    .insert({
      epic_id: epicId,
      status: "open",
      created_by_type: authorType,
      created_by_id: authorId,
      created_by_name: authorName,
    })
    .select()
    .single();

  if (threadErr || !thread) {
    console.error("Failed to create epic thread", threadErr);
    return { error: "Failed to create thread" };
  }

  const { data: message, error: msgErr } = await db
    .from("epic_feedback_messages")
    .insert({
      thread_id: thread.id,
      author_type: authorType,
      author_id: authorId,
      author_name: authorName,
      body,
    })
    .select()
    .single();

  if (msgErr || !message) {
    console.error("Failed to create epic message", msgErr);
    return { error: "Failed to create message" };
  }

  return { thread, message };
}

export async function addEpicFeedbackMessage({
  threadId,
  authorType,
  authorId,
  authorName,
  body,
}: {
  threadId: string;
  authorType: FeedbackAuthorType;
  authorId: string;
  authorName: string;
  body: string;
}) {
  const db = createAdminClient();

  const { data: message, error: msgErr } = await db
    .from("epic_feedback_messages")
    .insert({
      thread_id: threadId,
      author_type: authorType,
      author_id: authorId,
      author_name: authorName,
      body,
    })
    .select()
    .single();

  if (msgErr || !message) {
    console.error("Failed to add epic message", msgErr);
    return { error: "Failed to add message" };
  }

  // Update thread updated_at
  await db
    .from("epic_feedback_threads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", threadId);

  return { message };
}

export async function updateEpicFeedbackMessage({
  messageId,
  body,
}: {
  messageId: string;
  body: string;
}) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("epic_feedback_messages")
    .update({ body })
    .eq("id", messageId)
    .select()
    .single();

  if (error || !data) {
    console.error("Failed to update epic message", error);
    return { ok: false };
  }

  return { ok: true, data };
}

export async function deleteEpicFeedbackMessage(messageId: string) {
  const db = createAdminClient();
  const { error } = await db
    .from("epic_feedback_messages")
    .delete()
    .eq("id", messageId);

  if (error) {
    console.error("Failed to delete epic message", error);
    return { ok: false };
  }
  return { ok: true };
}

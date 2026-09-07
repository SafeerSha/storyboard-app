import { NextResponse } from "next/server";
import { getAuthenticatedInboxActor, verifyInboxItemAccess } from "@/lib/inbox-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateInboxAiChatResponse } from "@/lib/ai/inbox-chat";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; convId: string }> }
) {
  const actor = await getAuthenticatedInboxActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id, convId } = await params;
  const access = await verifyInboxItemAccess(actor, id);
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Inbox item not found or access denied." }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 10), 100);
  const before = searchParams.get("before"); // ISO timestamp for cursor pagination

  const db = createAdminClient();

  try {
    let messages: any[] = [];
    let hasMore = false;

    // 1. Query project_inbox_messages
    let query = db
      .from("project_inbox_messages")
      .select("id, conversation_id, sender_type, user_id, user_type, user_name, message, created_at")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: false })
      .limit(limit + 1);

    if (before) {
      query = query.lt("created_at", before);
    }

    const { data: msgRows, error: msgError } = await query;

    if (!msgError && msgRows) {
      if (msgRows.length > limit) {
        hasMore = true;
        messages = msgRows.slice(0, limit);
      } else {
        messages = msgRows;
      }
      // Reverse to chronological order (oldest to newest)
      messages.reverse();
    } else {
      // 2. Fallback to legacy project_inbox_ai_messages
      let legacyQuery = db
        .from("project_inbox_ai_messages")
        .select("id, thread_id, role, content, created_at")
        .eq("thread_id", convId)
        .order("created_at", { ascending: false })
        .limit(limit + 1);

      if (before) {
        legacyQuery = legacyQuery.lt("created_at", before);
      }

      const { data: legacyRows } = await legacyQuery;
      if (legacyRows) {
        if (legacyRows.length > limit) {
          hasMore = true;
          messages = legacyRows.slice(0, limit);
        } else {
          messages = legacyRows;
        }
        messages = messages.map((m) => ({
          id: m.id,
          conversation_id: m.thread_id,
          sender_type: m.role === "user" ? "user" : "ai",
          user_id: null,
          user_name: m.role === "user" ? "User" : "AI Thinking Partner",
          message: m.content,
          created_at: m.created_at,
        })).reverse();
      }
    }

    // 3. Query saved insight message IDs for this item to indicate which messages are already saved
    const savedMessageIds: string[] = [];
    try {
      const { data: insights } = await db
        .from("project_inbox_insights")
        .select("message_id")
        .eq("inbox_item_id", id);
      (insights || []).forEach((ins: any) => savedMessageIds.push(ins.message_id));
    } catch {}

    return NextResponse.json({
      messages,
      savedMessageIds,
      hasMore,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load messages." }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; convId: string }> }
) {
  const actor = await getAuthenticatedInboxActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id, convId } = await params;
  const access = await verifyInboxItemAccess(actor, id);
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Inbox item not found or access denied." }, { status: 404 });
  }

  const db = createAdminClient();

  try {
    const body = await req.json();
    const prompt = String(body.message || body.content || "").trim();
    if (!prompt) {
      return NextResponse.json({ error: "Message cannot be empty." }, { status: 400 });
    }

    // Determine if this is an AI query or a human team discussion message
    const isAiQuery = body.isAiQuery !== false; // Default true

    // 1. Insert user message
    let userMessage: any = null;
    const { data: userMsgRow, error: userMsgError } = await db
      .from("project_inbox_messages")
      .insert({
        conversation_id: convId,
        sender_type: "user",
        user_id: actor.id,
        user_type: actor.type,
        user_name: actor.name,
        message: prompt,
      })
      .select()
      .single();

    if (!userMsgError && userMsgRow) {
      userMessage = userMsgRow;
    } else {
      // Legacy fallback
      const { data: legacyUserMsg } = await db
        .from("project_inbox_ai_messages")
        .insert({
          thread_id: convId,
          role: "user",
          content: prompt,
        })
        .select()
        .single();
      if (legacyUserMsg) {
        userMessage = {
          id: legacyUserMsg.id,
          conversation_id: convId,
          sender_type: "user",
          user_id: actor.id,
          user_name: actor.name,
          message: legacyUserMsg.content,
          created_at: legacyUserMsg.created_at,
        };
      }
    }

    if (!isAiQuery) {
      // Human-to-human discussion message only
      const now = new Date().toISOString();
      await db.from("project_inbox_conversations").update({ updated_at: now }).eq("id", convId);
      await db.from("project_inbox_items").update({ updated_at: now }).eq("id", id);

      return NextResponse.json({ userMessage }, { status: 201 });
    }

    // 2. Human-to-AI query: fetch item context & bounded history
    const { data: item } = await db
      .from("project_inbox_items")
      .select("title, description, type, status, priority, notes, research_notes")
      .eq("id", id)
      .single();

    if (!item) {
      return NextResponse.json({ error: "Inbox item not found." }, { status: 404 });
    }

    const { data: links } = await db
      .from("project_inbox_links")
      .select("title, url")
      .eq("inbox_item_id", id);

    // Fetch prior messages for this conversation (bounded to last 15)
    let priorMessages: any[] = [];
    const { data: prevMsgs } = await db
      .from("project_inbox_messages")
      .select("sender_type, user_name, message")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: false })
      .limit(16);

    if (prevMsgs && prevMsgs.length > 0) {
      // Exclude the current message we just inserted
      priorMessages = prevMsgs
        .slice(1)
        .reverse()
        .map((m) => ({
          role: m.sender_type === "user" ? ("user" as const) : ("assistant" as const),
          content: m.message,
          userName: m.user_name,
        }));
    } else {
      // Legacy fallback
      const { data: legPrev } = await db
        .from("project_inbox_ai_messages")
        .select("role, content")
        .eq("thread_id", convId)
        .order("created_at", { ascending: false })
        .limit(16);

      if (legPrev && legPrev.length > 0) {
        priorMessages = legPrev
          .slice(1)
          .reverse()
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));
      }
    }

    // 3. Call Gemini
    let aiResult;
    try {
      aiResult = await generateInboxAiChatResponse({
        item,
        links: links || [],
        history: priorMessages,
        prompt,
        userName: actor.name,
      });
    } catch (aiErr: any) {
      console.error("Gemini invocation error:", aiErr);
      return NextResponse.json(
        {
          error: "AI Thinking Partner couldn't respond right now. Please try again.",
          userMessage,
        },
        { status: 502 }
      );
    }

    // 4. Save AI message to database
    let assistantMessage: any = null;
    const { data: aiMsgRow, error: aiMsgError } = await db
      .from("project_inbox_messages")
      .insert({
        conversation_id: convId,
        sender_type: "ai",
        user_id: null,
        user_name: "AI Thinking Partner",
        message: aiResult.response,
      })
      .select()
      .single();

    if (!aiMsgError && aiMsgRow) {
      assistantMessage = aiMsgRow;
    } else {
      // Legacy fallback
      const { data: legAiMsg } = await db
        .from("project_inbox_ai_messages")
        .insert({
          thread_id: convId,
          role: "assistant",
          content: aiResult.response,
        })
        .select()
        .single();

      if (legAiMsg) {
        assistantMessage = {
          id: legAiMsg.id,
          conversation_id: convId,
          sender_type: "ai",
          user_id: null,
          user_name: "AI Thinking Partner",
          message: legAiMsg.content,
          created_at: legAiMsg.created_at,
        };
      }
    }

    // Touch updated_at timestamps
    const nowIso = new Date().toISOString();
    await Promise.all([
      db.from("project_inbox_conversations").update({ updated_at: nowIso }).eq("id", convId),
      db.from("project_inbox_ai_threads").update({ updated_at: nowIso }).eq("id", convId),
      db.from("project_inbox_items").update({ updated_at: nowIso }).eq("id", id),
    ]);

    return NextResponse.json({
      userMessage,
      assistantMessage,
      insightMetadata: {
        question_summary: aiResult.question_summary,
        ai_response_summary: aiResult.ai_response_summary,
        suggested_type: aiResult.suggested_type,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process message." }, { status: 500 });
  }
}

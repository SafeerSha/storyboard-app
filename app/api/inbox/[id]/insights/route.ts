import { NextResponse } from "next/server";
import { getAuthenticatedInboxActor, verifyInboxItemAccess } from "@/lib/inbox-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProjectInboxInsightType } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getAuthenticatedInboxActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const access = await verifyInboxItemAccess(actor, id);
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Inbox item not found or access denied." }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const typeParam = searchParams.get("type");
  const searchQuery = (searchParams.get("search") || "").trim().toLowerCase();
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 20, 5), 50);
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

  const db = createAdminClient();

  try {
    let query = db
      .from("project_inbox_insights")
      .select(
        "id, inbox_item_id, conversation_id, message_id, type, title, question, question_summary, ai_response, ai_response_summary, saved_by, saved_by_name, saved_by_type, created_at, updated_at",
        { count: "exact" }
      )
      .eq("inbox_item_id", id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (typeParam && typeParam !== "all") {
      query = query.eq("type", typeParam);
    }

    if (searchQuery) {
      query = query.or(
        `question.ilike.%${searchQuery}%,question_summary.ilike.%${searchQuery}%,ai_response_summary.ilike.%${searchQuery}%,title.ilike.%${searchQuery}%`
      );
    }

    const { data: insights, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      insights: insights || [],
      totalCount: count || 0,
      hasMore: (count || 0) > offset + limit,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load insights." }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getAuthenticatedInboxActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const access = await verifyInboxItemAccess(actor, id);
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Inbox item not found or access denied." }, { status: 404 });
  }

  const db = createAdminClient();

  try {
    const body = await req.json();
    const messageId = String(body.messageId || "").trim();
    if (!messageId) {
      return NextResponse.json({ error: "Message ID is required." }, { status: 400 });
    }

    // 1. Check if insight for this message was already saved (idempotent)
    const { data: existingInsight } = await db
      .from("project_inbox_insights")
      .select("id, inbox_item_id, message_id, type, question, ai_response, saved_by_name, created_at")
      .eq("inbox_item_id", id)
      .eq("message_id", messageId)
      .maybeSingle();

    if (existingInsight) {
      return NextResponse.json({
        success: true,
        alreadySaved: true,
        insight: existingInsight,
      });
    }

    // 2. Fetch the target message and verify it belongs to this inbox item
    let targetMessage: any = null;
    let conversationId = body.conversationId;

    const { data: msgRow } = await db
      .from("project_inbox_messages")
      .select("id, conversation_id, sender_type, message, created_at")
      .eq("id", messageId)
      .maybeSingle();

    if (msgRow) {
      targetMessage = msgRow;
      conversationId = msgRow.conversation_id;
    } else {
      // Legacy fallback
      const { data: legMsg } = await db
        .from("project_inbox_ai_messages")
        .select("id, thread_id, role, content, created_at")
        .eq("id", messageId)
        .maybeSingle();
      if (legMsg) {
        targetMessage = {
          id: legMsg.id,
          conversation_id: legMsg.thread_id,
          sender_type: legMsg.role === "assistant" ? "ai" : "user",
          message: legMsg.content,
          created_at: legMsg.created_at,
        };
        conversationId = legMsg.thread_id;
      }
    }

    if (!targetMessage) {
      return NextResponse.json({ error: "Message not found." }, { status: 404 });
    }

    // Security check: Verify conversation belongs to this inbox item
    let validConv = false;
    const { data: conv } = await db
      .from("project_inbox_conversations")
      .select("id, inbox_item_id")
      .eq("id", conversationId)
      .eq("inbox_item_id", id)
      .maybeSingle();

    if (conv) {
      validConv = true;
    } else {
      const { data: legThread } = await db
        .from("project_inbox_ai_threads")
        .select("id, inbox_item_id")
        .eq("id", conversationId)
        .eq("inbox_item_id", id)
        .maybeSingle();
      if (legThread) validConv = true;
    }

    if (!validConv) {
      return NextResponse.json(
        { error: "Security violation: message does not belong to this inbox idea." },
        { status: 403 }
      );
    }

    // 3. Resolve original question from conversation
    let questionText = body.question ? String(body.question).trim() : "";
    let questionSummary = body.question_summary ? String(body.question_summary).trim() : "";

    if (!questionText) {
      // Find the user message immediately preceding this message in the conversation
      const { data: priorUserMsgs } = await db
        .from("project_inbox_messages")
        .select("message")
        .eq("conversation_id", conversationId)
        .eq("sender_type", "user")
        .lt("created_at", targetMessage.created_at)
        .order("created_at", { ascending: false })
        .limit(1);

      if (priorUserMsgs && priorUserMsgs.length > 0) {
        questionText = priorUserMsgs[0].message;
      } else {
        const { data: legPrior } = await db
          .from("project_inbox_ai_messages")
          .select("content")
          .eq("thread_id", conversationId)
          .eq("role", "user")
          .lt("created_at", targetMessage.created_at)
          .order("created_at", { ascending: false })
          .limit(1);

        if (legPrior && legPrior.length > 0) {
          questionText = legPrior[0].content;
        } else {
          questionText = "Exploration inquiry";
        }
      }
    }

    if (!questionSummary) {
      questionSummary = questionText.length > 80 ? questionText.slice(0, 77) + "..." : questionText;
    }

    // 4. Resolve AI response and summary
    const aiResponseText = targetMessage.message;
    let aiSummary = body.ai_response_summary ? String(body.ai_response_summary).trim() : "";

    if (!aiSummary) {
      const lines = aiResponseText
        .split("\n")
        .map((l: string) => l.replace(/^#+\s*/, "").replace(/^[-*]\s*/, "").trim())
        .filter((l: string) => l.length > 20);
      aiSummary = lines[0] ? lines[0].slice(0, 160) : aiResponseText.slice(0, 160);
    }

    // 5. Type and title
    const insightType: ProjectInboxInsightType = body.type || "insight";
    const title = body.title ? String(body.title).trim() : questionSummary;

    // 6. Insert insight
    const { data: newInsight, error: insertError } = await db
      .from("project_inbox_insights")
      .insert({
        inbox_item_id: id,
        conversation_id: conversationId,
        message_id: messageId,
        type: insightType,
        title,
        question: questionText,
        question_summary: questionSummary,
        ai_response: aiResponseText,
        ai_response_summary: aiSummary,
        saved_by: actor.id,
        saved_by_name: actor.name,
        saved_by_type: actor.type,
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        // Unique constraint hit on duplicate save
        return NextResponse.json({ success: true, alreadySaved: true });
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, insight: newInsight }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to save insight." }, { status: 500 });
  }
}

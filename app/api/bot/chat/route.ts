import { NextResponse } from "next/server";
import { getAuthenticatedInboxActor } from "@/lib/inbox-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { processWorkspaceCopilotMessage } from "@/lib/ai/workspace-copilot";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const actor = await getAuthenticatedInboxActor();
    if (!actor) {
      return new NextResponse("Unauthorized. Please log in.", { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const prompt = (body.prompt || "").trim();
    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }

    const activeProjectId = body.projectId || null;
    const history = Array.isArray(body.history) ? body.history : [];
    let conversationId = body.conversationId || null;

    const admin = createAdminClient();

    // 1. Manage Conversation Persistence (if tables exist)
    if (!conversationId) {
      try {
        const { data: conv } = await admin
          .from("workspace_bot_conversations")
          .insert({
            user_id: actor.id,
            user_type: actor.type,
            project_id: activeProjectId,
            title: prompt.slice(0, 45) + (prompt.length > 45 ? "..." : ""),
          })
          .select("id")
          .single();

        if (conv) {
          conversationId = conv.id;
        }
      } catch {
        // Table may not be migrated yet; fallback smoothly without breaking chat
      }
    }

    // Save User message if conversation exists
    if (conversationId) {
      try {
        await admin.from("workspace_bot_messages").insert({
          conversation_id: conversationId,
          sender_type: "user",
          content: prompt,
        });
      } catch {}
    }

    // 2. Execute Copilot AI Engine with Tools
    const result = await processWorkspaceCopilotMessage({
      actor,
      prompt,
      history,
      activeProjectId,
    });

    // 3. Save Assistant Message and Action Receipts
    if (conversationId) {
      try {
        await admin.from("workspace_bot_messages").insert({
          conversation_id: conversationId,
          sender_type: "assistant",
          content: result.content,
          metadata: { actionReceipts: result.actionReceipts },
        });

        await admin
          .from("workspace_bot_conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conversationId);
      } catch {}
    }

    return NextResponse.json({
      content: result.content,
      actionReceipts: result.actionReceipts,
      conversationId,
    });
  } catch (err: any) {
    console.error("Workspace Copilot error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process message with AI Copilot." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getAuthenticatedInboxActor } from "@/lib/inbox-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const actor = await getAuthenticatedInboxActor();
    if (!actor) {
      return new NextResponse("Unauthorized.", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const admin = createAdminClient();

    // 1. Fetch messages for a specific conversation
    if (id) {
      const { data: conv } = await admin
        .from("workspace_bot_conversations")
        .select("id, title, project_id, created_at")
        .eq("id", id)
        .eq("user_id", actor.id)
        .maybeSingle();

      if (!conv) {
        return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
      }

      const { data: messages, error } = await admin
        .from("workspace_bot_messages")
        .select("id, sender_type, content, metadata, created_at")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        conversation: conv,
        messages: messages || [],
      });
    }

    // 2. Fetch list of recorded conversations
    const { data: convs, error } = await admin
      .from("workspace_bot_conversations")
      .select("id, title, project_id, created_at, updated_at")
      .eq("user_id", actor.id)
      .order("updated_at", { ascending: false })
      .limit(30);

    if (error) {
      return NextResponse.json({ conversations: [] });
    }

    return NextResponse.json({ conversations: convs || [] });
  } catch {
    return NextResponse.json({ conversations: [] });
  }
}

export async function DELETE(req: Request) {
  try {
    const actor = await getAuthenticatedInboxActor();
    if (!actor) {
      return new NextResponse("Unauthorized.", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const admin = createAdminClient();

    if (id) {
      await admin
        .from("workspace_bot_conversations")
        .delete()
        .eq("id", id)
        .eq("user_id", actor.id);
    } else {
      await admin
        .from("workspace_bot_conversations")
        .delete()
        .eq("user_id", actor.id);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/super-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateInboxAiChatResponse } from "@/lib/ai/inbox-chat";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; threadId: string }> }
) {
  const admin = await verifySuperAdmin();
  if (!admin) {
    return new NextResponse("Unauthorized. Super Admin access required.", { status: 403 });
  }

  const { id, threadId } = await params;
  const db = createAdminClient();

  try {
    // Verify item ownership
    const { data: item } = await db
      .from("project_inbox_items")
      .select("id")
      .eq("id", id)
      .eq("owner_id", admin.id)
      .single();

    if (!item) {
      return NextResponse.json({ error: "Inbox item not found." }, { status: 404 });
    }

    const { data: messages, error } = await db
      .from("project_inbox_ai_messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ messages: messages || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; threadId: string }> }
) {
  const admin = await verifySuperAdmin();
  if (!admin) {
    return new NextResponse("Unauthorized. Super Admin access required.", { status: 403 });
  }

  const { id, threadId } = await params;
  const db = createAdminClient();

  try {
    // 1. Verify item and fetch context
    const { data: item, error: itemError } = await db
      .from("project_inbox_items")
      .select("*")
      .eq("id", id)
      .eq("owner_id", admin.id)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: "Inbox item not found." }, { status: 404 });
    }

    // 2. Fetch associated links for context
    const { data: links } = await db
      .from("project_inbox_links")
      .select("*")
      .eq("inbox_item_id", id);

    const body = await req.json();
    const prompt = (body.content || "").trim();
    if (!prompt) {
      return NextResponse.json({ error: "Message content cannot be empty." }, { status: 400 });
    }

    // 3. Save User message to DB
    const { data: userMessage, error: userMsgError } = await db
      .from("project_inbox_ai_messages")
      .insert({
        thread_id: threadId,
        role: "user",
        content: prompt,
      })
      .select()
      .single();

    if (userMsgError) {
      return NextResponse.json({ error: userMsgError.message }, { status: 500 });
    }

    // 4. Fetch prior history for conversational context
    const { data: previousMessages } = await db
      .from("project_inbox_ai_messages")
      .select("role, content")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(20);

    const history = (previousMessages || [])
      .slice(0, -1) // Exclude the message we just inserted
      .map((m: any) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    // 5. Query Gemini Thinking Partner
    let aiResponseText: string;
    try {
      aiResponseText = await generateInboxAiChatResponse({
        item,
        links: links || [],
        history,
        prompt,
      });
    } catch (aiErr: any) {
      console.error("Gemini AI error:", aiErr);
      return NextResponse.json(
        {
          error: "AI couldn't respond right now. Please try again.",
          userMessage,
        },
        { status: 502 }
      );
    }

    // 6. Save Assistant response to DB
    const { data: assistantMessage, error: aiMsgError } = await db
      .from("project_inbox_ai_messages")
      .insert({
        thread_id: threadId,
        role: "assistant",
        content: aiResponseText,
      })
      .select()
      .single();

    if (aiMsgError) {
      return NextResponse.json({ error: aiMsgError.message }, { status: 500 });
    }

    // Touch thread and inbox item updated_at
    const nowIso = new Date().toISOString();
    await Promise.all([
      db.from("project_inbox_ai_threads").update({ updated_at: nowIso }).eq("id", threadId),
      db.from("project_inbox_items").update({ updated_at: nowIso }).eq("id", id),
    ]);

    return NextResponse.json({
      userMessage,
      assistantMessage,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process message." }, { status: 500 });
  }
}

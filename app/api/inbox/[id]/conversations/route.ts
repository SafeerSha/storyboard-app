import { NextResponse } from "next/server";
import { getAuthenticatedInboxActor, verifyInboxItemAccess } from "@/lib/inbox-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
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
    // 1. Try project_inbox_conversations table
    let conversations: any[] = [];
    const { data: convRows, error: convError } = await db
      .from("project_inbox_conversations")
      .select("id, inbox_item_id, title, created_by, created_at, updated_at")
      .eq("inbox_item_id", id)
      .order("updated_at", { ascending: false });

    if (!convError && convRows && convRows.length > 0) {
      conversations = convRows;
    } else {
      // Fallback to legacy project_inbox_ai_threads
      const { data: threadRows } = await db
        .from("project_inbox_ai_threads")
        .select("id, inbox_item_id, title, created_at, updated_at")
        .eq("inbox_item_id", id)
        .order("created_at", { ascending: true });

      conversations = threadRows || [];
    }

    // If still empty, ensure a default "General Discussion" is created
    if (conversations.length === 0) {
      try {
        const { data: newConv } = await db
          .from("project_inbox_conversations")
          .insert({
            inbox_item_id: id,
            title: "General Discussion",
            created_by: actor.id,
          })
          .select()
          .single();

        if (newConv) conversations = [newConv];
      } catch {
        // Legacy fallback
        try {
          const { data: newThread } = await db
            .from("project_inbox_ai_threads")
            .insert({
              inbox_item_id: id,
              title: "General Discussion",
            })
            .select()
            .single();
          if (newThread) conversations = [newThread];
        } catch {}
      }
    }

    return NextResponse.json({ conversations });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load discussions." }, { status: 500 });
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

  const body = await req.json();
  const title = String(body.title || "").trim();
  if (!title) {
    return NextResponse.json({ error: "Discussion title is required." }, { status: 400 });
  }

  const db = createAdminClient();

  try {
    let createdConv: any = null;

    // 1. Try project_inbox_conversations
    const { data: convData, error: convError } = await db
      .from("project_inbox_conversations")
      .insert({
        inbox_item_id: id,
        title,
        created_by: actor.id,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (!convError && convData) {
      createdConv = convData;
    } else {
      // 2. Fallback to project_inbox_ai_threads
      const { data: threadData, error: threadError } = await db
        .from("project_inbox_ai_threads")
        .insert({
          inbox_item_id: id,
          title,
        })
        .select()
        .single();

      if (threadError) {
        return NextResponse.json({ error: threadError.message }, { status: 500 });
      }
      createdConv = threadData;
    }

    return NextResponse.json({ conversation: createdConv }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create discussion." }, { status: 500 });
  }
}

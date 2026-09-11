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
    return new NextResponse("Unauthorized. Please log in.", { status: 401 });
  }

  const { id } = await params;
  const access = await verifyInboxItemAccess(actor, id);
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Inbox item not found or access denied." }, { status: 404 });
  }

  const db = createAdminClient();

  try {
    const { data: threads, error } = await db
      .from("project_inbox_ai_threads")
      .select("*")
      .eq("inbox_item_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ threads: threads || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getAuthenticatedInboxActor();
  if (!actor) {
    return new NextResponse("Unauthorized. Please log in.", { status: 401 });
  }

  const { id } = await params;
  const access = await verifyInboxItemAccess(actor, id);
  if (!access.hasAccess || !access.canEditItem) {
    return NextResponse.json({ error: "Forbidden. Only the item owner can create discussion threads." }, { status: 403 });
  }

  const db = createAdminClient();

  try {
    const body = await req.json().catch(() => ({}));
    const title = (body.title || "New Discussion").trim();

    const { data: newThread, error } = await db
      .from("project_inbox_ai_threads")
      .insert({
        inbox_item_id: id,
        title,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ thread: newThread }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create thread." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getAuthenticatedInboxActor, verifyInboxItemAccess } from "@/lib/inbox-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; insightId: string }> }
) {
  const actor = await getAuthenticatedInboxActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id, insightId } = await params;
  const access = await verifyInboxItemAccess(actor, id);
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Inbox item not found or access denied." }, { status: 404 });
  }

  const db = createAdminClient();

  try {
    const { data: insight, error: findError } = await db
      .from("project_inbox_insights")
      .select("id, inbox_item_id, saved_by")
      .eq("id", insightId)
      .eq("inbox_item_id", id)
      .single();

    if (findError || !insight) {
      return NextResponse.json({ error: "Insight not found." }, { status: 404 });
    }

    if (!access.isOwner && insight.saved_by !== actor.id) {
      return NextResponse.json(
        { error: "Forbidden. You can only edit insights you saved." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (body.type !== undefined) updates.type = body.type;
    if (body.title !== undefined) updates.title = String(body.title).trim();
    if (body.ai_response_summary !== undefined) updates.ai_response_summary = String(body.ai_response_summary).trim();
    if (body.question_summary !== undefined) updates.question_summary = String(body.question_summary).trim();

    const { data: updated, error: updateError } = await db
      .from("project_inbox_insights")
      .update(updates)
      .eq("id", insightId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, insight: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update insight." }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; insightId: string }> }
) {
  const actor = await getAuthenticatedInboxActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id, insightId } = await params;
  const access = await verifyInboxItemAccess(actor, id);
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Inbox item not found or access denied." }, { status: 404 });
  }

  const db = createAdminClient();

  try {
    const { data: insight, error: findError } = await db
      .from("project_inbox_insights")
      .select("id, inbox_item_id, saved_by")
      .eq("id", insightId)
      .eq("inbox_item_id", id)
      .single();

    if (findError || !insight) {
      return NextResponse.json({ error: "Insight not found." }, { status: 404 });
    }

    if (!access.isOwner && insight.saved_by !== actor.id) {
      return NextResponse.json(
        { error: "Forbidden. You can only delete insights you saved." },
        { status: 403 }
      );
    }

    const { error: deleteError } = await db
      .from("project_inbox_insights")
      .delete()
      .eq("id", insightId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete insight." }, { status: 500 });
  }
}

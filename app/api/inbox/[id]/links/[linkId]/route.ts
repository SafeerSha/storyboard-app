import { NextResponse } from "next/server";
import { getAuthenticatedInboxActor, verifyInboxItemAccess } from "@/lib/inbox-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const actor = await getAuthenticatedInboxActor();
  if (!actor) {
    return new NextResponse("Unauthorized. Please log in.", { status: 401 });
  }

  const { id, linkId } = await params;
  const access = await verifyInboxItemAccess(actor, id);
  if (!access.hasAccess || !access.canEditItem) {
    return NextResponse.json({ error: "Forbidden. Only the item owner can edit links." }, { status: 403 });
  }

  const db = createAdminClient();

  try {
    const body = await req.json();
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.url !== undefined) {
      let url = body.url.trim();
      if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
        url = `https://${url}`;
      }
      updates.url = url;
    }

    const { data: updatedLink, error } = await db
      .from("project_inbox_links")
      .update(updates)
      .eq("id", linkId)
      .eq("inbox_item_id", id)
      .select()
      .single();

    if (error || !updatedLink) {
      return NextResponse.json({ error: error?.message || "Failed to update link." }, { status: 400 });
    }

    return NextResponse.json({ link: updatedLink });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const actor = await getAuthenticatedInboxActor();
  if (!actor) {
    return new NextResponse("Unauthorized. Please log in.", { status: 401 });
  }

  const { id, linkId } = await params;
  const access = await verifyInboxItemAccess(actor, id);
  if (!access.hasAccess || !access.canEditItem) {
    return NextResponse.json({ error: "Forbidden. Only the item owner can delete links." }, { status: 403 });
  }

  const db = createAdminClient();

  try {
    const { error } = await db
      .from("project_inbox_links")
      .delete()
      .eq("id", linkId)
      .eq("inbox_item_id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

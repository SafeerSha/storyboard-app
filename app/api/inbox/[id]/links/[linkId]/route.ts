import { NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/super-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const admin = await verifySuperAdmin();
  if (!admin) {
    return new NextResponse("Unauthorized. Super Admin access required.", { status: 403 });
  }

  const { id, linkId } = await params;
  const db = createAdminClient();

  try {
    // Verify ownership of the parent item
    const { data: item } = await db
      .from("project_inbox_items")
      .select("id")
      .eq("id", id)
      .eq("owner_id", admin.id)
      .single();

    if (!item) {
      return NextResponse.json({ error: "Inbox item not found." }, { status: 404 });
    }

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
  const admin = await verifySuperAdmin();
  if (!admin) {
    return new NextResponse("Unauthorized. Super Admin access required.", { status: 403 });
  }

  const { id, linkId } = await params;
  const db = createAdminClient();

  try {
    // Verify ownership
    const { data: item } = await db
      .from("project_inbox_items")
      .select("id")
      .eq("id", id)
      .eq("owner_id", admin.id)
      .single();

    if (!item) {
      return NextResponse.json({ error: "Inbox item not found." }, { status: 404 });
    }

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

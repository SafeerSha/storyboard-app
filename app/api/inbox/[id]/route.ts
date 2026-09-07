import { NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/super-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifySuperAdmin();
  if (!admin) {
    return new NextResponse("Unauthorized. Super Admin access required.", { status: 403 });
  }

  const { id } = await params;
  const db = createAdminClient();

  try {
    const { data: item, error: itemError } = await db
      .from("project_inbox_items")
      .select("*, converted_project:projects(id, name)")
      .eq("id", id)
      .eq("owner_id", admin.id)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: "Inbox item not found." }, { status: 404 });
    }

    // Fetch links for this item
    const { data: links } = await db
      .from("project_inbox_links")
      .select("*")
      .eq("inbox_item_id", id)
      .order("created_at", { ascending: true });

    // Fetch threads summary
    const { data: threads } = await db
      .from("project_inbox_ai_threads")
      .select("id, title, created_at, updated_at")
      .eq("inbox_item_id", id)
      .order("created_at", { ascending: true });

    return NextResponse.json({
      item: {
        ...item,
        links: links || [],
        ai_threads: threads || [],
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load item." }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifySuperAdmin();
  if (!admin) {
    return new NextResponse("Unauthorized. Super Admin access required.", { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const allowedFields = [
      "title",
      "description",
      "type",
      "status",
      "priority",
      "notes",
      "research_notes",
    ];

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    const db = createAdminClient();

    const { data: updatedItem, error } = await db
      .from("project_inbox_items")
      .update(updates)
      .eq("id", id)
      .eq("owner_id", admin.id)
      .select("*, converted_project:projects(id, name)")
      .single();

    if (error || !updatedItem) {
      return NextResponse.json({ error: error?.message || "Failed to update item." }, { status: 400 });
    }

    return NextResponse.json({ item: updatedItem });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update item." }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifySuperAdmin();
  if (!admin) {
    return new NextResponse("Unauthorized. Super Admin access required.", { status: 403 });
  }

  const { id } = await params;
  const db = createAdminClient();

  try {
    const { error } = await db
      .from("project_inbox_items")
      .delete()
      .eq("id", id)
      .eq("owner_id", admin.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete item." }, { status: 500 });
  }
}

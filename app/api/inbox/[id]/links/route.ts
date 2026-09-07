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
    const { data: item } = await db
      .from("project_inbox_items")
      .select("id")
      .eq("id", id)
      .eq("owner_id", admin.id)
      .single();

    if (!item) {
      return NextResponse.json({ error: "Inbox item not found." }, { status: 404 });
    }

    const { data: links, error } = await db
      .from("project_inbox_links")
      .select("*")
      .eq("inbox_item_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ links: links || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifySuperAdmin();
  if (!admin) {
    return new NextResponse("Unauthorized. Super Admin access required.", { status: 403 });
  }

  const { id } = await params;
  const db = createAdminClient();

  try {
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
    const title = (body.title || "").trim();
    let url = (body.url || "").trim();

    if (!title || !url) {
      return NextResponse.json({ error: "Link title and URL are required." }, { status: 400 });
    }

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }

    const { data: newLink, error } = await db
      .from("project_inbox_links")
      .insert({
        inbox_item_id: id,
        title,
        url,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Touch parent item updated_at
    await db
      .from("project_inbox_items")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({ link: newLink }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to add link." }, { status: 500 });
  }
}

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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/super-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const admin = await verifySuperAdmin();
  if (!admin) {
    return new NextResponse("Unauthorized. Super Admin access required.", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status") || "active";
  const typeParam = searchParams.get("type");
  const priorityParam = searchParams.get("priority");
  const searchParam = searchParams.get("search")?.trim().toLowerCase();
  const sortParam = searchParams.get("sort") || "updated_at";

  const db = createAdminClient();

  try {
    let query = db
      .from("project_inbox_items")
      .select("id, owner_id, title, description, type, status, priority, converted_project_id, converted_at, created_at, updated_at, converted_project:projects(id, name)")
      .eq("owner_id", admin.id);

    // Status filter: by default "active" shows non-archived items
    if (statusParam === "active") {
      query = query.neq("status", "archived");
    } else if (statusParam !== "all") {
      query = query.eq("status", statusParam);
    }

    if (typeParam && typeParam !== "all") {
      query = query.eq("type", typeParam);
    }

    if (priorityParam && priorityParam !== "all") {
      query = query.eq("priority", priorityParam);
    }

    // Database-level text search across title and description
    if (searchParam) {
      query = query.or(`title.ilike.%${searchParam}%,description.ilike.%${searchParam}%`);
    }

    // Sort order
    if (sortParam === "created_at") {
      query = query.order("created_at", { ascending: false });
    } else if (sortParam === "priority") {
      query = query.order("priority", { ascending: false }).order("updated_at", { ascending: false });
    } else if (sortParam === "status") {
      query = query.order("status", { ascending: true }).order("updated_at", { ascending: false });
    } else {
      query = query.order("updated_at", { ascending: false });
    }

    // Bound maximum items to protect free-tier memory and egress
    query = query.limit(100);

    const { data: items, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ items: items || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch inbox items." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const admin = await verifySuperAdmin();
  if (!admin) {
    return new NextResponse("Unauthorized. Super Admin access required.", { status: 403 });
  }

  try {
    const body = await req.json();
    let { title, description, type, status, priority, notes, research_notes } = body;

    const rawText = (title || "").trim();
    if (!rawText) {
      return NextResponse.json({ error: "Idea title or text is required." }, { status: 400 });
    }

    // If title has newline or is long, split title and description gracefully
    let resolvedTitle = rawText;
    let resolvedDescription = (description || "").trim();

    if (rawText.includes("\n") && !resolvedDescription) {
      const parts = rawText.split("\n").map((p: string) => p.trim()).filter(Boolean);
      resolvedTitle = parts[0];
      resolvedDescription = parts.slice(1).join("\n");
    }

    // Restrict title length comfortably
    if (resolvedTitle.length > 120 && !resolvedDescription) {
      resolvedDescription = resolvedTitle;
      resolvedTitle = resolvedTitle.slice(0, 80) + "...";
    }

    const db = createAdminClient();

    const { data: newItem, error } = await db
      .from("project_inbox_items")
      .insert({
        owner_id: admin.id,
        title: resolvedTitle,
        description: resolvedDescription,
        type: type || "idea",
        status: status || "inbox",
        priority: priority || "medium",
        notes: notes || "",
        research_notes: research_notes || "",
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Automatically create a default AI thread for this inbox item
    try {
      await db.from("project_inbox_ai_threads").insert({
        inbox_item_id: newItem.id,
        title: "General Discussion",
      });
    } catch {
      // Non-blocking if threads table is pending
    }

    return NextResponse.json({ item: newItem }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create inbox item." }, { status: 500 });
  }
}

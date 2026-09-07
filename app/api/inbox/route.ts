import { NextResponse } from "next/server";
import { getAuthenticatedInboxActor } from "@/lib/inbox-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await getAuthenticatedInboxActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status") || "active";
  const typeParam = searchParams.get("type");
  const priorityParam = searchParams.get("priority");
  const searchParam = searchParams.get("search")?.trim().toLowerCase();
  const sortParam = searchParams.get("sort") || "updated_at";

  const db = createAdminClient();

  try {
    // 1. Determine accessible item IDs
    let allowedItemIds: string[] | null = null;

    if (!actor.isSuperAdmin) {
      // Find items where user is an explicit collaborator in project_inbox_members
      const { data: memberships } = await db
        .from("project_inbox_members")
        .select("inbox_item_id")
        .eq("user_id", actor.id);

      const memberItemIds = (memberships || []).map((m: any) => m.inbox_item_id);

      if (actor.type === "freelancer") {
        // Freelancers see items they own OR are members of
        const { data: ownedItems } = await db
          .from("project_inbox_items")
          .select("id")
          .eq("owner_id", actor.id);

        const ownedItemIds = (ownedItems || []).map((o: any) => o.id);
        allowedItemIds = Array.from(new Set([...ownedItemIds, ...memberItemIds]));
      } else {
        // Team users see ONLY items where they are explicitly added as members
        allowedItemIds = memberItemIds;
      }

      if (allowedItemIds.length === 0) {
        return NextResponse.json({ items: [] });
      }
    }

    let query = db
      .from("project_inbox_items")
      .select(
        "id, owner_id, title, description, type, status, priority, converted_project_id, converted_at, created_at, updated_at, converted_project:projects(id, name)"
      );

    if (allowedItemIds !== null) {
      query = query.in("id", allowedItemIds);
    }

    // Status filter
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

    // Text search
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

    query = query.limit(100);

    const { data: items, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Attach role for the current actor on each item
    const itemIds = (items || []).map((i) => i.id);
    const memberRoleMap: Record<string, "owner" | "collaborator"> = {};

    if (itemIds.length > 0) {
      const { data: actorMemberships } = await db
        .from("project_inbox_members")
        .select("inbox_item_id, role")
        .in("inbox_item_id", itemIds)
        .eq("user_id", actor.id);

      (actorMemberships || []).forEach((m: any) => {
        memberRoleMap[m.inbox_item_id] = m.role;
      });
    }

    const enrichedItems = (items || []).map((item) => {
      let role: "owner" | "collaborator" = "collaborator";
      if (actor.isSuperAdmin || item.owner_id === actor.id || memberRoleMap[item.id] === "owner") {
        role = "owner";
      }
      return {
        ...item,
        currentUserRole: role,
      };
    });

    return NextResponse.json({ items: enrichedItems });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch inbox items." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const actor = await getAuthenticatedInboxActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
  }

  // Collaborators cannot create new root inbox items; only owners / super admins / freelancers
  if (actor.type !== "freelancer" && !actor.isSuperAdmin) {
    return NextResponse.json(
      { error: "Forbidden. Collaborators cannot create new inbox items." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    let { title, description, type, status, priority, notes, research_notes } = body;

    const rawText = (title || "").trim();
    if (!rawText) {
      return NextResponse.json({ error: "Idea title or text is required." }, { status: 400 });
    }

    let resolvedTitle = rawText;
    let resolvedDescription = (description || "").trim();

    if (rawText.includes("\n") && !resolvedDescription) {
      const parts = rawText.split("\n").map((p: string) => p.trim()).filter(Boolean);
      resolvedTitle = parts[0];
      resolvedDescription = parts.slice(1).join("\n");
    }

    if (resolvedTitle.length > 120 && !resolvedDescription) {
      resolvedDescription = resolvedTitle;
      resolvedTitle = resolvedTitle.slice(0, 80) + "...";
    }

    const db = createAdminClient();

    const { data: newItem, error } = await db
      .from("project_inbox_items")
      .insert({
        owner_id: actor.id,
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

    // 1. Add owner to project_inbox_members
    try {
      await db.from("project_inbox_members").insert({
        inbox_item_id: newItem.id,
        user_id: actor.id,
        user_type: actor.type,
        role: "owner",
      });
    } catch {
      // Non-blocking if table pending
    }

    // 2. Automatically create default "General Discussion" conversation
    try {
      await db.from("project_inbox_conversations").insert({
        inbox_item_id: newItem.id,
        title: "General Discussion",
        created_by: actor.id,
      });
    } catch {
      // Fallback to legacy project_inbox_ai_threads if exists
      try {
        await db.from("project_inbox_ai_threads").insert({
          inbox_item_id: newItem.id,
          title: "General Discussion",
        });
      } catch {}
    }

    return NextResponse.json(
      {
        item: {
          ...newItem,
          currentUserRole: "owner",
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create inbox item." }, { status: 500 });
  }
}

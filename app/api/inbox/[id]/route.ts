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
    const { data: item, error: itemError } = await db
      .from("project_inbox_items")
      .select("*, converted_project:projects(id, name)")
      .eq("id", id)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: "Inbox item not found." }, { status: 404 });
    }

    // Fetch links for this item
    const { data: links } = await db
      .from("project_inbox_links")
      .select("id, inbox_item_id, title, url, created_at, updated_at")
      .eq("inbox_item_id", id)
      .order("created_at", { ascending: true });

    // Fetch conversations (with fallback to project_inbox_ai_threads)
    let conversations: any[] = [];
    const { data: convData, error: convError } = await db
      .from("project_inbox_conversations")
      .select("id, title, created_at, updated_at")
      .eq("inbox_item_id", id)
      .order("updated_at", { ascending: false });

    if (!convError && convData && convData.length > 0) {
      conversations = convData;
    } else {
      const { data: threadData } = await db
        .from("project_inbox_ai_threads")
        .select("id, title, created_at, updated_at")
        .eq("inbox_item_id", id)
        .order("created_at", { ascending: true });
      conversations = threadData || [];
    }

    // Fetch members
    let members: any[] = [];
    try {
      const { data: memberRows } = await db
        .from("project_inbox_members")
        .select("id, inbox_item_id, user_id, user_type, role, added_by, created_at")
        .eq("inbox_item_id", id)
        .order("created_at", { ascending: true });

      if (memberRows && memberRows.length > 0) {
        // Enrich member details from respective user tables
        const teamUserIds = memberRows.filter((m) => m.user_type === "team_user").map((m) => m.user_id);
        const freelancerIds = memberRows.filter((m) => m.user_type === "freelancer").map((m) => m.user_id);

        const teamUserMap: Record<string, { name: string; username: string }> = {};
        const freelancerMap: Record<string, { name: string; email: string }> = {};

        if (teamUserIds.length > 0) {
          const { data: teamUsers } = await db
            .from("team_users")
            .select("id, name, username")
            .in("id", teamUserIds);
          (teamUsers || []).forEach((tu) => {
            teamUserMap[tu.id] = { name: tu.name, username: tu.username };
          });
        }

        if (freelancerIds.length > 0) {
          const { data: freelancers } = await db
            .from("freelancer_profiles")
            .select("id, name, email")
            .in("id", freelancerIds);
          (freelancers || []).forEach((fp) => {
            freelancerMap[fp.id] = { name: fp.name, email: fp.email };
          });
        }

        members = memberRows.map((m) => {
          if (m.user_type === "team_user") {
            const u = teamUserMap[m.user_id];
            return {
              ...m,
              name: u?.name || "Team Member",
              username: u?.username || "",
            };
          } else {
            const f = freelancerMap[m.user_id];
            return {
              ...m,
              name: f?.name || "Freelancer",
              email: f?.email || "",
            };
          }
        });
      }
    } catch {
      // Fallback: if project_inbox_members not yet populated, create virtual owner member
    }

    // Ensure owner is always present in members list if empty
    if (members.length === 0) {
      const { data: ownerProfile } = await db
        .from("freelancer_profiles")
        .select("id, name, email")
        .eq("id", item.owner_id)
        .maybeSingle();

      members = [
        {
          id: `owner-${item.owner_id}`,
          inbox_item_id: id,
          user_id: item.owner_id,
          user_type: "freelancer",
          role: "owner",
          name: ownerProfile?.name || "Owner",
          email: ownerProfile?.email || "",
          created_at: item.created_at,
        },
      ];
    }

    // Count saved insights
    let insightsCount = 0;
    try {
      const { count } = await db
        .from("project_inbox_insights")
        .select("id", { count: "exact", head: true })
        .eq("inbox_item_id", id);
      insightsCount = count || 0;
    } catch {}

    return NextResponse.json({
      item: {
        ...item,
        links: links || [],
        conversations: conversations || [],
        ai_threads: conversations || [],
        members,
        members_count: members.length,
        insights_count: insightsCount,
        currentUserRole: access.role,
        isOwner: access.isOwner,
        canManageCollaborators: access.canManageCollaborators,
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
  const actor = await getAuthenticatedInboxActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const access = await verifyInboxItemAccess(actor, id);
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Inbox item not found or access denied." }, { status: 404 });
  }

  // Only owners and super admins can modify title, status, priority, or type
  // Collaborators can only update research notes if permitted
  const body = await req.json();

  if (!access.canEditItem) {
    // If collaborator, restrict edits to research_notes only
    if (body.title || body.type || body.status || body.priority) {
      return NextResponse.json(
        { error: "Forbidden. Collaborators cannot edit core item metadata." },
        { status: 403 }
      );
    }
  }

  try {
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
      .select("*, converted_project:projects(id, name)")
      .single();

    if (error || !updatedItem) {
      return NextResponse.json({ error: error?.message || "Failed to update item." }, { status: 400 });
    }

    return NextResponse.json({
      item: {
        ...updatedItem,
        currentUserRole: access.role,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update item." }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getAuthenticatedInboxActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const access = await verifyInboxItemAccess(actor, id);
  if (!access.hasAccess || !access.canDeleteItem) {
    return NextResponse.json(
      { error: "Forbidden. Only the owner can delete this idea." },
      { status: 403 }
    );
  }

  const db = createAdminClient();

  try {
    const { error } = await db
      .from("project_inbox_items")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete item." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getAuthenticatedInboxActor, verifyInboxItemAccess } from "@/lib/inbox-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const actor = await getAuthenticatedInboxActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id, memberId } = await params;
  const access = await verifyInboxItemAccess(actor, id);
  if (!access.hasAccess || !access.canManageCollaborators) {
    return NextResponse.json(
      { error: "Forbidden. Only the owner or super admin can remove people." },
      { status: 403 }
    );
  }

  const db = createAdminClient();

  try {
    // 1. Fetch member row to check if it's owner
    const { data: member, error: memberError } = await db
      .from("project_inbox_members")
      .select("id, inbox_item_id, user_id, role")
      .eq("id", memberId)
      .eq("inbox_item_id", id)
      .single();

    if (memberError || !member) {
      return NextResponse.json({ error: "Member not found on this item." }, { status: 404 });
    }

    if (member.role === "owner") {
      return NextResponse.json(
        { error: "Cannot remove the idea owner." },
        { status: 400 }
      );
    }

    const { error: deleteError } = await db
      .from("project_inbox_members")
      .delete()
      .eq("id", memberId)
      .eq("inbox_item_id", id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to remove member." }, { status: 500 });
  }
}

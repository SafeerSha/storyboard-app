import { NextResponse } from "next/server";
import { getAuthenticatedInboxActor, verifyInboxItemAccess } from "@/lib/inbox-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await getAuthenticatedInboxActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const access = await verifyInboxItemAccess(actor, id);
  if (!access.hasAccess || !access.canManageCollaborators) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get("query") || "").trim().toLowerCase();

  const db = createAdminClient();

  try {
    // 1. Fetch current members to exclude
    const { data: currentMembers } = await db
      .from("project_inbox_members")
      .select("user_id")
      .eq("inbox_item_id", id);

    const excludedUserIds = new Set<string>((currentMembers || []).map((m: any) => m.user_id));

    // Also exclude item owner
    const { data: item } = await db
      .from("project_inbox_items")
      .select("owner_id")
      .eq("id", id)
      .single();

    if (item?.owner_id) {
      excludedUserIds.add(item.owner_id);
    }

    // 2. Query active team_users
    let teamQuery = db
      .from("team_users")
      .select("id, name, username, role, status")
      .eq("status", "active")
      .order("name", { ascending: true })
      .limit(30);

    if (search) {
      teamQuery = teamQuery.or(`name.ilike.%${search}%,username.ilike.%${search}%`);
    }

    const { data: teamUsers, error: teamError } = await teamQuery;
    if (teamError) {
      return NextResponse.json({ error: teamError.message }, { status: 500 });
    }

    // 3. Query active freelancer_profiles
    let freelancerQuery = db
      .from("freelancer_profiles")
      .select("id, name, email, role, status")
      .eq("status", "active")
      .order("name", { ascending: true })
      .limit(20);

    if (search) {
      freelancerQuery = freelancerQuery.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: freelancers, error: freeError } = await freelancerQuery;
    if (freeError) {
      return NextResponse.json({ error: freeError.message }, { status: 500 });
    }

    // 4. Transform and filter candidates
    const candidates: Array<{
      id: string;
      name: string;
      username: string;
      type: "team_user" | "freelancer";
      roleTitle: string;
    }> = [];

    (teamUsers || []).forEach((u: any) => {
      if (!excludedUserIds.has(u.id)) {
        candidates.push({
          id: u.id,
          name: u.name,
          username: u.username,
          type: "team_user",
          roleTitle: "Team Member",
        });
      }
    });

    (freelancers || []).forEach((f: any) => {
      if (!excludedUserIds.has(f.id)) {
        candidates.push({
          id: f.id,
          name: f.name || f.email.split("@")[0],
          username: f.email,
          type: "freelancer",
          roleTitle: f.role === "super_admin" ? "Super Admin" : "Freelancer",
        });
      }
    });

    return NextResponse.json({ candidates: candidates.slice(0, 25) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load candidate users." }, { status: 500 });
  }
}

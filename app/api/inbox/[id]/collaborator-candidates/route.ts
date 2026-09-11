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

    // 2. Scope team_users to only those assigned to the actor's own projects.
    //    This prevents a freelancer from seeing another freelancer's team members.
    const { data: actorProjects } = await db
      .from("projects")
      .select("id")
      .eq("owner_id", actor.id);

    const actorProjectIds = (actorProjects || []).map((p: any) => p.id);

    let teamUsers: any[] = [];
    if (actorProjectIds.length > 0) {
      // team_users are linked to projects via team_user_projects join table (or project_ids column)
      // Fetch team users scoped to the actor's projects only
      const { data: scopedTeamUsers, error: teamError } = await db
        .from("team_users")
        .select("id, name, username, role, status, project_ids")
        .eq("status", "active")
        .overlaps("project_ids", actorProjectIds)
        .order("name", { ascending: true })
        .limit(30);

      if (teamError) {
        // Fallback: no team user candidates if query fails
        teamUsers = [];
      } else {
        teamUsers = scopedTeamUsers || [];
        if (search) {
          const q = search.toLowerCase();
          teamUsers = teamUsers.filter(
            (u: any) =>
              u.name?.toLowerCase().includes(q) ||
              u.username?.toLowerCase().includes(q)
          );
        }
      }
    }

    // 3. Do NOT expose other freelancer accounts as collaborator candidates.
    //    Cross-workspace freelancer collaboration is not supported —
    //    only the actor's own scoped team members can be added as collaborators.

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

    return NextResponse.json({ candidates: candidates.slice(0, 25) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load candidate users." }, { status: 500 });
  }
}

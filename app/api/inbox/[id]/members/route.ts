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
    const { data: memberRows, error } = await db
      .from("project_inbox_members")
      .select("id, inbox_item_id, user_id, user_type, role, added_by, created_at")
      .eq("inbox_item_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const members = memberRows || [];

    // Enrich with names
    const teamUserIds = members.filter((m) => m.user_type === "team_user").map((m) => m.user_id);
    const freelancerIds = members.filter((m) => m.user_type === "freelancer").map((m) => m.user_id);

    const teamUserMap: Record<string, { name: string; username: string }> = {};
    const freelancerMap: Record<string, { name: string; email: string }> = {};

    if (teamUserIds.length > 0) {
      const { data: tus } = await db
        .from("team_users")
        .select("id, name, username")
        .in("id", teamUserIds);
      (tus || []).forEach((tu) => {
        teamUserMap[tu.id] = { name: tu.name, username: tu.username };
      });
    }

    if (freelancerIds.length > 0) {
      const { data: fps } = await db
        .from("freelancer_profiles")
        .select("id, name, email")
        .in("id", freelancerIds);
      (fps || []).forEach((fp) => {
        freelancerMap[fp.id] = { name: fp.name, email: fp.email };
      });
    }

    const enriched = members.map((m) => {
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

    return NextResponse.json({ members: enriched });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load members." }, { status: 500 });
  }
}

export async function POST(
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
    return NextResponse.json(
      { error: "Forbidden. Only the owner or super admin can add people." },
      { status: 403 }
    );
  }

  const db = createAdminClient();

  try {
    const body = await req.json();
    // Support single or multiple user additions: { userIds: string[], userType?: "team_user" | "freelancer" }
    // Or { candidates: Array<{ userId: string; userType: "team_user" | "freelancer" }> }
    const candidates: Array<{ userId: string; userType: "team_user" | "freelancer" }> = [];

    if (Array.isArray(body.candidates)) {
      body.candidates.forEach((c: any) => {
        if (c.userId) {
          candidates.push({
            userId: String(c.userId).trim(),
            userType: c.userType === "freelancer" ? "freelancer" : "team_user",
          });
        }
      });
    } else if (Array.isArray(body.userIds)) {
      const defaultType = body.userType === "freelancer" ? "freelancer" : "team_user";
      body.userIds.forEach((uid: any) => {
        if (uid) {
          candidates.push({
            userId: String(uid).trim(),
            userType: defaultType,
          });
        }
      });
    } else if (body.userId) {
      candidates.push({
        userId: String(body.userId).trim(),
        userType: body.userType === "freelancer" ? "freelancer" : "team_user",
      });
    }

    if (candidates.length === 0) {
      return NextResponse.json({ error: "No users selected to add." }, { status: 400 });
    }

    // Verify candidates are active internal users
    const teamUserIds = candidates.filter((c) => c.userType === "team_user").map((c) => c.userId);
    const freelancerIds = candidates.filter((c) => c.userType === "freelancer").map((c) => c.userId);

    const validCandidateIds = new Set<string>();

    if (teamUserIds.length > 0) {
      const { data: validTeamUsers } = await db
        .from("team_users")
        .select("id")
        .in("id", teamUserIds)
        .eq("status", "active");
      (validTeamUsers || []).forEach((u) => validCandidateIds.add(u.id));
    }

    if (freelancerIds.length > 0) {
      const { data: validFreelancers } = await db
        .from("freelancer_profiles")
        .select("id")
        .in("id", freelancerIds)
        .eq("status", "active");
      (validFreelancers || []).forEach((u) => validCandidateIds.add(u.id));
    }

    const rowsToInsert = candidates
      .filter((c) => validCandidateIds.has(c.userId))
      .map((c) => ({
        inbox_item_id: id,
        user_id: c.userId,
        user_type: c.userType,
        role: "collaborator",
        added_by: actor.id,
      }));

    if (rowsToInsert.length === 0) {
      return NextResponse.json(
        { error: "No eligible active users found from the selection." },
        { status: 400 }
      );
    }

    const { data: inserted, error: insertError } = await db
      .from("project_inbox_members")
      .upsert(rowsToInsert, { onConflict: "inbox_item_id, user_id" })
      .select();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      addedCount: rowsToInsert.length,
      members: inserted,
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to add people." }, { status: 500 });
  }
}

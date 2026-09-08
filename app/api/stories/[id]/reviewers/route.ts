import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageStoryReviewers, syncFreelancerToTeam } from "@/lib/story-reviewer-auth";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const putSchema = z.object({
  reviewerIds: z.array(z.string().uuid()),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await params;
  const admin = createAdminClient();

  const { data: story } = await admin
    .from("stories")
    .select("id, project_id")
    .eq("id", storyId)
    .maybeSingle();

  if (!story) {
    return NextResponse.json({ error: "Story not found." }, { status: 404 });
  }

  // Fetch reviewers mapped to story
  const { data: reviewers, error } = await admin
    .from("story_reviewers")
    .select("id, team_user_id, assigned_by, created_at, user:team_users(id, name, username, role, status)")
    .eq("story_id", storyId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rawReviewers = reviewers || [];
  const teamUserIds = rawReviewers
    .map((r: any) => r.team_user_id)
    .filter(Boolean);

  // Validate active membership in project_team_members
  let validUserIds = new Set<string>();
  if (teamUserIds.length > 0 && story.project_id) {
    const { data: activeMembers } = await admin
      .from("project_team_members")
      .select("team_user_id, team_users!inner(id, status)")
      .eq("project_id", story.project_id)
      .in("team_user_id", teamUserIds)
      .eq("team_users.status", "active");

    (activeMembers || []).forEach((m: any) => {
      const uid = m.team_user_id || m.team_users?.id;
      if (uid) validUserIds.add(uid);
    });

    // Backwards-compatibility fallback for unmigrated rows
    const missingIds = teamUserIds.filter((id) => !validUserIds.has(id));
    if (missingIds.length > 0) {
      const { data: legacyMembers } = await admin
        .from("team_users")
        .select("id")
        .eq("project_id", story.project_id)
        .eq("status", "active")
        .in("id", missingIds);
      (legacyMembers || []).forEach((m) => validUserIds.add(m.id));
    }

    // Project owner and super admins are also valid project members
    const stillMissing = teamUserIds.filter((id) => !validUserIds.has(id));
    if (stillMissing.length > 0) {
      const { data: proj } = await admin
        .from("projects")
        .select("owner_id")
        .eq("id", story.project_id)
        .maybeSingle();

      const { data: adminProfiles } = await admin
        .from("freelancer_profiles")
        .select("id, name, email, role, status")
        .in("id", stillMissing)
        .eq("status", "active");

      for (const ap of adminProfiles || []) {
        if (ap.id === proj?.owner_id || ap.role === "super_admin") {
          validUserIds.add(ap.id);
        }
      }
    }
  }

  // Look up freelancer_profiles for any user whose team_users info is not joined
  const unjoinedUserIds = rawReviewers
    .filter((r: any) => !r.user)
    .map((r: any) => r.team_user_id)
    .filter(Boolean);

  const freelancerLookup = new Map<string, any>();
  if (unjoinedUserIds.length > 0) {
    const { data: profiles } = await admin
      .from("freelancer_profiles")
      .select("id, name, email, role")
      .in("id", unjoinedUserIds);
    (profiles || []).forEach((p) => freelancerLookup.set(p.id, p));
  }

  const formatted = rawReviewers
    .filter((r: any) => {
      const uid = r.team_user_id;
      return validUserIds.has(uid);
    })
    .map((r: any) => {
      const u = r.user;
      const uid = r.team_user_id;
      const fp = freelancerLookup.get(uid);
      const displayName =
        u?.name ||
        fp?.name ||
        (fp?.role === "super_admin" ? "Super Admin" : "Project Creator") ||
        "Team Member";
      const displayUsername =
        u?.username || (fp?.email ? fp.email.split("@")[0] : "");
      const displayRole =
        u?.role ||
        (fp?.role === "super_admin" ? "Super Admin" : "Project Creator") ||
        "member";

      return {
        id: r.id,
        user_id: uid,
        team_user_id: uid,
        name: displayName,
        username: displayUsername,
        role: displayRole,
        assigned_by: r.assigned_by,
        created_at: r.created_at,
      };
    });

  return NextResponse.json({ reviewers: formatted });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: storyId } = await params;
  const admin = createAdminClient();

  const { data: story } = await admin
    .from("stories")
    .select("id, project_id, title, created_by_id")
    .eq("id", storyId)
    .maybeSingle();

  if (!story) {
    return NextResponse.json({ error: "Story not found." }, { status: 404 });
  }

  // 1. Authorize caller
  const auth = await canManageStoryReviewers(story);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: "Forbidden. Only the project owner, super admin, or story creator can manage reviewers." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { reviewerIds } = putSchema.parse(body);

    // 2. Validate that all requested team users belong to this project via project_team_members and are active
    if (reviewerIds.length > 0) {
      const { data: ptmMembers } = await admin
        .from("project_team_members")
        .select("team_user_id, team_users!inner(id, status)")
        .eq("project_id", story.project_id)
        .in("team_user_id", reviewerIds)
        .eq("team_users.status", "active");

      const validIds = new Set((ptmMembers || []).map((m: any) => m.team_user_id || m.team_users?.id));

      // Backwards-compatibility fallback
      const missingIds = reviewerIds.filter((id) => !validIds.has(id));
      if (missingIds.length > 0) {
        const { data: legacyMembers } = await admin
          .from("team_users")
          .select("id")
          .eq("project_id", story.project_id)
          .eq("status", "active")
          .in("id", missingIds);
        (legacyMembers || []).forEach((m) => validIds.add(m.id));
      }

      // Check if any remaining missing IDs belong to the project owner or super admins in freelancer_profiles
      const stillMissing = reviewerIds.filter((id) => !validIds.has(id));
      if (stillMissing.length > 0) {
        const { data: proj } = await admin
          .from("projects")
          .select("owner_id")
          .eq("id", story.project_id)
          .maybeSingle();

        const { data: adminProfiles } = await admin
          .from("freelancer_profiles")
          .select("id, name, email, role, status")
          .in("id", stillMissing)
          .eq("status", "active");

        for (const ap of adminProfiles || []) {
          if (ap.id === proj?.owner_id || ap.role === "super_admin") {
            await syncFreelancerToTeam(admin, ap, story.project_id);
            validIds.add(ap.id);
          }
        }
      }

      const hasInvalid = reviewerIds.some((id) => !validIds.has(id));
      if (hasInvalid) {
        return NextResponse.json(
          { error: "One or more selected reviewers do not belong to this project or are disabled." },
          { status: 400 }
        );
      }
    }

    // 3. Fetch existing reviewers
    const { data: existingReviewers } = await admin
      .from("story_reviewers")
      .select("id, team_user_id")
      .eq("story_id", storyId);

    const existingUserIds = new Set(
      (existingReviewers || []).map((r: any) => r.team_user_id)
    );
    const toAdd = reviewerIds.filter((id) => !existingUserIds.has(id));
    const toRemove = (existingReviewers || []).filter(
      (r: any) => !reviewerIds.includes(r.team_user_id)
    );

    // 4. Delete removed reviewers
    if (toRemove.length > 0) {
      const removeIds = toRemove.map((r) => r.id);
      await admin.from("story_reviewers").delete().in("id", removeIds);
    }

    // 5. Insert newly added reviewers
    if (toAdd.length > 0) {
      const rowsToInsert = toAdd.map((userId) => ({
        story_id: storyId,
        team_user_id: userId,
        assigned_by: auth.actorId.includes("-") ? auth.actorId : null,
      }));
      await admin.from("story_reviewers").insert(rowsToInsert);
    }

    // 6. Audit log
    await logAudit({
      action: "story_reviewers_updated",
      actorId: auth.actorId,
      actorType: auth.actorType,
      actorName: auth.actorName,
      targetType: "story",
      targetId: story.id,
      details: {
        storyTitle: story.title,
        projectId: story.project_id,
        addedCount: toAdd.length,
        removedCount: toRemove.length,
        totalReviewers: reviewerIds.length,
      },
    });

    // 7. Return updated reviewers
    const { data: updatedReviewers } = await admin
      .from("story_reviewers")
      .select("id, team_user_id, assigned_by, created_at, user:team_users(id, name, username, role)")
      .eq("story_id", storyId)
      .order("created_at", { ascending: true });

    // Lookup any reviewers whose user:team_users wasn't joined
    const unjoinedUpdatedIds = (updatedReviewers || [])
      .filter((r: any) => !r.user)
      .map((r: any) => r.team_user_id)
      .filter(Boolean);

    const updatedFreelancerLookup = new Map<string, any>();
    if (unjoinedUpdatedIds.length > 0) {
      const { data: profiles } = await admin
        .from("freelancer_profiles")
        .select("id, name, email, role")
        .in("id", unjoinedUpdatedIds);
      (profiles || []).forEach((p) => updatedFreelancerLookup.set(p.id, p));
    }

    const formatted = (updatedReviewers || []).map((r: any) => {
      const u = r.user;
      const uid = r.team_user_id;
      const fp = updatedFreelancerLookup.get(uid);
      const displayName =
        u?.name ||
        fp?.name ||
        (fp?.role === "super_admin" ? "Super Admin" : "Project Creator") ||
        "Team Member";
      const displayUsername =
        u?.username || (fp?.email ? fp.email.split("@")[0] : "");
      const displayRole =
        u?.role ||
        (fp?.role === "super_admin" ? "Super Admin" : "Project Creator") ||
        "member";

      return {
        id: r.id,
        user_id: uid,
        team_user_id: uid,
        name: displayName,
        username: displayUsername,
        role: displayRole,
        assigned_by: r.assigned_by,
        created_at: r.created_at,
      };
    });

    return NextResponse.json({ ok: true, reviewers: formatted });
  } catch (err: any) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update reviewers." },
      { status: 400 }
    );
  }
}

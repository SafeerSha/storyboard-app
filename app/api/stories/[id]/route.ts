import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedTeamUser } from "@/lib/team-session";
import {
  isTeamUserReviewer,
  isTeamUserProjectMember,
  canManageStoryReviewers,
  getStoryReviewers,
  syncFreelancerToTeam,
} from "@/lib/story-reviewer-auth";

const patchSchema = z.object({
  epic_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  acceptance_criteria: z.array(z.string()).optional(),
  assumptions: z.array(z.string()).optional(),
  clarifications: z.array(z.string()).optional(),
  raw_requirement: z.string().max(10000).optional(),
  reviewer_ids: z.array(z.string().uuid()).optional(),
  status: z
    .enum(["draft", "review", "changes_requested", "approved", "in_development", "completed"])
    .optional(),
  team_review_status: z.enum(["pending", "approved", "changes_requested"]).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = patchSchema.parse(await req.json());
    const admin = createAdminClient();

    const { data: story } = await admin
      .from("stories")
      .select("*, project_id")
      .eq("id", id)
      .maybeSingle();

    if (!story) return NextResponse.json({ error: "Story not found." }, { status: 404 });

    let isAuthorized = false;
    let isSuperAdminOrOwner = false;
    let actorId = "system";

    // 1. Freelancer / Super Admin check (Supabase Auth takes precedence)
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await admin
        .from("freelancer_profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.role === "super_admin") {
        isAuthorized = true;
        isSuperAdminOrOwner = true;
        actorId = user.id;
      } else {
        const { data: project } = await admin
          .from("projects")
          .select("id, owner_id")
          .eq("id", story.project_id)
          .maybeSingle();

        if (project?.owner_id === user.id || story.created_by_id === user.id) {
          isAuthorized = true;
          isSuperAdminOrOwner = true;
          actorId = user.id;
        }
      }
    }

    // 2. Team User session check if not authenticated via Supabase
    const teamUser = await getAuthenticatedTeamUser();
    if (!isAuthorized && teamUser) {
      const isMember = await isTeamUserProjectMember(teamUser.id, story.project_id);
      if (isMember) {
        isAuthorized = true;
        actorId = teamUser.id;
        if (
          (story.created_by_id && story.created_by_id === teamUser.id) ||
          (teamUser as any).role === "Super Admin" ||
          (teamUser as any).role === "Project Creator"
        ) {
          isSuperAdminOrOwner = true;
        }
      } else {
        return NextResponse.json({ error: "Forbidden. Access to this story is denied." }, { status: 403 });
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    // If changing review status, verify reviewer status (creators, owners, and super admins are exempt)
    if (body.team_review_status && !isSuperAdminOrOwner) {
      const reviewerCheckId = teamUser ? teamUser.id : actorId;
      const isReviewer = await isTeamUserReviewer(id, reviewerCheckId);
      if (!isReviewer) {
        return NextResponse.json(
          { error: "Forbidden. Only assigned reviewers can update story review status." },
          { status: 403 }
        );
      }
    }

    // If updating reviewer assignments, verify caller can manage reviewers and validate memberships
    if (body.reviewer_ids !== undefined) {
      if (!isSuperAdminOrOwner) {
        const canManage = await canManageStoryReviewers(story);
        if (!canManage.authorized) {
          return NextResponse.json(
            { error: "Forbidden. Only the project owner, super admin, or story creator can modify reviewer assignments." },
            { status: 403 }
          );
        }
      }

      if (body.reviewer_ids.length > 0) {
        const { data: ptmMembers } = await admin
          .from("project_team_members")
          .select("team_user_id, team_users!inner(id, status)")
          .eq("project_id", story.project_id)
          .in("team_user_id", body.reviewer_ids)
          .eq("team_users.status", "active");

        const validIds = new Set((ptmMembers || []).map((m: any) => m.team_user_id || m.team_users?.id));

        // Backwards compatibility fallback
        const missingIds = body.reviewer_ids.filter((rid) => !validIds.has(rid));
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
        const stillMissing = body.reviewer_ids.filter((rid) => !validIds.has(rid));
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

        const hasInvalid = body.reviewer_ids.some((rid) => !validIds.has(rid));
        if (hasInvalid) {
          return NextResponse.json(
            { error: "One or more selected reviewers do not belong to this project or are disabled." },
            { status: 400 }
          );
        }
      }

      await admin.from("story_reviewers").delete().eq("story_id", id);
      if (body.reviewer_ids.length > 0) {
        const rows = body.reviewer_ids.map((uid) => ({
          story_id: id,
          team_user_id: uid,
          assigned_by: actorId.includes("-") ? actorId : null,
        }));
        const { error: insErr } = await admin.from("story_reviewers").insert(rows);
        if (insErr) {
          console.error("Failed to insert story reviewers:", insErr);
          throw insErr;
        }
      }
    }

    // If changing epic, verify epic belongs to this story's project
    if (body.epic_id) {
      const { data: epic } = await admin
        .from("epics")
        .select("project_id")
        .eq("id", body.epic_id)
        .maybeSingle();
      if (!epic || epic.project_id !== story.project_id) {
        return NextResponse.json({ error: "Epic does not belong to this project." }, { status: 400 });
      }
    }

    // Check if content is materially changed
    const materialFields = ["title", "description", "acceptance_criteria", "assumptions", "clarifications"];
    let isMaterialChange = false;
    for (const field of materialFields) {
      if (body[field as keyof typeof body] !== undefined) {
        const oldVal = JSON.stringify(story[field as keyof typeof story]);
        const newVal = JSON.stringify(body[field as keyof typeof body]);
        if (oldVal !== newVal) {
          isMaterialChange = true;
          break;
        }
      }
    }

    const updateData: any = { ...body, updated_at: new Date().toISOString() };
    delete updateData.reviewer_ids;

    // If approved and materially changed, reset status to review
    if (story.status === "approved" && isMaterialChange && !body.status) {
      updateData.status = "review";
    }

    // Record revision
    if (isMaterialChange) {
      const { count } = await admin
        .from("story_revisions")
        .select("id", { count: "exact", head: true })
        .eq("story_id", id);
      const revision_number = (count || 0) + 1;

      await admin.from("story_revisions").insert({
        story_id: id,
        revision_number,
        title: story.title,
        description: story.description,
        epic_id: story.epic_id,
        acceptance_criteria: story.acceptance_criteria,
        assumptions: story.assumptions,
        clarifications: story.clarifications,
        status: story.status,
        created_by: actorId.includes("-") ? actorId : null,
      });
    }

    const { data: updated, error } = await admin
      .from("stories")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const reviewers = await getStoryReviewers(id);
    const enrichedStory = {
      ...updated,
      reviewer_ids: reviewers.map((r) => r.user_id),
      reviewers,
    };

    return NextResponse.json({ story: enrichedStory });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update story." }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: story } = await admin.from("stories").select("project_id").eq("id", id).maybeSingle();
  if (!story) return NextResponse.json({ error: "Story not found." }, { status: 404 });

  const { data: profile } = await admin
    .from("freelancer_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isSuperAdmin = profile?.role === "super_admin";
  if (!isSuperAdmin) {
    const { data: project } = await admin
      .from("projects")
      .select("id, owner_id")
      .eq("id", story.project_id)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!project) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { error } = await admin.from("stories").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

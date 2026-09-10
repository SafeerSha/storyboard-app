import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedTeamUser } from "@/lib/team-session";
import { getReviewersForStories, isTeamUserProjectMember, syncFreelancerToTeam } from "@/lib/story-reviewer-auth";
import { autoSyncStoriesFeedbackStatus } from "@/lib/feedback-store";
import { z } from "zod";

const schema = z.object({
  project_id: z.string().uuid(),
  epic_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(500),
  description: z.string().max(10000).default(""),
  acceptance_criteria: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  clarifications: z.array(z.string()).default([]),
  raw_requirement: z.string().max(10000).optional().default(""),
  reviewer_ids: z.array(z.string().uuid()).optional(),
  status: z
    .enum(["draft", "review", "changes_requested", "approved", "in_development", "completed"])
    .default("draft"),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const requestedProjectId = url.searchParams.get("projectId");
  if (!requestedProjectId) return NextResponse.json({ error: "projectId is required." }, { status: 400 });

  const admin = createAdminClient();
  let isAuthorized = false;

  // 1. Team User authorization (multi-project membership verified)
  const teamUser = await getAuthenticatedTeamUser();
  if (teamUser) {
    const isMember = await isTeamUserProjectMember(teamUser.id, requestedProjectId);
    if (isMember) {
      isAuthorized = true;
    } else {
      return NextResponse.json({ error: "Forbidden. Access to this project is not allowed." }, { status: 403 });
    }
  }

  // 2. Freelancer / Super Admin authorization
  if (!isAuthorized) {
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
      } else {
        const { data: project } = await admin
          .from("projects")
          .select("id")
          .eq("id", requestedProjectId)
          .eq("owner_id", user.id)
          .maybeSingle();

        if (project) isAuthorized = true;
      }
    }
  }

  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: stories, error } = await admin
    .from("stories")
    .select("id, project_id, epic_id, title, description, acceptance_criteria, assumptions, clarifications, status, team_review_status, team_approved_by_id, team_approved_by_name, team_approved_at, client_review_status, client_approved_by_id, client_approved_by_name, client_approved_at, created_by_id, created_at, updated_at")
    .eq("project_id", requestedProjectId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const storyList = stories ?? [];
  const storyIds = storyList.map((s) => s.id);
  const [reviewersMap, healed] = await Promise.all([
    getReviewersForStories(storyIds),
    autoSyncStoriesFeedbackStatus(storyIds),
  ]);

  const enriched = storyList.map((s) => ({
    ...s,
    status: healed[s.id]?.status || s.status,
    client_review_status: (healed[s.id]?.clientReviewStatus as any) || s.client_review_status,
    team_review_status: (healed[s.id]?.teamReviewStatus as any) || s.team_review_status,
    reviewer_ids: (reviewersMap[s.id] || []).map((r) => r.user_id),
    reviewers: reviewersMap[s.id] || [],
  }));

  return NextResponse.json({ stories: enriched });
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.json();
    const admin = createAdminClient();

    // Check if bulk insert
    if (rawBody && Array.isArray(rawBody.stories)) {
      const itemsToValidate = rawBody.stories;
      if (itemsToValidate.length === 0) {
        return NextResponse.json({ error: "No stories provided." }, { status: 400 });
      }

      const parsedStories = z.array(schema).parse(itemsToValidate);
      const teamUser = await getAuthenticatedTeamUser();
      let projectId = parsedStories[0].project_id;

      let creatorId: string | null = null;
      if (teamUser) {
        creatorId = teamUser.id;
        const isMember = await isTeamUserProjectMember(teamUser.id, projectId);
        if (!isMember) {
          return NextResponse.json({ error: "Forbidden. Access to this project is not allowed." }, { status: 403 });
        }
        for (const s of parsedStories) {
          s.project_id = projectId;
          if (!s.epic_id) {
            return NextResponse.json(
              { error: "Stories must belong to an Epic. Please specify an epic_id." },
              { status: 400 }
            );
          }
        }
      } else {
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        let isAuth = false;
        if (user) {
          creatorId = user.id;
          const { data: profile } = await admin
            .from("freelancer_profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();

          if (profile?.role === "super_admin") {
            isAuth = true;
          } else {
            const { data: project } = await admin
              .from("projects")
              .select("id")
              .eq("id", projectId)
              .eq("owner_id", user.id)
              .maybeSingle();
            if (project) isAuth = true;
          }
        }
        if (!isAuth) {
          return NextResponse.json({ error: "Unauthorized or access denied." }, { status: 403 });
        }
      }

      // Validate all epics belong to this project
      const epicIds = Array.from(new Set(parsedStories.map((s) => s.epic_id).filter(Boolean)));
      for (const epicId of epicIds) {
        const { data: epic } = await admin
          .from("epics")
          .select("project_id")
          .eq("id", epicId)
          .maybeSingle();
        if (!epic || epic.project_id !== projectId) {
          return NextResponse.json({ error: "Epic does not belong to this project." }, { status: 400 });
        }
      }

      const rowsToInsert = parsedStories.map((s) => ({
        project_id: s.project_id,
        epic_id: s.epic_id || null,
        title: s.title,
        description: s.description,
        acceptance_criteria: s.acceptance_criteria,
        assumptions: s.assumptions,
        clarifications: s.clarifications,
        raw_requirement: s.raw_requirement,
        status: s.status,
        created_by_id: creatorId,
      }));

      const { data: inserted, error: insertErr } = await admin
        .from("stories")
        .insert(rowsToInsert)
        .select("*");

      if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 400 });
      return NextResponse.json({ stories: inserted }, { status: 201 });
    }

    // Single story insert
    const body = schema.parse(rawBody);
    let isAuthorized = false;

    // 1. Team User authorization
    const teamUser = await getAuthenticatedTeamUser();
    if (teamUser) {
      const isMember = await isTeamUserProjectMember(teamUser.id, body.project_id);
      if (!isMember) {
        return NextResponse.json({ error: "Forbidden. Access to this project is not allowed." }, { status: 403 });
      }
      isAuthorized = true;
      if (!body.epic_id) {
        return NextResponse.json(
          { error: "Stories must belong to an Epic. Please specify an epic_id." },
          { status: 400 }
        );
      }
    }

    // 2. Freelancer / Super Admin authorization
    if (!isAuthorized) {
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
        } else {
          const { data: project } = await admin
            .from("projects")
            .select("id")
            .eq("id", body.project_id)
            .eq("owner_id", user.id)
            .maybeSingle();

          if (project) isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized or access denied." }, { status: 403 });
    }

    if (body.epic_id) {
      const { data: epic } = await admin
        .from("epics")
        .select("project_id")
        .eq("id", body.epic_id)
        .maybeSingle();
      if (!epic || epic.project_id !== body.project_id) {
        return NextResponse.json({ error: "Epic does not belong to this project." }, { status: 400 });
      }
    }

    let creatorId: string | null = null;
    if (teamUser) {
      creatorId = teamUser.id;
    } else {
      const supabase = await createClient();
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) creatorId = authData.user.id;
    }

    const { data: story, error } = await admin
      .from("stories")
      .insert({
        project_id: body.project_id,
        epic_id: body.epic_id || null,
        title: body.title,
        description: body.description,
        acceptance_criteria: body.acceptance_criteria,
        assumptions: body.assumptions,
        clarifications: body.clarifications,
        raw_requirement: body.raw_requirement,
        status: body.status,
        created_by_id: creatorId,
      })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Insert reviewer assignments if specified (validate against project_team_members)
    if (body.reviewer_ids && body.reviewer_ids.length > 0) {
      const { data: ptmMembers } = await admin
        .from("project_team_members")
        .select("team_user_id, team_users!inner(id, status)")
        .eq("project_id", body.project_id)
        .in("team_user_id", body.reviewer_ids)
        .eq("team_users.status", "active");

      const validIds = new Set((ptmMembers || []).map((m: any) => m.team_user_id || m.team_users?.id));

      const missingIds = body.reviewer_ids.filter((rid) => !validIds.has(rid));
      if (missingIds.length > 0) {
        const { data: legacyMembers } = await admin
          .from("team_users")
          .select("id")
          .eq("project_id", body.project_id)
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
          .eq("id", body.project_id)
          .maybeSingle();

        const { data: adminProfiles } = await admin
          .from("freelancer_profiles")
          .select("id, name, email, role, status")
          .in("id", stillMissing)
          .eq("status", "active");

        for (const ap of adminProfiles || []) {
          if (ap.id === proj?.owner_id || ap.role === "super_admin") {
            await syncFreelancerToTeam(admin, ap, body.project_id);
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

      const reviewerRows = body.reviewer_ids.map((uid: string) => ({
        story_id: story.id,
        team_user_id: uid,
        assigned_by: creatorId,
      }));
      const { error: revErr } = await admin.from("story_reviewers").insert(reviewerRows);
      if (revErr) {
        console.error("Failed to insert story reviewers:", revErr);
        throw revErr;
      }
    }

    return NextResponse.json(
      {
        story: {
          ...story,
          reviewer_ids: body.reviewer_ids || [],
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create story." }, { status: 400 });
  }
}

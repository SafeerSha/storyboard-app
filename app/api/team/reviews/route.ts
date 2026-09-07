import { NextResponse } from "next/server";
import { getAuthenticatedTeamUser } from "@/lib/team-session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const teamUser = await getAuthenticatedTeamUser();
  if (!teamUser) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();
  const url = new URL(req.url);

  const tab = url.searchParams.get("tab") || "action"; // "action" | "changes" | "reviewed"
  const search = (url.searchParams.get("search") || "").trim();
  const requestedProjectId = url.searchParams.get("projectId") || "";
  const requestedStatus = url.searchParams.get("status") || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get("pageSize") || "20", 10)));

  // 1. Get user's authorized projects from project_team_members
  const { data: memberships } = await admin
    .from("project_team_members")
    .select("project_id, projects(id, name)")
    .eq("team_user_id", teamUser.id);

  let authorizedProjects: Array<{ id: string; name: string }> = [];
  (memberships || []).forEach((m: any) => {
    if (m.projects) {
      authorizedProjects.push({ id: m.projects.id, name: m.projects.name });
    }
  });

  // Fallback for unmigrated single-project assignment
  if (authorizedProjects.length === 0 && teamUser.project_id) {
    const { data: proj } = await admin
      .from("projects")
      .select("id, name")
      .eq("id", teamUser.project_id)
      .maybeSingle();
    if (proj) authorizedProjects.push(proj);
  }

  if (authorizedProjects.length === 0) {
    return NextResponse.json({
      stories: [],
      projects: [],
      pagination: { total: 0, page: 1, pageSize, totalPages: 0 },
    });
  }

  let filterProjectIds = authorizedProjects.map((p) => p.id);
  if (requestedProjectId) {
    if (!filterProjectIds.includes(requestedProjectId)) {
      return NextResponse.json({ error: "Forbidden. Access to project denied." }, { status: 403 });
    }
    filterProjectIds = [requestedProjectId];
  }

  // Determine review status filter based on tab
  let reviewStatus: string = "pending";
  if (tab === "changes") {
    reviewStatus = "changes_requested";
  } else if (tab === "reviewed") {
    reviewStatus = "approved";
  }

  // 2. Query stories assigned to this reviewer using story_reviewers join
  let query = admin
    .from("story_reviewers")
    .select(
      `
        story_id,
        stories!inner(
          id,
          project_id,
          epic_id,
          title,
          description,
          acceptance_criteria,
          status,
          team_review_status,
          team_approved_by_name,
          team_approved_at,
          client_review_status,
          updated_at,
          projects(id, name),
          epics(id, name)
        )
      `,
      { count: "exact" }
    )
    .eq("team_user_id", teamUser.id)
    .in("stories.project_id", filterProjectIds)
    .eq("stories.team_review_status", reviewStatus);

  if (search) {
    query = query.ilike("stories.title", `%${search}%`);
  }

  if (requestedStatus) {
    query = query.eq("stories.status", requestedStatus);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  query = query.order("created_at", { ascending: false }).range(from, to);

  const { data: rows, error, count } = await query;

  if (error) {
    console.error("Failed to fetch team reviews:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total = count || 0;
  const totalPages = Math.ceil(total / pageSize);

  const storyItems = (rows || [])
    .map((r: any) => r.stories)
    .filter(Boolean);

  const storyIds = storyItems.map((s: any) => s.id);

  // 3. Batch lookup open feedback threads for these stories (0 N+1 queries)
  const openFeedbackCounts: Record<string, number> = {};
  if (storyIds.length > 0) {
    const { data: threads } = await admin
      .from("feedback_threads")
      .select("story_id")
      .in("story_id", storyIds)
      .eq("status", "open");

    (threads || []).forEach((t: any) => {
      openFeedbackCounts[t.story_id] = (openFeedbackCounts[t.story_id] || 0) + 1;
    });
  }

  // 4. Batch lookup reviewer counts for these stories (0 N+1 queries)
  const reviewerCounts: Record<string, number> = {};
  if (storyIds.length > 0) {
    const { data: allReviewers } = await admin
      .from("story_reviewers")
      .select("story_id")
      .in("story_id", storyIds);

    (allReviewers || []).forEach((r: any) => {
      reviewerCounts[r.story_id] = (reviewerCounts[r.story_id] || 0) + 1;
    });
  }

  // 5. Format payload
  const formattedStories = storyItems.map((s: any) => ({
    id: s.id,
    project_id: s.project_id,
    project_name: s.projects?.name || "Assigned Project",
    epic_id: s.epic_id,
    epic_name: s.epics?.name || "General Requirements",
    title: s.title,
    description: s.description || "",
    criteria_count: Array.isArray(s.acceptance_criteria) ? s.acceptance_criteria.length : 0,
    open_feedback_count: openFeedbackCounts[s.id] || 0,
    reviewer_count: reviewerCounts[s.id] || 1,
    status: s.status,
    team_review_status: s.team_review_status || "pending",
    team_approved_by_name: s.team_approved_by_name,
    team_approved_at: s.team_approved_at,
    client_review_status: s.client_review_status || "pending",
    updated_at: s.updated_at,
  }));

  return NextResponse.json({
    stories: formattedStories,
    projects: authorizedProjects,
    pagination: {
      total,
      page,
      pageSize,
      totalPages,
    },
  });
}

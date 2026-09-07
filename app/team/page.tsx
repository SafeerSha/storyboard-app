import { redirect } from "next/navigation";
import { getAuthenticatedTeamUser } from "@/lib/team-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReviewersForStories, isTeamUserProjectMember } from "@/lib/story-reviewer-auth";
import { TeamWorkspace } from "@/components/TeamWorkspace";
import type { Story, Epic } from "@/lib/types";

export default async function TeamDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ projectId?: string; storyId?: string }>;
}) {
  const teamUser = await getAuthenticatedTeamUser();
  if (!teamUser) {
    redirect("/team/login");
  }

  const resolvedParams = searchParams ? await searchParams : {};
  const requestedProjectId = typeof resolvedParams.projectId === "string" ? resolvedParams.projectId : undefined;
  const initialTargetStoryId = typeof resolvedParams.storyId === "string" ? resolvedParams.storyId : undefined;

  const admin = createAdminClient();

  // Resolve active project ID: check requestedProjectId or fallback to user default / memberships
  let activeProjectId = teamUser.project_id;
  if (requestedProjectId) {
    const isMember =
      requestedProjectId === teamUser.project_id ||
      (await isTeamUserProjectMember(teamUser.id, requestedProjectId));
    if (isMember) {
      activeProjectId = requestedProjectId;
    }
  }

  // If user has no activeProjectId, find first membership
  if (!activeProjectId) {
    const { data: firstMembership } = await admin
      .from("project_team_members")
      .select("project_id")
      .eq("team_user_id", teamUser.id)
      .limit(1)
      .maybeSingle();
    activeProjectId = firstMembership?.project_id || "";
  }

  // Fetch project, epics, and stories in parallel
  const [
    { data: project },
    { data: epicsData },
    { data: storiesData },
  ] = await Promise.all([
    admin
      .from("projects")
      .select("id, name, description")
      .eq("id", activeProjectId)
      .maybeSingle(),
    admin
      .from("epics")
      .select("id, project_id, name, description, status, sort_order, created_at, updated_at")
      .eq("project_id", activeProjectId)
      .order("created_at", { ascending: false }),
    admin
      .from("stories")
      .select("id, project_id, epic_id, title, description, acceptance_criteria, assumptions, clarifications, status, team_review_status, team_approved_by_id, team_approved_by_name, team_approved_at, client_review_status, client_approved_by_id, client_approved_by_name, client_approved_at, created_by_id, created_at, updated_at")
      .eq("project_id", activeProjectId)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  if (!project) {
    return (
      <main className="mx-auto max-w-4xl p-6 sm:p-12 text-center">
        <div className="rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h2 className="text-xl font-bold text-neutral-900">Project Not Found</h2>
          <p className="mt-2 text-sm text-neutral-500">
            The project assigned to your account could not be found or has been removed.
            Please contact your workspace administrator.
          </p>
        </div>
      </main>
    );
  }

  const storyList = (storiesData || []) as Story[];
  const storyIds = storyList.map((s) => s.id);
  const reviewersMap = await getReviewersForStories(storyIds);

  const initialStories: Story[] = storyList.map((s) => ({
    ...s,
    reviewer_ids: (reviewersMap[s.id] || []).map((r) => r.user_id),
    reviewers: reviewersMap[s.id] || [],
  }));

  const initialEpics = (epicsData || []) as Epic[];

  return (
    <TeamWorkspace
      teamUser={teamUser}
      project={project}
      initialStories={initialStories}
      initialEpics={initialEpics}
      initialTargetStoryId={initialTargetStoryId}
    />
  );
}

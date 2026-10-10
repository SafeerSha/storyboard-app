import { redirect } from "next/navigation";
import { getAuthenticatedTeamUser } from "@/lib/team-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReviewersForStories, isTeamUserProjectMember } from "@/lib/story-reviewer-auth";
import { autoSyncStoriesFeedbackStatus } from "@/lib/feedback-store";
import { getTeamUserAssignedProjects } from "@/lib/team-projects";
import { TeamWorkspace } from "@/components/TeamWorkspace";
import type { Story, Epic, ProjectNote } from "@/lib/types";

export default async function TeamDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ projectId?: string; storyId?: string; tab?: string }>;
}) {
  const teamUser = await getAuthenticatedTeamUser();
  if (!teamUser) {
    redirect("/login");
  }

  const resolvedParams = searchParams ? await searchParams : {};
  const requestedProjectId = typeof resolvedParams.projectId === "string" ? resolvedParams.projectId : undefined;
  const initialTargetStoryId = typeof resolvedParams.storyId === "string" ? resolvedParams.storyId : undefined;
  const rawTab = typeof resolvedParams.tab === "string" ? resolvedParams.tab : undefined;
  const initialTab =
    rawTab && ["hierarchy", "notes", "meetings", "remuneration"].includes(rawTab)
      ? (rawTab as "hierarchy" | "notes" | "meetings" | "remuneration")
      : undefined;

  const admin = createAdminClient();

  // Fetch all assigned projects for this team user
  const assignedProjects = await getTeamUserAssignedProjects(
    teamUser.id,
    teamUser.project_id
  );

  if (assignedProjects.length === 0) {
    return (
      <main className="mx-auto max-w-4xl p-6 sm:p-12 text-center">
        <div className="rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h2 className="text-xl font-bold text-neutral-900">No Projects Assigned</h2>
          <p className="mt-2 text-sm text-neutral-500">
            You do not currently have any projects mapped to your account.
            Please contact your workspace administrator to assign you to a project.
          </p>
        </div>
      </main>
    );
  }

  // Resolve active project:
  // 1. Requested project from query parameter (if authorized)
  // 2. User's legacy default project if it is among assigned projects
  // 3. Fallback to first assigned project
  let activeProjectId = assignedProjects[0].id;
  if (requestedProjectId) {
    const isMember =
      assignedProjects.some((p) => p.id === requestedProjectId) ||
      (await isTeamUserProjectMember(teamUser.id, requestedProjectId));
    if (isMember) {
      activeProjectId = requestedProjectId;
    }
  } else if (teamUser.project_id && assignedProjects.some((p) => p.id === teamUser.project_id)) {
    activeProjectId = teamUser.project_id;
  }

  // Fetch project, epics, stories, and notes in parallel
  const [
    { data: project },
    { data: epicsData },
    { data: storiesData },
    { data: notesData },
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
    admin
      .from("project_notes")
      .select("*")
      .eq("project_id", activeProjectId)
      .order("updated_at", { ascending: false }),
  ]);

  if (!project) {
    return (
      <main className="mx-auto max-w-4xl p-6 sm:p-12 text-center">
        <div className="rounded-2xl border border-line bg-white p-8 shadow-soft">
          <h2 className="text-xl font-bold text-neutral-900">Project Not Found</h2>
          <p className="mt-2 text-sm text-neutral-500">
            The project assigned to your account could not be found or has been removed.
            Please select another project from your assigned projects or contact your workspace administrator.
          </p>
        </div>
      </main>
    );
  }

  const storyList = (storiesData || []) as Story[];
  const storyIds = storyList.map((s) => s.id);
  const [reviewersMap, healed] = await Promise.all([
    getReviewersForStories(storyIds),
    autoSyncStoriesFeedbackStatus(storyIds),
  ]);

  const initialStories: Story[] = storyList.map((s) => ({
    ...s,
    status: healed[s.id]?.status || s.status,
    client_review_status: (healed[s.id]?.clientReviewStatus as any) || s.client_review_status,
    team_review_status: (healed[s.id]?.teamReviewStatus as any) || s.team_review_status,
    acceptance_criteria: Array.isArray(s.acceptance_criteria) ? s.acceptance_criteria : [],
    assumptions: Array.isArray(s.assumptions) ? s.assumptions : [],
    clarifications: Array.isArray(s.clarifications) ? s.clarifications : [],
    reviewer_ids: (reviewersMap[s.id] || []).map((r) => r.user_id),
    reviewers: reviewersMap[s.id] || [],
  }));

  const initialEpics = (epicsData || []) as Epic[];

  return (
    <TeamWorkspace
      teamUser={teamUser}
      project={project}
      assignedProjects={assignedProjects}
      initialStories={initialStories}
      initialEpics={initialEpics}
      initialNotes={(notesData || []) as ProjectNote[]}
      initialTargetStoryId={initialTargetStoryId}
      initialTab={initialTab}
    />
  );
}

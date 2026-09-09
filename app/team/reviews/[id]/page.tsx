import { redirect } from "next/navigation";
import { getAuthenticatedTeamUser } from "@/lib/team-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReviewersForStories } from "@/lib/story-reviewer-auth";
import { ReviewClient } from "./ReviewClient";
import type { Story, Epic } from "@/lib/types";

export default async function StoryReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const teamUser = await getAuthenticatedTeamUser();
  if (!teamUser) {
    redirect("/team/login");
  }

  const { id: storyId } = await params;
  const admin = createAdminClient();

  // Fetch the story
  const { data: storyData } = await admin
    .from("stories")
    .select(
      "id, project_id, epic_id, title, description, acceptance_criteria, assumptions, clarifications, status, team_review_status, team_approved_by_id, team_approved_by_name, team_approved_at, client_review_status, client_approved_by_id, client_approved_by_name, client_approved_at, created_by_id, created_at, updated_at"
    )
    .eq("id", storyId)
    .maybeSingle();

  if (!storyData) {
    return (
      <main className="min-h-screen bg-[#FAF9FB] p-6 sm:p-12 flex justify-center items-start">
        <div className="w-full max-w-2xl mt-20 rounded-2xl border border-line bg-white p-8 text-center shadow-soft">
          <h2 className="text-xl font-bold text-neutral-900">Story Not Found</h2>
          <p className="mt-2 text-sm text-neutral-500">
            The story you are trying to review could not be found or you do not have access.
          </p>
        </div>
      </main>
    );
  }

  // Fetch epics for this project (needed for the StoryEditor dropdowns)
  const { data: epicsData } = await admin
    .from("epics")
    .select("id, project_id, name, description, status, sort_order, created_at, updated_at")
    .eq("project_id", storyData.project_id)
    .order("created_at", { ascending: false });

  const reviewersMap = await getReviewersForStories([storyId]);
  
  const initialStory: Story = {
    ...(storyData as Story),
    acceptance_criteria: Array.isArray(storyData.acceptance_criteria) ? storyData.acceptance_criteria : [],
    assumptions: Array.isArray(storyData.assumptions) ? storyData.assumptions : [],
    clarifications: Array.isArray(storyData.clarifications) ? storyData.clarifications : [],
    reviewer_ids: (reviewersMap[storyData.id] || []).map((r) => r.user_id),
    reviewers: reviewersMap[storyData.id] || [],
  };

  const isReviewer = 
    Boolean(initialStory.created_by_id && initialStory.created_by_id === teamUser.id) ||
    teamUser.role === "Super Admin" ||
    teamUser.role === "Project Creator" ||
    (initialStory.reviewer_ids || []).includes(teamUser.id);

  return (
    <ReviewClient 
      initialStory={initialStory} 
      epics={(epicsData || []) as Epic[]} 
      teamUser={teamUser} 
      isReviewer={isReviewer} 
    />
  );
}

import { redirect } from "next/navigation";
import { getAuthenticatedTeamUser } from "@/lib/team-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTeamUserAssignedProjects } from "@/lib/team-projects";
import { ProjectsClient, ProjectWithStats } from "./ProjectsClient";

export const metadata = {
  title: "My Assigned Projects | Team Portal",
  description: "Browse all projects assigned to your team account.",
};

export default async function TeamProjectsPage() {
  const teamUser = await getAuthenticatedTeamUser();
  if (!teamUser) {
    redirect("/login");
  }

  const assignedProjects = await getTeamUserAssignedProjects(
    teamUser.id,
    teamUser.project_id
  );

  const admin = createAdminClient();
  const projectIds = assignedProjects.map((p) => p.id);

  let enrichedProjects: ProjectWithStats[] = assignedProjects.map((p) => ({
    ...p,
    totalStories: 0,
    approvedStories: 0,
    epicsCount: 0,
    pendingReviewCount: 0,
  }));

  if (projectIds.length > 0) {
    try {
      const [{ data: stories }, { data: epics }, { data: pendingReviews }] =
        await Promise.all([
          admin
            .from("stories")
            .select("id, project_id, status, team_review_status")
            .in("project_id", projectIds),
          admin
            .from("epics")
            .select("id, project_id")
            .in("project_id", projectIds),
          admin
            .from("story_reviewers")
            .select("story_id, stories!inner(id, project_id, team_review_status)")
            .eq("team_user_id", teamUser.id)
            .in("stories.project_id", projectIds)
            .in("stories.team_review_status", ["pending", "changes_requested"]),
        ]);

      const statsMap: Record<
        string,
        {
          totalStories: number;
          approvedStories: number;
          epicsCount: number;
          pendingReviewCount: number;
        }
      > = {};

      projectIds.forEach((pid) => {
        statsMap[pid] = {
          totalStories: 0,
          approvedStories: 0,
          epicsCount: 0,
          pendingReviewCount: 0,
        };
      });

      (stories || []).forEach((s) => {
        if (statsMap[s.project_id]) {
          statsMap[s.project_id].totalStories += 1;
          if (s.team_review_status === "approved" || s.status === "approved") {
            statsMap[s.project_id].approvedStories += 1;
          }
        }
      });

      (epics || []).forEach((e) => {
        if (statsMap[e.project_id]) {
          statsMap[e.project_id].epicsCount += 1;
        }
      });

      (pendingReviews || []).forEach((r: any) => {
        const pid = r.stories?.project_id;
        if (pid && statsMap[pid]) {
          statsMap[pid].pendingReviewCount += 1;
        }
      });

      enrichedProjects = assignedProjects.map((p) => ({
        ...p,
        ...(statsMap[p.id] || {
          totalStories: 0,
          approvedStories: 0,
          epicsCount: 0,
          pendingReviewCount: 0,
        }),
      }));
    } catch (err) {
      console.error("Failed to load project metrics:", err);
    }
  }

  return (
    <ProjectsClient
      projects={enrichedProjects}
      userName={teamUser.name}
    />
  );
}

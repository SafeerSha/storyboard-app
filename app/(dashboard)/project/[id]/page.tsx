import Link from "next/link";
import { ArrowLeft, FolderKanban } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProjectWorkspace } from "@/components/ProjectWorkspace";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

import { Story } from "@/lib/types";
import { getReviewersForStories } from "@/lib/story-reviewer-auth";
import { autoSyncStoriesFeedbackStatus } from "@/lib/feedback-store";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();
  const { data: project } = await db
    .from("projects")
    .select("id,name,description,status")
    .eq("id", id)
    .maybeSingle();

  if (!project) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6">
        <EmptyState
          icon={FolderKanban}
          title="Project not found"
          description="This project may have been removed, archived, or you may not have access."
          action={
            <Link href="/projects">
              <Button variant="secondary" size="md" leftIcon={<ArrowLeft size={14} />}>
                Back to projects
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const [{ data: rawStories }, { data: epics }] = await Promise.all([
    db
      .from("stories")
      .select("id,project_id,epic_id,title,description,acceptance_criteria,assumptions,clarifications,status,team_review_status,team_approved_by_id,team_approved_by_name,team_approved_at,client_review_status,client_approved_by_id,client_approved_by_name,client_approved_at,created_by_id,created_at,updated_at")
      .eq("project_id", id)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false }),
    db
      .from("epics")
      .select("id,project_id,name,description,status,sort_order,created_at,updated_at")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const storyList = (rawStories || []) as Story[];
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
    reviewer_ids: (reviewersMap[s.id] || []).map((r) => r.user_id),
    reviewers: reviewersMap[s.id] || [],
  }));

  return (
    <ProjectWorkspace
      projectId={id}
      projectName={project.name}
      projectDescription={project.description || undefined}
      projectStatus={project.status || "active"}
      initialStories={initialStories}
      initialEpics={epics ?? []}
    />
  );
}

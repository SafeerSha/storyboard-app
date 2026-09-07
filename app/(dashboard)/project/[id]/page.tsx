import Link from "next/link";
import { ArrowLeft, FolderKanban } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProjectWorkspace } from "@/components/ProjectWorkspace";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

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

  const { data: stories } = await db
    .from("stories")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: true });

  const { data: epics } = await db
    .from("epics")
    .select("*")
    .eq("project_id", id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return (
    <ProjectWorkspace
      projectId={id}
      projectName={project.name}
      projectDescription={project.description || undefined}
      projectStatus={project.status || "active"}
      initialStories={stories ?? []}
      initialEpics={epics ?? []}
    />
  );
}

import { createAdminClient } from "@/lib/supabase/admin";
import { ProjectWorkspace } from "@/components/ProjectWorkspace";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createAdminClient();
  const { data: project } = await db.from("projects").select("id,name,description").eq("id", id).maybeSingle();
  if (!project) {
    return (
      <main className="min-h-screen">
        <div className="lg:pl-[248px]">
          <div className="mx-auto max-w-[1320px] px-6 py-8 lg:px-9">
            <div className="rounded-2xl border border-line bg-white p-12 text-center shadow-soft">
              <p className="text-sm font-medium text-neutral-900">Project not found</p>
              <p className="mt-1 text-sm text-neutral-500">This project may have been removed or you don't have access.</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const { data: stories } = await db.from("stories").select("*").eq("project_id", id).order("created_at", { ascending: true });
  const { data: epics } = await db.from("epics").select("*").eq("project_id", id).order("sort_order", { ascending: true }).order("created_at", { ascending: true });

  return <ProjectWorkspace projectId={id} projectName={project.name} initialStories={stories ?? []} initialEpics={epics ?? []} />;
}

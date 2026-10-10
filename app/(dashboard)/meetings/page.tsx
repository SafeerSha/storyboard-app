import { createAdminClient } from "@/lib/supabase/admin";
import { AdminMeetingsWorkspace } from "@/components/meetings/AdminMeetingsWorkspace";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Meetings & Calls | REQly",
  description: "Schedule, coordinate, and review meetings across all projects.",
};

export default async function MeetingsPage() {
  const admin = createAdminClient();

  const [{ data: projectsData }, { data: meetingsData }] = await Promise.all([
    admin.from("projects").select("id, name, description").order("name", { ascending: true }),
    admin
      .from("project_meetings")
      .select(`
        *,
        projects:projects(id, name, description)
      `)
      .order("start_at", { ascending: true }),
  ]);

  const projects = (projectsData || []).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
  }));

  const initialMeetings = (meetingsData || []).map((m: any) => ({
    ...m,
    projectName: m.projects?.name || "Project Meeting",
  }));

  return (
    <main className="min-h-screen bg-[#faf9fc]">
      <AdminMeetingsWorkspace
        initialProjects={projects}
        initialMeetings={initialMeetings}
      />
    </main>
  );
}

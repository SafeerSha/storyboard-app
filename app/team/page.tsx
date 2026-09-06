import { redirect } from "next/navigation";
import { getAuthenticatedTeamUser } from "@/lib/team-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { TeamWorkspace } from "@/components/TeamWorkspace";
import type { Story, Epic } from "@/lib/types";

export default async function TeamDashboardPage() {
  const teamUser = await getAuthenticatedTeamUser();
  if (!teamUser) {
    redirect("/team/login");
  }

  const admin = createAdminClient();

  // Fetch the assigned project ONLY
  const { data: project } = await admin
    .from("projects")
    .select("id, name, description")
    .eq("id", teamUser.project_id)
    .maybeSingle();

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

  // Fetch Epics for this project
  const { data: epicsData } = await admin
    .from("epics")
    .select("*")
    .eq("project_id", teamUser.project_id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  // Fetch Stories for this project
  const { data: storiesData } = await admin
    .from("stories")
    .select("*")
    .eq("project_id", teamUser.project_id)
    .order("created_at", { ascending: true });

  const initialStories = (storiesData || []) as Story[];
  const initialEpics = (epicsData || []) as Epic[];

  return (
    <TeamWorkspace
      teamUser={teamUser}
      project={project}
      initialStories={initialStories}
      initialEpics={initialEpics}
    />
  );
}

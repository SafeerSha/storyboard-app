import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthenticatedTeamUser } from "@/lib/team-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { EpicFeedbackThread } from "@/components/epics/EpicFeedbackThread";
import { ArrowLeft } from "lucide-react";

export default async function TeamEpicDiscussionPage({
  params,
}: {
  params: Promise<{ epicId: string }>;
}) {
  const teamUser = await getAuthenticatedTeamUser();
  if (!teamUser) {
    redirect("/login");
  }

  const { epicId } = await params;
  const admin = createAdminClient();

  // Fetch the epic
  const { data: epic } = await admin
    .from("epics")
    .select("id, project_id, name, description")
    .eq("id", epicId)
    .maybeSingle();

  if (!epic) {
    return (
      <main className="mx-auto max-w-4xl p-6 sm:p-12 text-center">
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Epic Not Found</h2>
          <p className="mt-2 text-sm text-slate-500">
            The epic you are looking for could not be found or has been removed.
          </p>
          <div className="mt-6">
            <Link
              href="/team"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition"
            >
              <ArrowLeft size={16} />
              <span>Back to Workspace</span>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Fetch project name for context
  const { data: project } = await admin
    .from("projects")
    .select("name")
    .eq("id", epic.project_id)
    .maybeSingle();

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-8">
      {/* Navigation */}
      <div className="mb-6">
        <Link
          href={`/team?projectId=${epic.project_id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft size={16} />
          <span>Back to Project</span>
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8 rounded-2xl border border-[rgba(184,148,78,0.2)] bg-gradient-to-br from-[#FCFBFC] to-white p-6 shadow-sm">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#80642F]">
            <span>{project?.name || "Project"}</span>
            <span className="text-[rgba(184,148,78,0.3)]">/</span>
            <span>Epic Discussion</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{epic.name}</h1>
          {epic.description && (
            <p className="text-sm text-slate-600 mt-1">{epic.description}</p>
          )}
        </div>
      </div>

      {/* Discussion Thread */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-6">Discussion</h2>
        <EpicFeedbackThread
          epicId={epic.id}
          sectionType="general"
          viewerId={teamUser.id}
          viewerType="team_user"
        />
      </div>
    </main>
  );
}

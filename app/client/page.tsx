import { redirect } from "next/navigation";
import { ChevronDown, FolderKanban, Layers } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedClient } from "@/lib/client-session";
import { ClientStoryReview } from "@/components/ClientStoryReview";
import { ClientSignOut } from "@/components/ClientSignOut";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Story, Epic } from "@/lib/types";

export default async function ClientPortal() {
  const client = await getAuthenticatedClient({ allowPendingPasswordChange: true });
  if (!client) redirect("/client/login");
  if (!client.is_password_changed) redirect("/client/set-password");

  const db = createAdminClient();
  const { data: project } = await db
    .from("projects")
    .select("name,description")
    .eq("id", client.project_id)
    .single();

  const { data: stories } = await db
    .from("stories")
    .select("id,epic_id,title,description,acceptance_criteria,assumptions,clarifications,status,updated_at,team_review_status,team_approved_by_name")
    .eq("project_id", client.project_id)
    .order("created_at");

  const { data: epicsData } = await db
    .from("epics")
    .select("*")
    .eq("project_id", client.project_id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const all = (stories ?? []) as Story[];
  const epics = (epicsData ?? []) as Epic[];
  const approvedCount = all.filter((s) => s.status === "approved").length;
  const changesCount = all.filter((s) => s.status === "changes_requested").length;
  const progressPercent = all.length
    ? Math.round((approvedCount / all.length) * 100)
    : 0;

  const projectName = project?.name || "Project Requirements";

  return (
    <main className="min-h-screen bg-paper pb-20">
      {/* Top Header */}
      <header className="sticky top-0 z-20 border-b border-[#E2E6EF] bg-[#F8F9FC]/95 backdrop-blur-md">
        <div className="mx-auto flex min-h-[72px] sm:min-h-[80px] py-4 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-900 text-white shadow-xs">
              <span className="text-xs font-semibold">◆</span>
            </div>
            <div className="min-w-0">
              <span className="text-base font-semibold tracking-tight text-[#111827] truncate block">
                StoryBoard
              </span>
              <span className="text-[11px] text-[#64748B] font-medium uppercase tracking-wider block">
                Client Review Portal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-semibold text-slate-900">{client.name}</p>
              <p className="text-[11px] text-zinc-400 truncate max-w-[180px]">{projectName}</p>
            </div>
            <ClientSignOut />
          </div>
        </div>
      </header>

      {/* Main Review Body */}
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-9 lg:px-8 space-y-6">
        {/* Project Header & Review Progress Card */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 sm:p-7 shadow-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 border-b border-zinc-100 pb-4">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-indigo-600">
                <FolderKanban size={13} />
                <span>Project Scope Review</span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                {projectName}
              </h1>
              {project?.description && (
                <p className="mt-1.5 text-xs sm:text-sm text-zinc-500 max-w-2xl leading-relaxed">
                  {project.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs font-medium shrink-0 pt-1">
              <span className="text-zinc-600">{all.length} Stories</span>
              <span className="text-zinc-300">•</span>
              <span className="text-emerald-700 font-semibold">{approvedCount} Approved</span>
              {changesCount > 0 && (
                <>
                  <span className="text-zinc-300">•</span>
                  <span className="text-rose-700 font-semibold">{changesCount} Changes</span>
                </>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-zinc-500 mb-1.5 font-medium">
              <span>Review Progress</span>
              <span className="text-slate-900 font-semibold">{progressPercent}% Reviewed</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-slate-900 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Epics & Stories Accordion */}
        {epics.length === 0 && all.filter((s) => s.epic_id === null).length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No requirements available yet"
            description="Your project team has not added any feature stories for review yet. You will be notified once stories are ready for sign-off."
          />
        ) : (
          <div className="space-y-4">
            {epics.map((epic) => {
              const epicStories = all.filter((s) => s.epic_id === epic.id);
              return <EpicBlock key={epic.id} epic={epic} stories={epicStories} />;
            })}

            {/* Uncategorized stories */}
            {all.filter((s) => s.epic_id === null).length > 0 && (
              <EpicBlock
                key="uncategorized"
                epic={
                  {
                    id: "uncategorized",
                    name: "Additional Requirements",
                    description: "Stories not grouped under a specific Epic",
                    project_id: client.project_id,
                  } as Epic
                }
                stories={all.filter((s) => s.epic_id === null)}
              />
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function EpicBlock({ epic, stories }: { epic: Epic; stories: Story[] }) {
  const approvedCount = stories.filter((s) => s.status === "approved").length;
  const progressPercent = stories.length
    ? Math.round((approvedCount / stories.length) * 100)
    : 0;

  return (
    <details
      className="group rounded-2xl border border-zinc-200/80 bg-white shadow-card overflow-hidden"
      open
    >
      <summary className="flex cursor-pointer items-center justify-between p-4 sm:p-5 outline-none [&::-webkit-details-marker]:hidden select-none hover:bg-zinc-50/70 transition-colors border-b border-transparent group-open:border-zinc-100">
        <div className="flex-1 min-w-0 pr-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Epic
            </span>
            <span className="text-zinc-300">•</span>
            <span className="text-xs text-zinc-500 font-medium">
              {stories.length} {stories.length === 1 ? "story" : "stories"} · {approvedCount} approved
            </span>
          </div>

          <h2 className="text-base sm:text-lg font-semibold text-slate-900 tracking-tight truncate">
            {epic.name}
          </h2>

          {epic.description && (
            <p className="mt-1 text-xs text-zinc-500 line-clamp-1">
              {epic.description}
            </p>
          )}

          {stories.length > 0 && (
            <div className="mt-2.5 flex items-center gap-2">
              <div className="h-1 w-24 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-slate-900 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-[11px] font-medium text-zinc-400">{progressPercent}%</span>
            </div>
          )}
        </div>

        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-400 group-hover:text-zinc-700 transition">
          <ChevronDown className="transition-transform duration-200 group-open:rotate-180" size={16} />
        </div>
      </summary>

      <div className="p-3 sm:p-5 space-y-3 bg-zinc-50/20">
        {stories.length === 0 ? (
          <p className="text-xs text-zinc-400 py-3 text-center">No stories in this Epic yet.</p>
        ) : (
          stories.map((story) => <StoryArticle key={story.id} story={story} />)
        )}
      </div>
    </details>
  );
}

function StoryArticle({ story }: { story: Story }) {
  const statusVariant = (story.status || "review") as BadgeVariant;

  return (
    <details className="group/story rounded-xl border border-zinc-200/80 bg-white shadow-xs overflow-hidden transition-all">
      <summary className="flex cursor-pointer flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 outline-none [&::-webkit-details-marker]:hidden hover:bg-zinc-50/50 transition-colors select-none">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Feature
            </span>
            <span className="text-zinc-300">•</span>
            <span className="text-xs text-zinc-500">
              {story.acceptance_criteria?.length ?? 0} criteria
            </span>
          </div>
          <h3 className="text-sm sm:text-base font-semibold text-slate-900 group-open/story:text-indigo-600 transition-colors truncate">
            {story.title}
          </h3>
          {story.description && (
            <p className="mt-1 text-xs text-zinc-500 line-clamp-1">
              {story.description}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
          <Badge variant={statusVariant} size="sm" />
          <div className="grid h-7 w-7 place-items-center rounded text-zinc-400 group-hover/story:text-zinc-700 transition">
            <ChevronDown className="transition-transform duration-200 group-open/story:rotate-180" size={16} />
          </div>
        </div>
      </summary>

      <div className="border-t border-zinc-100 p-4 sm:p-6 bg-white space-y-5">
        {story.description && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
              Summary
            </h4>
            <p className="text-xs sm:text-sm leading-relaxed text-zinc-700 whitespace-pre-wrap">
              {story.description}
            </p>
          </div>
        )}

        {/* Story details & Client review action flow */}
        <ClientStoryReview story={story} />
      </div>
    </details>
  );
}

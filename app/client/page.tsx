import React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Bookmark,
  CheckCircle2,
  Clock,
  FolderKanban,
  Layers,
  ListTodo,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedClient } from "@/lib/client-session";
import { Button } from "@/components/ui/Button";
import { ClientStoryCard, type EnrichedClientStory } from "@/components/clients/ClientStoryCard";
import type { Story, Epic } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ClientOverviewPage() {
  const client = await getAuthenticatedClient({ allowPendingPasswordChange: true });
  if (!client) redirect("/client/login");
  if (!client.is_password_changed) redirect("/client/set-password");

  const db = createAdminClient();

  // Parallel server queries for Overview
  const [
    { data: project },
    { count: totalStoriesCount },
    { count: approvedStoriesCount },
    { count: changesRequestedCount },
    { count: needsActionCount },
    { data: actionStoriesData },
    { data: epicsData },
    { data: storyEpicMap },
  ] = await Promise.all([
    // Project info
    db
      .from("projects")
      .select("name, description")
      .eq("id", client.project_id)
      .single(),

    // Total stories count
    db
      .from("stories")
      .select("id", { count: "exact", head: true })
      .eq("project_id", client.project_id),

    // Approved stories count
    db
      .from("stories")
      .select("id", { count: "exact", head: true })
      .eq("project_id", client.project_id)
      .or("client_review_status.eq.approved,status.eq.approved"),

    // Changes requested count
    db
      .from("stories")
      .select("id", { count: "exact", head: true })
      .eq("project_id", client.project_id)
      .or("client_review_status.eq.changes_requested,status.eq.changes_requested"),

    // Needs action count
    db
      .from("stories")
      .select("id", { count: "exact", head: true })
      .eq("project_id", client.project_id)
      .neq("client_review_status", "approved")
      .neq("status", "approved"),

    // Bounded top 6 actionable stories
    db
      .from("stories")
      .select(
        "id, project_id, epic_id, title, description, acceptance_criteria, assumptions, clarifications, status, team_review_status, team_approved_by_name, team_approved_at, client_review_status, client_approved_by_name, client_approved_at, created_at, updated_at"
      )
      .eq("project_id", client.project_id)
      .neq("client_review_status", "approved")
      .neq("status", "approved")
      .order("updated_at", { ascending: false })
      .limit(6),

    // Epics
    db
      .from("epics")
      .select("id, name, description, created_at")
      .eq("project_id", client.project_id)
      .order("created_at", { ascending: false }),

    // All story IDs + epic IDs + status for epic progress aggregation
    db
      .from("stories")
      .select("id, epic_id, status, client_review_status")
      .eq("project_id", client.project_id),
  ]);

  const total = totalStoriesCount ?? 0;
  const approved = approvedStoriesCount ?? 0;
  const changes = changesRequestedCount ?? 0;
  const needsAction = needsActionCount ?? 0;
  const progressPercent = total ? Math.round((approved / total) * 100) : 0;
  const projectName = project?.name || "Project Requirements";

  // Batch query feedback counts for the top actionable stories
  const actionStoryList = (actionStoriesData || []) as Story[];
  const actionStoryIds = actionStoryList.map((s) => s.id);
  const feedbackCountsMap: Record<string, number> = {};

  if (actionStoryIds.length > 0) {
    const { data: openThreads } = await db
      .from("story_feedback_threads")
      .select("story_id")
      .in("story_id", actionStoryIds)
      .eq("status", "open");

    (openThreads || []).forEach((t) => {
      feedbackCountsMap[t.story_id] = (feedbackCountsMap[t.story_id] || 0) + 1;
    });
  }

  // Epic lookup map
  const epics = (epicsData || []) as Epic[];
  const epicMap = new Map<string, string>();
  epics.forEach((e) => epicMap.set(e.id, e.name));

  const enrichedActionStories: EnrichedClientStory[] = actionStoryList.map((s) => ({
    ...s,
    epic_name: s.epic_id ? epicMap.get(s.epic_id) || "Epic" : "Additional Requirements",
    open_feedback_count: feedbackCountsMap[s.id] || 0,
  }));

  // Epic statistics aggregation
  const epicStats: Record<string, { total: number; approved: number }> = {};
  (storyEpicMap || []).forEach((s) => {
    const k = s.epic_id || "uncategorized";
    if (!epicStats[k]) epicStats[k] = { total: 0, approved: 0 };
    epicStats[k].total += 1;
    if (s.client_review_status === "approved" || s.status === "approved") {
      epicStats[k].approved += 1;
    }
  });

  return (
    <div className="min-h-screen pb-16">
      {/* Top Banner / Project Summary Card */}
      <div className="border-b border-[rgba(74,61,100,0.08)] bg-white/60 backdrop-blur-[20px] px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(184,148,78,0.10)] px-2.5 py-0.5 text-[11px] font-semibold text-[#80642F] border border-[rgba(184,148,78,0.18)] mb-2 uppercase tracking-wider">
                <FolderKanban size={12} className="text-[#B8944E]" />
                <span>Client Review Portal</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#252331]">
                {projectName}
              </h1>
              {project?.description && (
                <p className="mt-1 text-sm text-[#706C7D] max-w-2xl leading-relaxed">
                  {project.description}
                </p>
              )}
            </div>

            {/* Overall Progress Indicator */}
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-[rgba(184,148,78,0.22)] bg-gradient-to-br from-white/90 to-[#FDFBF7] p-4 shadow-[0_4px_20px_rgba(184,148,78,0.08)] min-w-[200px]">
                <div className="flex items-center justify-between text-xs font-semibold text-[#80642F] mb-1.5">
                  <span>Sign-Off Progress</span>
                  <span className="text-sm font-bold text-[#252331]">{progressPercent}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[rgba(74,61,100,0.08)]">
                  <div
                    className="h-full rounded-full bg-[#B8944E] transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-[#706C7D] font-medium">
                  <span>{approved} of {total} stories signed off</span>
                  {changes > 0 && (
                    <span className="text-rose-600 font-semibold">{changes} changes</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 space-y-8">
        {/* Quick Review Navigation Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Needs Your Action Card */}
          <Link
            href="/client/reviews"
            className="group rounded-2xl border border-[rgba(74,61,100,0.08)] bg-white/80 p-5 shadow-xs hover:border-[#B8944E]/30 hover:shadow-md transition backdrop-blur-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[rgba(184,148,78,0.14)] text-[#80642F]">
                <ListTodo size={20} />
              </div>
              <span className="text-xl font-bold text-[#252331] group-hover:text-[#80642F] transition-colors">
                {needsAction}
              </span>
            </div>
            <h3 className="text-sm font-bold text-[#252331] group-hover:text-[#80642F] transition-colors">
              Needs Your Action
            </h3>
            <p className="mt-1 text-xs text-[#706C7D] line-clamp-2">
              Stories awaiting your review, feedback, or sign-off.
            </p>
          </Link>
          {/* Changes Requested Card */}
          <Link
            href="/client/changes"
            className="group rounded-2xl border border-[rgba(74,61,100,0.08)] bg-white/80 p-5 shadow-xs hover:border-[#B8944E]/30 hover:shadow-md transition backdrop-blur-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
                <AlertCircle size={20} />
              </div>
              <span className="text-xl font-bold text-[#252331] group-hover:text-[#80642F] transition-colors">
                {changes}
              </span>
            </div>
            <h3 className="text-sm font-bold text-[#252331] group-hover:text-[#80642F] transition-colors">
              Changes Requested
            </h3>
            <p className="mt-1 text-xs text-[#706C7D] line-clamp-2">
              Stories where revisions were requested and team updates need sign-off.
            </p>
          </Link>

          {/* Approved Stories Card */}
          <Link
            href="/client/approved"
            className="group rounded-2xl border border-[rgba(74,61,100,0.08)] bg-white/80 p-5 shadow-xs hover:border-[#B8944E]/30 hover:shadow-md transition backdrop-blur-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                <CheckCircle2 size={20} />
              </div>
              <span className="text-xl font-bold text-[#252331] group-hover:text-[#80642F] transition-colors">
                {approved}
              </span>
            </div>
            <h3 className="text-sm font-bold text-[#252331] group-hover:text-[#80642F] transition-colors">
              Approved Stories
            </h3>
            <p className="mt-1 text-xs text-[#706C7D] line-clamp-2">
              Complete catalog of signed-off features and acceptance criteria.
            </p>
          </Link>

          {/* All Stories Card */}
          <Link
            href="/client/stories"
            className="group rounded-2xl border border-[rgba(74,61,100,0.08)] bg-white/80 p-5 shadow-xs hover:border-[#B8944E]/30 hover:shadow-md transition backdrop-blur-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[rgba(184,148,78,0.12)] text-[#80642F] border border-[rgba(184,148,78,0.18)]">
                <Layers size={20} />
              </div>
              <span className="text-xl font-bold text-[#252331] group-hover:text-[#80642F] transition-colors">
                {total}
              </span>
            </div>
            <h3 className="text-sm font-bold text-[#252331] group-hover:text-[#80642F] transition-colors">
              All Stories Directory
            </h3>
            <p className="mt-1 text-xs text-[#706C7D] line-clamp-2">
              Full requirements catalog grouped by Epics with search and filters.
            </p>
          </Link>
        </section>

        {/* Project Epics Overview Grid */}
        {epics.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-[rgba(74,61,100,0.08)] pb-3">
              <div>
                <h2 className="text-lg font-bold text-[#252331] tracking-tight">
                  Project Epics
                </h2>
                <p className="text-xs text-[#706C7D]">
                  High-level functional modules and their sign-off progress.
                </p>
              </div>
              <Link href="/client/stories">
                <Button
                  variant="secondary"
                  size="sm"
                  className="text-xs font-semibold text-[#80642F]"
                >
                  View by Epic
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {epics.map((epic) => {
                const stats = epicStats[epic.id] || { total: 0, approved: 0 };
                const pct = stats.total ? Math.round((stats.approved / stats.total) * 100) : 0;

                return (
                  <Link
                    key={epic.id}
                    href={`/client/stories?epicId=${epic.id}`}
                    className="group rounded-2xl border border-[rgba(74,61,100,0.08)] bg-white/80 p-5 shadow-xs hover:border-[#B8944E]/30 hover:shadow-md transition backdrop-blur-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#80642F] mb-1.5">
                        <Bookmark size={13} className="text-[#B8944E]" />
                        <span className="uppercase tracking-wider text-[10px]">Epic</span>
                      </div>
                      <h3 className="text-sm font-bold text-[#252331] group-hover:text-[#80642F] transition-colors truncate">
                        {epic.name}
                      </h3>
                      {epic.description && (
                        <p className="mt-1 text-xs text-[#706C7D] line-clamp-2">
                          {epic.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-[rgba(74,61,100,0.06)]">
                      <div className="flex items-center justify-between text-xs font-medium text-[#706C7D] mb-1">
                        <span>{stats.approved} of {stats.total} approved</span>
                        <span className="font-semibold text-[#252331]">{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className="h-full rounded-full bg-[#B8944E] transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

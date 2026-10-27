"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowDown,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Filter,
  MessageSquare,
  RotateCcw,
  Search,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  ClientStoryCard,
  formatRelativeTime,
  type EnrichedClientStory,
} from "@/components/clients/ClientStoryCard";
import type { Epic } from "@/lib/types";

interface PaginatedResponse {
  stories: EnrichedClientStory[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  epics: Epic[];
}

interface ThreadItem {
  id: string;
  story_id: string;
  section_type: string;
  item_text: string | null;
  status: string;
  created_by_name: string;
  created_at: string;
  last_message: {
    body: string;
    author_name: string;
    author_type: string;
    created_at: string;
  } | null;
}

export default function ClientChangesRequestedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentEpicId = searchParams.get("epicId") || "all";
  const currentSearch = searchParams.get("search") || "";
  const currentPage = parseInt(searchParams.get("page") || "1", 10);
  const targetStoryId = searchParams.get("storyId");

  const [searchInput, setSearchInput] = useState(currentSearch);
  const [data, setData] = useState<PaginatedResponse | null>(null);
  const [threadsMap, setThreadsMap] = useState<Record<string, ThreadItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openStoryId, setOpenStoryId] = useState<string | null>(targetStoryId);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setSearchInput(currentSearch);
  }, [currentSearch]);

  const updateQueryParams = useCallback(
    (updates: {
      epicId?: string;
      search?: string;
      page?: number;
    }) => {
      const params = new URLSearchParams(searchParams.toString());

      if (updates.epicId !== undefined) {
        if (updates.epicId === "all" || !updates.epicId) params.delete("epicId");
        else params.set("epicId", updates.epicId);
        params.delete("page");
      }

      if (updates.search !== undefined) {
        if (!updates.search.trim()) params.delete("search");
        else params.set("search", updates.search.trim());
        params.delete("page");
      }

      if (updates.page !== undefined) {
        if (updates.page <= 1) params.delete("page");
        else params.set("page", updates.page.toString());
      }

      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `/client/changes?${qs}` : "/client/changes");
      });
    },
    [router, searchParams]
  );

  const fetchChanges = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("tab", "changes_requested");
      if (currentEpicId !== "all") params.set("epicId", currentEpicId);
      if (currentSearch.trim()) params.set("search", currentSearch.trim());
      params.set("page", currentPage.toString());
      params.set("limit", "15");

      const [storiesRes, inboxRes] = await Promise.all([
        fetch(`/api/client/stories/paginated?${params.toString()}`),
        fetch("/api/client/feedback/inbox?limit=50"),
      ]);

      if (!storiesRes.ok) {
        if (storiesRes.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Failed to load changes requested");
      }

      const storiesJson: PaginatedResponse = await storiesRes.json();
      setData(storiesJson);

      if (inboxRes.ok) {
        const inboxJson = await inboxRes.json();
        const map: Record<string, ThreadItem[]> = {};
        (inboxJson.threads || []).forEach((t: ThreadItem) => {
          if (!map[t.story_id]) map[t.story_id] = [];
          map[t.story_id].push(t);
        });
        setThreadsMap(map);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error fetching changes");
    } finally {
      setLoading(false);
    }
  }, [currentEpicId, currentSearch, currentPage, router]);

  useEffect(() => {
    fetchChanges();
  }, [fetchChanges]);

  useEffect(() => {
    const handleUpdate = () => fetchChanges();
    window.addEventListener("storyboard:client-review-updated", handleUpdate);
    return () => {
      window.removeEventListener("storyboard:client-review-updated", handleUpdate);
    };
  }, [fetchChanges]);

  useEffect(() => {
    if (targetStoryId) {
      setOpenStoryId(targetStoryId);
      const timer = setTimeout(() => {
        const el = document.getElementById(`story-${targetStoryId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [targetStoryId]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      updateQueryParams({ search: searchInput });
    }
  };

  const stories = data?.stories || [];
  const pagination = data?.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 };
  const epics = data?.epics || [];

  return (
    <div className="min-h-screen pb-16">
      {/* Header */}
      <div className="border-b border-[rgba(15,23,42,0.08)] bg-white/60 backdrop-blur-[20px] px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-[1720px]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-800 border border-rose-200/80 mb-2 uppercase tracking-wider">
                <AlertCircle size={12} className="text-rose-600" />
                <span>Revisions Workflow</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A]">
                Changes Requested
              </h1>
              <p className="mt-1 text-sm text-[#334155]">
                Stories where you requested changes and the team has updated the requirements for your sign-off.
              </p>
            </div>

            {/* Total Metric */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5 rounded-2xl border border-rose-200/80 bg-gradient-to-br from-white/90 to-rose-50/30 px-4 py-2.5 shadow-xs">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-rose-100 text-rose-700">
                  <AlertCircle size={18} />
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-800/80">
                    Pending Revision
                  </div>
                  <div className="text-lg font-bold text-[#0F172A]">
                    {pagination.total} {pagination.total === 1 ? "story" : "stories"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="mx-auto max-w-[1720px] px-4 py-6 sm:px-8">
        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#334155]"
              />
              <input
                type="text"
                placeholder="Search revision stories..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                onBlur={() => {
                  if (searchInput !== currentSearch) {
                    updateQueryParams({ search: searchInput });
                  }
                }}
                className="h-10 w-full rounded-xl border border-[rgba(15,23,42,0.12)] bg-white/80 pl-10 pr-4 text-sm text-[#0F172A] placeholder-[#A09CAB] backdrop-blur-[12px] transition focus:border-[#CCA038] focus:outline-none focus:ring-2 focus:ring-[#CCA038]/20 shadow-sm"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    updateQueryParams({ search: "" });
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#334155] hover:text-[#0F172A]"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Epic Filter */}
            {epics.length > 0 && (
              <div className="flex items-center gap-1.5 rounded-xl border border-[rgba(15,23,42,0.12)] bg-white/80 px-3 py-2 text-sm text-[#0F172A] shadow-sm backdrop-blur-[12px]">
                <Filter size={14} className="text-[#334155]" />
                <span className="text-xs font-medium text-[#334155]">Epic:</span>
                <select
                  value={currentEpicId}
                  onChange={(e) => updateQueryParams({ epicId: e.target.value })}
                  className="bg-transparent text-sm font-semibold text-[#0F172A] focus:outline-none cursor-pointer"
                >
                  <option value="all">All Epics</option>
                  {epics.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                  <option value="uncategorized">Additional Requirements</option>
                </select>
              </div>
            )}
          </div>

          <button
            onClick={() => fetchChanges()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[rgba(15,23,42,0.12)] bg-white/80 px-3 py-2 text-xs font-semibold text-[#334155] hover:text-[#0F172A] hover:bg-white transition self-end sm:self-auto"
            title="Refresh list"
          >
            <RotateCcw size={13} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Empty State */}
        {!loading && stories.length === 0 && (
          <div className="mt-8 rounded-3xl border border-[rgba(15,23,42,0.12)] bg-white/80 p-10 sm:p-16 text-center shadow-xs backdrop-blur-[16px]">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-rose-50 text-rose-600 shadow-xs">
              <AlertCircle size={32} />
            </div>
            <h3 className="text-xl font-bold text-[#0F172A]">
              No change requests pending
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#334155]">
              You have not requested changes on any stories, or all requested changes have been resolved and signed off.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/client">
                <Button variant="secondary">Go to Overview</Button>
              </Link>
            </div>
          </div>
        )}

        {/* Stories List with Change Request → Team Response flow */}
        {!loading && stories.length > 0 && (
          <div className="space-y-6">
            {stories.map((story) => {
              const threads = threadsMap[story.id] || [];
              const isOpen = openStoryId === story.id;

              return (
                <div
                  key={story.id}
                  className="rounded-2xl border border-rose-200/70 bg-gradient-to-br from-white/95 to-rose-50/20 shadow-xs overflow-hidden backdrop-blur-md"
                >
                  {/* Contextual Flow Banner (when collapsed or expanded) */}
                  {threads.length > 0 && (
                    <div className="border-b border-rose-100 bg-rose-50/40 p-4 sm:px-6">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-rose-800 mb-2 flex items-center gap-1.5">
                        <MessageSquare size={13} />
                        <span>Revision Thread Preview</span>
                      </div>

                      <div className="space-y-3">
                        {threads.slice(0, 2).map((t) => (
                          <div
                            key={t.id}
                            className="rounded-xl border border-rose-200/60 bg-white/80 p-3 text-xs shadow-2xs space-y-2"
                          >
                            {/* Client change request */}
                            <div className="flex items-start gap-2">
                              <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 shrink-0">
                                Your Request
                              </span>
                              <p className="text-[#0F172A] font-medium italic">
                                &ldquo;{t.item_text || "Revision requested on requirement"}&rdquo;
                              </p>
                            </div>

                            {/* Team response if available */}
                            {t.last_message && t.last_message.author_type !== "client" && (
                              <div className="flex items-start gap-2 border-t border-rose-50 pt-2 pl-3">
                                <ArrowDown size={12} className="text-zinc-400 shrink-0 mt-0.5" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 text-[10px] text-[#334155] mb-0.5">
                                    <span className="font-semibold text-[#785312]">
                                      Team Response ({t.last_message.author_name}):
                                    </span>
                                    <span>{formatRelativeTime(t.last_message.created_at)}</span>
                                  </div>
                                  <p className="text-[#0F172A] bg-[rgba(204,160,56,0.06)] rounded-lg p-2 border border-[rgba(204,160,56,0.12)]">
                                    {t.last_message.body}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Client Story Card */}
                  <div className="p-2 sm:p-3">
                    <ClientStoryCard
                      story={story}
                      isOpen={isOpen}
                      onToggle={() =>
                        setOpenStoryId((prev) => (prev === story.id ? null : story.id))
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && pagination.totalPages > 1 && (
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[rgba(15,23,42,0.08)] pt-4 text-xs text-[#334155]">
            <div>
              Showing{" "}
              <span className="font-semibold text-[#0F172A]">
                {(pagination.page - 1) * pagination.limit + 1}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-[#0F172A]">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-[#0F172A]">{pagination.total}</span>{" "}
              stories
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => updateQueryParams({ page: pagination.page - 1 })}
                className="inline-flex items-center gap-1 rounded-xl border border-[rgba(15,23,42,0.12)] bg-white px-3 py-1.5 font-semibold text-[#0F172A] shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[rgba(204,160,56,0.08)] hover:border-[#CCA038] transition"
              >
                <ChevronLeft size={14} />
                <span>Previous</span>
              </button>

              <span className="px-2 font-medium text-[#0F172A]">
                Page {pagination.page} of {pagination.totalPages}
              </span>

              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => updateQueryParams({ page: pagination.page + 1 })}
                className="inline-flex items-center gap-1 rounded-xl border border-[rgba(15,23,42,0.12)] bg-white px-3 py-1.5 font-semibold text-[#0F172A] shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[rgba(204,160,56,0.08)] hover:border-[#CCA038] transition"
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

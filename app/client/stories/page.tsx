"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  ClientStoryCard,
  type EnrichedClientStory,
} from "@/components/clients/ClientStoryCard";
import type { Epic } from "@/lib/types";
import { EpicFolder } from "@/components/epics/EpicFolder";
import { groupStoriesByEpic } from "@/lib/epic-story-utils";

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

export default function ClientAllStoriesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentEpicId = searchParams.get("epicId") || "all";
  const currentStatus = searchParams.get("status") || "all";
  const currentSearch = searchParams.get("search") || "";
  const currentSortBy = searchParams.get("sortBy") || "updated";
  const currentPage = parseInt(searchParams.get("page") || "1", 10);
  const targetStoryId = searchParams.get("storyId");

  const [searchInput, setSearchInput] = useState(currentSearch);
  const [data, setData] = useState<PaginatedResponse | null>(null);
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
      status?: string;
      search?: string;
      sortBy?: string;
      page?: number;
    }) => {
      const params = new URLSearchParams(searchParams.toString());

      if (updates.epicId !== undefined) {
        if (updates.epicId === "all" || !updates.epicId) params.delete("epicId");
        else params.set("epicId", updates.epicId);
        params.delete("page");
      }

      if (updates.status !== undefined) {
        if (updates.status === "all" || !updates.status) params.delete("status");
        else params.set("status", updates.status);
        params.delete("page");
      }

      if (updates.search !== undefined) {
        if (!updates.search.trim()) params.delete("search");
        else params.set("search", updates.search.trim());
        params.delete("page");
      }

      if (updates.sortBy !== undefined) {
        if (updates.sortBy === "updated") params.delete("sortBy");
        else params.set("sortBy", updates.sortBy);
        params.delete("page");
      }

      if (updates.page !== undefined) {
        if (updates.page <= 1) params.delete("page");
        else params.set("page", updates.page.toString());
      }

      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `/client/stories?${qs}` : "/client/stories");
      });
    },
    [router, searchParams]
  );

  const fetchStories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("tab", "all");
      if (currentEpicId !== "all") params.set("epicId", currentEpicId);
      if (currentStatus !== "all") params.set("status", currentStatus);
      if (currentSearch.trim()) params.set("search", currentSearch.trim());
      if (currentSortBy !== "updated") params.set("sortBy", currentSortBy);
      params.set("page", currentPage.toString());
      params.set("limit", "15");

      const res = await fetch(`/api/client/stories/paginated?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Failed to load stories");
      }

      const json: PaginatedResponse = await res.json();
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error fetching stories");
    } finally {
      setLoading(false);
    }
  }, [currentEpicId, currentStatus, currentSearch, currentSortBy, currentPage, router]);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  useEffect(() => {
    const handleUpdate = () => fetchStories();
    window.addEventListener("storyboard:client-review-updated", handleUpdate);
    return () => {
      window.removeEventListener("storyboard:client-review-updated", handleUpdate);
    };
  }, [fetchStories]);

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

  const [collapsedEpicIds, setCollapsedEpicIds] = useState<Set<string>>(new Set());

  const toggleEpic = useCallback((epicId: string) => {
    setCollapsedEpicIds((prev) => {
      const next = new Set(prev);
      if (next.has(epicId)) {
        next.delete(epicId);
      } else {
        next.add(epicId);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (targetStoryId && data) {
      const foundStory = data.stories.find((s) => s.id === targetStoryId);
      if (foundStory) {
        const folderId = foundStory.epic_id || "uncategorized";
        setCollapsedEpicIds((prev) => {
          if (prev.has(folderId)) {
            const next = new Set(prev);
            next.delete(folderId);
            return next;
          }
          return prev;
        });
      }
    }
  }, [targetStoryId, data]);

  const epicGroups = React.useMemo(() => {
    if (!data) return [];
    const targetEpics =
      currentEpicId === "all"
        ? data.epics
        : currentEpicId === "uncategorized"
        ? []
        : data.epics.filter((e) => e.id === currentEpicId);

    const groups = groupStoriesByEpic(targetEpics, data.stories);
    if (currentEpicId === "uncategorized") {
      return groups.filter((g) => g.isUncategorized);
    }
    return groups;
  }, [data, currentEpicId]);

  return (
    <div className="min-h-screen pb-16">
      {/* Header */}
      <div className="border-b border-[rgba(15,23,42,0.08)] bg-white/60 backdrop-blur-[20px] px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-[1720px]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(204,160,56,0.10)] px-2.5 py-0.5 text-[11px] font-semibold text-[#785312] border border-[rgba(204,160,56,0.18)] mb-2 uppercase tracking-wider">
                <Layers size={12} className="text-[#CCA038]" />
                <span>Requirements Directory</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A]">
                All Project Stories
              </h1>
              <p className="mt-1 text-sm text-[#334155]">
                Complete catalog of functional specifications and acceptance criteria across all project Epics.
              </p>
            </div>

            {/* Total Metric */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5 rounded-2xl border border-[rgba(204,160,56,0.22)] bg-gradient-to-br from-white/90 to-[#FDFBF7] px-4 py-2.5 shadow-xs">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-[rgba(204,160,56,0.14)] text-[#785312]">
                  <Layers size={18} />
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#785312]/80">
                    Total Requirements
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
        {/* Filters and Controls */}
        <div className="mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-1 flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#334155]"
              />
              <input
                type="text"
                placeholder="Search stories by title or description..."
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
                  <option value="uncategorized">Uncategorized</option>
                </select>
              </div>
            )}

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 rounded-xl border border-[rgba(15,23,42,0.12)] bg-white/80 px-3 py-2 text-sm text-[#0F172A] shadow-sm backdrop-blur-[12px]">
              <span className="text-xs font-medium text-[#334155]">Status:</span>
              <select
                value={currentStatus}
                onChange={(e) => updateQueryParams({ status: e.target.value })}
                className="bg-transparent text-sm font-semibold text-[#0F172A] focus:outline-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="new">New</option>
                <option value="active">Active</option>
                <option value="done">Done</option>
                <option value="approved">Approved</option>
                <option value="changes_requested">Changes Requested</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 rounded-xl border border-[rgba(15,23,42,0.12)] bg-white/80 px-3 py-2 text-sm text-[#0F172A] shadow-sm backdrop-blur-[12px]">
              <SlidersHorizontal size={14} className="text-[#334155]" />
              <span className="text-xs font-medium text-[#334155]">Sort:</span>
              <select
                value={currentSortBy}
                onChange={(e) => updateQueryParams({ sortBy: e.target.value })}
                className="bg-transparent text-sm font-semibold text-[#0F172A] focus:outline-none cursor-pointer"
              >
                <option value="updated">Recently Updated</option>
                <option value="created">Recently Created</option>
                <option value="status">Status</option>
              </select>
            </div>
          </div>

          <button
            onClick={() => fetchStories()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[rgba(15,23,42,0.12)] bg-white/80 px-3 py-2 text-xs font-semibold text-[#334155] hover:text-[#0F172A] hover:bg-white transition self-end lg:self-auto"
            title="Refresh list"
          >
            <RotateCcw size={13} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Empty State */}
        {!loading && stories.length === 0 && (
          <div className="mt-8 rounded-3xl border border-[rgba(15,23,42,0.12)] bg-white/80 p-10 sm:p-16 text-center shadow-xs backdrop-blur-[16px]">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-[rgba(204,160,56,0.12)] text-[#CCA038] shadow-xs">
              <Layers size={32} />
            </div>
            <h3 className="text-xl font-bold text-[#0F172A]">
              No stories found
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#334155]">
              No requirements match your current search or filter criteria.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setSearchInput("");
                  updateQueryParams({
                    search: "",
                    epicId: "all",
                    status: "all",
                    sortBy: "updated",
                  });
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        )}

        {/* Stories Grouped by Epic Folders */}
        {!loading && epicGroups.length > 0 && (
          <div className="space-y-6">
            {epicGroups.map((group) => (
              <EpicFolder
                key={group.id}
                id={group.id}
                name={group.name}
                description={group.description}
                storyCount={group.storyCount}
                isExpanded={!collapsedEpicIds.has(group.id)}
                onToggle={() => toggleEpic(group.id)}
                isUncategorized={group.isUncategorized}
                emptyMessage={
                  group.isUncategorized
                    ? "No uncategorized stories."
                    : "No stories in this Epic yet."
                }
              >
                <div className="space-y-4">
                  {group.stories.map((story) => (
                    <ClientStoryCard
                      key={story.id}
                      story={story}
                      isOpen={openStoryId === story.id}
                      onToggle={() =>
                        setOpenStoryId((prev) => (prev === story.id ? null : story.id))
                      }
                    />
                  ))}
                </div>
              </EpicFolder>
            ))}
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

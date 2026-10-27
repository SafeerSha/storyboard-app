"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  RotateCcw,
  Search,
  Sparkles,
  Layers,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  ClientStoryCard,
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

export default function ClientNeedsActionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentEpicId = searchParams.get("epicId") || "all";
  const currentStatus = searchParams.get("status") || "all";
  const currentSearch = searchParams.get("search") || "";
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

      if (updates.page !== undefined) {
        if (updates.page <= 1) params.delete("page");
        else params.set("page", updates.page.toString());
      }

      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `/client/reviews?${qs}` : "/client/reviews");
      });
    },
    [router, searchParams]
  );

  const fetchStories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("tab", "needs_action");
      if (currentEpicId !== "all") params.set("epicId", currentEpicId);
      if (currentStatus !== "all") params.set("status", currentStatus);
      if (currentSearch.trim()) params.set("search", currentSearch.trim());
      params.set("page", currentPage.toString());
      params.set("limit", "15");

      const res = await fetch(`/api/client/stories/paginated?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Failed to load review queue");
      }

      const json: PaginatedResponse = await res.json();
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error fetching stories");
    } finally {
      setLoading(false);
    }
  }, [currentEpicId, currentStatus, currentSearch, currentPage, router]);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  // Listen for review updates dispatched across client portal
  useEffect(() => {
    const handleUpdate = () => fetchStories();
    window.addEventListener("storyboard:client-review-updated", handleUpdate);
    return () => {
      window.removeEventListener("storyboard:client-review-updated", handleUpdate);
    };
  }, [fetchStories]);

  // Deep-link scroll when targetStoryId is provided
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
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(204,160,56,0.10)] px-2.5 py-0.5 text-[11px] font-semibold text-[#785312] border border-[rgba(204,160,56,0.18)] mb-2 uppercase tracking-wider">
                <Sparkles size={12} className="text-[#CCA038]" />
                <span>Action Required</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A]">
                Needs Your Action
              </h1>
              <p className="mt-1 text-sm text-[#334155]">
                Stories currently awaiting your initial review, feedback on team updates, or sign-off.
              </p>
            </div>

            {/* Total Badge Metric */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5 rounded-2xl border border-[rgba(204,160,56,0.22)] bg-gradient-to-br from-white/90 to-[#FDFBF7] px-4 py-2.5 shadow-[0_4px_20px_rgba(204,160,56,0.08)]">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-[rgba(204,160,56,0.14)] text-[#785312]">
                  <Clock size={18} />
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#785312]/80">
                    Awaiting Sign-Off
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
        {/* Filters and Search Bar */}
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

            {/* Epic Filter Dropdown */}
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

          {/* Refresh Button */}
          <button
            onClick={() => fetchStories()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[rgba(15,23,42,0.12)] bg-white/80 px-3 py-2 text-xs font-semibold text-[#334155] hover:text-[#0F172A] hover:bg-white transition self-end sm:self-auto"
            title="Refresh list"
          >
            <RotateCcw size={13} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Loading Skeletons */}
        {loading && !data && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-[18px] border border-[rgba(15,23,42,0.08)] bg-white/70 p-5 shadow-sm"
              >
                <div className="h-4 w-1/4 rounded bg-zinc-200 mb-3" />
                <div className="h-6 w-3/4 rounded bg-zinc-200 mb-4" />
                <div className="h-4 w-1/2 rounded bg-zinc-100" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && stories.length === 0 && (
          <div className="mt-8 rounded-3xl border border-[rgba(204,160,56,0.18)] bg-gradient-to-b from-white/90 to-[#FAF7F2]/60 p-10 sm:p-16 text-center shadow-[0_12px_40px_rgba(15,23,42,0.04)] backdrop-blur-[16px]">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-[rgba(204,160,56,0.12)] text-[#CCA038] shadow-sm">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-[#0F172A]">
              You&apos;re all caught up!
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#334155]">
              There are no stories currently waiting for your review. All pending items have been signed off.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              {searchInput || currentEpicId !== "all" ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearchInput("");
                    updateQueryParams({ search: "", epicId: "all" });
                  }}
                >
                  Clear Filters
                </Button>
              ) : (
                <Link href="/client/stories">
                  <Button
                    variant="primary"
                    className="bg-[#CCA038] hover:bg-[#B58422] text-white border-none shadow-sm"
                  >
                    Browse All Stories
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Stories List */}
        {!loading && stories.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {stories.map((story) => (
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

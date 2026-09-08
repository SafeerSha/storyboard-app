"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  Filter,
  Layers,
  Users,
  MessageSquare,
  ArrowRight,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Check,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ReviewStoryItem {
  id: string;
  project_id: string;
  project_name: string;
  epic_id: string | null;
  epic_name: string;
  title: string;
  description: string;
  acceptance_criteria: string[];
  assumptions: string[];
  clarifications: string[];
  team_review_status: "pending" | "approved" | "changes_requested";
  client_review_status: "pending" | "approved" | "changes_requested" | null;
  team_approved_by_name: string | null;
  team_approved_at: string | null;
  reviewer_count: number;
  reviewers: Array<{
    id: string;
    name: string;
    username: string;
    role?: string;
  }>;
  open_feedback_count: number;
  updated_at: string;
  assigned_at: string;
}

interface ReviewApiResponse {
  stories: ReviewStoryItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  counts: {
    pending: number;
    changes_requested: number;
    recently_reviewed: number;
  };
  projects: Array<{ id: string; name: string }>;
}

function formatRelativeTime(isoString?: string): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return "Just now";

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "Just now";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function TeamReviewsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentTab = searchParams.get("tab") || "needs_action";
  const currentProjectId = searchParams.get("projectId") || "all";
  const currentSearch = searchParams.get("search") || "";
  const currentPage = parseInt(searchParams.get("page") || "1", 10);

  const [searchInput, setSearchInput] = useState(currentSearch);
  const [data, setData] = useState<ReviewApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Sync search input if query param changes externally
  useEffect(() => {
    setSearchInput(currentSearch);
  }, [currentSearch]);

  const updateQueryParams = useCallback(
    (updates: {
      tab?: string;
      projectId?: string;
      search?: string;
      page?: number;
    }) => {
      const params = new URLSearchParams(searchParams.toString());

      if (updates.tab !== undefined) {
        if (updates.tab === "needs_action") params.delete("tab");
        else params.set("tab", updates.tab);
        params.delete("page"); // reset page on tab switch
      }

      if (updates.projectId !== undefined) {
        if (updates.projectId === "all" || !updates.projectId) {
          params.delete("projectId");
        } else {
          params.set("projectId", updates.projectId);
        }
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
        router.push(qs ? `/team/reviews?${qs}` : "/team/reviews");
      });
    },
    [router, searchParams]
  );

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("tab", currentTab);
      if (currentProjectId !== "all") params.set("projectId", currentProjectId);
      if (currentSearch.trim()) params.set("search", currentSearch.trim());
      params.set("page", currentPage.toString());
      params.set("limit", "20");

      const res = await fetch(`/api/team/reviews?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/team/login");
          return;
        }
        throw new Error("Failed to load review queue");
      }

      const json: ReviewApiResponse = await res.json();
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error fetching reviews");
    } finally {
      setLoading(false);
    }
  }, [currentTab, currentProjectId, currentSearch, currentPage, router]);

  // Fetch when params change
  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  // Listen for review status updates dispatched across workspace
  useEffect(() => {
    const handleReviewUpdated = () => {
      fetchReviews();
    };
    window.addEventListener("storyboard:review-updated", handleReviewUpdated);
    return () => {
      window.removeEventListener("storyboard:review-updated", handleReviewUpdated);
    };
  }, [fetchReviews]);

  // Debounce search submission
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      updateQueryParams({ search: searchInput });
    }
  };

  const stories = data?.stories || [];
  const pagination = data?.pagination || {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  };
  const counts = data?.counts || {
    pending: 0,
    changes_requested: 0,
    recently_reviewed: 0,
  };
  const projects = data?.projects || [];

  const tabOptions = [
    {
      id: "needs_action",
      label: "Needs Your Action",
      count: counts.pending,
      description: "Pending your team review & signoff",
    },
    {
      id: "changes_requested",
      label: "Changes Requested",
      count: counts.changes_requested,
      description: "Stories requiring revision",
    },
    {
      id: "recently_reviewed",
      label: "Recently Reviewed",
      count: counts.recently_reviewed,
      description: "Approved by you or your team",
    },
  ];

  return (
    <div className="min-h-screen pb-16">
      {/* Top Header */}
      <div className="border-b border-[rgba(74,61,100,0.08)] bg-white/60 backdrop-blur-[20px] px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(184,148,78,0.10)] px-2.5 py-0.5 text-[11px] font-semibold text-[#80642F] border border-[rgba(184,148,78,0.18)] mb-2 uppercase tracking-wider">
                <Sparkles size={12} className="text-[#B8944E]" />
                <span>My Reviews</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#252331]">
                Review Queue
              </h1>
              <p className="mt-1 text-sm text-[#706C7D]">
                Stories assigned to you for review across your assigned projects.
              </p>
            </div>

            {/* Total Pending Pill */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-2xl border border-[rgba(184,148,78,0.22)] bg-gradient-to-br from-white/90 to-[#FDFBF7] px-4 py-2.5 shadow-[0_4px_20px_rgba(184,148,78,0.08)]">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-[rgba(184,148,78,0.14)] text-[#80642F]">
                  <Clock size={18} />
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#80642F]/80">
                    Awaiting Action
                  </div>
                  <div className="text-lg font-bold text-[#252331]">
                    {counts.pending} {counts.pending === 1 ? "story" : "stories"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section Tabs */}
          <div className="mt-8 flex flex-wrap gap-2 border-b border-[rgba(74,61,100,0.08)] pb-px">
            {tabOptions.map((tab) => {
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => updateQueryParams({ tab: tab.id })}
                  className={`group relative flex items-center gap-2.5 px-4 py-3 text-sm font-semibold transition rounded-t-xl ${
                    isActive
                      ? "text-[#80642F] bg-[rgba(184,148,78,0.08)] border-b-2 border-[#B8944E]"
                      : "text-[#706C7D] hover:text-[#252331] hover:bg-white/50"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold transition ${
                      isActive
                        ? "bg-[#B8944E] text-white shadow-sm"
                        : "bg-[rgba(74,61,100,0.08)] text-[#706C7D] group-hover:bg-[rgba(74,61,100,0.12)]"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
        {/* Filters and Search Bar */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#706C7D]"
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
                className="h-10 w-full rounded-xl border border-[rgba(74,61,100,0.12)] bg-white/80 pl-10 pr-4 text-sm text-[#252331] placeholder-[#A09CAB] backdrop-blur-[12px] transition focus:border-[#B8944E] focus:outline-none focus:ring-2 focus:ring-[#B8944E]/20 shadow-sm"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    updateQueryParams({ search: "" });
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#706C7D] hover:text-[#252331]"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Project Filter Dropdown */}
            {projects.length > 1 && (
              <div className="relative inline-block text-left">
                <div className="flex items-center gap-1.5 rounded-xl border border-[rgba(74,61,100,0.12)] bg-white/80 px-3 py-2 text-sm text-[#252331] shadow-sm backdrop-blur-[12px]">
                  <Filter size={14} className="text-[#706C7D]" />
                  <span className="text-xs font-medium text-[#706C7D]">Project:</span>
                  <select
                    value={currentProjectId}
                    onChange={(e) => updateQueryParams({ projectId: e.target.value })}
                    className="bg-transparent text-sm font-semibold text-[#252331] focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Assigned Projects</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchReviews()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[rgba(74,61,100,0.12)] bg-white/80 px-3 py-2 text-xs font-semibold text-[#706C7D] hover:text-[#252331] hover:bg-white transition self-end sm:self-auto"
            title="Refresh list"
          >
            <RotateCcw size={13} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-800 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} className="text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <Button size="sm" variant="secondary" onClick={() => fetchReviews()}>
              Retry
            </Button>
          </div>
        )}

        {/* Loading Skeletons */}
        {loading && !data && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-[18px] border border-[rgba(74,61,100,0.08)] bg-white/70 p-5 shadow-sm"
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
          <div className="mt-8 rounded-3xl border border-[rgba(184,148,78,0.18)] bg-gradient-to-b from-white/90 to-[#FAF7F2]/60 p-10 sm:p-16 text-center shadow-[0_12px_40px_rgba(70,55,95,0.04)] backdrop-blur-[16px]">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-[rgba(184,148,78,0.12)] text-[#B8944E] shadow-sm">
              {currentTab === "needs_action" ? (
                <CheckCircle2 size={32} />
              ) : (
                <FolderOpen size={32} />
              )}
            </div>
            <h3 className="text-xl font-bold text-[#252331]">
              {currentTab === "needs_action"
                ? "You're all caught up!"
                : currentTab === "changes_requested"
                ? "No revision requests pending"
                : "No recently reviewed stories"}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#706C7D]">
              {currentTab === "needs_action"
                ? "There are no stories currently waiting for your review. When stories are assigned to you, they'll appear here."
                : currentTab === "changes_requested"
                ? "There are no stories where changes have been requested."
                : "Stories that you approve will be listed in this history."}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              {searchInput || currentProjectId !== "all" ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearchInput("");
                    updateQueryParams({ search: "", projectId: "all" });
                  }}
                >
                  Clear Filters
                </Button>
              ) : (
                <Link href="/team">
                  <Button
                    variant="primary"
                    className="bg-[#B8944E] hover:bg-[#9F7D3E] text-white border-none shadow-[0_4px_16px_rgba(184,148,78,0.24)]"
                  >
                    View Project Stories
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Stories List */}
        {!loading && stories.length > 0 && (
          <div className="space-y-4">
            {stories.map((story) => {
              const isTeamApproved = story.team_review_status === "approved";
              const isChangesRequested =
                story.team_review_status === "changes_requested";
              const isClientApproved = story.client_review_status === "approved";

              return (
                <div
                  key={story.id}
                  className={`group relative rounded-[20px] border transition-all duration-200 overflow-hidden ${
                    isTeamApproved
                      ? "bg-[rgba(46,139,112,0.04)] border-[rgba(46,139,112,0.20)] shadow-[0_4px_20px_rgba(46,139,112,0.04)]"
                      : isChangesRequested
                      ? "bg-[rgba(244,63,94,0.03)] border-rose-200/80 shadow-[0_4px_20px_rgba(244,63,94,0.04)]"
                      : "bg-white/85 border-[rgba(74,61,100,0.09)] hover:border-[#B8944E]/40 hover:shadow-[0_10px_32px_rgba(184,148,78,0.08)] shadow-[0_4px_24px_rgba(70,55,95,0.04)] backdrop-blur-[16px]"
                  }`}
                >
                  <div className="p-5 sm:p-6">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      {/* Left Details */}
                      <div className="min-w-0 flex-1">
                        {/* Meta Tags Row */}
                        <div className="flex flex-wrap items-center gap-2 mb-2 text-xs">
                          {/* Project Name */}
                          <span className="inline-flex items-center gap-1 rounded-md bg-[rgba(184,148,78,0.10)] px-2.5 py-1 text-[11px] font-semibold text-[#80642F] border border-[rgba(184,148,78,0.16)]">
                            <Layers size={12} className="text-[#B8944E]" />
                            <span className="truncate max-w-[160px]">
                              {story.project_name}
                            </span>
                          </span>

                          {/* Epic Name */}
                          {story.epic_name && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-[rgba(74,61,100,0.06)] px-2.5 py-1 text-[11px] font-medium text-[#706C7D] border border-[rgba(74,61,100,0.08)]">
                              <span className="truncate max-w-[140px]">
                                {story.epic_name}
                              </span>
                            </span>
                          )}

                          {/* Criteria Count */}
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#706C7D]">
                            <Check size={12} className="text-[#80642F]" />
                            <span>{story.acceptance_criteria?.length ?? 0} criteria</span>
                          </span>

                          {/* Reviewers Pill */}
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-zinc-100/90 px-2 py-0.5 text-[11px] font-medium text-zinc-700 border border-zinc-200"
                            title={`Assigned reviewers: ${story.reviewers
                              .map((r) => r.name || r.username)
                              .join(", ")}`}
                          >
                            <Users size={11} className="text-zinc-500" />
                            <span>
                              {story.reviewer_count}{" "}
                              {story.reviewer_count === 1 ? "reviewer" : "reviewers"}
                            </span>
                          </span>

                          {/* Open Feedback Threads */}
                          {story.open_feedback_count > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 border border-rose-200">
                              <MessageSquare size={11} />
                              <span>{story.open_feedback_count} feedback threads</span>
                            </span>
                          )}
                        </div>

                        {/* Story Title */}
                        <h2 className="text-base sm:text-lg font-bold text-[#252331] tracking-tight group-hover:text-[#80642F] transition-colors">
                          {story.title}
                        </h2>

                        {/* Description Preview */}
                        {story.description && (
                          <p className="mt-1 text-xs sm:text-sm text-[#706C7D] leading-relaxed max-w-3xl">
                            {story.description}
                          </p>
                        )}

                        {/* Status Badges Row */}
                        <div className="mt-3.5 flex flex-wrap items-center gap-2">
                          {/* Team Review Status */}
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              isTeamApproved
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200/80"
                                : isChangesRequested
                                ? "bg-rose-50 text-rose-800 border border-rose-200/80"
                                : "bg-[rgba(184,148,78,0.12)] text-[#80642F] border border-[rgba(184,148,78,0.22)]"
                            }`}
                          >
                            {isTeamApproved ? (
                              <>
                                <CheckCircle2 size={12} className="stroke-[2.5]" />
                                <span>
                                  Team Approved{" "}
                                  {story.team_approved_by_name
                                    ? `(${story.team_approved_by_name})`
                                    : ""}
                                </span>
                              </>
                            ) : isChangesRequested ? (
                              <>
                                <AlertCircle size={12} />
                                <span>Changes Requested</span>
                              </>
                            ) : (
                              <>
                                <Clock size={12} />
                                <span>Action Required</span>
                              </>
                            )}
                          </span>

                          {/* Client Review Status */}
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              isClientApproved
                                ? "bg-indigo-50 text-indigo-700 border border-indigo-200/80"
                                : story.client_review_status === "changes_requested"
                                ? "bg-rose-50 text-rose-700 border border-rose-200/80"
                                : "bg-zinc-100 text-zinc-500 border border-zinc-200"
                            }`}
                          >
                            {isClientApproved ? (
                              <>
                                <CheckCircle2 size={12} className="stroke-[2.5]" />
                                <span>Client Approved</span>
                              </>
                            ) : story.client_review_status === "changes_requested" ? (
                              <>
                                <AlertCircle size={12} />
                                <span>Client: Changes Requested</span>
                              </>
                            ) : (
                              <>
                                <Clock size={12} />
                                <span>Client: Pending</span>
                              </>
                            )}
                          </span>

                          {/* Updated Relative Time */}
                          <span className="text-[11px] text-[#A09CAB] ml-1">
                            Updated {formatRelativeTime(story.updated_at)}
                          </span>
                        </div>
                      </div>

                      {/* Right CTA Button */}
                      <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0 self-end lg:self-center">
                        <Link
                          href={`/team?projectId=${story.project_id}&storyId=${story.id}`}
                        >
                          <Button
                            variant="primary"
                            className="bg-[#B8944E] hover:bg-[#9F7D3E] text-white border-none shadow-[0_4px_14px_rgba(184,148,78,0.22)] group-hover:scale-[1.02] transition-transform"
                            rightIcon={
                              <ArrowRight
                                size={14}
                                className="group-hover:translate-x-0.5 transition-transform"
                              />
                            }
                          >
                            Review →
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && pagination.totalPages > 1 && (
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[rgba(74,61,100,0.08)] pt-4 text-xs text-[#706C7D]">
            <div>
              Showing{" "}
              <span className="font-semibold text-[#252331]">
                {(pagination.page - 1) * pagination.limit + 1}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-[#252331]">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-[#252331]">
                {pagination.total}
              </span>{" "}
              stories
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => updateQueryParams({ page: pagination.page - 1 })}
                className="inline-flex items-center gap-1 rounded-xl border border-[rgba(74,61,100,0.12)] bg-white px-3 py-1.5 font-semibold text-[#252331] shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[rgba(184,148,78,0.08)] hover:border-[#B8944E] transition"
              >
                <ChevronLeft size={14} />
                <span>Previous</span>
              </button>

              <span className="px-2 font-medium text-[#252331]">
                Page {pagination.page} of {pagination.totalPages}
              </span>

              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => updateQueryParams({ page: pagination.page + 1 })}
                className="inline-flex items-center gap-1 rounded-xl border border-[rgba(74,61,100,0.12)] bg-white px-3 py-1.5 font-semibold text-[#252331] shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[rgba(184,148,78,0.08)] hover:border-[#B8944E] transition"
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

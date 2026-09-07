"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Building,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Compass,
  FileCode,
  Flame,
  HelpCircle,
  Lightbulb,
  Link as LinkIcon,
  Loader2,
  Rocket,
  Search,
  Tag,
  Target,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/lib/toast";
import type { ProjectInboxInsight, ProjectInboxInsightType } from "@/lib/types";

interface InboxInsightsWorkspaceProps {
  inboxItemId: string;
  isOwner: boolean;
  currentUserId?: string;
  onCountChange?: (count: number) => void;
}

const INSIGHT_TYPE_META: Record<
  ProjectInboxInsightType,
  { label: string; icon: string; badgeClass: string }
> = {
  insight: { label: "Insight", icon: "💡", badgeClass: "bg-amber-50 text-amber-800 border-amber-200" },
  research: { label: "Research", icon: "🔎", badgeClass: "bg-blue-50 text-blue-800 border-blue-200" },
  hook: { label: "Hook", icon: "🪝", badgeClass: "bg-purple-50 text-purple-800 border-purple-200" },
  risk: { label: "Risk", icon: "⚠", badgeClass: "bg-rose-50 text-rose-800 border-rose-200" },
  decision: { label: "Decision", icon: "🎯", badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  mvp_idea: { label: "MVP Idea", icon: "🚀", badgeClass: "bg-indigo-50 text-indigo-800 border-indigo-200" },
  competitor: { label: "Competitor", icon: "🏢", badgeClass: "bg-slate-100 text-slate-800 border-slate-300" },
  technical_finding: { label: "Technical Finding", icon: "🏗", badgeClass: "bg-cyan-50 text-cyan-800 border-cyan-200" },
  question: { label: "Question", icon: "❓", badgeClass: "bg-orange-50 text-orange-800 border-orange-200" },
  reference: { label: "Reference", icon: "🔗", badgeClass: "bg-teal-50 text-teal-800 border-teal-200" },
};

const FILTER_TABS: Array<{ id: string; label: string; icon?: string }> = [
  { id: "all", label: "All" },
  { id: "insight", label: "Insights", icon: "💡" },
  { id: "research", label: "Research", icon: "🔎" },
  { id: "hook", label: "Hooks", icon: "🪝" },
  { id: "risk", label: "Risks", icon: "⚠" },
  { id: "decision", label: "Decisions", icon: "🎯" },
  { id: "mvp_idea", label: "MVP Ideas", icon: "🚀" },
  { id: "competitor", label: "Competitors", icon: "🏢" },
  { id: "technical_finding", label: "Technical", icon: "🏗" },
];

export function InboxInsightsWorkspace({
  inboxItemId,
  isOwner,
  currentUserId,
  onCountChange,
}: InboxInsightsWorkspaceProps) {
  const [insights, setInsights] = useState<ProjectInboxInsight[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState("");

  // Expanded original view
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Delete dialog state
  const [deletingInsight, setDeletingInsight] = useState<ProjectInboxInsight | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  const loadInsights = async (offset = 0, append = false) => {
    if (offset === 0) setLoading(true);
    else setLoadingMore(true);
    setError("");

    try {
      const typeParam = activeTab !== "all" ? `&type=${activeTab}` : "";
      const searchParam = searchQuery.trim() ? `&search=${encodeURIComponent(searchQuery.trim())}` : "";
      const res = await fetch(
        `/api/inbox/${inboxItemId}/insights?limit=20&offset=${offset}${typeParam}${searchParam}`
      );
      const data = await res.json();
      if (res.ok && data.insights) {
        if (append) {
          setInsights((prev) => [...prev, ...data.insights]);
        } else {
          setInsights(data.insights);
        }
        setTotalCount(data.totalCount || 0);
        setHasMore(Boolean(data.hasMore));
        if (offset === 0) {
          onCountChange?.(data.totalCount || 0);
        }
      } else {
        setError(data.error || "Failed to load saved insights.");
      }
    } catch {
      setError("Unable to connect to server.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadInsights(0, false);
  }, [inboxItemId, activeTab]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTypeChange = async (insight: ProjectInboxInsight, newType: ProjectInboxInsightType) => {
    if (insight.type === newType) return;
    try {
      const res = await fetch(`/api/inbox/${inboxItemId}/insights/${insight.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: newType }),
      });
      if (res.ok) {
        setInsights((prev) =>
          prev.map((ins) => (ins.id === insight.id ? { ...ins, type: newType } : ins))
        );
        toast.success("Insight category updated");
      } else {
        toast.error("Unable to update category");
      }
    } catch {
      toast.error("Unable to update category");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingInsight) return;
    setDeletingLoading(true);
    try {
      const res = await fetch(`/api/inbox/${inboxItemId}/insights/${deletingInsight.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setInsights((prev) => prev.filter((ins) => ins.id !== deletingInsight.id));
        setTotalCount((prev) => Math.max(prev - 1, 0));
        onCountChange?.(Math.max(totalCount - 1, 0));
        toast.success("Insight removed");
        setDeletingInsight(null);
      } else {
        toast.error("Unable to delete insight");
      }
    } catch {
      toast.error("Unable to delete insight");
    } finally {
      setDeletingLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls & Filter Bar */}
      <div className="space-y-3">
        {/* Search bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search insights, questions, recommendations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") loadInsights(0, false);
              }}
              className="h-10 w-full rounded-xl border border-[#E2E6EF] bg-white pl-9 pr-3 text-xs sm:text-sm text-[#111827] outline-none transition focus:border-[#4F46E5] shadow-xs"
            />
          </div>

          <span className="text-xs font-semibold text-slate-500 self-center sm:self-auto">
            {totalCount} saved {totalCount === 1 ? "finding" : "findings"}
          </span>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {FILTER_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                  active
                    ? "bg-[#111827] text-white shadow-xs"
                    : "bg-white border border-[#E2E6EF] text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {tab.icon && <span>{tab.icon}</span>}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Insights Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 rounded-2xl border border-[#E2E6EF] bg-white p-5 animate-pulse space-y-3 shadow-card"
            >
              <div className="h-4 bg-slate-200 rounded w-1/4" />
              <div className="h-4 bg-slate-100 rounded w-3/4" />
              <div className="h-4 bg-slate-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <AlertCircle size={22} className="mx-auto text-rose-600 mb-2" />
          <p className="text-xs text-rose-700 font-medium">{error}</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => loadInsights(0, false)}
          >
            Try again
          </Button>
        </div>
      ) : insights.length === 0 ? (
        /* Empty State */
        <div className="rounded-2xl border border-[#E2E6EF] bg-white p-12 text-center shadow-card">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-[#80642F] mx-auto mb-3">
            <Lightbulb size={24} />
          </div>
          <h3 className="text-base font-semibold text-[#111827]">
            {searchQuery || activeTab !== "all" ? "No matching insights found" : "No saved insights yet"}
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            {searchQuery || activeTab !== "all"
              ? "Try adjusting your filters or search terms."
              : "Save useful AI responses here so the team can refer to them later."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {insights.map((insight) => {
            const meta = INSIGHT_TYPE_META[insight.type] || INSIGHT_TYPE_META.insight;
            const isExpanded = expandedIds.has(insight.id);
            const canDelete = isOwner || insight.saved_by === currentUserId;

            return (
              <div
                key={insight.id}
                className="rounded-2xl border border-[#E2E6EF] bg-white p-5 sm:p-6 shadow-card hover:border-slate-300 transition space-y-3.5"
              >
                {/* Header: Semantic Badge, Title & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold border ${meta.badgeClass}`}
                    >
                      <span>{meta.icon}</span>
                      <span>{meta.label}</span>
                    </span>

                    <h4 className="text-sm font-bold text-[#111827] truncate">
                      {insight.title || insight.question_summary || "Research Finding"}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Category Changer */}
                    <select
                      value={insight.type}
                      onChange={(e) =>
                        handleTypeChange(insight, e.target.value as ProjectInboxInsightType)
                      }
                      className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-600 outline-none hover:bg-slate-50 cursor-pointer"
                    >
                      {Object.keys(INSIGHT_TYPE_META).map((key) => (
                        <option key={key} value={key}>
                          {INSIGHT_TYPE_META[key as ProjectInboxInsightType].label}
                        </option>
                      ))}
                    </select>

                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => setDeletingInsight(insight)}
                        title="Delete insight"
                        className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Question Block */}
                <div className="rounded-xl bg-slate-50/70 p-3 border border-slate-100">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                    Question
                  </p>
                  <p className="text-xs sm:text-sm font-medium text-slate-800">
                    {insight.question_summary || insight.question}
                  </p>
                </div>

                {/* AI Summary Block */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#80642F] mb-1">
                    AI Summary
                  </p>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal">
                    {insight.ai_response_summary || insight.ai_response}
                  </p>
                </div>

                {/* Expandable Original Question + Response Details */}
                {isExpanded && (
                  <div className="pt-3 border-t border-slate-100 space-y-3 animate-in fade-in duration-150">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                        Full Original Question
                      </p>
                      <p className="text-xs text-slate-600 italic bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        &ldquo;{insight.question}&rdquo;
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                        Full Original AI Response
                      </p>
                      <div className="text-xs text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed max-h-96 overflow-y-auto">
                        {insight.ai_response}
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer: Attribution & Expand Button */}
                <div className="flex items-center justify-between pt-2 text-[11px] text-slate-400">
                  <p>
                    Saved by <span className="font-semibold text-slate-600">{insight.saved_by_name}</span> •{" "}
                    {new Date(insight.created_at).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>

                  <button
                    type="button"
                    onClick={() => toggleExpand(insight.id)}
                    className="inline-flex items-center gap-1 font-semibold text-[#4F46E5] hover:underline"
                  >
                    <span>{isExpanded ? "Hide full research" : "View full research"}</span>
                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                </div>
              </div>
            );
          })}

          {/* Load More Button */}
          {hasMore && (
            <div className="text-center pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => loadInsights(insights.length, true)}
                isLoading={loadingMore}
              >
                Load more insights
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingInsight)}
        title="Delete Insight"
        description="Permanently delete this saved insight from the idea repository?"
        confirmLabel="Delete"
        variant="danger"
        isLoading={deletingLoading}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingInsight(null)}
      />
    </div>
  );
}

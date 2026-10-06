"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  AlertCircle,
  Archive,
  ArrowUpDown,
  Compass,
  Filter,
  Flame,
  FolderKanban,
  Lightbulb,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { InboxCard } from "@/components/inbox/InboxCard";
import { CaptureIdeaModal } from "@/components/inbox/CaptureIdeaModal";
import { ConvertToProjectModal } from "@/components/inbox/ConvertToProjectModal";
import { toast } from "@/lib/toast";
import type { InboxItemPriority, InboxItemStatus, InboxItemType, ProjectInboxItem } from "@/lib/types";

const CATEGORY_TABS: Array<{ id: string; label: string; icon?: string }> = [
  { id: "all", label: "All Items" },
  { id: "idea", label: "Ideas", icon: "🧠" },
  { id: "upcoming_project", label: "Upcoming", icon: "📱" },
  { id: "research", label: "Research", icon: "🔬" },
  { id: "opportunity", label: "Opportunities", icon: "⚡" },
  { id: "experiment", label: "Experiments", icon: "🧪" },
  { id: "archived", label: "Archived", icon: "📦" },
];

export default function ProjectInboxPage() {
  const [items, setItems] = useState<ProjectInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("updated_at");

  const [captureOpen, setCaptureOpen] = useState(false);
  const [convertingItem, setConvertingItem] = useState<ProjectInboxItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<ProjectInboxItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadItems = async () => {
    setLoading(true);
    setError("");
    try {
      // If archived tab is selected, request archived; otherwise get all
      const statusParam = activeTab === "archived" ? "archived" : "all";
      const res = await fetch(`/api/inbox?status=${statusParam}&sort=${sortBy}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load Project Inbox.");
      }
      setItems(data.items || []);
    } catch (err: any) {
      setError(err.message || "Unable to load your inbox.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, [activeTab, sortBy]);

  // Metric counts
  const metrics = useMemo(() => {
    const active = items.filter((i) => i.status !== "archived");
    const highPriority = active.filter((i) => i.priority === "high").length;
    const researchNeeded = active.filter(
      (i) => i.status === "researching" || i.type === "research"
    ).length;
    const upcomingCount = active.filter((i) => i.type === "upcoming_project").length;

    return {
      totalActive: active.length,
      highPriority,
      researchNeeded,
      upcomingCount,
    };
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Tab filter
      if (activeTab === "archived") {
        if (item.status !== "archived") return false;
      } else {
        if (item.status === "archived") return false;
        if (activeTab !== "all" && item.type !== activeTab) return false;
      }

      // Priority filter
      if (priorityFilter !== "all" && item.priority !== priorityFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const inTitle = item.title?.toLowerCase().includes(query);
        const inDesc = item.description?.toLowerCase().includes(query);
        const inNotes = item.notes?.toLowerCase().includes(query);
        if (!inTitle && !inDesc && !inNotes) return false;
      }

      return true;
    });
  }, [items, activeTab, priorityFilter, searchQuery]);

  // Quick actions on cards
  const handleArchiveToggle = async (item: ProjectInboxItem) => {
    const newStatus: InboxItemStatus = item.status === "archived" ? "inbox" : "archived";
    try {
      const res = await fetch(`/api/inbox/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (res.ok && data.item) {
        setItems((prev) => prev.map((i) => (i.id === item.id ? data.item : i)));
        toast.success(newStatus === "archived" ? "Idea archived" : "Idea restored");
      } else {
        toast.error("Unable to update idea", { description: data?.error || "Failed to update item status." });
      }
    } catch {
      toast.error("Unable to update idea", { description: "An unexpected error occurred." });
    }
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/inbox/${itemToDelete.id}`, { method: "DELETE" });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== itemToDelete.id));
        toast.success("Idea deleted");
        setItemToDelete(null);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error("Unable to delete idea", { description: data?.error || "Failed to delete idea." });
      }
    } catch {
      toast.error("Unable to delete idea", { description: "An unexpected network error occurred." });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <DashboardHeader
        eyebrow="PERSONAL WORKSPACE"
        title="Project Inbox"
        description="Ideas, opportunities, and things worth exploring before they become formal projects."
        actions={
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus size={15} />}
            onClick={() => setCaptureOpen(true)}
          >
            Capture idea
          </Button>
        }
      />

      <main className="mx-auto max-w-[1720px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-6">
        {/* Needs Attention / Metrics Summary Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-xl border border-[#E2E6EF] bg-white p-4 shadow-card">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Active Concepts
            </p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-[#111827]">
              {metrics.totalActive}
            </p>
            <p className="text-[11px] text-[#64748B] mt-0.5">Pre-project ideas</p>
          </div>

          <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-4 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
                High Priority
              </p>
              <Flame size={14} className="text-amber-600" />
            </div>
            <p className="mt-1 text-2xl font-bold tracking-tight text-amber-950">
              {metrics.highPriority}
            </p>
            <p className="text-[11px] text-amber-700 mt-0.5">Needs attention</p>
          </div>

          <div className="rounded-xl border border-purple-200/80 bg-purple-50/40 p-4 shadow-card">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-purple-800">
              Research Needed
            </p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-purple-950">
              {metrics.researchNeeded}
            </p>
            <p className="text-[11px] text-purple-700 mt-0.5">Awaiting investigation</p>
          </div>

          <div className="rounded-xl border border-blue-200/80 bg-blue-50/40 p-4 shadow-card">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-800">
              Upcoming
            </p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-blue-950">
              {metrics.upcomingCount}
            </p>
            <p className="text-[11px] text-blue-700 mt-0.5">Next in pipeline</p>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="space-y-3">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORY_TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
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

          {/* Search, Priority, and Sort Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ideas, notes, concepts..."
                className="h-9 w-full rounded-xl border border-[#E2E6EF] bg-white pl-9 pr-3.5 text-xs sm:text-sm text-[#111827] outline-none transition focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="h-9 rounded-xl border border-[#E2E6EF] bg-white px-3 text-xs sm:text-sm font-medium text-slate-700 outline-none transition focus:border-[#4F46E5] cursor-pointer"
              >
                <option value="all">All Priorities</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-9 rounded-xl border border-[#E2E6EF] bg-white px-3 text-xs sm:text-sm font-medium text-slate-700 outline-none transition focus:border-[#4F46E5] cursor-pointer"
              >
                <option value="updated_at">Recently Updated</option>
                <option value="created_at">Recently Captured</option>
                <option value="priority">Priority Order</option>
                <option value="status">Status</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-44 rounded-2xl border border-[#E2E6EF] bg-white p-5 animate-pulse space-y-3"
              >
                <div className="h-4 bg-slate-200 rounded w-1/3" />
                <div className="h-5 bg-slate-200 rounded w-3/4" />
                <div className="h-12 bg-slate-100 rounded w-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
            <AlertCircle size={24} className="mx-auto text-rose-600 mb-2" />
            <h3 className="text-sm font-semibold text-rose-900">Unable to load your inbox</h3>
            <p className="text-xs text-rose-700 mt-1 max-w-sm mx-auto">{error}</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-4"
              onClick={loadItems}
            >
              Try again
            </Button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-[#E2E6EF] bg-white p-12 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-[#4F46E5] mx-auto mb-3">
              <Lightbulb size={24} />
            </div>
            <h3 className="text-base font-semibold text-[#111827]">
              {searchQuery || priorityFilter !== "all" || activeTab !== "all"
                ? "No matching ideas found"
                : "A place for ideas before they become projects"}
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-[#64748B] max-w-md mx-auto leading-relaxed">
              {searchQuery || priorityFilter !== "all" || activeTab !== "all"
                ? "Try adjusting your filters or search query to find what you're looking for."
                : "Capture anything worth exploring, researching, or building without needing to create a formal project."}
            </p>
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus size={15} />}
              className="mt-5"
              onClick={() => setCaptureOpen(true)}
            >
              Capture your first idea
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => (
              <InboxCard
                key={item.id}
                item={item}
                onConvert={(it) => setConvertingItem(it)}
                onArchiveToggle={handleArchiveToggle}
                onDelete={(it) => setItemToDelete(it)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modals */}
      <CaptureIdeaModal
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        onCaptured={(newItem) => {
          setItems((prev) => [newItem, ...prev]);
        }}
      />

      <ConvertToProjectModal
        open={Boolean(convertingItem)}
        item={convertingItem}
        onClose={() => setConvertingItem(null)}
        onConverted={() => {
          loadItems();
        }}
      />

      <ConfirmDialog
        isOpen={Boolean(itemToDelete)}
        title="Delete Idea"
        description={`Permanently delete idea "${itemToDelete?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setItemToDelete(null)}
      />
    </div>
  );
}

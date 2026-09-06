"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit2,
  FileText,
  FolderKanban,
  HelpCircle,
  Layers,
  MessageSquare,
  Plus,
  Sparkles,
} from "lucide-react";
import { GenerateStoriesModal } from "@/components/GenerateStoriesModal";
import { StoryEditor } from "@/components/StoryEditor";
import { ContextualFeedbackThread } from "@/components/ContextualFeedbackThread";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Story, Epic, FeedbackThread } from "@/lib/types";

interface TeamWorkspaceProps {
  teamUser: {
    id: string;
    name: string;
    username: string;
    project_id: string;
  };
  project: {
    id: string;
    name: string;
    description: string | null;
  };
  initialStories: Story[];
  initialEpics: Epic[];
}

export function TeamWorkspace({
  teamUser,
  project,
  initialStories,
  initialEpics,
}: TeamWorkspaceProps) {
  const [stories, setStories] = useState<Story[]>(initialStories);
  const [epics, setEpics] = useState<Epic[]>(initialEpics);
  const [activeEpicTab, setActiveEpicTab] = useState<string>("all");
  const [feedbackCounts, setFeedbackCounts] = useState<Record<string, number>>({});
  const [storyThreadsMap, setStoryThreadsMap] = useState<Record<string, FeedbackThread[]>>({});

  // Modals & Editor states
  const [generatingEpicId, setGeneratingEpicId] = useState<string | null>(null);
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [showAddStory, setShowAddStory] = useState(false);
  const [newStoryTitle, setNewStoryTitle] = useState("");
  const [newStoryDesc, setNewStoryDesc] = useState("");
  const [newStoryEpicId, setNewStoryEpicId] = useState<string>(
    initialEpics.length > 0 ? initialEpics[0].id : ""
  );
  const [addingStory, setAddingStory] = useState(false);
  const [addStoryError, setAddStoryError] = useState("");

  // Epic create/edit modal
  const [showEpicModal, setShowEpicModal] = useState(false);
  const [editingEpic, setEditingEpic] = useState<Epic | null>(null);
  const [epicName, setEpicName] = useState("");
  const [epicDesc, setEpicDesc] = useState("");
  const [savingEpic, setSavingEpic] = useState(false);
  const [epicError, setEpicError] = useState("");

  // Approval state
  const [approvingStoryId, setApprovingStoryId] = useState<string | null>(null);
  const [confirmUnresolved, setConfirmUnresolved] = useState<{
    storyId: string;
    count: number;
  } | null>(null);

  // Collapsed / Expanded stories
  const [expandedStoryIds, setExpandedStoryIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedStoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Load feedback counts
  const loadFeedbackCounts = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/feedback-counts`);
      if (res.ok) {
        const data = await res.json();
        if (data.counts) setFeedbackCounts(data.counts);
      }
    } catch {
      // Silently catch
    }
  }, [project.id]);

  useEffect(() => {
    setStories(initialStories);
    setEpics(initialEpics);
    loadFeedbackCounts();
  }, [initialStories, initialEpics, loadFeedbackCounts]);

  // Load feedback threads for expanded stories
  useEffect(() => {
    for (const storyId of expandedStoryIds) {
      if (!storyThreadsMap[storyId]) {
        fetch(`/api/stories/${storyId}/feedback`)
          .then((r) => (r.ok ? r.json() : { threads: [] }))
          .then((d) => {
            if (d.threads) {
              setStoryThreadsMap((prev) => ({ ...prev, [storyId]: d.threads }));
            }
          })
          .catch(() => {});
      }
    }
  }, [expandedStoryIds, storyThreadsMap]);

  // Handle Team Story Approval
  async function handleApproveStory(storyId: string, confirmWithUnresolved = false) {
    setApprovingStoryId(storyId);
    try {
      const res = await fetch(`/api/team/stories/${storyId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmWithUnresolved }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.requiresConfirmation) {
          setConfirmUnresolved({ storyId, count: data.unresolvedCount });
          return;
        }
        throw new Error(data.error || "Approval failed.");
      }

      setStories((prev) =>
        prev.map((s) =>
          s.id === storyId
            ? {
                ...s,
                team_review_status: "approved",
                team_approved_by_id: teamUser.id,
                team_approved_by_name: teamUser.name,
                team_approved_at: new Date().toISOString(),
              }
            : s
        )
      );
      setConfirmUnresolved(null);
      loadFeedbackCounts();
    } catch (err: any) {
      alert(err.message || "Failed to approve story.");
    } finally {
      setApprovingStoryId(null);
    }
  }

  // Handle Create/Save Epic
  async function handleSaveEpic(e: React.FormEvent) {
    e.preventDefault();
    if (!epicName.trim()) return;
    setSavingEpic(true);
    setEpicError("");

    try {
      if (editingEpic) {
        const res = await fetch(`/api/epics/${editingEpic.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: epicName.trim(), description: epicDesc.trim() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update Epic.");

        setEpics((prev) =>
          prev.map((e) => (e.id === editingEpic.id ? data : e))
        );
      } else {
        const res = await fetch("/api/epics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: project.id,
            name: epicName.trim(),
            description: epicDesc.trim(),
            status: "active",
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create Epic.");

        setEpics((prev) => [...prev, data]);
        if (!newStoryEpicId) setNewStoryEpicId(data.id);
      }

      setShowEpicModal(false);
      setEditingEpic(null);
      setEpicName("");
      setEpicDesc("");
    } catch (err: any) {
      setEpicError(err.message);
    } finally {
      setSavingEpic(false);
    }
  }

  // Handle Manual Add Story
  async function handleCreateStory(e: React.FormEvent) {
    e.preventDefault();
    if (!newStoryTitle.trim()) return;
    setAddingStory(true);
    setAddStoryError("");

    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          epic_id: newStoryEpicId || null,
          title: newStoryTitle.trim(),
          description: newStoryDesc.trim(),
          acceptance_criteria: [],
          assumptions: [],
          clarifications: [],
          status: "review",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create story.");

      setStories((prev) => [...prev, data.story]);
      setShowAddStory(false);
      setNewStoryTitle("");
      setNewStoryDesc("");
    } catch (err: any) {
      setAddStoryError(err.message);
    } finally {
      setAddingStory(false);
    }
  }

  // Handle Save from StoryEditor
  async function handleSaveStoryEditor(updatedStory: any) {
    try {
      const res = await fetch(`/api/stories/${updatedStory.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: updatedStory.title,
          description: updatedStory.description,
          epic_id: updatedStory.epic_id,
          acceptance_criteria: updatedStory.acceptance_criteria,
          assumptions: updatedStory.assumptions,
          clarifications: updatedStory.clarifications,
          status: updatedStory.status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save story.");

      setStories((prev) =>
        prev.map((s) => (s.id === updatedStory.id ? data.story : s))
      );
      setEditingStory(null);
      loadFeedbackCounts();
    } catch (err: any) {
      alert(err.message);
    }
  }

  // Filtered stories based on active epic tab
  const filteredStories =
    activeEpicTab === "all"
      ? stories
      : activeEpicTab === "uncategorized"
      ? stories.filter((s) => !s.epic_id)
      : stories.filter((s) => s.epic_id === activeEpicTab);

  // Review statistics
  const totalStories = stories.length;
  const teamApprovedCount = stories.filter((s) => s.team_review_status === "approved").length;
  const clientApprovedCount = stories.filter(
    (s) => s.client_review_status === "approved" || s.status === "approved"
  ).length;

  const teamApprovedPercent = totalStories
    ? Math.round((teamApprovedCount / totalStories) * 100)
    : 0;
  const clientApprovedPercent = totalStories
    ? Math.round((clientApprovedCount / totalStories) * 100)
    : 0;

  return (
    <div className="pb-24">
      {/* Top Workspace Header */}
      <div className="border-b border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-800">
                <span>Team Workspace</span>
                <span>•</span>
                <span className="text-zinc-500 font-normal">
                  Welcome, {teamUser.name} (@{teamUser.username})
                </span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 truncate">
                {project.name}
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm text-zinc-500 max-w-2xl">
                {project.description ||
                  "Collaborate with your team, review requirements, generate stories, and participate in client discussions."}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="md"
                leftIcon={<Plus size={14} />}
                onClick={() => {
                  setEditingEpic(null);
                  setEpicName("");
                  setEpicDesc("");
                  setEpicError("");
                  setShowEpicModal(true);
                }}
              >
                Create Epic
              </Button>
              <Button
                variant="primary"
                size="md"
                leftIcon={<Plus size={14} />}
                onClick={() => {
                  setNewStoryTitle("");
                  setNewStoryDesc("");
                  setAddStoryError("");
                  setShowAddStory(true);
                }}
              >
                Add Story
              </Button>
            </div>
          </div>

          {/* Dual Review Progress Cards */}
          <div id="project-details" className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Team Review Progress */}
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/30 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                  Internal Team Review
                </span>
                <span className="text-xs font-bold text-emerald-700">
                  {teamApprovedCount} / {totalStories} Approved ({teamApprovedPercent}%)
                </span>
              </div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-emerald-100">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                  style={{ width: `${teamApprovedPercent}%` }}
                />
              </div>
            </div>

            {/* Client Review Progress */}
            <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/30 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-900 uppercase tracking-wider">
                  Client Sign-off
                </span>
                <span className="text-xs font-bold text-indigo-700">
                  {clientApprovedCount} / {totalStories} Approved ({clientApprovedPercent}%)
                </span>
              </div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-indigo-100">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                  style={{ width: `${clientApprovedPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Workspace Body */}
      <main id="epics-and-stories" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-6">
        {/* Story Editor View if an item is being edited */}
        {editingStory && (
          <div className="mb-6">
            <StoryEditor
              story={editingStory}
              epics={epics}
              viewerType="team_user"
              onSave={handleSaveStoryEditor}
              onCancel={() => setEditingStory(null)}
              onCreateEpic={(name) => {
                setEpicName(name);
                setShowEpicModal(true);
              }}
              onFeedbackChange={loadFeedbackCounts}
            />
          </div>
        )}

        {/* Epics Filter Tabs */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Project Epics
            </span>
            <span className="text-xs text-zinc-400">
              {epics.length} {epics.length === 1 ? "epic" : "epics"}
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveEpicTab("all")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition ${
                activeEpicTab === "all"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              All Stories ({stories.length})
            </button>

            {epics.map((epic) => {
              const count = stories.filter((s) => s.epic_id === epic.id).length;
              return (
                <button
                  key={epic.id}
                  type="button"
                  onClick={() => setActiveEpicTab(epic.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition flex items-center gap-1.5 ${
                    activeEpicTab === epic.id
                      ? "bg-slate-900 text-white shadow-xs"
                      : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  <span>{epic.name}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                      activeEpicTab === epic.id
                        ? "bg-white/20 text-white"
                        : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}

            {stories.some((s) => !s.epic_id) && (
              <button
                type="button"
                onClick={() => setActiveEpicTab("uncategorized")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition ${
                  activeEpicTab === "uncategorized"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                Uncategorized ({stories.filter((s) => !s.epic_id).length})
              </button>
            )}
          </div>
        </div>

        {/* Stories Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Requirements & Stories
            </h2>
            <span className="text-xs text-zinc-400">
              {filteredStories.length} {filteredStories.length === 1 ? "story" : "stories"}
            </span>
          </div>

          {filteredStories.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No stories in this view"
              description="Generate stories with AI using an Epic, or click 'Add Story' to create one manually."
              action={
                epics.length > 0 ? (
                  <Button
                    variant="brand"
                    size="sm"
                    leftIcon={<Sparkles size={13} />}
                    onClick={() => setGeneratingEpicId(epics[0].id)}
                  >
                    Generate Stories with AI
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-4">
              {filteredStories.map((story) => {
                const isExpanded = expandedStoryIds.has(story.id);
                const isTeamApproved = story.team_review_status === "approved";
                const isClientApproved =
                  story.client_review_status === "approved" || story.status === "approved";
                const isApprovingThis = approvingStoryId === story.id;
                const openThreadCount = feedbackCounts[story.id] || 0;
                const threads = storyThreadsMap[story.id] || [];

                return (
                  <div
                    key={story.id}
                    className={`rounded-xl border bg-white transition shadow-card overflow-hidden ${
                      isTeamApproved
                        ? "border-emerald-200/80"
                        : "border-zinc-200/80 hover:border-zinc-300"
                    }`}
                  >
                    {/* Story Header Summary */}
                    <div className="p-4 sm:p-5">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {/* Metadata row */}
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-zinc-400 mb-1.5">
                            <span className="uppercase text-zinc-500 font-semibold">
                              {epics.find((e) => e.id === story.epic_id)?.name || "Uncategorized"}
                            </span>
                            <span>•</span>
                            <span>{story.acceptance_criteria?.length ?? 0} criteria</span>
                            {openThreadCount > 0 && (
                              <>
                                <span>•</span>
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200/80">
                                  <MessageSquare size={11} />
                                  {openThreadCount} open feedback
                                </span>
                              </>
                            )}
                          </div>

                          <h3 className="text-base font-semibold text-slate-900 tracking-tight">
                            {story.title}
                          </h3>

                          {story.description && (
                            <p className="mt-1 text-xs sm:text-sm text-zinc-500 leading-relaxed line-clamp-2">
                              {story.description}
                            </p>
                          )}

                          {/* Dual Review Status Badges */}
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {/* Team Review Badge */}
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                isTeamApproved
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                                  : "bg-zinc-100 text-zinc-600 border border-zinc-200"
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
                              ) : (
                                <>
                                  <Clock size={12} />
                                  <span>Team: Pending Review</span>
                                </>
                              )}
                            </span>

                            {/* Client Review Badge */}
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                isClientApproved
                                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200/80"
                                  : story.client_review_status === "changes_requested" ||
                                    story.status === "changes_requested"
                                  ? "bg-rose-50 text-rose-700 border border-rose-200/80"
                                  : "bg-zinc-100 text-zinc-500 border border-zinc-200"
                              }`}
                            >
                              {isClientApproved ? (
                                <>
                                  <CheckCircle2 size={12} className="stroke-[2.5]" />
                                  <span>
                                    Client Approved{" "}
                                    {story.client_approved_by_name
                                      ? `(${story.client_approved_by_name})`
                                      : ""}
                                  </span>
                                </>
                              ) : story.client_review_status === "changes_requested" ||
                                story.status === "changes_requested" ? (
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
                          </div>
                        </div>

                        {/* Action buttons on card */}
                        <div className="flex items-center gap-2 self-end sm:self-start shrink-0 pt-1">
                          {!isTeamApproved && (
                            <Button
                              variant="primary"
                              size="sm"
                              isLoading={isApprovingThis}
                              leftIcon={<Check size={13} />}
                              onClick={() => handleApproveStory(story.id)}
                            >
                              Approve
                            </Button>
                          )}

                          <Button
                            variant="secondary"
                            size="sm"
                            leftIcon={<Edit2 size={13} />}
                            onClick={() => setEditingStory(story)}
                          >
                            Edit
                          </Button>

                          <button
                            type="button"
                            onClick={() => toggleExpand(story.id)}
                            className="grid h-8 w-8 place-items-center rounded-lg border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 transition cursor-pointer"
                            aria-label={isExpanded ? "Collapse story" : "Expand story details"}
                          >
                            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Story Details: Acceptance Criteria & Feedback Threads */}
                    {isExpanded && (
                      <div className="border-t border-zinc-100 bg-zinc-50/40 p-4 sm:p-5 space-y-5 animate-in fade-in duration-150">
                        {/* Acceptance Criteria */}
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2.5">
                            Acceptance Criteria
                          </h4>
                          {story.acceptance_criteria && story.acceptance_criteria.length > 0 ? (
                            <div className="space-y-2.5">
                              {story.acceptance_criteria.map((item, i) => {
                                const itemId = `ac-${i}`;
                                return (
                                  <div
                                    key={i}
                                    className="rounded-xl border border-zinc-200/70 bg-white p-3 shadow-2xs"
                                  >
                                    <div className="flex items-start gap-2">
                                      <span className="font-mono text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5 shrink-0 mt-0.5">
                                        {String(i + 1).padStart(2, "0")}
                                      </span>
                                      <p className="text-xs sm:text-sm text-zinc-800 leading-relaxed flex-1">
                                        {item}
                                      </p>
                                    </div>

                                    {/* Contextual Feedback on this criterion */}
                                    <div className="mt-1 pl-6">
                                      <ContextualFeedbackThread
                                        storyId={story.id}
                                        sectionType="acceptance_criteria"
                                        itemId={itemId}
                                        itemText={item}
                                        pointNumber={i}
                                        actionLabel="Discuss criterion"
                                        viewerType="team_user"
                                        threads={threads}
                                        onThreadCreated={(t) => {
                                          setStoryThreadsMap((prev) => ({
                                            ...prev,
                                            [story.id]: [...(prev[story.id] || []), t],
                                          }));
                                          loadFeedbackCounts();
                                        }}
                                        onMessageAdded={(tid, m) => {
                                          setStoryThreadsMap((prev) => ({
                                            ...prev,
                                            [story.id]: (prev[story.id] || []).map((t) =>
                                              t.id === tid
                                                ? { ...t, messages: [...t.messages, m] }
                                                : t
                                            ),
                                          }));
                                          loadFeedbackCounts();
                                        }}
                                        onStatusUpdated={(tid, s) => {
                                          setStoryThreadsMap((prev) => ({
                                            ...prev,
                                            [story.id]: (prev[story.id] || []).map((t) =>
                                              t.id === tid ? { ...t, status: s } : t
                                            ),
                                          }));
                                          loadFeedbackCounts();
                                        }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-zinc-400 italic">No criteria specified yet.</p>
                          )}
                        </div>

                        {/* Assumptions */}
                        {story.assumptions && story.assumptions.length > 0 && (
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                              Assumptions
                            </h4>
                            <div className="space-y-1.5">
                              {story.assumptions.map((a, i) => (
                                <div key={i} className="text-xs sm:text-sm text-zinc-700 flex items-center gap-2">
                                  <span className="text-zinc-400">•</span>
                                  <span>{a}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Clarifications */}
                        {story.clarifications && story.clarifications.length > 0 && (
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                              Clarifications
                            </h4>
                            <div className="space-y-1.5">
                              {story.clarifications.map((cl, i) => (
                                <div key={i} className="text-xs sm:text-sm text-zinc-700 flex items-center gap-2">
                                  <HelpCircle size={13} className="text-amber-500 shrink-0" />
                                  <span>{cl}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Confirmation Modal if approving story with unresolved changes */}
      <Modal
        isOpen={Boolean(confirmUnresolved)}
        onClose={() => setConfirmUnresolved(null)}
        title="Unresolved Feedback Notice"
        description={`This story has ${confirmUnresolved?.count} open change request${confirmUnresolved?.count === 1 ? '' : 's'}. Approving now indicates your team is satisfied with the criteria.`}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setConfirmUnresolved(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (confirmUnresolved) {
                  handleApproveStory(confirmUnresolved.storyId, true);
                }
              }}
            >
              Confirm Team Approval
            </Button>
          </>
        }
      >
        <p className="text-xs text-zinc-500">
          The open discussions will remain visible for client review.
        </p>
      </Modal>

      {/* Add Story Modal */}
      <Modal
        isOpen={showAddStory}
        onClose={() => setShowAddStory(false)}
        title="Add feature story"
        description="Define a new story for this project."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setShowAddStory(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="add-story-form"
              isLoading={addingStory}
              disabled={!newStoryTitle.trim()}
            >
              Create story
            </Button>
          </>
        }
      >
        <form id="add-story-form" onSubmit={handleCreateStory} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
              Assigned Epic
            </label>
            <select
              value={newStoryEpicId}
              onChange={(e) => setNewStoryEpicId(e.target.value)}
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="">No Epic assigned (Uncategorized)</option>
              {epics.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
              Story Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={newStoryTitle}
              onChange={(e) => setNewStoryTitle(e.target.value)}
              placeholder="e.g. Export Reports to CSV"
              className="h-10 w-full rounded-xl border border-zinc-200 px-3.5 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
              Description
            </label>
            <textarea
              rows={3}
              value={newStoryDesc}
              onChange={(e) => setNewStoryDesc(e.target.value)}
              placeholder="Describe user capability..."
              className="w-full rounded-xl border border-zinc-200 p-3 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>

          {addStoryError && (
            <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg">
              {addStoryError}
            </p>
          )}
        </form>
      </Modal>

      {/* Create / Edit Epic Modal */}
      <Modal
        isOpen={showEpicModal}
        onClose={() => setShowEpicModal(false)}
        title={editingEpic ? "Edit Epic" : "Create Epic"}
        description="Group related feature stories under a common theme."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setShowEpicModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="team-epic-form"
              isLoading={savingEpic}
              disabled={!epicName.trim()}
            >
              {editingEpic ? "Save changes" : "Create Epic"}
            </Button>
          </>
        }
      >
        <form id="team-epic-form" onSubmit={handleSaveEpic} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
              Epic Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={epicName}
              onChange={(e) => setEpicName(e.target.value)}
              placeholder="e.g. User Management"
              className="h-10 w-full rounded-xl border border-zinc-200 px-3.5 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
              Description
            </label>
            <textarea
              rows={3}
              value={epicDesc}
              onChange={(e) => setEpicDesc(e.target.value)}
              placeholder="Describe the product area..."
              className="w-full rounded-xl border border-zinc-200 p-3 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>

          {epicError && (
            <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg">
              {epicError}
            </p>
          )}
        </form>
      </Modal>

      {/* AI Generate Stories Modal */}
      {generatingEpicId && (
        <GenerateStoriesModal
          projectId={project.id}
          epicId={generatingEpicId}
          onClose={() => setGeneratingEpicId(null)}
          onStoriesGenerated={(newStories) => {
            setStories((prev) => [...newStories, ...prev]);
            setGeneratingEpicId(null);
          }}
        />
      )}
    </div>
  );
}

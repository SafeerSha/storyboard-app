"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit2,
  Layers,
  Plus,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { GenerateStoriesModal } from "@/components/GenerateStoriesModal";
import { StoryEditor } from "@/components/StoryEditor";
import { StoryCard } from "@/components/StoryCard";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import { VoiceTextarea } from "@/components/ui/VoiceTextarea";
import { toast } from "@/lib/toast";
import type { Story, Epic } from "@/lib/types";
import { EpicFolder } from "@/components/epics/EpicFolder";
import { EpicFeedbackThread } from "@/components/epics/EpicFeedbackThread";
import { sortEpics, sortStories } from "@/lib/epic-story-utils";

interface TeamWorkspaceProps {
  teamUser: {
    id: string;
    name: string;
    username: string;
    role?: string;
    project_id: string;
  };
  project: {
    id: string;
    name: string;
    description: string | null;
  };
  initialStories: Story[];
  initialEpics: Epic[];
  initialTargetStoryId?: string;
}

export function TeamWorkspace({
  teamUser,
  project,
  initialStories,
  initialEpics,
  initialTargetStoryId,
}: TeamWorkspaceProps) {
  const [stories, setStories] = useState<Story[]>(initialStories);
  const [epics, setEpics] = useState<Epic[]>(initialEpics);
  const [feedbackCounts, setFeedbackCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Currently selected story for Document Inspector / StoryEditor (Right column)
  const [editingStory, setEditingStory] = useState<Story | null>(() => {
    if (initialTargetStoryId) {
      return initialStories.find((s) => s.id === initialTargetStoryId) || null;
    }
    return null;
  });

  // AI Story Generation modal
  const [generatingEpicId, setGeneratingEpicId] = useState<string | null>(null);

  // Manual Story Creation modal
  const [manualStoryModalOpen, setManualStoryModalOpen] = useState(false);
  const [manualStoryEpic, setManualStoryEpic] = useState<Epic | null>(null);
  const [manualStoryTitle, setManualStoryTitle] = useState("");
  const [manualStoryDesc, setManualStoryDesc] = useState("");
  const [manualStoryCriteria, setManualStoryCriteria] = useState<string[]>([]);
  const [manualStoryAssumptions, setManualStoryAssumptions] = useState<string[]>([]);
  const [manualStoryClarifications, setManualStoryClarifications] = useState<string[]>([]);
  const [manualStoryReviewerIds, setManualStoryReviewerIds] = useState<string[]>([teamUser.id]);
  const [manualStoryError, setManualStoryError] = useState("");
  const [creatingManualStory, setCreatingManualStory] = useState(false);

  // Project team members (with Super Admin / Creator pinned at top)
  const [projectTeamMembers, setProjectTeamMembers] = useState<
    Array<{ id: string; name: string; username: string; role?: string }>
  >([]);

  // Epic modal state (Create / Edit with AI Auto-format)
  const [epicModalOpen, setEpicModalOpen] = useState(false);
  const [editingEpic, setEditingEpic] = useState<Epic | null>(null);
  const [epicForm, setEpicForm] = useState({ name: "", description: "", status: "active" });
  const [aiCorrecting, setAiCorrecting] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[] | null>(null);
  const [aiError, setAiError] = useState("");
  const [savingEpic, setSavingEpic] = useState(false);

  // Filter and Folding state (Record ensures pure serializable state and reliable re-rendering)
  const [epicFilter, setEpicFilter] = useState<string>("all");
  const [collapsedEpicIds, setCollapsedEpicIds] = useState<Record<string, boolean>>({});

  // ConfirmDialog states
  const [deletingStoryId, setDeletingStoryId] = useState<string | null>(null);
  const [deletingEpicItem, setDeletingEpicItem] = useState<Epic | null>(null);
  const [approvingStoryId, setApprovingStoryId] = useState<string | null>(null);
  const [confirmUnresolved, setConfirmUnresolved] = useState<{
    storyId: string;
    count: number;
  } | null>(null);

  // Load Feedback Counts
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

  // Load Team Members
  const loadTeamMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/team-members?forReviewers=true`);
      if (res.ok) {
        const data = await res.json();
        if (data.teamMembers) setProjectTeamMembers(data.teamMembers);
      }
    } catch {
      // Silently catch
    }
  }, [project.id]);

  useEffect(() => {
    setStories(initialStories);
    setEpics(initialEpics);
    loadFeedbackCounts();
    loadTeamMembers();
  }, [initialStories, initialEpics, loadFeedbackCounts, loadTeamMembers]);

  // Auto-expand and select target story when opened from notifications / review queue
  useEffect(() => {
    if (initialTargetStoryId) {
      const target = initialStories.find((s) => s.id === initialTargetStoryId);
      if (target) {
        setEditingStory(target);
        if (target.epic_id) {
          setCollapsedEpicIds((prev) => ({
            ...prev,
            [target.epic_id!]: false,
          }));
        }
      }
    }
  }, [initialTargetStoryId, initialStories]);

  // Prevent background scroll bleed when full-screen story inspector is open on mobile
  useEffect(() => {
    if (!editingStory) return;
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [editingStory]);

  // Folding controls
  const toggleEpic = useCallback((epicId: string) => {
    setCollapsedEpicIds((prev) => ({
      ...prev,
      [epicId]: !prev[epicId],
    }));
  }, []);

  const foldAllEpics = useCallback(() => {
    setCollapsedEpicIds(() => {
      const next: Record<string, boolean> = {};
      epics.forEach((e) => {
        next[e.id] = true;
      });
      next["uncategorized"] = true;
      return next;
    });
  }, [epics]);

  const expandAllEpics = useCallback(() => {
    setCollapsedEpicIds({});
  }, []);

  // Epic Actions
  function openCreateEpic(name = "") {
    setEpicForm({ name, description: "", status: "active" });
    setEditingEpic(null);
    setAiSuggestions(null);
    setAiError("");
    setEpicModalOpen(true);
  }

  function openEditEpic(epic: Epic) {
    setEditingEpic(epic);
    setEpicForm({
      name: epic.name,
      description: epic.description || "",
      status: epic.status,
    });
    setAiSuggestions(null);
    setAiError("");
    setEpicModalOpen(true);
  }

  async function handleAiCorrectEpicName() {
    if (!epicForm.name.trim()) return;
    setAiCorrecting(true);
    setAiError("");
    try {
      const res = await fetch("/api/epics/correct-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: epicForm.name,
          description: epicForm.description,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to correct epic name.");

      const suggestions = Array.from(
        new Set([data.correctedName, ...(data.alternatives || [])])
      ).filter(Boolean);
      setAiSuggestions(suggestions);

      setEpicForm((prev) => ({
        ...prev,
        name: data.correctedName,
        description: prev.description
          ? prev.description
          : data.suggestedDescription || prev.description,
      }));
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Failed to correct epic name.");
    } finally {
      setAiCorrecting(false);
    }
  }

  async function saveEpic() {
    if (!epicForm.name.trim()) return;
    setSavingEpic(true);
    setError("");
    try {
      if (editingEpic) {
        const res = await fetch(`/api/epics/${editingEpic.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(epicForm),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to save Epic");
        setEpics((v) => v.map((e) => (e.id === editingEpic.id ? data : e)));
        toast.success("Epic updated successfully");
      } else {
        const res = await fetch("/api/epics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...epicForm, projectId: project.id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create Epic");
        setEpics((v) => [data, ...v]);
        toast.success("Epic created successfully");
      }
      setEpicModalOpen(false);
      setEditingEpic(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save Epic";
      setError(msg);
      toast.error(editingEpic ? "Unable to update epic" : "Unable to create epic");
    } finally {
      setSavingEpic(false);
    }
  }

  function deleteEpic(id: string) {
    if (stories.some((s) => s.epic_id === id)) {
      toast.warning(
        "Cannot delete an Epic that contains stories. Please delete or reassign its stories first."
      );
      return;
    }
    const targetEpic = epics.find((e) => e.id === id);
    if (targetEpic) {
      setDeletingEpicItem(targetEpic);
    }
  }

  async function confirmDeleteEpic() {
    if (!deletingEpicItem) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/epics/${deletingEpicItem.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete Epic");
      }
      setEpics((v) => v.filter((e) => e.id !== deletingEpicItem.id));
      if (epicFilter === deletingEpicItem.id) setEpicFilter("all");
      toast.success("Epic deleted");
      setDeletingEpicItem(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete Epic";
      setError(msg);
      toast.error("Unable to delete epic");
    } finally {
      setLoading(false);
    }
  }

  // Story Inspector Actions
  async function handleSaveStoryEditor(updated: any) {
    if (!editingStory) return;
    try {
      const res = await fetch(`/api/stories/${editingStory.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: updated.title,
          description: updated.description,
          acceptance_criteria: updated.acceptance_criteria,
          assumptions: updated.assumptions,
          clarifications: updated.clarifications,
          raw_requirement: updated.raw_requirement,
          epic_id: updated.epic_id,
          reviewer_ids: updated.reviewer_ids,
          status: updated.status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update story");

      setStories((v) => v.map((s) => (s.id === editingStory.id ? data.story : s)));
      setEditingStory(data.story);
      loadFeedbackCounts();
      toast.success("Story updated successfully");
    } catch (e: any) {
      toast.error(e.message || "Unable to update story");
    }
  }

  async function confirmDeleteStory() {
    if (!deletingStoryId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/stories/${deletingStoryId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete story");
      }
      setStories((v) => v.filter((s) => s.id !== deletingStoryId));
      if (editingStory?.id === deletingStoryId) {
        setEditingStory(null);
      }
      toast.success("Story deleted");
      setDeletingStoryId(null);
    } catch (e: any) {
      toast.error(e.message || "Unable to delete story");
    } finally {
      setLoading(false);
    }
  }

  // Team Approval Action
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

      if (editingStory && editingStory.id === storyId) {
        setEditingStory((prev) =>
          prev
            ? {
                ...prev,
                team_review_status: "approved",
                team_approved_by_id: teamUser.id,
                team_approved_by_name: teamUser.name,
                team_approved_at: new Date().toISOString(),
              }
            : null
        );
      }

      setConfirmUnresolved(null);
      loadFeedbackCounts();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("storyboard:review-updated"));
      }
      toast.success("Story approved for team review");
    } catch (err: any) {
      toast.error(err.message || "Unable to approve story");
    } finally {
      setApprovingStoryId(null);
    }
  }

  // Open Manual Add Story Modal
  function openAddStoryManually(epic: Epic) {
    setManualStoryEpic(epic);
    setManualStoryTitle("");
    setManualStoryDesc("");
    setManualStoryCriteria([]);
    setManualStoryAssumptions([]);
    setManualStoryClarifications([]);
    setManualStoryReviewerIds([]);
    setManualStoryError("");
    setManualStoryModalOpen(true);
    loadTeamMembers();
  }

  async function handleCreateManualStory(e: React.FormEvent) {
    e.preventDefault();
    if (!manualStoryTitle.trim()) {
      setManualStoryError("Story title is required.");
      return;
    }
    if (!manualStoryEpic) {
      setManualStoryError("Epic is required.");
      return;
    }

    setCreatingManualStory(true);
    setManualStoryError("");

    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          epic_id: manualStoryEpic.id,
          title: manualStoryTitle.trim(),
          description: manualStoryDesc.trim(),
          acceptance_criteria: manualStoryCriteria.filter((c) => c.trim()),
          assumptions: manualStoryAssumptions.filter((a) => a.trim()),
          clarifications: manualStoryClarifications.filter((cl) => cl.trim()),
          status: "review",
          reviewer_ids: manualStoryReviewerIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create story.");

      const created = data.story as Story;
      setStories((prev) => [created, ...prev]);
      setEditingStory(created);
      setManualStoryModalOpen(false);
      toast.success("Story created successfully");
    } catch (err: any) {
      setManualStoryError(err.message || "Failed to create story");
      toast.error("Unable to create story");
    } finally {
      setCreatingManualStory(false);
    }
  }



  // Sorted and filtered epics
  const sortedEpics = useMemo(() => sortEpics(epics), [epics]);
  const filteredEpics = useMemo(
    () => (epicFilter === "all" ? sortedEpics : sortedEpics.filter((e) => e.id === epicFilter)),
    [sortedEpics, epicFilter]
  );
  const uncategorizedStories = useMemo(
    () => sortStories(stories.filter((s) => !s.epic_id)),
    [stories]
  );

  return (
    <div className="pb-24">
      {/* Top Workspace Header */}
      <header className="border-b border-[rgba(74,61,100,0.08)] bg-white/68 backdrop-blur-[20px]">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:py-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[#B8944E] mb-1">
                <span>Team Workspace</span>
                <span className="text-[rgba(74,61,100,0.25)]">•</span>
                <span className="text-[#706C7D] font-normal lowercase tracking-normal">
                  @{teamUser.username}
                </span>
              </div>
              <div className="flex items-center justify-between sm:justify-start gap-2.5 sm:gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-[#252331] truncate">
                    {project.name}
                  </h1>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-xs font-medium text-emerald-700 border border-emerald-200 shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Active
                  </span>
                </div>

                {/* Mobile-only compact Add Epic button */}
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus size={13} />}
                  onClick={() => openCreateEpic()}
                  className="sm:hidden shrink-0 text-xs px-2.5 py-1"
                >
                  Add Epic
                </Button>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-[#706C7D] max-w-2xl font-normal leading-relaxed truncate">
                {project.description ||
                  "Epics group focused product areas. Stories contain criteria and discussions."}
              </p>
            </div>

            {/* Desktop Add Epic Button */}
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <Button
                variant="primary"
                size="md"
                leftIcon={<Plus size={14} />}
                onClick={() => openCreateEpic()}
              >
                Add Epic
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8 space-y-5 sm:space-y-6">
        {error && (
          <div className="rounded-xl border border-rose-200/80 bg-rose-50/80 p-4 text-xs sm:text-sm text-[#C25D72]">
            {error}
          </div>
        )}

        {/* Filter & Quick Folding Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-1 sm:flex-none min-w-0">
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#9994A5] shrink-0">
                Filter:
              </span>
              <select
                value={epicFilter}
                onChange={(e) => setEpicFilter(e.target.value)}
                className="h-8 sm:h-9 w-full sm:w-auto rounded-xl border border-[rgba(74,61,100,0.11)] bg-white/85 px-2.5 sm:px-3 text-xs font-medium text-[#252331] outline-none transition focus:border-[#B8944E] cursor-pointer truncate"
              >
                <option value="all">All Epics ({epics.length})</option>
                {epics.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Segmented Quick Fold / Expand Controls */}
            <div className="inline-flex items-center rounded-xl border border-[rgba(74,61,100,0.11)] bg-white/80 p-0.5 text-xs shrink-0 shadow-2xs">
              <button
                type="button"
                onClick={foldAllEpics}
                className="flex items-center gap-1 rounded-lg px-2 sm:px-2.5 py-1 text-[11px] font-medium text-[#706C7D] hover:text-[#252331] hover:bg-[#FAF9FC] transition cursor-pointer whitespace-nowrap"
                title="Collapse all epics"
              >
                <ChevronUp size={12} className="shrink-0" />
                <span>Fold all</span>
              </button>
              <span className="h-3 w-[1px] bg-[rgba(74,61,100,0.12)] shrink-0" />
              <button
                type="button"
                onClick={expandAllEpics}
                className="flex items-center gap-1 rounded-lg px-2 sm:px-2.5 py-1 text-[11px] font-medium text-[#706C7D] hover:text-[#252331] hover:bg-[#FAF9FC] transition cursor-pointer whitespace-nowrap"
                title="Expand all epics"
              >
                <ChevronDown size={12} className="shrink-0" />
                <span>Expand all</span>
              </button>
            </div>
          </div>

          <span className="text-[11px] sm:text-xs text-[#706C7D] shrink-0">
            {stories.length} {stories.length === 1 ? "story" : "stories"} total
          </span>
        </div>

        {/* Super Admin Split View: Epics/Stories on Left, Story Document Inspector on Right */}
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1.9fr] items-start">
          {/* Left Column: Epics and Stories List */}
          <div className="space-y-6">
            {epics.length === 0 && stories.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="No Epics yet"
                description="Create your first Epic to group feature stories into structured product areas."
                action={
                  <Button
                    variant="primary"
                    size="md"
                    leftIcon={<Plus size={14} />}
                    onClick={() => openCreateEpic()}
                  >
                    Create Epic
                  </Button>
                }
              />
            ) : (
              <>
                {filteredEpics.map((epic) => {
                  const epicStories = sortStories(stories.filter((s) => s.epic_id === epic.id));
                  const approvedCount = epicStories.filter((s) => s.status === "approved" || s.team_review_status === "approved").length;
                  const changesCount = epicStories.filter((s) => s.status === "changes_requested").length;

                  return (
                    <EpicFolder
                      key={epic.id}
                      id={epic.id}
                      name={epic.name}
                      description={epic.description}
                      creatorName={projectTeamMembers.find(tm => tm.id === epic.created_by_id)?.name || undefined}
                      storyCount={epicStories.length}
                      isExpanded={!collapsedEpicIds[epic.id]}
                      onToggle={() => toggleEpic(epic.id)}
                      headerExtra={
                        <span className="flex items-center gap-1.5 text-[11px] font-medium">
                          <span className="text-[rgba(74,61,100,0.2)]">•</span>
                          <span className="text-[#2E8B70]">{approvedCount} approved</span>
                          {changesCount > 0 && (
                            <>
                              <span className="text-[rgba(74,61,100,0.2)]">•</span>
                              <span className="text-[#C25D72]">{changesCount} changes</span>
                            </>
                          )}
                        </span>
                      }
                      discussion={
                        <EpicFeedbackThread
                          epicId={epic.id}
                          sectionType="general"
                          viewerId={teamUser.id}
                          viewerType="team_user"
                        />
                      }
                      actions={
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            leftIcon={<Sparkles size={13} className="text-[#B8944E]" />}
                            onClick={() => setGeneratingEpicId(epic.id)}
                            className="text-xs px-2 sm:px-3"
                            title="Generate stories with AI"
                          >
                            <span className="hidden sm:inline">Generate</span>
                          </Button>

                          <DropdownMenu
                            ariaLabel={`Actions for ${epic.name}`}
                            items={[
                              {
                                label: "Add Story manually",
                                icon: <Plus size={14} />,
                                onClick: () => openAddStoryManually(epic),
                              },
                              {
                                label: "Edit Epic",
                                icon: <Edit2 size={14} />,
                                onClick: () => openEditEpic(epic),
                              },
                              {
                                label: "Delete Epic",
                                icon: <Trash2 size={14} />,
                                variant: "danger",
                                onClick: () => deleteEpic(epic.id),
                              },
                            ]}
                          />
                        </>
                      }
                      emptyMessage="No stories in this Epic yet."
                      emptyAction={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[#80642F]"
                          leftIcon={<Sparkles size={13} />}
                          onClick={() => setGeneratingEpicId(epic.id)}
                        >
                          Generate stories with AI
                        </Button>
                      }
                    >
                      {epicStories.map((story) => (
                        <StoryCard
                          key={story.id}
                          story={story}
                          isSelected={editingStory?.id === story.id}
                          openFeedbackCount={feedbackCounts[story.id] || 0}
                          creatorName={projectTeamMembers.find(tm => tm.id === story.created_by_id)?.name}
                          onClick={() => setEditingStory(story)}
                        />
                      ))}
                    </EpicFolder>
                  );
                })}

                {/* Uncategorized Stories */}
                {epicFilter === "all" && uncategorizedStories.length > 0 && (
                  <EpicFolder
                    id="uncategorized"
                    name="Uncategorized"
                    description="Requirements not assigned to an Epic. Select a story to assign it to an Epic."
                    storyCount={uncategorizedStories.length}
                    isExpanded={!collapsedEpicIds["uncategorized"]}
                    onToggle={() => toggleEpic("uncategorized")}
                    isUncategorized={true}
                  >
                    {uncategorizedStories.map((story) => (
                      <StoryCard
                        key={story.id}
                        story={story}
                        isSelected={editingStory?.id === story.id}
                        openFeedbackCount={feedbackCounts[story.id] || 0}
                        creatorName={projectTeamMembers.find(tm => tm.id === story.created_by_id)?.name}
                        onClick={() => setEditingStory(story)}
                      />
                    ))}
                  </EpicFolder>
                )}
              </>
            )}
          </div>

          {/* Right Column: Story Document Inspector / Editor */}
          <div
            id="story-editor-section"
            className={
              editingStory
                ? "max-lg:fixed max-lg:inset-0 max-lg:z-40 max-lg:overflow-y-auto max-lg:bg-[#FAF9FC] max-lg:p-3.5 sm:max-lg:p-6 max-lg:pb-20 lg:sticky lg:top-20 lg:self-start z-10 animate-in fade-in max-lg:slide-in-from-bottom-4 duration-200"
                : "hidden lg:block lg:sticky lg:top-20 lg:self-start z-10"
            }
          >
            {editingStory ? (
              <div className="space-y-3">
                {/* Mobile Back to Stories Bar */}
                <div className="lg:hidden sticky top-0 z-20 -mx-3.5 -mt-3.5 sm:-mx-6 sm:-mt-6 px-4 py-3 bg-white/95 backdrop-blur-md border-b border-[rgba(74,61,100,0.08)] flex items-center justify-between shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setEditingStory(null)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#80642F] bg-[rgba(184,148,78,0.08)] hover:bg-[rgba(184,148,78,0.14)] px-3 py-1.5 rounded-xl border border-[rgba(184,148,78,0.18)] transition active:scale-95 cursor-pointer"
                  >
                    <ArrowLeft size={14} />
                    <span>Back to Stories</span>
                  </button>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#706C7D]">
                    Story Inspector
                  </span>
                </div>

                <StoryEditor
                  story={editingStory}
                  epics={epics}
                  viewerType="team_user"
                  currentUserId={teamUser.id}
                  isReviewer={
                    Boolean(editingStory.created_by_id && editingStory.created_by_id === teamUser.id) ||
                    teamUser.role === "Super Admin" ||
                    teamUser.role === "Project Creator" ||
                    (editingStory.reviewer_ids || []).includes(teamUser.id)
                  }
                  onCancel={() => setEditingStory(null)}
                  onFeedbackChange={loadFeedbackCounts}
                  onSave={handleSaveStoryEditor}
                  onCreateEpic={openCreateEpic}
                  onDelete={() => setDeletingStoryId(editingStory.id)}
                  onApprove={() => handleApproveStory(editingStory.id)}
                  isTeamApproved={editingStory.team_review_status === "approved"}
                  approving={approvingStoryId === editingStory.id}
                />
              </div>
            ) : (
              <div className="rounded-[18px] border border-dashed border-[rgba(74,61,100,0.12)] bg-white/80 backdrop-blur-[16px] p-8 sm:p-12 text-center shadow-[0_8px_30px_rgba(70,55,95,0.04)]">
                <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-[rgba(184,148,78,0.10)] text-[#B8944E] mb-3 shadow-sm border border-[rgba(184,148,78,0.15)]">
                  <Layers size={18} />
                </div>
                <h4 className="text-sm font-semibold text-[#252331]">
                  Select a feature story
                </h4>
                <p className="mt-1 text-xs text-[#706C7D] max-w-xs mx-auto">
                  Click any story on the left to review criteria, inspect assumptions, and participate in discussion threads.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Epic Modal (Create / Edit with AI Auto-format) */}
      <Modal
        isOpen={epicModalOpen}
        onClose={() => setEpicModalOpen(false)}
        title={editingEpic ? "Edit Epic" : "Create Epic"}
        description="Epics represent major product areas or feature themes."
        footer={
          <>
            <Button
              variant="outline"
              size="md"
              type="button"
              onClick={() => setEpicModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              type="submit"
              form="team-epic-modal-form"
              isLoading={savingEpic}
              disabled={!epicForm.name.trim()}
            >
              {editingEpic ? "Save changes" : "Create Epic"}
            </Button>
          </>
        }
      >
        <form
          id="team-epic-modal-form"
          onSubmit={(e) => {
            e.preventDefault();
            saveEpic();
          }}
          className="space-y-4"
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#9994A5]">
                Epic Name <span className="text-[#C25D72]">*</span>
              </label>
              <button
                type="button"
                disabled={aiCorrecting || !epicForm.name.trim()}
                onClick={handleAiCorrectEpicName}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#80642F] hover:text-[#9F7D3E] disabled:opacity-40 transition cursor-pointer"
              >
                <Sparkles size={12} />
                <span>{aiCorrecting ? "Enhancing..." : "Auto-format name"}</span>
              </button>
            </div>
            <input
              type="text"
              required
              autoFocus
              value={epicForm.name}
              onChange={(e) =>
                setEpicForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="e.g. User Authentication & Security"
              className="h-10 w-full rounded-xl border border-[#EBE7F2] px-3.5 text-sm text-[#252331] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)]"
            />

            {aiSuggestions && aiSuggestions.length > 1 && (
              <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                <span className="text-[10px] text-[#9994A5]">Suggestions:</span>
                {aiSuggestions.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() =>
                      setEpicForm((prev) => ({ ...prev, name: sug }))
                    }
                    className="text-[11px] rounded-md bg-[rgba(184,148,78,0.08)] px-2 py-0.5 text-[#80642F] hover:bg-[rgba(184,148,78,0.15)] transition cursor-pointer"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            )}
            {aiError && <p className="text-xs text-[#C25D72] mt-1">{aiError}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5] mb-1.5">
              Description
            </label>
            <VoiceTextarea
              rows={3}
              value={epicForm.description}
              onChange={(e) =>
                setEpicForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Describe the scope and purpose of this Epic..."
              className="w-full rounded-xl border border-[#EBE7F2] p-3 text-sm text-[#252331] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)] resize-none"
            />
          </div>
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
            if (newStories[0]) {
              setEditingStory(newStories[0]);
            }
            toast.success(
              newStories.length > 1
                ? `${newStories.length} stories created successfully`
                : "Story created successfully"
            );
          }}
        />
      )}

      {/* Add Story Manually Modal */}
      <Modal
        isOpen={manualStoryModalOpen}
        onClose={() => setManualStoryModalOpen(false)}
        title="Add Story manually"
        description={`Create a new story inside "${manualStoryEpic?.name || 'Epic'}".`}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setManualStoryModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="manual-add-story-form"
              isLoading={creatingManualStory}
              disabled={!manualStoryTitle.trim()}
            >
              Create story
            </Button>
          </>
        }
      >
        <form
          id="manual-add-story-form"
          onSubmit={handleCreateManualStory}
          className="space-y-4 max-h-[70vh] overflow-y-auto pr-1"
        >
          {/* Assigned Epic (Locked) */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5] mb-1.5">
              Assigned Epic
            </label>
            <div className="flex items-center justify-between h-10 w-full rounded-xl border border-[#EBE7F2] bg-[#FAF9FC] px-3.5 text-sm">
              <div className="flex items-center gap-2 truncate">
                <Layers size={15} className="text-[#B8944E] shrink-0" />
                <span className="font-semibold text-[#252331] truncate">
                  {manualStoryEpic?.name || "No Epic selected"}
                </span>
              </div>
              <span className="shrink-0 text-[10px] font-semibold text-[#706C7D] uppercase tracking-wider bg-[rgba(74,61,100,0.06)] px-2 py-0.5 rounded">
                Locked
              </span>
            </div>
          </div>

          {/* Story Title */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5] mb-1.5">
              Story Title <span className="text-[#C25D72]">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={manualStoryTitle}
              onChange={(e) => setManualStoryTitle(e.target.value)}
              placeholder="e.g. User Profile Avatar Upload"
              className="h-10 w-full rounded-xl border border-[#EBE7F2] px-3.5 text-sm text-[#252331] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)]"
            />
          </div>

          {/* Story Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5] mb-1.5">
              Description <span className="text-[#9994A5] font-normal normal-case">(optional)</span>
            </label>
            <VoiceTextarea
              rows={3}
              value={manualStoryDesc}
              onChange={(e) => setManualStoryDesc(e.target.value)}
              placeholder="Describe user capability, context, or business value..."
              className="w-full rounded-xl border border-[#EBE7F2] p-3 text-sm text-[#252331] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)]"
            />
          </div>

          {/* Acceptance Criteria */}
          <div className="space-y-2 pt-1 border-t border-[rgba(74,61,100,0.06)]">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5]">
                Acceptance Criteria {manualStoryCriteria.length > 0 && `(${manualStoryCriteria.length})`}
              </label>
              <button
                type="button"
                onClick={() => setManualStoryCriteria((prev) => [...prev, ""])}
                className="text-xs font-medium text-[#80642F] hover:text-[#9F7D3E] flex items-center gap-1 cursor-pointer"
              >
                <Plus size={12} />
                <span>Add criterion</span>
              </button>
            </div>

            {manualStoryCriteria.length > 0 ? (
              <div className="space-y-2">
                {manualStoryCriteria.map((crit, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-[11px] font-mono text-[#9994A5] shrink-0 w-4 text-right mt-1.5">
                      {idx + 1}.
                    </span>
                    <VoiceTextarea
                      rows={1}
                      value={crit}
                      onChange={(e) => {
                        const updated = [...manualStoryCriteria];
                        updated[idx] = e.target.value;
                        setManualStoryCriteria(updated);
                      }}
                      placeholder="e.g. User can upload JPEG or PNG images up to 5MB"
                      containerClassName="flex-1 min-w-0"
                      className="w-full rounded-lg border border-[#EBE7F2] px-3 py-1.5 text-xs text-[#252331] outline-none focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)] leading-relaxed"
                      actionSize="sm"
                      actionSlot={
                        <button
                          type="button"
                          onClick={() => setManualStoryCriteria((prev) => prev.filter((_, i) => i !== idx))}
                          className="grid h-6 w-6 place-items-center text-[#9994A5] hover:text-[#C25D72] cursor-pointer"
                          aria-label="Remove criterion"
                        >
                          <X size={14} />
                        </button>
                      }
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#9994A5] italic">
                No criteria added yet. Click &ldquo;Add criterion&rdquo; to define acceptance rules.
              </p>
            )}
          </div>

          {/* Reviewer Assignment Selection (Shows Super Admin / Project Creator pinned at top) */}
          {projectTeamMembers.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[rgba(74,61,100,0.06)]">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5]">
                  Assign Story Reviewers
                </label>
                <span className="text-[11px] text-[#706C7D]">
                  {manualStoryReviewerIds.length} selected
                </span>
              </div>
              <p className="text-[11px] text-[#706C7D]">
                Select team members and project leaders who will review and approve this story.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {projectTeamMembers
                  .filter((tm) => tm.id !== teamUser.id && tm.role !== "Super Admin" && tm.role !== "Project Creator")
                  .map((tm) => {
                    const isSelected = manualStoryReviewerIds.includes(tm.id);
                  return (
                    <button
                      key={tm.id}
                      type="button"
                      onClick={() => {
                        setManualStoryReviewerIds((prev) =>
                          isSelected
                            ? prev.filter((id) => id !== tm.id)
                            : [...prev, tm.id]
                        );
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                        isSelected
                          ? "bg-[#80642F] text-white shadow-2xs"
                          : "border border-[#EBE7F2] bg-white text-[#252331] hover:bg-[#FAF9FC]"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          isSelected ? "bg-emerald-300" : "bg-[#9994A5]"
                        }`}
                      />
                      <span>{tm.name}</span>
                      <span className="text-[10px] opacity-75">(@{tm.username})</span>
                      {tm.role && tm.role !== "member" && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-semibold ${
                            isSelected
                              ? "bg-white/20 text-white"
                              : "bg-[rgba(184,148,78,0.12)] text-[#80642F]"
                          }`}
                        >
                          {tm.role}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {manualStoryError && (
            <p className="text-xs text-[#C25D72] bg-rose-50 p-2.5 rounded-lg">
              {manualStoryError}
            </p>
          )}
        </form>
      </Modal>

      {/* Delete Story Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingStoryId)}
        onClose={() => setDeletingStoryId(null)}
        onConfirm={confirmDeleteStory}
        title="Delete story"
        description="Are you sure you want to delete this story? This action cannot be undone."
        confirmLabel="Delete story"
        variant="danger"
        isLoading={loading}
      />

      {/* Delete Epic Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingEpicItem)}
        onClose={() => setDeletingEpicItem(null)}
        onConfirm={confirmDeleteEpic}
        title="Delete epic"
        description={`Are you sure you want to delete "${deletingEpicItem?.name}"? This action cannot be undone.`}
        confirmLabel="Delete epic"
        variant="danger"
        isLoading={loading}
      />

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
        <p className="text-xs text-[#706C7D]">
          The open discussions will remain visible for client review.
        </p>
      </Modal>
    </div>
  );
}

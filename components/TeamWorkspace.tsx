"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  Code2,
  Edit2,
  FolderKanban,
  Layers,
  Plus,
  Sparkles,
  Trash2,
  Users,
  X,
  MessageSquare,
  FileText,
  Filter,
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
import type { Story, Epic, StoryStatus, ProjectNote, StoryLifecycleStatus } from "@/lib/types";
import { normalizeStoryStatus, getStoryStatusLabel } from "@/lib/types";
import { EpicFolder } from "@/components/epics/EpicFolder";
import { EpicFeedbackThread } from "@/components/epics/EpicFeedbackThread";
import { AiEpicAgentPromptModal } from "@/components/epics/AiEpicAgentPromptModal";
import { sortEpics, sortStories } from "@/lib/epic-story-utils";
import { ProjectNotesWorkspace } from "@/components/notes/ProjectNotesWorkspace";
import { EpicNotesModal } from "@/components/notes/EpicNotesModal";

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
  assignedProjects?: Array<{
    id: string;
    name: string;
    description?: string | null;
    status?: string;
  }>;
  initialStories: Story[];
  initialEpics: Epic[];
  initialNotes?: ProjectNote[];
  initialTargetStoryId?: string;
}

export function TeamWorkspace({
  teamUser,
  project,
  assignedProjects = [],
  initialStories,
  initialEpics,
  initialNotes,
  initialTargetStoryId,
}: TeamWorkspaceProps) {
  const [stories, setStories] = useState<Story[]>(initialStories);
  const [epics, setEpics] = useState<Epic[]>(initialEpics);
  const [notes, setNotes] = useState<ProjectNote[]>(initialNotes || []);
  const [activeTab, setActiveTab] = useState<"hierarchy" | "notes">("hierarchy");
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
  const [activeEpicForNotes, setActiveEpicForNotes] = useState<Epic | null>(null);

  // Manual Story Creation modal
  const [manualStoryModalOpen, setManualStoryModalOpen] = useState(false);
  const [manualStoryEpic, setManualStoryEpic] = useState<Epic | null>(null);
  const [manualStoryTitle, setManualStoryTitle] = useState("");
  const [manualStoryDesc, setManualStoryDesc] = useState("");
  const [manualStoryCriteria, setManualStoryCriteria] = useState<string[]>([]);
  const [manualStoryAssumptions, setManualStoryAssumptions] = useState<string[]>([]);
  const [manualStoryClarifications, setManualStoryClarifications] = useState<string[]>([]);
  const [manualStoryReviewerIds, setManualStoryReviewerIds] = useState<string[]>([teamUser.id]);
  const [manualStoryStatus, setManualStoryStatus] = useState<StoryLifecycleStatus>("new");
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
  const [epicPromptTarget, setEpicPromptTarget] = useState<Epic | null>(null);

  // Filter and Folding state (Record ensures pure serializable state and reliable re-rendering)
  const [epicFilter, setEpicFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | StoryLifecycleStatus>("all");
  const [expandedEpicIds, setExpandedEpicIds] = useState<Set<string>>(() => new Set());

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

  const reloadStories = useCallback(async () => {
    try {
      const res = await fetch(`/api/stories?projectId=${project.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.stories) setStories(data.stories);
      }
    } catch {
      // Silently catch
    }
  }, [project.id]);

  const handleFeedbackChange = useCallback((updatedStoryId?: string, newStatus?: StoryStatus) => {
    loadFeedbackCounts();
    if (updatedStoryId && newStatus) {
      setStories((prev) =>
        prev.map((s) => (s.id === updatedStoryId ? { ...s, status: newStatus } : s))
      );
      setEditingStory((prev: any) =>
        prev && prev.id === updatedStoryId ? { ...prev, status: newStatus } : prev
      );
    }
  }, [loadFeedbackCounts]);

  useEffect(() => {
    const handleReviewUpdate = () => {
      loadFeedbackCounts();
      reloadStories();
    };
    window.addEventListener("storyboard:review-updated", handleReviewUpdate);
    return () => {
      window.removeEventListener("storyboard:review-updated", handleReviewUpdate);
    };
  }, [loadFeedbackCounts, reloadStories]);

  const handleNoteConversionComplete = useCallback(
    (result: { epic: Epic; stories: Story[]; note: ProjectNote }) => {
      setEpics((prev) => {
        const exists = prev.some((e) => e.id === result.epic.id);
        if (exists) {
          return prev.map((e) => (e.id === result.epic.id ? result.epic : e));
        }
        return [result.epic, ...prev];
      });

      if (result.stories && result.stories.length > 0) {
        setStories((prev) => [...result.stories, ...prev]);
        if (result.stories[0]) {
          setEditingStory(result.stories[0]);
        }
      }

      setNotes((prev) =>
        prev.map((n) => (n.id === result.note.id ? result.note : n))
      );

      setExpandedEpicIds((prev) => {
        const next = new Set(prev);
        next.add(result.epic.id);
        return next;
      });
      setEpicFilter("all");

      setActiveTab("hierarchy");
      toast.success(`Successfully converted note into Epic "${result.epic.name}"!`);
    },
    []
  );


  useEffect(() => {
    setStories(initialStories);
    setEpics(initialEpics);
    if (initialNotes) setNotes(initialNotes);
    loadFeedbackCounts();
    loadTeamMembers();
  }, [initialStories, initialEpics, initialNotes, loadFeedbackCounts, loadTeamMembers]);


  // Auto-expand and select target story when opened from notifications / review queue
  useEffect(() => {
    if (initialTargetStoryId) {
      const target = initialStories.find((s) => s.id === initialTargetStoryId);
      if (target) {
        setEditingStory(target);
        if (target.epic_id) {
          setExpandedEpicIds((prev) => {
            const next = new Set(prev);
            next.add(target.epic_id!);
            return next;
          });
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
    setExpandedEpicIds((prev) => {
      const next = new Set(prev);
      if (next.has(epicId)) {
        next.delete(epicId);
      } else {
        next.add(epicId);
      }
      return next;
    });
  }, []);

  const foldAllEpics = useCallback(() => {
    setExpandedEpicIds(new Set());
  }, []);

  const expandAllEpics = useCallback(() => {
    setExpandedEpicIds(() => {
      const next = new Set<string>();
      epics.forEach((e) => {
        next.add(e.id);
      });
      next.add("uncategorized");
      return next;
    });
  }, [epics]);

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
  async function handleStoryStatusChange(storyId: string, newStatus: StoryLifecycleStatus) {
    try {
      const res = await fetch(`/api/stories/${storyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update story status");

      setStories((v) => v.map((s) => (s.id === storyId ? data.story : s)));
      setEditingStory((prev: any) => (prev && prev.id === storyId ? data.story : prev));
      loadFeedbackCounts();
      toast.success(`Story status updated to ${getStoryStatusLabel(newStatus)}`);
    } catch (e: any) {
      toast.error(e.message || "Unable to update story status");
      throw e;
    }
  }

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
    setManualStoryStatus("new");
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
          status: manualStoryStatus,
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



  const totalStoriesCount = stories.length;
  const newStoriesCount = stories.filter((s) => normalizeStoryStatus(s.status) === "new").length;
  const activeStoriesCount = stories.filter((s) => normalizeStoryStatus(s.status) === "active").length;
  const doneStoriesCount = stories.filter((s) => normalizeStoryStatus(s.status) === "done").length;

  // Sorted and filtered epics
  const sortedEpics = useMemo(() => sortEpics(epics), [epics]);
  const filteredEpics = useMemo(
    () => (epicFilter === "all" ? sortedEpics : sortedEpics.filter((e) => e.id === epicFilter)),
    [sortedEpics, epicFilter]
  );
  const filteredStories = useMemo(() => {
    if (statusFilter === "all") return stories;
    return stories.filter((s) => normalizeStoryStatus(s.status) === statusFilter);
  }, [stories, statusFilter]);

  const uncategorizedStories = useMemo(
    () => sortStories(filteredStories.filter((s) => !s.epic_id)),
    [filteredStories]
  );

  const visibleEpics = useMemo(() => {
    if (statusFilter === "all" || epicFilter !== "all") {
      return filteredEpics;
    }
    const withStories = filteredEpics.filter((epic) =>
      filteredStories.some((s) => s.epic_id === epic.id)
    );
    return withStories.length > 0 ? withStories : filteredEpics;
  }, [filteredEpics, filteredStories, statusFilter, epicFilter]);

  return (
    <div className="w-full min-w-0 pb-32">
      {/* Top Workspace Header */}
      <header className="w-full border-b border-[rgba(74,61,100,0.08)] bg-white/68 backdrop-blur-[20px]">
        <div className="w-full mx-auto max-w-6xl px-4 py-4 sm:py-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[#B8944E] mb-1">
                <span>Team Workspace</span>
                <span className="text-[rgba(74,61,100,0.25)]">•</span>
                <span className="text-[#706C7D] font-normal lowercase tracking-normal">
                  @{teamUser.username}
                </span>
              </div>
              <div className="flex items-center justify-between sm:justify-start gap-2.5 sm:gap-3 flex-wrap">
                <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                  <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-[#252331] truncate">
                    {project.name}
                  </h1>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-xs font-medium text-emerald-700 border border-emerald-200 shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Active
                  </span>

                  {assignedProjects.length > 1 && (
                    <DropdownMenu
                      ariaLabel="Switch mapped project"
                      trigger={
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-[#80642F] bg-[rgba(184,148,78,0.12)] hover:bg-[rgba(184,148,78,0.20)] border border-[rgba(184,148,78,0.25)] transition cursor-pointer shrink-0"
                          title="Switch project"
                        >
                          <span>{assignedProjects.length} Projects</span>
                          <ChevronsUpDown size={13} />
                        </button>
                      }
                      items={assignedProjects.map((p) => ({
                        label: p.id === project.id ? `${p.name} (Current)` : p.name,
                        icon:
                          p.id === project.id ? (
                            <Check size={14} className="text-[#80642F]" />
                          ) : (
                            <FolderKanban size={14} />
                          ),
                        onClick: () => {
                          window.location.href = `/team?projectId=${p.id}`;
                        },
                      }))}
                    />
                  )}
                </div>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-[#706C7D] max-w-2xl font-normal leading-relaxed truncate">
                {project.description ||
                  "Epics group focused product areas. Stories contain criteria and discussions."}
              </p>

              {/* Mapped Projects Pill Bar */}
              {assignedProjects.length > 1 && (
                <div className="mt-3 pt-3 border-t border-[rgba(74,61,100,0.06)] flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9994A5] flex items-center gap-1.5 mr-1">
                    <FolderKanban size={13} className="text-[#80642F]" />
                    Mapped Projects ({assignedProjects.length}):
                  </span>
                  {assignedProjects.map((p) => {
                    const isActive = p.id === project.id;
                    return (
                      <Link
                        key={p.id}
                        href={`/team?projectId=${p.id}`}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                          isActive
                            ? "bg-[#80642F] text-white shadow-2xs ring-2 ring-[#80642F]/20"
                            : "bg-white/80 hover:bg-white text-[#706C7D] hover:text-[#252331] border border-[rgba(74,61,100,0.12)] hover:border-[#80642F]/40"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            isActive ? "bg-emerald-400" : "bg-zinc-400"
                          }`}
                        />
                        <span>{p.name}</span>
                        {isActive && (
                          <span className="text-[10px] font-normal opacity-90">(Current)</span>
                        )}
                      </Link>
                    );
                  })}
                  <Link
                    href="/team/projects"
                    className="text-xs font-semibold text-[#80642F] hover:underline ml-1 inline-flex items-center gap-1"
                  >
                    <span>View all cards</span>
                    <span>→</span>
                  </Link>
                </div>
              )}
            </div>

            {/* Workspace Actions (Unified for mobile & desktop) */}
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 mt-1 sm:mt-0">
              <Button
                variant={activeTab === "notes" ? "primary" : "secondary"}
                className="flex-1 sm:flex-initial h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm justify-center whitespace-nowrap shadow-2xs"
                leftIcon={<FileText size={13} />}
                onClick={() => setActiveTab("notes")}
                title="Discussion Notes"
              >
                <span>Notes</span>
                {notes.length > 0 && (
                  <span className="ml-1 rounded-full bg-[rgba(74,61,100,0.12)] px-1.5 py-0.2 text-[10px] font-bold">
                    {notes.length}
                  </span>
                )}
              </Button>
              <Button
                variant="primary"
                className="flex-1 sm:flex-initial h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm justify-center whitespace-nowrap font-semibold shadow-2xs"
                leftIcon={<Plus size={13} />}
                onClick={() => openCreateEpic()}
              >
                Add Epic
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full min-w-0 mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-8 lg:px-8 space-y-4 sm:space-y-6">
        {/* View Switcher Tabs between Requirements Hierarchy and Discussion Notes */}
        <div className="flex items-center gap-1.5 sm:gap-2 border-b border-[rgba(74,61,100,0.08)] pb-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab("hierarchy")}
            className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-xl transition cursor-pointer whitespace-nowrap ${
              activeTab === "hierarchy"
                ? "bg-white text-[#252331] shadow-2xs border border-[rgba(74,61,100,0.12)]"
                : "text-[#706C7D] hover:text-[#252331] hover:bg-white/60"
            }`}
          >
            <Layers size={14} className={activeTab === "hierarchy" ? "text-[#B8944E]" : "text-[#9994A5]"} />
            <span className="hidden sm:inline">Requirements Hierarchy</span>
            <span className="sm:hidden">Hierarchy</span>
            <span className="rounded-full bg-[rgba(184,148,78,0.10)] px-1.5 sm:px-2 py-0.5 text-[10px] font-bold text-[#80642F]">
              <span className="hidden sm:inline">{epics.length} Epics • {stories.length} Stories</span>
              <span className="sm:hidden">{epics.length}E • {stories.length}S</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("notes")}
            className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-xl transition cursor-pointer whitespace-nowrap ${
              activeTab === "notes"
                ? "bg-white text-[#252331] shadow-2xs border border-[rgba(74,61,100,0.12)]"
                : "text-[#706C7D] hover:text-[#252331] hover:bg-white/60"
            }`}
          >
            <FileText size={14} className={activeTab === "notes" ? "text-[#B8944E]" : "text-[#9994A5]"} />
            <span className="hidden sm:inline">Discussion Notes</span>
            <span className="sm:hidden">Notes</span>
            <span className="rounded-full bg-[rgba(74,61,100,0.08)] px-1.5 sm:px-2 py-0.5 text-[10px] font-bold text-[#252331]">
              {notes.length}
            </span>
          </button>
        </div>

        {activeTab === "notes" ? (
          <ProjectNotesWorkspace
            projectId={project.id}
            epics={epics}
            initialNotes={notes}
            onConversionComplete={handleNoteConversionComplete}
            onNavigateToEpic={(epicId) => {
              setActiveTab("hierarchy");
              setExpandedEpicIds((prev) => {
                const next = new Set(prev);
                next.add(epicId);
                return next;
              });
              setEpicFilter("all");
            }}

          />
        ) : (
          <>
        {error && (
          <div className="rounded-xl border border-rose-200/80 bg-rose-50/80 p-4 text-xs sm:text-sm text-[#C25D72]">
            {error}
          </div>
        )}


        {/* Filter & Quick Folding Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 flex-1 min-w-0">
            {/* 2-column equal dropdowns on mobile */}
            <div className="grid grid-cols-2 gap-2 flex-1 sm:flex-none">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 bg-white/85 border border-[rgba(74,61,100,0.11)] rounded-xl px-2.5 h-8.5 shadow-2xs">
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-[#9994A5] shrink-0">
                  Epic:
                </span>
                <select
                  value={epicFilter}
                  onChange={(e) => setEpicFilter(e.target.value)}
                  className="w-full bg-transparent text-xs font-medium text-[#252331] outline-none transition focus:border-[#B8944E] cursor-pointer truncate"
                >
                  <option value="all">All Epics ({epics.length})</option>
                  {epics.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 bg-white/85 border border-[rgba(74,61,100,0.11)] rounded-xl px-2.5 h-8.5 shadow-2xs">
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-[#9994A5] shrink-0">
                  Status:
                </span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full bg-transparent text-xs font-medium text-[#252331] outline-none transition focus:border-[#B8944E] cursor-pointer truncate"
                >
                  <option value="all">All Statuses ({totalStoriesCount})</option>
                  <option value="new">New ({newStoriesCount})</option>
                  <option value="active">Active ({activeStoriesCount})</option>
                  <option value="done">Done ({doneStoriesCount})</option>
                </select>
              </div>
            </div>

            {/* Quick Status Pills */}
            <div className="hidden md:inline-flex items-center rounded-xl border border-[rgba(74,61,100,0.11)] bg-white/80 p-0.5 text-xs shadow-2xs gap-0.5">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  statusFilter === "all"
                    ? "bg-[#252331] text-white shadow-2xs"
                    : "text-[#706C7D] hover:text-[#252331] hover:bg-[#FAF9FC]"
                }`}
              >
                All ({totalStoriesCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === "new" ? "all" : "new")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  statusFilter === "new"
                    ? "bg-sky-100 text-sky-800 border-2 border-sky-500/70 ring-2 ring-sky-500/20"
                    : "text-[#706C7D] hover:text-[#252331] hover:bg-[#FAF9FC]"
                }`}
              >
                New ({newStoriesCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === "active" ? "all" : "active")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  statusFilter === "active"
                    ? "bg-[rgba(184,148,78,0.22)] text-[#80642F] border-2 border-[#B8944E] ring-2 ring-[#B8944E]/20"
                    : "text-[#706C7D] hover:text-[#252331] hover:bg-[#FAF9FC]"
                }`}
              >
                Active ({activeStoriesCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === "done" ? "all" : "done")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  statusFilter === "done"
                    ? "bg-emerald-100 text-emerald-800 border-2 border-emerald-500/70 ring-2 ring-emerald-500/20"
                    : "text-[#706C7D] hover:text-[#252331] hover:bg-[#FAF9FC]"
                }`}
              >
                Done ({doneStoriesCount})
              </button>
            </div>

            {/* Segmented Quick Fold / Expand Controls - 50/50 balanced grid on mobile */}
            <div className="grid grid-cols-2 sm:inline-flex items-center rounded-xl border border-[rgba(74,61,100,0.11)] bg-white/80 p-0.5 text-xs shrink-0 shadow-2xs w-full sm:w-auto">
              <button
                type="button"
                onClick={foldAllEpics}
                className="flex items-center justify-center gap-1 rounded-lg py-1.5 sm:px-2.5 sm:py-1 text-xs sm:text-[11px] font-medium text-[#706C7D] hover:text-[#252331] hover:bg-[#FAF9FC] transition cursor-pointer whitespace-nowrap"
                title="Collapse all epics"
              >
                <ChevronUp size={13} className="shrink-0" />
                <span>Fold all</span>
              </button>
              <button
                type="button"
                onClick={expandAllEpics}
                className="flex items-center justify-center gap-1 rounded-lg py-1.5 sm:px-2.5 sm:py-1 text-xs sm:text-[11px] font-medium text-[#706C7D] hover:text-[#252331] hover:bg-[#FAF9FC] transition cursor-pointer whitespace-nowrap"
                title="Expand all epics"
              >
                <ChevronDown size={13} className="shrink-0" />
                <span>Expand all</span>
              </button>
            </div>
          </div>

          <span className="text-[11px] sm:text-xs text-[#706C7D] shrink-0">
            {stories.length} {stories.length === 1 ? "story" : "stories"} total
          </span>
        </div>

        {/* Super Admin Split View: Epics/Stories on Left, Story Document Inspector on Right */}
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1.9fr] items-start w-full min-w-0">
          {/* Left Column: Epics and Stories List */}
          <div className="space-y-6 w-full min-w-0">
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
            ) : filteredStories.length === 0 && statusFilter !== "all" ? (
              <div className="rounded-[18px] border border-dashed border-[rgba(74,61,100,0.12)] bg-white/80 backdrop-blur-[16px] p-8 sm:p-12 text-center shadow-[0_8px_30px_rgba(70,55,95,0.04)]">
                <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-[rgba(184,148,78,0.10)] text-[#B8944E] mb-3 shadow-sm border border-[rgba(184,148,78,0.15)]">
                  <Filter size={18} />
                </div>
                <h4 className="text-sm font-semibold text-[#252331]">
                  No {getStoryStatusLabel(statusFilter)} stories found
                </h4>
                <p className="mt-1 text-xs text-[#706C7D] max-w-xs mx-auto leading-relaxed">
                  There are currently no stories matching the &ldquo;{getStoryStatusLabel(statusFilter)}&rdquo; status in this project.
                </p>
                <div className="mt-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setStatusFilter("all")}
                  >
                    Show all stories ({totalStoriesCount})
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {visibleEpics.map((epic) => {
                  const epicStories = sortStories(filteredStories.filter((s) => s.epic_id === epic.id));
                  const doneCount = epicStories.filter((s) => normalizeStoryStatus(s.status) === "done").length;
                  const activeCount = epicStories.filter((s) => normalizeStoryStatus(s.status) === "active").length;
                  const approvedCount = epicStories.filter((s) => s.status === "approved" || s.team_review_status === "approved").length;
                  const changesCount = epicStories.filter((s) => s.status === "changes_requested").length;
                  const epicNotes = notes.filter((n) => n.epic_id === epic.id && n.status !== "archived");

                  return (
                    <EpicFolder
                      key={epic.id}
                      id={epic.id}
                      name={epic.name}
                      description={epic.description}
                      creatorName={projectTeamMembers.find(tm => tm.id === epic.created_by_id)?.name || undefined}
                      storyCount={epicStories.length}
                      isExpanded={expandedEpicIds.has(epic.id)}
                      onToggle={() => toggleEpic(epic.id)}
                      headerExtra={
                        <span className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-medium flex-wrap">
                          <span className="text-[rgba(74,61,100,0.2)]">•</span>
                          <span className="text-[#2E8B70]">{approvedCount} approved</span>
                          {changesCount > 0 && (
                            <>
                              <span className="text-[rgba(74,61,100,0.2)]">•</span>
                              <span className="text-[#C25D72]">{changesCount} changes</span>
                            </>
                          )}
                          {epicNotes.length > 0 && (
                            <>
                              <span className="text-[rgba(74,61,100,0.2)]">•</span>
                              <span className="text-[#80642F] font-semibold">
                                {epicNotes.length} {epicNotes.length === 1 ? "note" : "notes"}
                              </span>
                            </>
                          )}
                        </span>
                      }
                      actions={
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <div className="flex items-center gap-1 sm:gap-1.5">
                            <Button
                              variant="secondary"
                              size="sm"
                              leftIcon={<FileText size={12} className="text-[#80642F]" />}
                              onClick={() => setActiveEpicForNotes(epic)}
                              className="text-xs px-2 sm:px-3 h-7 sm:h-8"
                              title={`Discussion and meeting notes for ${epic.name}`}
                            >
                              <span>Notes</span>
                              {epicNotes.length > 0 && (
                                <span className="ml-1 rounded-full bg-[rgba(184,148,78,0.18)] px-1.5 py-0.2 text-[10px] font-bold text-[#80642F]">
                                  {epicNotes.length}
                                </span>
                              )}
                            </Button>

                            <Button
                              variant="secondary"
                              size="sm"
                              leftIcon={<Sparkles size={12} className="text-[#B8944E]" />}
                              onClick={() => setGeneratingEpicId(epic.id)}
                              className="text-xs px-2 sm:px-2.5 h-7 sm:h-8"
                              title="Generate stories with AI"
                            >
                              <span className="hidden sm:inline">Generate</span>
                            </Button>

                            <DropdownMenu
                              ariaLabel={`Actions for ${epic.name}`}
                              items={[
                                {
                                  label: "Epic Notes",
                                  icon: <FileText size={14} />,
                                  onClick: () => setActiveEpicForNotes(epic),
                                },
                                {
                                  label: "Generate AI Prompt",
                                  icon: <Code2 size={14} />,
                                  onClick: () => setEpicPromptTarget(epic),
                                },
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
                          </div>
                          <Link
                            href={`/team/epics/${epic.id}/discussion`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-50 transition"
                          >
                            <MessageSquare size={13} className="text-[#80642F]" />
                            <span>Discussion</span>
                          </Link>
                        </div>
                      }
                      emptyMessage={statusFilter !== "all" ? `No ${getStoryStatusLabel(statusFilter).toLowerCase()} stories in this Epic.` : "No stories in this Epic yet."}
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
                    isExpanded={expandedEpicIds.has("uncategorized")}
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
                ? "max-lg:fixed max-lg:inset-0 max-lg:z-40 max-lg:overflow-y-auto max-lg:bg-[#FAF9FC] max-lg:p-3.5 sm:max-lg:p-6 max-lg:pb-20 lg:sticky lg:top-[5.25rem] lg:self-start lg:max-h-[calc(100vh-6.75rem)] lg:overflow-y-auto lg:overscroll-contain pr-1 z-10 animate-in fade-in max-lg:slide-in-from-bottom-4 duration-200"
                : "hidden lg:block lg:sticky lg:top-[5.25rem] lg:self-start z-10"
            }
          >
            {editingStory ? (
              <div className="space-y-3 pb-16 lg:pb-24">
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
                  onFeedbackChange={handleFeedbackChange}
                  onStatusChange={(newStatus) => handleStoryStatusChange(editingStory.id, newStatus)}
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
          </>
        )}
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

          {/* Story Status */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5] mb-1.5">
              Status
            </label>
            <div className="flex gap-2">
              {(["new", "active", "done"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setManualStoryStatus(st)}
                  className={`flex-1 py-1.5 px-3 rounded-xl border text-xs font-semibold capitalize transition cursor-pointer ${
                    manualStoryStatus === st
                      ? st === "new"
                        ? "border-sky-200 bg-sky-50 text-sky-800 ring-1 ring-sky-500/20"
                        : st === "active"
                        ? "border-[rgba(184,148,78,0.30)] bg-[rgba(184,148,78,0.10)] text-[#80642F] ring-1 ring-[#B8944E]/20"
                        : "border-[rgba(46,139,112,0.30)] bg-[rgba(46,139,112,0.10)] text-[#2E8B70] ring-1 ring-[#2E8B70]/20"
                      : "border-[#EBE7F2] bg-white text-[#706C7D] hover:bg-[#FAF9FC]"
                  }`}
                >
                  {st === "new" ? "New" : st === "active" ? "Active" : "Done"}
                </button>
              ))}
            </div>
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

      {/* Ai Epic Agent Prompt Modal */}
      {epicPromptTarget && (
        <AiEpicAgentPromptModal
          isOpen={true}
          onClose={() => setEpicPromptTarget(null)}
          epic={epicPromptTarget}
          stories={sortStories(stories.filter(s => s.epic_id === epicPromptTarget.id))}
        />
      )}

      {/* Epic Notes Modal */}
      {activeEpicForNotes && (
        <EpicNotesModal
          isOpen={Boolean(activeEpicForNotes)}
          onClose={() => setActiveEpicForNotes(null)}
          epic={activeEpicForNotes}
          projectId={project.id}
          notes={notes}
          onNotesChange={(updatedNotes) => setNotes(updatedNotes)}
        />
      )}
    </div>
  );
}

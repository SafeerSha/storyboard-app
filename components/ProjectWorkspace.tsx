"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code2,
  Copy,
  Edit2,
  ExternalLink,
  Layers,
  Plus,
  Sparkles,
  Trash2,
  MessageSquare,
  FileText,
  Filter,
  CheckSquare,
  LayoutGrid,
  X,
} from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { AiEpicAgentPromptModal } from "@/components/epics/AiEpicAgentPromptModal";
import { GenerateStoriesModal } from "@/components/GenerateStoriesModal";
import { StoryEditor } from "@/components/StoryEditor";
import { StoryCard } from "@/components/StoryCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/lib/toast";
import type { Story, Epic, StoryStatus, ProjectNote, StoryLifecycleStatus } from "@/lib/types";
import { normalizeStoryStatus, getStoryStatusLabel } from "@/lib/types";
import { EpicFolder } from "@/components/epics/EpicFolder";
import { EpicFeedbackThread } from "@/components/epics/EpicFeedbackThread";
import { EpicKanbanBoard } from "@/components/epics/EpicKanbanBoard";
import { useRequirementsViewPreference } from "@/hooks/useRequirementsViewPreference";
import type { EpicKanbanStatus, EpicStatus, EpicPriority } from "@/lib/types/epic";
import { getEpicStatusLabel, extractEpicPriority, cleanEpicDescription } from "@/lib/types/epic";
import { Textarea } from "@/components/ui/Textarea";
import { sortEpics, sortStories } from "@/lib/epic-story-utils";
import { ProjectNotesWorkspace } from "@/components/notes/ProjectNotesWorkspace";
import { EpicNotesModal } from "@/components/notes/EpicNotesModal";
import { TasksWorkspace } from "@/components/tasks/TasksWorkspace";
import { TaskModal } from "@/components/tasks/TaskModal";
import type { Task } from "@/lib/types/task";

type ProjectWorkspaceProps = {
  projectId: string;
  projectName: string;
  projectDescription?: string;
  projectStatus?: string;
  initialStories: Story[];
  initialEpics: Epic[];
  initialNotes?: ProjectNote[];
  viewerId?: string;
  viewerType?: "freelancer" | "client" | "team_user";
};


export function ProjectWorkspace({
  projectId,
  projectName,
  projectDescription,
  projectStatus = "active",
  initialStories,
  initialEpics,
  initialNotes,
  viewerId,
  viewerType = "freelancer",
}: ProjectWorkspaceProps) {
  const [stories, setStories] = useState<Story[]>(initialStories);
  const [epics, setEpics] = useState<Epic[]>(initialEpics);
  const [notes, setNotes] = useState<ProjectNote[]>(initialNotes || []);
  const [activeTab, setActiveTab] = useState<"hierarchy" | "tasks" | "notes">("hierarchy");
  const [feedbackCounts, setFeedbackCounts] = useState<Record<string, number>>({});
  const [projectTeamMembers, setProjectTeamMembers] = useState<
    Array<{ id: string; name: string; username: string; role?: string }>
  >([]);
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [storyTaskModalOpen, setStoryTaskModalOpen] = useState(false);
  const [storyForTask, setStoryForTask] = useState<Story | null>(null);

  const [generatingEpicId, setGeneratingEpicId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Story | null>(null);
  const [activeEpicForNotes, setActiveEpicForNotes] = useState<Epic | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  const handleNoteConversionComplete = useCallback(
    (result: { epic: Epic; stories: Story[]; note: ProjectNote }) => {
      // 1. Insert or update the Epic
      setEpics((prev) => {
        const exists = prev.some((e) => e.id === result.epic.id);
        if (exists) {
          return prev.map((e) => (e.id === result.epic.id ? result.epic : e));
        }
        return [result.epic, ...prev];
      });

      // 2. Insert newly generated stories
      if (result.stories && result.stories.length > 0) {
        setStories((prev) => [...result.stories, ...prev]);
        if (result.stories[0]) {
          setEditing(result.stories[0]);
        }
      }

      // 3. Update notes
      setNotes((prev) =>
        prev.map((n) => (n.id === result.note.id ? result.note : n))
      );

      // 4. Ensure newly converted Epic is unfolded and selected in filter
      setCollapsedEpicIds((prev) => ({
        ...prev,
        [result.epic.id]: false,
      }));
      setEpicFilter("all");

      // 5. Navigate to hierarchy view
      setActiveTab("hierarchy");
      toast.success(`Successfully converted note into Epic "${result.epic.name}"!`);
    },
    []
  );


  // Requirements Hierarchy view toggle state (persisted per session)
  const [requirementsView, setRequirementsView] = useRequirementsViewPreference("hierarchy");

  // Epic creation/editing state
  const [epicModalOpen, setEpicModalOpen] = useState(false);
  const [editingEpic, setEditingEpic] = useState<Epic | null>(null);
  const [epicForm, setEpicForm] = useState<{
    name: string;
    description: string;
    status: EpicStatus;
    priority: EpicPriority;
  }>({ name: "", description: "", status: "backlog", priority: "medium" });
  const [aiCorrecting, setAiCorrecting] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[] | null>(null);
  const [aiError, setAiError] = useState("");

  const [epicFilter, setEpicFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "changes" | StoryLifecycleStatus>("all");
  const [collapsedEpicIds, setCollapsedEpicIds] = useState<Record<string, boolean>>({});

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

  // ConfirmDialog states for deletions
  const [deletingStoryId, setDeletingStoryId] = useState<string | null>(null);
  const [deletingEpicItem, setDeletingEpicItem] = useState<Epic | null>(null);
  const [epicPromptTarget, setEpicPromptTarget] = useState<Epic | null>(null);

  const loadProjectTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks?projectId=${projectId}`);
      const data = await res.json();
      if (data.tasks) {
        setProjectTasks(data.tasks);
      }
    } catch (err) {
      console.error("Failed to load project tasks:", err);
    }
  }, [projectId]);

  useEffect(() => {
    loadProjectTasks();
  }, [loadProjectTasks]);

  const taskCountsByStory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of projectTasks) {
      if (t.story_id) {
        map[t.story_id] = (map[t.story_id] || 0) + 1;
      }
    }
    return map;
  }, [projectTasks]);

  const completedTaskCountsByStory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of projectTasks) {
      if (t.story_id && t.status === "done") {
        map[t.story_id] = (map[t.story_id] || 0) + 1;
      }
    }
    return map;
  }, [projectTasks]);

  const loadFeedbackCounts = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/feedback-counts`);
      if (res.ok) {
        const data = await res.json();
        if (data.counts) setFeedbackCounts(data.counts);
      }
    } catch {
      // Silently catch
    }
    
    try {
      const res = await fetch(`/api/projects/${projectId}/team-members?forReviewers=false`);
      if (res.ok) {
        const data = await res.json();
        if (data.teamMembers) setProjectTeamMembers(data.teamMembers);
      }
    } catch {
      // Silently catch
    }
  }, [projectId]);

  const reloadStories = useCallback(async () => {
    try {
      const res = await fetch(`/api/stories?projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.stories) setStories(data.stories);
      }
    } catch {
      // Silently catch
    }
  }, [projectId]);

  const handleFeedbackChange = useCallback((updatedStoryId?: string, newStatus?: StoryStatus) => {
    loadFeedbackCounts();
    if (updatedStoryId && newStatus) {
      setStories((prev) =>
        prev.map((s) => (s.id === updatedStoryId ? { ...s, status: newStatus } : s))
      );
      setEditing((prev: any) =>
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

  useEffect(() => {
    setStories(initialStories);
    setEpics(initialEpics);
    if (initialNotes) setNotes(initialNotes);
    loadFeedbackCounts();
  }, [initialStories, initialEpics, initialNotes, loadFeedbackCounts]);


  // Support direct deep-linking to a specific story via query params (?story=id or ?storyId=id)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const targetStoryId = params.get("story") || params.get("storyId");
    if (targetStoryId && stories.length > 0) {
      const found = stories.find(
        (s) => s.id === targetStoryId || s.id.startsWith(targetStoryId) || targetStoryId.startsWith(s.id)
      );
      if (found) {
        setEditing(found);
        if (found.epic_id) {
          setCollapsedEpicIds((prev) => ({ ...prev, [found.epic_id!]: false }));
        }
      }
    }
  }, [stories]);

  // Prevent background scroll bleed when full-screen story inspector is open on mobile
  useEffect(() => {
    if (!editing) return;
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [editing]);

  // Story Actions
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
      setEditing((prev: any) => (prev && prev.id === storyId ? data.story : prev));
      loadFeedbackCounts();
      toast.success(`Story status updated to ${getStoryStatusLabel(newStatus)}`);
    } catch (e: any) {
      toast.error(e.message || "Unable to update story status");
      throw e;
    }
  }

  async function updateStory(id: string, updates: Partial<Story>) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/stories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update story");
      setStories((v) => v.map((s) => (s.id === id ? data.story : s)));
      setEditing(null);
      toast.success("Story updated successfully");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update story";
      setError(msg);
      toast.error("Unable to update story");
    } finally {
      setLoading(false);
    }
  }

  function deleteStory(id: string) {
    setDeletingStoryId(id);
  }

  async function confirmDeleteStory() {
    if (!deletingStoryId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/stories/${deletingStoryId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete story");
      }
      setStories((v) => v.filter((s) => s.id !== deletingStoryId));
      setEditing(null);
      toast.success("Story deleted");
      setDeletingStoryId(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete story";
      setError(msg);
      toast.error("Unable to delete story");
    } finally {
      setLoading(false);
    }
  }

  // Epic Actions
  async function saveEpic() {
    if (!epicForm.name.trim()) return;
    setLoading(true);
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
        const res = await fetch(`/api/epics`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...epicForm, projectId }),
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
      setLoading(false);
    }
  }

  function deleteEpic(id: string) {
    if (stories.some((s) => s.epic_id === id)) {
      toast.warning("Cannot delete an Epic that contains stories. Please delete or reassign its stories first.");
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

  function openCreateEpic(name = "", defaultStatus: EpicStatus = "backlog") {
    setEpicForm({ name, description: "", status: defaultStatus, priority: "medium" });
    setEditingEpic(null);
    setAiSuggestions(null);
    setAiError("");
    setEpicModalOpen(true);
  }

  function openEditEpic(epic: Epic) {
    setEditingEpic(epic);
    setEpicForm({
      name: epic.name,
      description: cleanEpicDescription(epic.description),
      status: epic.status || "backlog",
      priority: extractEpicPriority(epic),
    });
    setAiSuggestions(null);
    setAiError("");
    setEpicModalOpen(true);
  }

  async function handleEpicStatusChange(epicId: string, newStatus: EpicKanbanStatus) {
    const previousEpics = epics;
    // Optimistic UI update
    setEpics((prev) =>
      prev.map((e) => (e.id === epicId ? { ...e, status: newStatus } : e))
    );
    try {
      const res = await fetch(`/api/epics/${epicId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update Epic status");
      setEpics((prev) =>
        prev.map((e) => (e.id === epicId ? { ...e, ...data } : e))
      );
      toast.success(`Epic moved to ${getEpicStatusLabel(newStatus)}`);
    } catch (err) {
      setEpics(previousEpics);
      const msg = err instanceof Error ? err.message : "Failed to update status";
      setError(msg);
      toast.error("Unable to update epic status");
    }
  }

  async function handleEpicPriorityChange(epicId: string, newPriority: EpicPriority) {
    const previousEpics = epics;
    // Optimistic UI update
    setEpics((prev) =>
      prev.map((e) => (e.id === epicId ? { ...e, priority: newPriority } : e))
    );
    try {
      const res = await fetch(`/api/epics/${epicId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: newPriority }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update Epic priority");
      setEpics((prev) =>
        prev.map((e) => (e.id === epicId ? { ...e, ...data, priority: newPriority } : e))
      );
      toast.success(`Priority updated to ${newPriority.toUpperCase()}`);
    } catch (err) {
      setEpics(previousEpics);
      const msg = err instanceof Error ? err.message : "Failed to update priority";
      setError(msg);
      toast.error("Unable to update epic priority");
    }
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

  function handleCopyClientLink() {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/login`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    toast.success("Portal link copied");
  }

  // Progress metrics
  const totalStoriesCount = stories.length;
  const newStoriesCount = stories.filter((s) => normalizeStoryStatus(s.status) === "new").length;
  const activeStoriesCount = stories.filter((s) => normalizeStoryStatus(s.status) === "active").length;
  const doneStoriesCount = stories.filter((s) => normalizeStoryStatus(s.status) === "done").length;
  const approvedStoriesCount = stories.filter((s) => s.status === "approved" || s.client_review_status === "approved").length;
  const changesRequestedCount = stories.filter((s) => s.status === "changes_requested").length;

  const progressPercent = totalStoriesCount
    ? Math.round((doneStoriesCount / totalStoriesCount) * 100)
    : 0;

  const statusFilterLabel = statusFilter === "all" ? "All" : statusFilter === "changes" ? "Changes Requested" : getStoryStatusLabel(statusFilter);

  const sortedEpics = useMemo(() => sortEpics(epics), [epics]);
  const filteredEpics = useMemo(
    () => (epicFilter === "all" ? sortedEpics : sortedEpics.filter((e) => e.id === epicFilter)),
    [sortedEpics, epicFilter]
  );
  const filteredStories = useMemo(() => {
    if (statusFilter === "all") return stories;
    if (statusFilter === "changes") return stories.filter((s) => s.status === "changes_requested");
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
    <div className="w-full min-w-0 max-w-full overflow-x-hidden">
      <DashboardHeader
        eyebrow="PROJECT"
        title={projectName}
        description={projectDescription}
        badge={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {projectStatus ? projectStatus.charAt(0).toUpperCase() + projectStatus.slice(1) : "Active"}
          </span>
        }
        backHref="/projects"
        backLabel="Projects"
        actions={
          <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
            <Button
              variant="secondary"
              className="flex-1 sm:flex-initial h-9 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm justify-center whitespace-nowrap shadow-2xs"
              leftIcon={copiedLink ? <Check size={13} className="text-emerald-600 shrink-0" /> : <Copy size={13} className="shrink-0" />}
              onClick={handleCopyClientLink}
              title="Share client portal link"
            >
              <span className="hidden sm:inline">{copiedLink ? "Link copied" : "Share client portal"}</span>
              <span className="sm:hidden">{copiedLink ? "Copied" : "Share"}</span>
            </Button>
            <Button
              variant="primary"
              className="flex-1 sm:flex-initial h-9 sm:h-10 px-3.5 sm:px-4 text-xs sm:text-sm justify-center whitespace-nowrap font-semibold shadow-2xs"
              leftIcon={<Plus size={13} className="shrink-0" />}
              onClick={() => openCreateEpic()}
            >
              Add Epic
            </Button>
          </div>
        }
      />

      <main className="w-full min-w-0 mx-auto max-w-[1720px] px-4 py-4 sm:px-6 sm:py-8 lg:px-8 space-y-4 sm:space-y-6 pb-32">
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
              <span className="hidden sm:inline">{epics.length} Epics • {totalStoriesCount} Stories</span>
              <span className="sm:hidden">{epics.length}E • {totalStoriesCount}S</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("tasks")}
            className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-xl transition cursor-pointer whitespace-nowrap ${
              activeTab === "tasks"
                ? "bg-white text-[#252331] shadow-2xs border border-[rgba(74,61,100,0.12)]"
                : "text-[#706C7D] hover:text-[#252331] hover:bg-white/60"
            }`}
          >
            <CheckSquare size={14} className={activeTab === "tasks" ? "text-[#B8944E]" : "text-[#9994A5]"} />
            <span className="hidden sm:inline">To-Do Tasks</span>
            <span className="sm:hidden">Tasks</span>
            {projectTasks.length > 0 && (
              <span className="rounded-full bg-[rgba(184,148,78,0.10)] px-1.5 sm:px-2 py-0.5 text-[10px] font-bold text-[#80642F]">
                {projectTasks.length}
              </span>
            )}
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

        {activeTab === "tasks" ? (
          <TasksWorkspace
            fixedProjectId={projectId}
            fixedProjectName={projectName}
            initialTasks={projectTasks}
          />
        ) : activeTab === "notes" ? (
          <ProjectNotesWorkspace
            projectId={projectId}
            epics={epics}
            initialNotes={notes}
            onConversionComplete={handleNoteConversionComplete}
            onNavigateToEpic={(epicId) => {
              setActiveTab("hierarchy");
              setCollapsedEpicIds((prev) => ({ ...prev, [epicId]: false }));
              setEpicFilter("all");
            }}
          />
        ) : (
          <>
        {/* Optimized Requirements Hierarchy Control Panel */}
        <div className="w-full rounded-[18px] border border-[rgba(74,61,100,0.08)] bg-white/88 p-4 sm:p-5 shadow-[0_8px_30px_rgba(70,55,95,0.055)] backdrop-blur-[16px] space-y-4">

          {/* Header Row: Title, Epic/Story counts, and Status Breakdown Pills */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-[#252331]">
                  Requirements Hierarchy
                </h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(184,148,78,0.10)] px-2.5 py-0.5 text-xs font-semibold text-[#80642F] border border-[rgba(184,148,78,0.20)]">
                  <Layers size={12} />
                  <span>{epics.length} {epics.length === 1 ? "Epic" : "Epics"}</span>
                  <span className="text-[rgba(128,100,47,0.35)]">•</span>
                  <span>{totalStoriesCount} Stories</span>
                </span>
              </div>
              <p className="mt-1 text-xs text-[#706C7D] leading-relaxed">
                Epics group focused product areas. Stories contain criteria and client discussions.
              </p>
            </div>

            {/* View Toggle & Status Breakdown Pills */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
              {/* Requirements View Toggle (Hierarchy vs Kanban Board) */}
              <div
                id="requirements-view-toggle"
                className="relative z-10 inline-flex items-center rounded-xl border border-[rgba(74,61,100,0.12)] bg-[#FAF9FC] p-1 shadow-2xs shrink-0 self-start sm:self-auto"
              >
                <button
                  type="button"
                  onClick={() => setRequirementsView("hierarchy")}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                    requirementsView === "hierarchy"
                      ? "bg-white text-[#252331] shadow-xs border border-[rgba(74,61,100,0.12)]"
                      : "text-[#706C7D] hover:text-[#252331]"
                  }`}
                  title="Standard Hierarchy View"
                >
                  <Layers size={13} className={requirementsView === "hierarchy" ? "text-[#B8944E]" : "text-[#9994A5]"} />
                  <span>Hierarchy</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRequirementsView("kanban")}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                    requirementsView === "kanban"
                      ? "bg-white text-[#252331] shadow-xs border border-[rgba(74,61,100,0.12)]"
                      : "text-[#706C7D] hover:text-[#252331]"
                  }`}
                  title="Kanban Board View"
                >
                  <LayoutGrid size={13} className={requirementsView === "kanban" ? "text-[#B8944E]" : "text-[#9994A5]"} />
                  <span>Kanban</span>
                </button>
              </div>

              {/* Status Breakdown Pills (Clickable filter controls - 4-column balanced grid on mobile) */}
              <div className="grid grid-cols-4 sm:flex items-center gap-1.5 sm:gap-2 text-xs w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className={`flex items-center justify-center gap-1 sm:gap-1.5 rounded-lg px-1.5 sm:px-2.5 py-1.5 sm:py-1 font-semibold transition cursor-pointer shadow-2xs text-center ${
                    statusFilter === "all"
                      ? "bg-[#252331] text-white shadow-xs"
                      : "bg-[#FAF9FC] text-[#706C7D] border border-[rgba(74,61,100,0.12)] hover:text-[#252331] hover:bg-white"
                  }`}
                  title="Show all stories"
                >
                  <span>All ({totalStoriesCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === "new" ? "all" : "new")}
                  className={`flex items-center justify-center gap-1 sm:gap-1.5 rounded-lg px-1 sm:px-2.5 py-1.5 sm:py-1 font-semibold transition cursor-pointer shadow-2xs text-center ${
                    statusFilter === "new"
                      ? "bg-sky-100 text-sky-800 border-2 border-sky-500/70 ring-2 ring-sky-500/20"
                      : "bg-sky-50 text-sky-700 border border-sky-200/80 hover:bg-sky-100/60"
                  }`}
                  title="Filter by New status"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500 shrink-0" />
                  <span className="truncate">{newStoriesCount} New</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === "active" ? "all" : "active")}
                  className={`flex items-center justify-center gap-1 sm:gap-1.5 rounded-lg px-1 sm:px-2.5 py-1.5 sm:py-1 font-semibold transition cursor-pointer shadow-2xs text-center ${
                    statusFilter === "active"
                      ? "bg-[rgba(184,148,78,0.22)] text-[#80642F] border-2 border-[#B8944E] ring-2 ring-[#B8944E]/20"
                      : "bg-[rgba(184,148,78,0.10)] text-[#80642F] border border-[rgba(184,148,78,0.20)] hover:bg-[rgba(184,148,78,0.16)]"
                  }`}
                  title="Filter by Active status"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#B8944E] shrink-0" />
                  <span className="truncate">{activeStoriesCount} Act.</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === "done" ? "all" : "done")}
                  className={`flex items-center justify-center gap-1 sm:gap-1.5 rounded-lg px-1 sm:px-2.5 py-1.5 sm:py-1 font-semibold transition cursor-pointer shadow-2xs text-center ${
                    statusFilter === "done"
                      ? "bg-emerald-100 text-emerald-800 border-2 border-emerald-500/70 ring-2 ring-emerald-500/20"
                      : "bg-emerald-50/90 text-emerald-700 border border-emerald-200/70 hover:bg-emerald-100/60"
                  }`}
                  title="Filter by Done status"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="truncate">{doneStoriesCount} Done</span>
                </button>
                {changesRequestedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setStatusFilter(statusFilter === "changes" ? "all" : "changes")}
                    className={`col-span-4 sm:col-auto inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold text-rose-700 border border-rose-200/70 shadow-2xs ${
                      statusFilter === "changes"
                        ? "bg-rose-100 border-2 border-rose-500/70 ring-2 ring-rose-500/20"
                        : "bg-rose-50/90 hover:bg-rose-100/60"
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                    {changesRequestedCount} Changes Requested
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Integrated Action & Progress Row */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-[rgba(74,61,100,0.06)]">
            {/* Inline Sign-off Progress Bar */}
            <div className="flex items-center gap-3 w-full lg:max-w-md min-w-0">
              <span className="text-xs font-semibold text-[#252331] shrink-0">
                Client Sign-off:
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[rgba(74,61,100,0.07)]">
                <div
                  className="h-full rounded-full bg-[#B8944E] transition-all duration-500 shadow-2xs"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs font-bold text-[#80642F] shrink-0 min-w-[2.5rem] text-right font-mono">
                {progressPercent}%
              </span>
            </div>

            {/* Filter & Quick Folding Controls - Full width 2-column grids on mobile */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full lg:w-auto">
              {/* Epic & Status Dropdowns in equal 2-column grid on mobile */}
              <div className="grid grid-cols-2 gap-2 flex-1 sm:flex-initial">
                <div className="flex items-center gap-1.5 bg-[#FAF9FC] border border-[rgba(74,61,100,0.12)] rounded-xl px-2.5 h-8.5 shadow-2xs min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#9994A5] shrink-0">
                    Epic:
                  </span>
                  <select
                    value={epicFilter}
                    onChange={(e) => setEpicFilter(e.target.value)}
                    className="w-full bg-transparent text-xs font-medium text-[#252331] outline-none truncate cursor-pointer"
                  >
                    <option value="all">All Epics ({epics.length})</option>
                    {epics.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5 bg-[#FAF9FC] border border-[rgba(74,61,100,0.12)] rounded-xl px-2.5 h-8.5 shadow-2xs min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#9994A5] shrink-0">
                    Status:
                  </span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="w-full bg-transparent text-xs font-medium text-[#252331] outline-none truncate cursor-pointer"
                  >
                    <option value="all">All Statuses ({totalStoriesCount})</option>
                    <option value="new">New ({newStoriesCount})</option>
                    <option value="active">Active ({activeStoriesCount})</option>
                    <option value="done">Done ({doneStoriesCount})</option>
                  </select>
                </div>
              </div>

              {/* Segmented Quick Fold / Expand Controls - 50/50 balanced grid on mobile */}
              <div className="grid grid-cols-2 sm:inline-flex items-center rounded-xl border border-[rgba(74,61,100,0.12)] bg-[#FAF9FC] p-0.5 text-xs shadow-2xs shrink-0 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={foldAllEpics}
                  className="flex items-center justify-center gap-1 rounded-lg py-1.5 sm:px-2.5 sm:py-1 text-xs sm:text-[11px] font-medium text-[#706C7D] hover:text-[#252331] hover:bg-white transition cursor-pointer whitespace-nowrap"
                  title="Collapse all epics"
                >
                  <ChevronUp size={13} className="shrink-0" />
                  <span>Fold all</span>
                </button>
                <button
                  type="button"
                  onClick={expandAllEpics}
                  className="flex items-center justify-center gap-1 rounded-lg py-1.5 sm:px-2.5 sm:py-1 text-xs sm:text-[11px] font-medium text-[#706C7D] hover:text-[#252331] hover:bg-white transition cursor-pointer whitespace-nowrap"
                  title="Expand all epics"
                >
                  <ChevronDown size={13} className="shrink-0" />
                  <span>Expand all</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200/80 bg-rose-50/80 p-4 text-xs sm:text-sm text-[#C25D72]">
            {error}
          </div>
        )}

        {/* Requirements Hierarchy Layout: Kanban Board View vs Standard Split Hierarchy View */}
        {requirementsView === "kanban" ? (
          <div className="w-full min-w-0 transition-opacity duration-200 animate-in fade-in">
            <EpicKanbanBoard
              epics={epics}
              stories={stories}
              onEditEpic={openEditEpic}
              onDeleteEpic={deleteEpic}
              onAddStory={(epicId) => {
                setGeneratingEpicId(epicId);
              }}
              onStatusChange={handleEpicStatusChange}
              onPriorityChange={handleEpicPriorityChange}
              onCreateEpicInStatus={(status) => openCreateEpic("", status)}
              onNavigateToEpic={(epicId) => {
                setRequirementsView("hierarchy");
                setCollapsedEpicIds((prev) => ({ ...prev, [epicId]: false }));
                setEpicFilter(epicId);
              }}
            />
          </div>
        ) : (
        /* Split View: Epics/Stories on Left, Story Document Inspector on Right */
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] items-start w-full min-w-0 transition-opacity duration-200 animate-in fade-in">
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
                  No {statusFilterLabel} stories found
                </h4>
                <p className="mt-1 text-xs text-[#706C7D] max-w-xs mx-auto leading-relaxed">
                  There are currently no stories matching the &ldquo;{statusFilterLabel}&rdquo; status in this project.
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
                  const approvedCount = epicStories.filter((s) => s.status === "approved").length;
                  const changesCount = epicStories.filter((s) => s.status === "changes_requested").length;
                  const epicNotes = notes.filter((n) => n.epic_id === epic.id && n.status !== "archived");

                  return (
                    <EpicFolder
                      key={epic.id}
                      id={epic.id}
                      name={epic.name}
                      description={epic.description}
                      status={epic.status}
                      priority={epic.priority}
                      creatorName={projectTeamMembers.find(tm => tm.id === epic.created_by_id)?.name || undefined}
                      storyCount={epicStories.length}
                      isExpanded={!collapsedEpicIds[epic.id]}
                      onToggle={() => toggleEpic(epic.id)}
                      onStatusCycle={(newStatus) => handleEpicStatusChange(epic.id, newStatus)}
                      onPriorityChange={(newPriority) => handleEpicPriorityChange(epic.id, newPriority)}
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
                          {viewerId && (
                            <Link
                              href={`/project/${projectId}/epics/${epic.id}/discussion`}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-50 transition"
                            >
                              <MessageSquare size={13} className="text-[#80642F]" />
                              <span>Discussion</span>
                            </Link>
                          )}
                        </div>
                      }
                      emptyMessage={statusFilter !== "all" ? `No ${statusFilterLabel.toLowerCase()} stories in this Epic.` : "No stories in this Epic yet."}
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
                          isSelected={editing?.id === story.id}
                          openFeedbackCount={feedbackCounts[story.id] || 0}
                          creatorName={projectTeamMembers.find(tm => tm.id === story.created_by_id)?.name}
                          tasksCount={taskCountsByStory[story.id]}
                          completedTasksCount={completedTaskCountsByStory[story.id]}
                          onCreateTask={(s) => {
                            setStoryForTask(s);
                            setStoryTaskModalOpen(true);
                          }}
                          onClick={() => setEditing(story)}
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
                    description="Requirements not assigned to an Epic"
                    storyCount={uncategorizedStories.length}
                    isExpanded={!collapsedEpicIds["uncategorized"]}
                    onToggle={() => toggleEpic("uncategorized")}
                    isUncategorized={true}
                  >
                    {uncategorizedStories.map((story) => (
                      <StoryCard
                        key={story.id}
                        story={story}
                        isSelected={editing?.id === story.id}
                        openFeedbackCount={feedbackCounts[story.id] || 0}
                        creatorName={projectTeamMembers.find(tm => tm.id === story.created_by_id)?.name}
                        tasksCount={taskCountsByStory[story.id]}
                        completedTasksCount={completedTaskCountsByStory[story.id]}
                        onCreateTask={(s) => {
                          setStoryForTask(s);
                          setStoryTaskModalOpen(true);
                        }}
                        onClick={() => setEditing(story)}
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
              editing
                ? "max-lg:fixed max-lg:inset-0 max-lg:z-40 max-lg:overflow-y-auto max-lg:bg-[#FAF9FC] max-lg:p-3.5 sm:max-lg:p-6 max-lg:pb-20 lg:sticky lg:top-[5.25rem] lg:self-start lg:max-h-[calc(100vh-6.75rem)] lg:overflow-y-auto lg:overscroll-contain pr-1 z-10 animate-in fade-in max-lg:slide-in-from-bottom-4 duration-200"
                : "hidden lg:block lg:sticky lg:top-[5.25rem] lg:self-start z-10"
            }
          >
            {editing ? (
              <div className="space-y-3 pb-16 lg:pb-24">
                {/* Mobile Back to Stories Bar */}
                <div className="lg:hidden sticky top-0 z-20 -mx-3.5 -mt-3.5 sm:-mx-6 sm:-mt-6 px-4 py-3 bg-white/95 backdrop-blur-md border-b border-[rgba(74,61,100,0.08)] flex items-center justify-between shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
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
                  story={editing}
                  epics={epics}
                  viewerType="freelancer"
                  isReviewer={true}
                  onCancel={() => setEditing(null)}
                  onFeedbackChange={handleFeedbackChange}
                  onStatusChange={(newStatus) => handleStoryStatusChange(editing.id, newStatus)}
                  onSave={async (updated) => {
                    await updateStory(editing.id, {
                      title: updated.title,
                      description: updated.description,
                      acceptance_criteria: updated.acceptance_criteria,
                      assumptions: updated.assumptions,
                      clarifications: updated.clarifications,
                      raw_requirement: updated.raw_requirement,
                      epic_id: updated.epic_id,
                      reviewer_ids: updated.reviewer_ids,
                      status: updated.status,
                    });
                  }}
                  onCreateEpic={openCreateEpic}
                  onDelete={() => deleteStory(editing.id)}
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
        )}
          </>
        )}
      </main>


      {/* Epic Modal (Create / Edit) */}
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
              form="epic-modal-form"
              isLoading={loading}
              disabled={!epicForm.name.trim()}
            >
              {editingEpic ? "Save changes" : "Create Epic"}
            </Button>
          </>
        }
      >
        <form
          id="epic-modal-form"
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
                className="inline-flex items-center gap-1 text-xs font-medium text-[#80642F] hover:text-[#9F7D3E] disabled:opacity-40 transition"
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
                    className="text-[11px] rounded-md bg-[rgba(184,148,78,0.08)] px-2 py-0.5 text-[#80642F] hover:bg-[rgba(184,148,78,0.15)] transition"
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
            <Textarea
              rows={3}
              value={epicForm.description}
              onChange={(e) =>
                setEpicForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Describe the scope and purpose of this Epic..."
              className="w-full rounded-xl border border-[#EBE7F2] p-3 text-sm text-[#252331] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)] resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5] mb-1.5">
                Status
              </label>
              <select
                value={epicForm.status}
                onChange={(e) =>
                  setEpicForm((prev) => ({ ...prev, status: e.target.value as EpicStatus }))
                }
                className="h-10 w-full rounded-xl border border-[#EBE7F2] bg-white px-3.5 text-sm text-[#252331] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)] cursor-pointer"
              >
                <option value="backlog">Backlog / Pending</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="qa_review">QA / Review</option>
                <option value="done">Done</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5] mb-1.5">
                Priority
              </label>
              <select
                value={epicForm.priority}
                onChange={(e) =>
                  setEpicForm((prev) => ({ ...prev, priority: e.target.value as EpicPriority }))
                }
                className="h-10 w-full rounded-xl border border-[#EBE7F2] bg-white px-3.5 text-sm text-[#252331] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)] cursor-pointer"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>

      {/* AI Generate Stories Modal */}
      {generatingEpicId && (
        <GenerateStoriesModal
          projectId={projectId}
          epicId={generatingEpicId}
          onClose={() => setGeneratingEpicId(null)}
          onStoriesGenerated={(newStories) => {
            setStories((prev) => [...newStories, ...prev]);
            setGeneratingEpicId(null);
            if (newStories[0]) {
              setEditing(newStories[0]);
            }
            toast.success(
              newStories.length > 1
                ? `${newStories.length} stories created successfully`
                : "Story created successfully"
            );
          }}
        />
      )}

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
          projectId={projectId}
          notes={notes}
          onNotesChange={(updatedNotes) => setNotes(updatedNotes)}
        />
      )}

      {/* Story Task Creation Modal */}
      {storyTaskModalOpen && (
        <TaskModal
          isOpen={storyTaskModalOpen}
          onClose={() => {
            setStoryTaskModalOpen(false);
            setStoryForTask(null);
          }}
          onSaved={(newTask) => {
            setProjectTasks((prev) => [newTask, ...prev]);
            toast.success("Task created and linked to story!");
          }}
          onBatchSaved={(newTasks) => {
            setProjectTasks((prev) => [...newTasks, ...prev]);
            toast.success(`${newTasks.length} tasks created and linked to story!`);
          }}
          defaultProjectId={projectId}
          defaultStoryId={storyForTask?.id}
          projects={[{ id: projectId, name: projectName }]}
        />
      )}
    </div>
  );
}

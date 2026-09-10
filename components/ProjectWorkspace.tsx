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
  Copy,
  Edit2,
  ExternalLink,
  Layers,
  Plus,
  Sparkles,
  Trash2,
  MessageSquare,
} from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
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
import type { Story, Epic } from "@/lib/types";
import { EpicFolder } from "@/components/epics/EpicFolder";
import { EpicFeedbackThread } from "@/components/epics/EpicFeedbackThread";
import { VoiceTextarea } from "@/components/ui/VoiceTextarea";
import { sortEpics, sortStories } from "@/lib/epic-story-utils";

type ProjectWorkspaceProps = {
  projectId: string;
  projectName: string;
  projectDescription?: string;
  projectStatus?: string;
  initialStories: Story[];
  initialEpics: Epic[];
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
  viewerId,
  viewerType = "freelancer",
}: ProjectWorkspaceProps) {
  const [stories, setStories] = useState<Story[]>(initialStories);
  const [epics, setEpics] = useState<Epic[]>(initialEpics);
  const [feedbackCounts, setFeedbackCounts] = useState<Record<string, number>>({});
  const [projectTeamMembers, setProjectTeamMembers] = useState<
    Array<{ id: string; name: string; username: string; role?: string }>
  >([]);

  const [generatingEpicId, setGeneratingEpicId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Story | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  // Epic creation/editing state
  const [epicModalOpen, setEpicModalOpen] = useState(false);
  const [editingEpic, setEditingEpic] = useState<Epic | null>(null);
  const [epicForm, setEpicForm] = useState({ name: "", description: "", status: "active" });
  const [aiCorrecting, setAiCorrecting] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[] | null>(null);
  const [aiError, setAiError] = useState("");

  const [epicFilter, setEpicFilter] = useState<string>("all");
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

  useEffect(() => {
    setStories(initialStories);
    setEpics(initialEpics);
    loadFeedbackCounts();
  }, [initialStories, initialEpics, loadFeedbackCounts]);

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
  const approvedStoriesCount = stories.filter((s) => s.status === "approved").length;
  const changesRequestedCount = stories.filter((s) => s.status === "changes_requested").length;
  const draftStoriesCount = stories.filter(
    (s) => !s.status || s.status === "draft" || s.status === "review"
  ).length;

  const progressPercent = totalStoriesCount
    ? Math.round((approvedStoriesCount / totalStoriesCount) * 100)
    : 0;

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
    <div>
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
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <Button
              variant="secondary"
              className="h-8 sm:h-10 px-2.5 sm:px-4 text-xs sm:text-sm"
              leftIcon={copiedLink ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
              onClick={handleCopyClientLink}
              title="Share client portal link"
            >
              <span className="hidden sm:inline">{copiedLink ? "Link copied" : "Share client portal"}</span>
              <span className="sm:hidden">{copiedLink ? "Copied" : "Share portal"}</span>
            </Button>
            <Button
              variant="primary"
              className="h-8 sm:h-10 px-3 sm:px-4 text-xs sm:text-sm"
              leftIcon={<Plus size={13} />}
              onClick={() => openCreateEpic()}
            >
              Add Epic
            </Button>
          </div>
        }
      />

      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8 space-y-5 sm:space-y-6">
        {/* Optimized Requirements Hierarchy Control Panel */}
        <div className="rounded-[18px] border border-[rgba(74,61,100,0.08)] bg-white/88 p-4 sm:p-5 shadow-[0_8px_30px_rgba(70,55,95,0.055)] backdrop-blur-[16px] space-y-4">
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

            {/* Status Breakdown Pills */}
            <div className="flex items-center gap-2 sm:gap-2.5 text-xs flex-wrap shrink-0">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50/90 px-2.5 py-1 font-semibold text-emerald-700 border border-emerald-200/70 shadow-2xs">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {approvedStoriesCount} Approved
              </span>
              {changesRequestedCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50/90 px-2.5 py-1 font-semibold text-rose-700 border border-rose-200/70 shadow-2xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  {changesRequestedCount} Changes Requested
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#FAF9FC] px-2.5 py-1 font-medium text-[#706C7D] border border-[rgba(74,61,100,0.10)] shadow-2xs">
                <span className="h-1.5 w-1.5 rounded-full bg-[#9994A5]" />
                {draftStoriesCount} In Review
              </span>
            </div>
          </div>

          {/* Integrated Action & Progress Row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 pt-3.5 border-t border-[rgba(74,61,100,0.06)]">
            {/* Inline Sign-off Progress Bar */}
            <div className="flex items-center gap-3 flex-1 max-w-md min-w-0">
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

            {/* Filter & Quick Folding Controls */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9994A5] shrink-0">
                  Filter:
                </span>
                <select
                  value={epicFilter}
                  onChange={(e) => setEpicFilter(e.target.value)}
                  className="h-8 rounded-xl border border-[rgba(74,61,100,0.12)] bg-[#FAF9FC] px-2.5 text-xs font-medium text-[#252331] outline-none transition focus:border-[#B8944E] focus:bg-white cursor-pointer shadow-2xs"
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
              <div className="inline-flex items-center rounded-xl border border-[rgba(74,61,100,0.12)] bg-[#FAF9FC] p-0.5 text-xs shrink-0 shadow-2xs">
                <button
                  type="button"
                  onClick={foldAllEpics}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium text-[#706C7D] hover:text-[#252331] hover:bg-white transition cursor-pointer whitespace-nowrap"
                  title="Collapse all epics"
                >
                  <ChevronUp size={12} className="shrink-0" />
                  <span>Fold all</span>
                </button>
                <span className="h-3 w-[1px] bg-[rgba(74,61,100,0.12)] shrink-0" />
                <button
                  type="button"
                  onClick={expandAllEpics}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium text-[#706C7D] hover:text-[#252331] hover:bg-white transition cursor-pointer whitespace-nowrap"
                  title="Expand all epics"
                >
                  <ChevronDown size={12} className="shrink-0" />
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

        {/* Split View: Epics/Stories on Left, Story Document Inspector on Right */}
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] items-start">
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
                  const approvedCount = epicStories.filter((s) => s.status === "approved").length;
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
                      actions={
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-1.5">
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
                          isSelected={editing?.id === story.id}
                          openFeedbackCount={feedbackCounts[story.id] || 0}
                          creatorName={projectTeamMembers.find(tm => tm.id === story.created_by_id)?.name}
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
                ? "max-lg:fixed max-lg:inset-0 max-lg:z-40 max-lg:overflow-y-auto max-lg:bg-[#FAF9FC] max-lg:p-3.5 sm:max-lg:p-6 max-lg:pb-20 lg:sticky lg:top-20 lg:self-start z-10 animate-in fade-in max-lg:slide-in-from-bottom-4 duration-200"
                : "hidden lg:block lg:sticky lg:top-20 lg:self-start z-10"
            }
          >
            {editing ? (
              <div className="space-y-3">
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
                  onFeedbackChange={loadFeedbackCounts}
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
    </div>
  );
}

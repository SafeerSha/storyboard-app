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
  HelpCircle,
  Layers,
  Lock,
  MessageSquare,
  Plus,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { StoryEditor } from "@/components/StoryEditor";
import { ContextualFeedbackThread } from "@/components/ContextualFeedbackThread";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { toast } from "@/lib/toast";
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
  const [activeEpicTab, setActiveEpicTab] = useState<string>("all");
  const [feedbackCounts, setFeedbackCounts] = useState<Record<string, number>>({});
  const [storyThreadsMap, setStoryThreadsMap] = useState<Record<string, FeedbackThread[]>>({});

  // Modals & Editor states
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [showAddStory, setShowAddStory] = useState(false);
  const [targetEpic, setTargetEpic] = useState<Epic | null>(null);
  const [newStoryTitle, setNewStoryTitle] = useState("");
  const [newStoryDesc, setNewStoryDesc] = useState("");
  const [newStoryCriteria, setNewStoryCriteria] = useState<string[]>([]);
  const [newStoryAssumptions, setNewStoryAssumptions] = useState<string[]>([]);
  const [newStoryClarifications, setNewStoryClarifications] = useState<string[]>([]);
  const [titleValidationError, setTitleValidationError] = useState("");
  const [generatingAi, setGeneratingAi] = useState(false);
  const [addingStory, setAddingStory] = useState(false);
  const [addStoryError, setAddStoryError] = useState("");
  const [multiStoryReview, setMultiStoryReview] = useState<Story[] | null>(null);
  const [savingMultiStories, setSavingMultiStories] = useState(false);

  // Reviewer assignment state
  const [projectTeamMembers, setProjectTeamMembers] = useState<
    Array<{ id: string; name: string; username: string }>
  >([]);
  const [newStoryReviewerIds, setNewStoryReviewerIds] = useState<string[]>([
    teamUser.id,
  ]);

  // Epic create/edit modal
  const [showEpicModal, setShowEpicModal] = useState(false);
  const [editingEpic, setEditingEpic] = useState<Epic | null>(null);
  const [epicName, setEpicName] = useState("");
  const [epicDesc, setEpicDesc] = useState("");
  const [savingEpic, setSavingEpic] = useState(false);
  const [epicError, setEpicError] = useState("");
  const [deletingEpicItem, setDeletingEpicItem] = useState<Epic | null>(null);
  const [deletingEpicLoading, setDeletingEpicLoading] = useState(false);

  // Approval state
  const [approvingStoryId, setApprovingStoryId] = useState<string | null>(null);
  const [confirmUnresolved, setConfirmUnresolved] = useState<{
    storyId: string;
    count: number;
  } | null>(null);

  // Collapsed / Expanded stories
  const [expandedStoryIds, setExpandedStoryIds] = useState<Set<string>>(
    () => new Set(initialTargetStoryId ? [initialTargetStoryId] : [])
  );

  // Auto-expand and scroll to target story when opened from Review Queue
  useEffect(() => {
    if (initialTargetStoryId) {
      setExpandedStoryIds((prev) => new Set([...prev, initialTargetStoryId]));
      const timer = setTimeout(() => {
        const el = document.getElementById(`story-${initialTargetStoryId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("ring-2", "ring-[#B8944E]", "ring-offset-2");
          setTimeout(() => {
            el.classList.remove("ring-2", "ring-[#B8944E]", "ring-offset-2");
          }, 3500);
        }
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [initialTargetStoryId]);

  const toggleExpand = (id: string) => {
    setExpandedStoryIds((prev) => {
      if (prev.has(id)) {
        const next = new Set(prev);
        next.delete(id);
        return next;
      }
      return new Set([id]);
    });
  };

  // Open Add Story modal for a specific Epic
  function openAddStoryModal(epic: Epic) {
    setTargetEpic(epic);
    setNewStoryTitle("");
    setNewStoryDesc("");
    setNewStoryCriteria([]);
    setNewStoryAssumptions([]);
    setNewStoryClarifications([]);
    setNewStoryReviewerIds([teamUser.id]);
    setTitleValidationError("");
    setAddStoryError("");
    setMultiStoryReview(null);
    setShowAddStory(true);

    if (projectTeamMembers.length === 0) {
      fetch(`/api/projects/${project.id}/team-members`)
        .then((r) => (r.ok ? r.json() : { teamMembers: [] }))
        .then((d) => {
          if (d.teamMembers) setProjectTeamMembers(d.teamMembers);
        })
        .catch(() => {});
    }
  }

  // Close Add Story modal
  function closeAddStoryModal() {
    setShowAddStory(false);
    setTargetEpic(null);
    setNewStoryTitle("");
    setNewStoryDesc("");
    setNewStoryCriteria([]);
    setNewStoryAssumptions([]);
    setNewStoryClarifications([]);
    setNewStoryReviewerIds([teamUser.id]);
    setTitleValidationError("");
    setAddStoryError("");
    setMultiStoryReview(null);
  }

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
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("storyboard:review-updated"));
      }
      toast.success("Story approved");
    } catch {
      toast.error("Unable to approve story");
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
        toast.success("Epic updated successfully");
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
        toast.success("Epic created successfully");
      }

      setShowEpicModal(false);
      setEditingEpic(null);
      setEpicName("");
      setEpicDesc("");
    } catch (err: any) {
      setEpicError(err.message);
      toast.error(editingEpic ? "Unable to update epic" : "Unable to create epic");
    } finally {
      setSavingEpic(false);
    }
  }

  // Handle Delete Epic request
  function handleDeleteEpic(epicId: string) {
    const count = stories.filter((s) => s.epic_id === epicId).length;
    if (count > 0) {
      toast.warning("Cannot delete an Epic that contains stories. Please delete or reassign its stories first.");
      return;
    }

    const target = epics.find((e) => e.id === epicId);
    if (target) {
      setDeletingEpicItem(target);
    }
  }

  async function confirmDeleteEpic() {
    if (!deletingEpicItem) return;
    setDeletingEpicLoading(true);

    try {
      const res = await fetch(`/api/epics/${deletingEpicItem.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete Epic.");

      setEpics((prev) => prev.filter((e) => e.id !== deletingEpicItem.id));
      if (activeEpicTab === deletingEpicItem.id) {
        setActiveEpicTab("all");
      }
      toast.success("Epic deleted");
      setDeletingEpicItem(null);
    } catch {
      toast.error("Unable to delete epic");
    } finally {
      setDeletingEpicLoading(false);
    }
  }

  // Handle AI Generation from inside Add Story modal
  async function handleAiGenerate() {
    const trimmedTitle = newStoryTitle.trim();
    if (!trimmedTitle) {
      setTitleValidationError("Story title is required to generate a story.");
      return;
    }

    if (!targetEpic) {
      setAddStoryError("Assigned Epic is required.");
      return;
    }

    setTitleValidationError("");
    setAddStoryError("");
    setGeneratingAi(true);

    try {
      const requirement = newStoryDesc.trim()
        ? `${trimmedTitle}\n\nAdditional Context:\n${newStoryDesc.trim()}`
        : trimmedTitle;

      const res = await fetch("/api/generate-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirement,
          projectId: project.id,
          epicId: targetEpic.id,
          save: false, // Preview / review in modal before saving
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate story with AI.");
      }

      const generated = (data.stories || []) as Array<{
        title: string;
        description: string;
        acceptance_criteria: string[];
        assumptions: string[];
        clarifications: string[];
      }>;

      if (generated.length === 0) {
        throw new Error("AI did not produce any story. Please try with more descriptive details.");
      }

      if (generated.length === 1) {
        // Single story: populate form for review/editing
        const s = generated[0];
        setNewStoryTitle(s.title || trimmedTitle);
        setNewStoryDesc(s.description || "");
        setNewStoryCriteria(s.acceptance_criteria || []);
        setNewStoryAssumptions(s.assumptions || []);
        setNewStoryClarifications(s.clarifications || []);
        toast.success("Story generated successfully");
      } else {
        // Multiple stories: transition to multi-story review step
        setMultiStoryReview(
          generated.map((s, idx) => ({
            id: `temp-${Date.now()}-${idx}`,
            project_id: project.id,
            epic_id: targetEpic.id,
            title: s.title,
            description: s.description || "",
            acceptance_criteria: s.acceptance_criteria || [],
            assumptions: s.assumptions || [],
            clarifications: s.clarifications || [],
            status: "review" as const,
            team_review_status: "pending" as const,
            client_review_status: "pending" as const,
            created_at: new Date().toISOString(),
          }))
        );
        toast.success(`${generated.length} stories generated successfully`);
      }
    } catch (err: any) {
      setAddStoryError(err.message || "Failed to generate story with AI.");
      toast.error("Unable to generate stories", "Please try again.");
    } finally {
      setGeneratingAi(false);
    }
  }

  // Handle Manual / Populated Single Story Creation
  async function handleCreateStory(e: React.FormEvent) {
    e.preventDefault();
    const trimmedTitle = newStoryTitle.trim();
    if (!trimmedTitle) {
      setTitleValidationError("Story title is required.");
      return;
    }
    if (!targetEpic) {
      setAddStoryError("Stories must belong to an Epic. Please select an Epic first.");
      return;
    }
    setAddingStory(true);
    setAddStoryError("");

    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          epic_id: targetEpic.id,
          title: trimmedTitle,
          description: newStoryDesc.trim(),
          acceptance_criteria: newStoryCriteria.filter((c) => c.trim()),
          assumptions: newStoryAssumptions.filter((a) => a.trim()),
          clarifications: newStoryClarifications.filter((cl) => cl.trim()),
          status: "review",
          reviewer_ids: newStoryReviewerIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create story.");

      setStories((prev) => [...prev, data.story]);
      closeAddStoryModal();
      toast.success("Story created successfully");
    } catch (err: any) {
      setAddStoryError(err.message);
      toast.error("Unable to create story");
    } finally {
      setAddingStory(false);
    }
  }

  // Handle Saving Multiple Stories from Review Step
  async function handleSaveMultiStories() {
    if (!multiStoryReview || multiStoryReview.length === 0 || !targetEpic) return;
    setSavingMultiStories(true);
    setAddStoryError("");

    try {
      const payload = multiStoryReview.map((s) => ({
        project_id: project.id,
        epic_id: targetEpic.id,
        title: s.title.trim(),
        description: s.description || "",
        acceptance_criteria: s.acceptance_criteria || [],
        assumptions: s.assumptions || [],
        clarifications: s.clarifications || [],
        status: "review",
      }));

      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stories: payload }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save stories.");

      const created = data.stories as Story[];
      setStories((prev) => [...prev, ...created]);
      closeAddStoryModal();
      toast.success(
        created.length > 1
          ? `${created.length} stories created successfully`
          : "Story created successfully"
      );
    } catch (err: any) {
      setAddStoryError(err.message);
      toast.error("Unable to create stories");
    } finally {
      setSavingMultiStories(false);
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
      toast.success("Story updated successfully");
    } catch {
      toast.error("Unable to update story");
    }
  }

  // Uncategorized legacy stories
  const uncategorizedStories = stories.filter((s) => !s.epic_id);

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

  // Reusable Story Card Renderer
  const renderStoryCard = (story: Story, showEpicBadge = false) => {
    const isExpanded = expandedStoryIds.has(story.id);
    const isReviewer = (story.reviewer_ids || []).includes(teamUser.id);
    const isTeamApproved = story.team_review_status === "approved";
    const isClientApproved =
      story.client_review_status === "approved" || story.status === "approved";
    const isApprovingThis = approvingStoryId === story.id;
    const openThreadCount = feedbackCounts[story.id] || 0;
    const threads = storyThreadsMap[story.id] || [];

    return (
      <div
        key={story.id}
        id={`story-${story.id}`}
        className={`rounded-[18px] border transition overflow-hidden ${
          isTeamApproved
            ? "bg-[rgba(46,139,112,0.06)] border-[rgba(46,139,112,0.18)] shadow-[0_8px_30px_rgba(70,55,95,0.04)]"
            : "bg-white/88 border-[rgba(74,61,100,0.08)] hover:border-[#B8944E]/30 shadow-[0_8px_30px_rgba(70,55,95,0.055)] backdrop-blur-[16px]"
        }`}
      >
        {/* Story Header Summary */}
        <div className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0 flex-1">
              {/* Metadata row */}
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-zinc-400 mb-1.5">
                {showEpicBadge && (
                  <>
                    <span className="uppercase text-zinc-500 font-semibold">
                      {epics.find((e) => e.id === story.epic_id)?.name || "Uncategorized"}
                    </span>
                    <span>•</span>
                  </>
                )}
                <span>{story.acceptance_criteria?.length ?? 0} criteria</span>

                {/* Reviewers pill */}
                {story.reviewers && story.reviewers.length > 0 ? (
                  <>
                    <span>•</span>
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700 border border-zinc-200"
                      title={`Reviewers: ${story.reviewers.map((r) => `${r.name || r.username}${r.role && r.role !== "member" ? ` (${r.role})` : ""}`).join(", ")}`}
                    >
                      <Users size={11} className="text-zinc-500" />
                      {story.reviewers.length} {story.reviewers.length === 1 ? "reviewer" : "reviewers"}
                    </span>
                  </>
                ) : (
                  <>
                    <span>•</span>
                    <span className="text-[11px] text-zinc-400 italic">No reviewers assigned</span>
                  </>
                )}

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

                {/* Access Level Badge */}
                {!isReviewer ? (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                    <Lock size={12} />
                    <span>Read Only (Non-Reviewer)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 size={12} className="stroke-[2.5]" />
                    <span>Assigned Reviewer</span>
                  </span>
                )}
              </div>
            </div>

            {/* Action buttons on card */}
            <div className="flex items-center gap-2 self-end sm:self-start shrink-0 pt-1">
              {!isTeamApproved && (
                isReviewer ? (
                  <Button
                    variant="primary"
                    size="sm"
                    isLoading={isApprovingThis}
                    leftIcon={<Check size={13} />}
                    onClick={() => handleApproveStory(story.id)}
                  >
                    Approve
                  </Button>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-400 cursor-not-allowed"
                    title="Only assigned reviewers can approve this story"
                  >
                    <Lock size={12} className="opacity-40" />
                    <span>Reviewer Only</span>
                  </span>
                )
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
                className="grid h-8 w-8 place-items-center rounded-lg border border-white/60 bg-white/50 text-zinc-500 hover:bg-white/70 transition cursor-pointer"
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
            {/* Read-Only Banner for Non-Reviewers */}
            {!isReviewer && (
              <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 p-3.5 flex items-center gap-2.5 text-xs text-amber-900">
                <AlertCircle size={15} className="shrink-0 text-amber-600" />
                <div>
                  <span className="font-semibold">Read-only access: </span>
                  You can view this story. Only assigned reviewers can participate in review discussions, request changes, or approve this story.
                </div>
              </div>
            )}

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
                        className="rounded-xl border border-[rgba(74,61,100,0.08)] bg-white p-3 shadow-xs"
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
                            isReadOnly={!isReviewer}
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
  };

  // Render Epic Section Card
  const renderEpicSection = (epic: Epic, epicStories: Story[]) => {
    return (
      <div
        key={epic.id}
        className="rounded-[18px] border border-[rgba(74,61,100,0.08)] bg-white/85 shadow-[0_8px_30px_rgba(70,55,95,0.055)] backdrop-blur-[16px] overflow-hidden"
      >
        {/* Epic Card Header: Shows ONLY Epic Name, count, Add Story, and Actions Dropdown */}
        <div className="border-b border-[rgba(74,61,100,0.06)] bg-[#FAF9FC]/90 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            {/* Epic Details */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[rgba(184,148,78,0.10)] text-[#80642F] border border-[rgba(184,148,78,0.15)]">
                  <Layers size={13} />
                </span>
                <h3 className="text-base font-semibold text-[#252331] truncate">
                  {epic.name}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span className="font-semibold text-zinc-700">
                  {epicStories.length} {epicStories.length === 1 ? "story" : "stories"}
                </span>
                {epic.description && (
                  <>
                    <span>•</span>
                    <span className="text-zinc-600 line-clamp-1">{epic.description}</span>
                  </>
                )}
              </div>
            </div>

            {/* Epic Scoped Actions: Add Story & ⋯ Menu ONLY */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Plus size={13} />}
                onClick={() => openAddStoryModal(epic)}
              >
                Add Story
              </Button>
              <DropdownMenu
                items={[
                  {
                    label: "Edit Epic",
                    icon: <Edit2 size={13} />,
                    onClick: () => {
                      setEditingEpic(epic);
                      setEpicName(epic.name);
                      setEpicDesc(epic.description || "");
                      setEpicError("");
                      setShowEpicModal(true);
                    },
                  },
                  {
                    label: "Delete Epic",
                    icon: <Trash2 size={13} />,
                    variant: "danger",
                    onClick: () => handleDeleteEpic(epic.id),
                  },
                ]}
                align="right"
                ariaLabel={`Actions for ${epic.name}`}
              />
            </div>
          </div>
        </div>

        {/* Epic Stories List / Empty state */}
        <div className="p-4 sm:p-5">
          {epicStories.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 py-8 px-4 text-center">
              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-white border border-zinc-200 shadow-2xs mb-2.5">
                <FileText className="h-4 w-4 text-zinc-400" />
              </div>
              <h4 className="text-sm font-semibold text-zinc-800">
                No stories in this Epic yet.
              </h4>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                Add your first story to this Epic.
              </p>
              <div className="mt-4 flex items-center justify-center">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Plus size={13} />}
                  onClick={() => openAddStoryModal(epic)}
                >
                  Add Story
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {epicStories.map((story) => renderStoryCard(story))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render Uncategorized Section
  const renderUncategorizedSection = (uncatStories: Story[]) => {
    return (
      <div className="rounded-2xl border border-amber-200/90 bg-white shadow-xs overflow-hidden">
        {/* Uncategorized Header */}
        <div className="border-b border-amber-200/70 bg-amber-50/50 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                  <AlertCircle size={13} />
                </span>
                <h3 className="text-base font-bold text-amber-950">
                  Uncategorized Stories
                </h3>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 border border-amber-200">
                  {uncatStories.length} {uncatStories.length === 1 ? "story" : "stories"}
                </span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                Stories must belong to an Epic. Use <strong>Edit</strong> on a story below to assign it to an Epic.
              </p>
            </div>
          </div>
        </div>

        {/* Stories List */}
        <div className="p-4 sm:p-5 space-y-3 sm:space-y-4">
          {uncatStories.map((story) => renderStoryCard(story, true))}
        </div>
      </div>
    );
  };

  return (
    <div className="pb-24">
      {/* Top Workspace Header */}
      <div className="border-b border-[#E2E6EF] bg-[#F8F9FC]">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:py-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-800 mb-1">
                <span>Team Workspace</span>
                <span>•</span>
                <span className="text-slate-400 font-normal">
                  Welcome, {teamUser.name} (@{teamUser.username})
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#111827] truncate">
                {project.name}
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-[#64748B] max-w-2xl font-normal leading-relaxed">
                {project.description ||
                  "Collaborate with your team, review requirements, generate stories, and participate in client discussions."}
              </p>
            </div>

            {/* Workspace Actions: ONLY Create Epic at top level */}
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
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

        {/* Empty project state if project has NO Epics yet */}
        {epics.length === 0 ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 sm:p-12 shadow-xs">
              <EmptyState
                icon={Layers}
                title="No epics yet"
                description="Organize project requirements into Epics before adding stories."
                action={
                  <Button
                    variant="primary"
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
                }
              />
            </div>

            {/* Legacy uncategorized stories if any exist */}
            {uncategorizedStories.length > 0 && renderUncategorizedSection(uncategorizedStories)}
          </div>
        ) : (
          <>
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
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition cursor-pointer ${
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
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
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

                {uncategorizedStories.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveEpicTab("uncategorized")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
                      activeEpicTab === "uncategorized"
                        ? "bg-slate-900 text-white shadow-xs"
                        : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    <span>Uncategorized</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                        activeEpicTab === "uncategorized"
                          ? "bg-white/20 text-white"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {uncategorizedStories.length}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Epics & Stories Content */}
            <div className="space-y-6">
              {activeEpicTab === "all" ? (
                <>
                  {epics.map((epic) => {
                    const epicStories = stories.filter((s) => s.epic_id === epic.id);
                    return renderEpicSection(epic, epicStories);
                  })}
                  {uncategorizedStories.length > 0 &&
                    renderUncategorizedSection(uncategorizedStories)}
                </>
              ) : activeEpicTab === "uncategorized" ? (
                renderUncategorizedSection(uncategorizedStories)
              ) : (
                (() => {
                  const currentEpic = epics.find((e) => e.id === activeEpicTab);
                  if (!currentEpic) return null;
                  const epicStories = stories.filter((s) => s.epic_id === currentEpic.id);
                  return renderEpicSection(currentEpic, epicStories);
                })()
              )}
            </div>
          </>
        )}
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

      {/* Add Story Modal with Embedded AI Assistant */}
      <Modal
        isOpen={showAddStory}
        onClose={closeAddStoryModal}
        title={multiStoryReview ? "Review generated stories" : "Create story"}
        description={
          multiStoryReview
            ? `Review and adjust the ${multiStoryReview.length} stories generated for this Epic.`
            : `Add a feature story to ${targetEpic?.name || "this Epic"}.`
        }
        footer={
          multiStoryReview ? (
            <>
              <Button
                variant="outline"
                onClick={() => setMultiStoryReview(null)}
                disabled={savingMultiStories}
              >
                Back to Form
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveMultiStories}
                isLoading={savingMultiStories}
                disabled={multiStoryReview.length === 0}
              >
                Save {multiStoryReview.length} {multiStoryReview.length === 1 ? "story" : "stories"}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={closeAddStoryModal}
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
          )
        }
      >
        {multiStoryReview ? (
          /* Multi-Story Review View */
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/50 p-3.5">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-indigo-600 shrink-0" />
                <h4 className="text-xs sm:text-sm font-bold text-indigo-950">
                  AI generated {multiStoryReview.length} stories for &ldquo;{targetEpic?.name}&rdquo;
                </h4>
              </div>
              <p className="text-xs text-indigo-800 mt-1">
                You can review or edit each story before saving. All saved stories will belong to this Epic.
              </p>
            </div>

            <div className="space-y-3">
              {multiStoryReview.map((story, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-zinc-200 bg-white p-3.5 sm:p-4 shadow-2xs space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-2 py-0.5">
                      Story {idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setMultiStoryReview((prev) =>
                          prev ? prev.filter((_, i) => i !== idx) : null
                        )
                      }
                      className="text-xs text-zinc-400 hover:text-rose-600 transition cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-500 mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      value={story.title}
                      onChange={(e) => {
                        const updated = [...multiStoryReview];
                        updated[idx] = { ...updated[idx], title: e.target.value };
                        setMultiStoryReview(updated);
                      }}
                      className="h-9 w-full rounded-lg border border-zinc-200 px-3 text-xs font-semibold text-zinc-900 outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-500 mb-1">
                      Description
                    </label>
                    <textarea
                      rows={2}
                      value={story.description || ""}
                      onChange={(e) => {
                        const updated = [...multiStoryReview];
                        updated[idx] = { ...updated[idx], description: e.target.value };
                        setMultiStoryReview(updated);
                      }}
                      className="w-full rounded-lg border border-zinc-200 p-2.5 text-xs text-zinc-800 outline-none focus:border-indigo-500 resize-none"
                    />
                  </div>

                  {story.acceptance_criteria && story.acceptance_criteria.length > 0 && (
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-500 mb-1.5">
                        Acceptance Criteria ({story.acceptance_criteria.length})
                      </label>
                      <div className="space-y-1.5">
                        {story.acceptance_criteria.map((crit, cIdx) => (
                          <div key={cIdx} className="flex items-start gap-2">
                            <span className="text-[10px] font-mono text-zinc-400 shrink-0 mt-0.5">
                              {cIdx + 1}.
                            </span>
                            <input
                              type="text"
                              value={crit}
                              onChange={(e) => {
                                const updated = [...multiStoryReview];
                                const criteria = [...(updated[idx].acceptance_criteria || [])];
                                criteria[cIdx] = e.target.value;
                                updated[idx] = { ...updated[idx], acceptance_criteria: criteria };
                                setMultiStoryReview(updated);
                              }}
                              className="flex-1 rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-800 outline-none focus:border-indigo-500"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...multiStoryReview];
                                const criteria = (updated[idx].acceptance_criteria || []).filter(
                                  (_, i) => i !== cIdx
                                );
                                updated[idx] = { ...updated[idx], acceptance_criteria: criteria };
                                setMultiStoryReview(updated);
                              }}
                              className="text-zinc-400 hover:text-rose-500 p-0.5"
                              aria-label="Remove criterion"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {addStoryError && (
              <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg">
                {addStoryError}
              </p>
            )}
          </div>
        ) : (
          /* Regular Add Story Form with Embedded AI Assistant */
          <form id="add-story-form" onSubmit={handleCreateStory} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {/* Assigned Epic (Locked) */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                Assigned Epic
              </label>
              <div className="flex items-center justify-between h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50/80 px-3.5 text-sm">
                <div className="flex items-center gap-2 truncate">
                  <Layers size={15} className="text-indigo-600 shrink-0" />
                  <span className="font-semibold text-zinc-900 truncate">
                    {targetEpic?.name || "No Epic selected"}
                  </span>
                </div>
                <span className="shrink-0 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider bg-zinc-200/70 px-2 py-0.5 rounded">
                  Locked
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">
                Stories must belong to an Epic. This story will be created inside &ldquo;{targetEpic?.name}&rdquo;.
              </p>
            </div>

            {/* Story Title & Embedded AI Assistant */}
            <div>
              <label htmlFor="story-title-input" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                Story Title <span className="text-rose-500">*</span>
              </label>
              <input
                id="story-title-input"
                type="text"
                required
                autoFocus
                value={newStoryTitle}
                onChange={(e) => {
                  setNewStoryTitle(e.target.value);
                  if (titleValidationError) setTitleValidationError("");
                }}
                placeholder="e.g. User profile management"
                aria-invalid={Boolean(titleValidationError)}
                aria-describedby={titleValidationError ? "story-title-error" : undefined}
                className={`h-10 w-full rounded-xl border px-3.5 text-sm text-zinc-900 outline-none transition focus:ring-1 ${
                  titleValidationError
                    ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500 bg-rose-50/20"
                    : "border-zinc-200 focus:border-indigo-500 focus:ring-indigo-500"
                }`}
              />

              {titleValidationError && (
                <p id="story-title-error" className="mt-1.5 text-xs text-rose-600 font-medium flex items-center gap-1">
                  <AlertCircle size={12} className="shrink-0" />
                  <span>{titleValidationError}</span>
                </p>
              )}

              {/* Embedded AI Assistant Action */}
              <div className="mt-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-indigo-100 bg-indigo-50/40 p-2.5">
                <div className="flex items-center gap-1.5 text-xs text-indigo-900">
                  <Sparkles size={13} className="text-indigo-600 shrink-0" />
                  <span className="text-[11px] text-zinc-600">
                    Use title as requirement to generate criteria with AI.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAiGenerate}
                  disabled={generatingAi}
                  aria-label="Generate story with AI"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 transition disabled:opacity-50 cursor-pointer shadow-2xs shrink-0"
                >
                  <Sparkles
                    size={13}
                    className={generatingAi ? "animate-spin text-indigo-600" : "text-indigo-600"}
                  />
                  <span>{generatingAi ? "Generating..." : "Generate with AI"}</span>
                </button>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                Description <span className="text-zinc-400 font-normal normal-case">(optional context for AI or team)</span>
              </label>
              <textarea
                rows={3}
                value={newStoryDesc}
                onChange={(e) => setNewStoryDesc(e.target.value)}
                placeholder="Describe user capability or business context..."
                className="w-full rounded-xl border border-zinc-200 p-3 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
              />
            </div>

            {/* Acceptance Criteria (Editable / AI Populated) */}
            <div className="space-y-2 pt-1 border-t border-zinc-100">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Acceptance Criteria {newStoryCriteria.length > 0 && `(${newStoryCriteria.length})`}
                </label>
                <button
                  type="button"
                  onClick={() => setNewStoryCriteria((prev) => [...prev, ""])}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={12} />
                  <span>Add criterion</span>
                </button>
              </div>

              {newStoryCriteria.length > 0 ? (
                <div className="space-y-2">
                  {newStoryCriteria.map((crit, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-zinc-400 shrink-0 w-4 text-right">
                        {idx + 1}.
                      </span>
                      <input
                        type="text"
                        value={crit}
                        onChange={(e) => {
                          const updated = [...newStoryCriteria];
                          updated[idx] = e.target.value;
                          setNewStoryCriteria(updated);
                        }}
                        placeholder="e.g. User can update their profile information"
                        className="flex-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setNewStoryCriteria((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-zinc-400 hover:text-rose-500 p-1 cursor-pointer"
                        aria-label="Remove criterion"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-400 italic">
                  No criteria yet. You can add them manually or click &ldquo;Generate with AI&rdquo; above.
                </p>
              )}
            </div>

            {/* Assumptions & Clarifications if present */}
            {newStoryAssumptions.length > 0 && (
              <div className="space-y-1.5 pt-1 border-t border-zinc-100">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Assumptions ({newStoryAssumptions.length})
                </label>
                <div className="space-y-1">
                  {newStoryAssumptions.map((a, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-zinc-700">
                      <span className="text-zinc-400">•</span>
                      <input
                        type="text"
                        value={a}
                        onChange={(e) => {
                          const updated = [...newStoryAssumptions];
                          updated[idx] = e.target.value;
                          setNewStoryAssumptions(updated);
                        }}
                        className="flex-1 rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-800 outline-none focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setNewStoryAssumptions((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-zinc-400 hover:text-rose-500 p-0.5 cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {newStoryClarifications.length > 0 && (
              <div className="space-y-1.5 pt-1 border-t border-zinc-100">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Clarifications ({newStoryClarifications.length})
                </label>
                <div className="space-y-1">
                  {newStoryClarifications.map((cl, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-zinc-700">
                      <HelpCircle size={12} className="text-amber-500 shrink-0" />
                      <input
                        type="text"
                        value={cl}
                        onChange={(e) => {
                          const updated = [...newStoryClarifications];
                          updated[idx] = e.target.value;
                          setNewStoryClarifications(updated);
                        }}
                        className="flex-1 rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-800 outline-none focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setNewStoryClarifications((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-zinc-400 hover:text-rose-500 p-0.5 cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reviewer Assignment Selection */}
            {projectTeamMembers.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-zinc-100">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Assign Story Reviewers
                  </label>
                  <span className="text-[11px] text-zinc-400">
                    {newStoryReviewerIds.length} selected
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Select team members who can review, discuss, and approve this story.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {projectTeamMembers.map((tm) => {
                    const isSelected = newStoryReviewerIds.includes(tm.id);
                    return (
                      <button
                        key={tm.id}
                        type="button"
                        onClick={() => {
                          setNewStoryReviewerIds((prev) =>
                            isSelected
                              ? prev.filter((id) => id !== tm.id)
                              : [...prev, tm.id]
                          );
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                          isSelected
                            ? "bg-[#80642F] text-white shadow-2xs"
                            : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            isSelected ? "bg-emerald-300" : "bg-zinc-300"
                          }`}
                        />
                        <span>{tm.name}</span>
                        <span className="text-[10px] opacity-75">(@{tm.username})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {addStoryError && (
              <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg">
                {addStoryError}
              </p>
            )}
          </form>
        )}
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

      {/* Delete Epic Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingEpicItem)}
        onClose={() => setDeletingEpicItem(null)}
        onConfirm={confirmDeleteEpic}
        title="Delete epic"
        description={`Are you sure you want to delete "${deletingEpicItem?.name}"? This action cannot be undone.`}
        confirmLabel="Delete epic"
        variant="danger"
        isLoading={deletingEpicLoading}
      />

      {/* Edit Story Modal */}
      {editingStory && (
        <Modal
          isOpen={Boolean(editingStory)}
          onClose={() => setEditingStory(null)}
          title="Edit Story"
          maxWidth="xl"
        >
          <StoryEditor
            story={editingStory}
            epics={epics}
            viewerType="team_user"
            currentUserId={teamUser.id}
            isReviewer={(editingStory.reviewer_ids || []).includes(teamUser.id)}
            onCancel={() => setEditingStory(null)}
            onFeedbackChange={loadFeedbackCounts}
            onSave={async (updated) => {
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
                    epic_id: updated.epic_id,
                    reviewer_ids: (updated as any).reviewer_ids,
                  }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Failed to update story");
                setStories((prev) =>
                  prev.map((s) => (s.id === editingStory.id ? data.story : s))
                );
                setEditingStory(null);
                toast.success("Story updated successfully");
              } catch (err: any) {
                toast.error(err.message || "Unable to update story");
              }
            }}
            onCreateEpic={(name) => {
              setEpicName(name);
              setEpicDesc("");
              setEditingEpic(null);
              setShowEpicModal(true);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

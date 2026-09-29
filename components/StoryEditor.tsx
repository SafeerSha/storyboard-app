"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CheckSquare,
  ExternalLink,
  HelpCircle,
  MessageSquare,
  Plus,
  Trash2,
  Users,
  X,
  Bot,
  Sparkles,
  Clock,
  Loader2,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { Badge } from "@/components/ui/Badge";
import { ContextualFeedbackThread } from "@/components/ContextualFeedbackThread";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { TaskModal } from "@/components/tasks/TaskModal";
import { TaskDetailDrawer } from "@/components/tasks/TaskDetailDrawer";
import type { Task } from "@/lib/types/task";
import { AiAgentPromptModal } from "@/components/stories/AiAgentPromptModal";
import {
  normalizeStoryStatus,
  getStoryStatusLabel,
  type StoryLifecycleStatus,
  type GeneratedStory,
  type Epic,
  type Story,
  type StoryStatus,
  type FeedbackThread,
  type FeedbackAuthorType,
  type FeedbackThreadStatus,
} from "@/lib/types";

interface StoryFormState {
  id?: string;
  title: string;
  description: string;
  acceptance_criteria: string[];
  assumptions: string[];
  clarifications: string[];
  raw_requirement?: string | null;
  epic_id?: string | null;
  suggestedEpic?: string;
  reviewer_ids: string[];
  status: StoryStatus;
  [key: string]: any;
}

export function StoryEditor({
  story,
  epics,
  onSave,
  onCancel,
  onCreateEpic,
  onDelete,
  onFeedbackChange,
  onStatusChange,
  viewerType,
  currentUserId,
  isReviewer,
  onApprove,
  isTeamApproved,
  approving,
  layout = "sidebar",
}: {
  story: (GeneratedStory | Story) & {
    raw_requirement?: string | null;
    id?: string;
    suggestedEpic?: string;
    project_id?: string;
    created_by_id?: string | null;
    reviewer_ids?: string[];
  };
  epics: Epic[];
  onSave: (story: (GeneratedStory | Story) & { raw_requirement?: string | null; reviewer_ids?: string[] }) => void;
  onCancel: () => void;
  onCreateEpic: (name: string) => void;
  onDelete?: () => void;
  onFeedbackChange?: (storyId?: string, newStatus?: StoryStatus) => void;
  onStatusChange?: (newStatus: StoryLifecycleStatus) => Promise<void> | void;
  viewerType?: FeedbackAuthorType;
  currentUserId?: string;
  isReviewer?: boolean;
  onApprove?: (storyId: string) => void;
  isTeamApproved?: boolean;
  approving?: boolean;
  layout?: "sidebar" | "standalone";
}) {
  const normalizeStory = (s: any): StoryFormState => ({
    ...s,
    title: s?.title || "",
    description: s?.description || "",
    acceptance_criteria: Array.isArray(s?.acceptance_criteria) ? s.acceptance_criteria : [],
    assumptions: Array.isArray(s?.assumptions) ? s.assumptions : [],
    clarifications: Array.isArray(s?.clarifications) ? s.clarifications : [],
    reviewer_ids: Array.isArray(s?.reviewer_ids) ? s.reviewer_ids : [],
    status: (s?.status as StoryStatus) || "new",
  });

  const [value, setValue] = useState<StoryFormState>(() => normalizeStory(story));
  const [agentPromptOpen, setAgentPromptOpen] = useState(false);
  const storyId = story.id;
  const [threads, setThreads] = useState<FeedbackThread[]>([]);
  const effectiveViewer = viewerType || "freelancer";

  const isCreator = Boolean(
    (story.created_by_id && currentUserId && story.created_by_id === currentUserId) ||
    effectiveViewer === "freelancer"
  );

  const isReadOnly = effectiveViewer === "team_user" && !isCreator && isReviewer === false;

  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; name: string; username: string; role?: string }>>([]);
  const [selectedReviewerIds, setSelectedReviewerIds] = useState<string[]>(
    Array.isArray(story.reviewer_ids) ? story.reviewer_ids : []
  );
  const [loadingTeam, setLoadingTeam] = useState(false);

  useEffect(() => {
    setValue(normalizeStory(story));
    setSelectedReviewerIds(Array.isArray(story.reviewer_ids) ? story.reviewer_ids : []);
  }, [story]);

  const projectId = (story as any).project_id;
  const [storyTasks, setStoryTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const loadStoryTasks = useCallback(async () => {
    if (!storyId) return;
    setLoadingTasks(true);
    try {
      const res = await fetch(`/api/tasks?storyId=${storyId}`);
      const data = await res.json();
      if (data.tasks) {
        setStoryTasks(data.tasks);
      }
    } catch (err) {
      console.error("Failed to load story tasks:", err);
    } finally {
      setLoadingTasks(false);
    }
  }, [storyId]);

  useEffect(() => {
    loadStoryTasks();
  }, [loadStoryTasks]);
  useEffect(() => {
    if (!projectId) return;
    let active = true;
    setLoadingTeam(true);
    fetch(`/api/projects/${projectId}/team-members?forReviewers=false`)
      .then((r) => (r.ok ? r.json() : { teamMembers: [] }))
      .then((d) => {
        if (active && d.teamMembers) {
          setTeamMembers(d.teamMembers);
        }
      })
      .catch(() => { })
      .finally(() => {
        if (active) setLoadingTeam(false);
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  const canManageReviewers =
    effectiveViewer === "freelancer" ||
    isCreator ||
    (Boolean(story.created_by_id) && story.created_by_id === currentUserId);

  const candidateReviewers = teamMembers.filter((tm) => {
    if (story.created_by_id && tm.id === story.created_by_id) return false;
    if (currentUserId && tm.id === currentUserId) return false;
    if (tm.role === "Super Admin" || tm.role === "Project Creator") return false;
    return true;
  });

  useEffect(() => {
    if (!storyId) return;
    let active = true;
    fetch(`/api/stories/${storyId}/feedback`)
      .then((r) => (r.ok ? r.json() : { threads: [] }))
      .then((d) => {
        if (active && d.threads) {
          setThreads(d.threads);
          const openCount = d.threads.filter((t: any) => t.status === "open").length;
          if (openCount === 0 && value.status === "changes_requested") {
            setValue((v) => ({ ...v, status: "review" }));
            onFeedbackChange?.(storyId, "review");
          }
        }
      })
      .catch(() => { });
    return () => {
      active = false;
    };
  }, [storyId]);

  const handleThreadCreated = (t: FeedbackThread) => {
    setThreads((prev) => [...prev, t]);
    setValue((v) => ({ ...v, status: "changes_requested" }));
    onFeedbackChange?.(storyId, "changes_requested");
  };

  const handleThreadStatusUpdated = (
    threadId: string,
    nextStatus: FeedbackThreadStatus,
    syncResult?: any
  ) => {
    let computedStoryStatus: StoryStatus | undefined = syncResult?.status;

    setThreads((prev) => {
      const updated = prev.map((t) => (t.id === threadId ? { ...t, status: nextStatus } : t));
      const stillOpen = updated.filter((t) => t.status === "open").length;

      if (!computedStoryStatus) {
        if (stillOpen === 0) {
          if (value.status === "changes_requested") {
            computedStoryStatus = "review";
          }
        } else {
          if (value.status !== "approved" && value.status !== "in_development" && value.status !== "completed") {
            computedStoryStatus = "changes_requested";
          }
        }
      }

      return updated;
    });

    if (computedStoryStatus && computedStoryStatus !== value.status) {
      setValue((prev) => ({ ...prev, status: computedStoryStatus! }));
    }

    const finalStatus = computedStoryStatus || (value.status === "changes_requested" ? "review" : value.status);
    onFeedbackChange?.(storyId, finalStatus);
  };

  const updateList = (
    key: "acceptance_criteria" | "assumptions" | "clarifications",
    index: number,
    text: string
  ) =>
    setValue((v: any) => {
      const arr = Array.isArray(v[key]) ? (v[key] as string[]) : [];
      return {
        ...v,
        [key]: arr.map((x: string, i: number) => (i === index ? text : x)),
      };
    });

  const add = (key: "acceptance_criteria" | "assumptions" | "clarifications") =>
    setValue((v: any) => {
      const arr = Array.isArray(v[key]) ? (v[key] as string[]) : [];
      return {
        ...v,
        [key]: [...arr, ""],
      };
    });

  const remove = (
    key: "acceptance_criteria" | "assumptions" | "clarifications",
    index: number
  ) =>
    setValue((v: any) => {
      const arr = Array.isArray(v[key]) ? (v[key] as string[]) : [];
      return {
        ...v,
        [key]: arr.filter((_: string, i: number) => i !== index),
      };
    });

  const suggestedEpicExists = epics.some((e) => e.name === story.suggestedEpic);
  const openFeedbackCount = threads.filter((t) => t.status === "open").length;

  const assignedEpic = epics.find((e) => e.id === value.epic_id);
  const normalizedStatus = normalizeStoryStatus(value.status);
  const statusLabel = `Story · ${getStoryStatusLabel(value.status)}`;
  const [savingStatus, setSavingStatus] = useState(false);

  const handleStatusChange = async (newStatus: StoryLifecycleStatus) => {
    if (isReadOnly || savingStatus) return;
    if (normalizeStoryStatus(value.status) === newStatus) return;

    const prevStatus = value.status;
    setValue((prev) => ({ ...prev, status: newStatus }));

    if (onStatusChange) {
      try {
        setSavingStatus(true);
        await onStatusChange(newStatus);
      } catch (err: any) {
        setValue((prev) => ({ ...prev, status: prevStatus }));
      } finally {
        setSavingStatus(false);
      }
      return;
    }

    if (storyId) {
      try {
        setSavingStatus(true);
        const res = await fetch(`/api/stories/${storyId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update story status");

        onFeedbackChange?.(storyId, newStatus);
        toast.success(`Story status updated to ${getStoryStatusLabel(newStatus)}`);
      } catch (err: any) {
        setValue((prev) => ({ ...prev, status: prevStatus }));
        toast.error(err.message || "Failed to update story status");
      } finally {
        setSavingStatus(false);
      }
    }
  };

  const renderStatusSelector = () => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5]">
          Story Status
        </label>
        {savingStatus && (
          <span className="inline-flex items-center gap-1 text-[11px] text-[#B8944E] font-medium animate-pulse">
            <Loader2 size={11} className="animate-spin" />
            Saving...
          </span>
        )}
      </div>
      {isReadOnly ? (
        <div className="flex items-center gap-2">
          <Badge variant={normalizedStatus} size="sm" />
          <span className="text-xs text-[#706C7D]">Read-only status</span>
        </div>
      ) : (
        <div className="inline-flex rounded-xl p-1 bg-[#FAF9FC] border border-[rgba(74,61,100,0.10)] gap-1">
          <button
            type="button"
            disabled={savingStatus}
            onClick={() => handleStatusChange("new")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
              normalizedStatus === "new"
                ? "bg-white text-sky-700 shadow-xs border border-sky-200/80 ring-1 ring-sky-500/10"
                : "text-[#706C7D] hover:text-[#252331] hover:bg-white/60"
            }`}
          >
            <Sparkles size={12} className={normalizedStatus === "new" ? "text-sky-600" : "text-[#9994A5]"} />
            <span>New</span>
          </button>

          <button
            type="button"
            disabled={savingStatus}
            onClick={() => handleStatusChange("active")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
              normalizedStatus === "active"
                ? "bg-white text-[#80642F] shadow-xs border border-[rgba(184,148,78,0.30)] ring-1 ring-[#B8944E]/15"
                : "text-[#706C7D] hover:text-[#252331] hover:bg-white/60"
            }`}
          >
            <Clock size={12} className={normalizedStatus === "active" ? "text-[#B8944E]" : "text-[#9994A5]"} />
            <span>Active</span>
          </button>

          <button
            type="button"
            disabled={savingStatus}
            onClick={() => handleStatusChange("done")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
              normalizedStatus === "done"
                ? "bg-white text-[#2E8B70] shadow-xs border border-[rgba(46,139,112,0.30)] ring-1 ring-[#2E8B70]/15"
                : "text-[#706C7D] hover:text-[#252331] hover:bg-white/60"
            }`}
          >
            <CheckCircle2 size={12} className={normalizedStatus === "done" ? "text-[#2E8B70]" : "text-[#9994A5]"} />
            <span>Done</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="rounded-[18px] border border-[rgba(74,61,100,0.08)] bg-white p-4 sm:p-7 shadow-[0_8px_30px_rgba(70,55,95,0.055)] space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-[rgba(74,61,100,0.06)] pb-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9994A5]">
              {assignedEpic ? `${assignedEpic.name}` : "REQUIREMENTS"}
            </span>
            {openFeedbackCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(168,121,54,0.08)] px-2 py-0.5 text-[11px] font-semibold text-[#A87936] border border-[rgba(168,121,54,0.16)]">
                <MessageSquare size={11} />
                {openFeedbackCount} open feedback
              </span>
            )}
          </div>
          <h3 className="text-lg font-semibold tracking-tight text-[#252331] truncate">
            {value.title || "Untitled Story"}
          </h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[#706C7D] font-medium">
            <span>{statusLabel}</span>
            {story.created_by_id && (
              <>
                <span className="opacity-40">•</span>
                <span>
                  Created by {teamMembers.find((tm) => tm.id === story.created_by_id)?.name || "Admin"}
                </span>
              </>
            )}
          </p>
        </div>

        {layout === "standalone" ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft size={14} />} onClick={onCancel}>
              Back to Reviews
            </Button>
            {assignedEpic && story.project_id && (
              <Link href={`/team?projectId=${story.project_id}&epicId=${assignedEpic.id}`}>
                <Button variant="outline" size="sm" leftIcon={<ExternalLink size={14} />}>
                  Go to Epic
                </Button>
              </Link>
            )}
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Bot size={14} className="text-[#80642F]" />}
              onClick={() => setAgentPromptOpen(true)}
              title="Convert this story implementation into an AI agent prompt"
            >
              AI Agent Prompt
            </Button>
            {onApprove && !isReadOnly && (
              <Button
                variant={isTeamApproved ? "secondary" : "primary"}
                size="sm"
                leftIcon={
                  <CheckCircle2
                    size={14}
                    className={isTeamApproved ? "text-[#2E8B70]" : "text-white"}
                  />
                }
                onClick={() => onApprove(storyId!)}
                isLoading={approving}
              >
                {isTeamApproved ? "Team Approved" : "Approve for Team"}
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={() =>
                onSave({
                  ...value,
                  status: (value.status || "new") as StoryStatus,
                  reviewer_ids: selectedReviewerIds,
                } as any)
              }
            >
              Save changes
            </Button>
            {onDelete && (
              <Button
                variant="danger"
                size="sm"
                onClick={onDelete}
                aria-label="Delete story"
              >
                <Trash2 size={14} />
              </Button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 shrink-0">
            {storyId && projectId && (
              <button
                type="button"
                onClick={() => setTaskModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#80642F] bg-[rgba(184,148,78,0.08)] hover:bg-[rgba(184,148,78,0.16)] border border-[rgba(184,148,78,0.20)] transition cursor-pointer shadow-2xs"
                title="Create a to-do task against this story"
              >
                <CheckSquare size={13} />
                <span className="hidden sm:inline">+ Task</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setAgentPromptOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#80642F] bg-[rgba(184,148,78,0.08)] hover:bg-[rgba(184,148,78,0.16)] border border-[rgba(184,148,78,0.20)] transition cursor-pointer shadow-2xs"
              title="Convert to AI Agent Prompt for Cursor, Claude Code, Copilot, Antigravity"
            >
              <Bot size={13} />
              <span className="hidden sm:inline">AI Agent Prompt</span>
            </button>
            <button
              type="button"
              onClick={onCancel}
              aria-label="Close story editor"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#9994A5] hover:bg-[#E9E3F4]/30 hover:text-[#252331] transition"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      {layout === "standalone" ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 sm:gap-8 mt-6">
          <div className="space-y-5 sm:space-y-6">
            {/* Read-Only Warning Banner */}
            {isReadOnly && (
              <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 p-3.5 flex items-start gap-2.5 text-xs text-amber-900">
                <AlertCircle size={15} className="shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <span className="font-semibold">Read-only access: </span>
                  You are viewing this story as a non-reviewer team member. You can inspect criteria, assumptions, clarifications, and discussions, but only assigned reviewers can participate in discussions, request changes, or approve.
                </div>
              </div>
            )}

            {/* Story Title */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5] mb-1.5">
                Story Title
              </label>
              <input
                type="text"
                value={value.title}
                onChange={(e) => setValue({ ...value, title: e.target.value })}
                placeholder="e.g. Manage User Profile"
                className="h-10 w-full rounded-xl border border-[rgba(74,61,100,0.11)] bg-white px-3.5 text-sm font-medium text-[#252331] placeholder-[#9994A5] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)]"
              />
            </div>

            {/* Story Description */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5] mb-1.5">
                Description
              </label>
              <Textarea
                rows={3}
                value={value.description}
                onChange={(e) => setValue({ ...value, description: e.target.value })}
                placeholder="Describe the user capability and business value..."
                className="w-full rounded-xl border border-[rgba(74,61,100,0.11)] bg-white p-3 text-sm text-[#252331] placeholder-[#9994A5] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)]"
              />
            </div>

            {/* 1. Acceptance Criteria */}
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-[#252331] tracking-tight">
                    Acceptance Criteria
                  </h4>
                  <p className="text-xs text-[#706C7D]">
                    Precise testable statements for client validation and sign-off.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => add("acceptance_criteria")}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[#80642F] hover:bg-[rgba(184,148,78,0.08)] transition shrink-0 whitespace-nowrap cursor-pointer"
                >
                  <Plus size={13} />
                  <span>Add criterion</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {((Array.isArray(value.acceptance_criteria) ? value.acceptance_criteria : []) as string[]).map((item: string, i: number) => {
                  const itemId = `ac-${i}`;
                  return (
                    <div
                      key={i}
                      className="rounded-xl border border-[rgba(74,61,100,0.08)] bg-[#FAF9FC] p-3 transition focus-within:border-[#B8944E] focus-within:bg-white"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="font-mono text-[11px] font-bold text-[#80642F] bg-[rgba(184,148,78,0.10)] border border-[rgba(184,148,78,0.15)] rounded px-1.5 py-0.5 shrink-0 mt-0.5">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <Textarea
                          rows={1}
                          value={item}
                          onChange={(e) => updateList("acceptance_criteria", i, e.target.value)}
                          placeholder="Describe specific validation or behavior..."
                          containerClassName="flex-1 min-w-0"
                          className="w-full text-xs sm:text-sm text-[#252331] placeholder-[#9994A5] bg-transparent outline-none leading-relaxed"
                          actionSlot={
                            <button
                              type="button"
                              onClick={() => remove("acceptance_criteria", i)}
                              aria-label="Remove criterion"
                              className="grid h-7 w-7 place-items-center rounded-lg text-[#9994A5] hover:bg-rose-50/80 hover:text-[#C25D72] transition cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          }
                        />
                      </div>

                      {storyId && (
                        <div className="mt-1.5 pl-8">
                          <ContextualFeedbackThread
                            storyId={storyId}
                            sectionType="acceptance_criteria"
                            itemId={itemId}
                            itemText={item}
                            pointNumber={i}
                            actionLabel="Discuss criterion"
                            viewerType={effectiveViewer}
                            viewerId={currentUserId}
                            isReadOnly={isReadOnly}
                            threads={threads}
                            onThreadCreated={handleThreadCreated}
                            onMessageAdded={(tid, m) => {
                              setThreads((prev) =>
                                prev.map((t) =>
                                  t.id === tid ? { ...t, messages: [...t.messages, m] } : t
                                )
                              );
                              onFeedbackChange?.();
                            }}
                            onStatusUpdated={handleThreadStatusUpdated}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

          </div>
          <div className="space-y-5 sm:space-y-6">
            {/* Story Status Control */}
            {renderStatusSelector()}

            {/* Epic Assignment */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5] mb-1.5">
                Assigned Epic
              </label>
              <select
                value={value.epic_id || ""}
                onChange={(e) =>
                  setValue({ ...value, epic_id: e.target.value || null })
                }
                className="h-10 w-full rounded-xl border border-[rgba(74,61,100,0.11)] bg-white px-3 text-sm text-[#252331] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)] cursor-pointer"
              >
                <option value="">No Epic assigned (Uncategorized)</option>
                {epics.map((epic) => (
                  <option key={epic.id} value={epic.id}>
                    {epic.name}
                  </option>
                ))}
              </select>
              {story.suggestedEpic && !suggestedEpicExists && (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-[rgba(184,148,78,0.15)] bg-[rgba(184,148,78,0.06)] p-2.5 text-xs text-[#80642F]">
                  <span>
                    Suggested Epic: <strong>{story.suggestedEpic}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => onCreateEpic(story.suggestedEpic!)}
                    className="font-medium text-[#80642F] hover:underline shrink-0"
                  >
                    + Create Epic
                  </button>
                </div>
              )}
            </div>

            {/* Story Reviewers Section */}
            {projectId && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5]">
                    Assigned Reviewers
                  </label>
                  <span className="text-xs text-[#706C7D]">
                    {selectedReviewerIds.length}{" "}
                    {selectedReviewerIds.length === 1 ? "reviewer" : "reviewers"}
                  </span>
                </div>
                <p className="text-xs text-[#706C7D]">
                  Only assigned reviewers can discuss, request changes, and approve this story.
                </p>

                {canManageReviewers ? (
                  <div className="rounded-xl border border-[rgba(74,61,100,0.11)] bg-[#FAF9FC] p-3">
                    {loadingTeam ? (
                      <p className="text-xs text-[#9994A5]">Loading team members...</p>
                    ) : candidateReviewers.length === 0 ? (
                      <p className="text-xs text-[#706C7D]">
                        No other team members found in this project. Only client or team members verifying this story should be assigned as reviewers.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {candidateReviewers.map((tm) => {
                          const isSelected = selectedReviewerIds.includes(tm.id);
                          return (
                            <button
                              key={tm.id}
                              type="button"
                              onClick={() => {
                                setSelectedReviewerIds((prev) =>
                                  isSelected
                                    ? prev.filter((id) => id !== tm.id)
                                    : [...prev, tm.id]
                                );
                              }}
                              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${isSelected
                                  ? "bg-[#80642F] text-white shadow-2xs"
                                  : "border border-[rgba(74,61,100,0.12)] bg-white text-[#252331] hover:bg-[#FAF9FC]"
                                }`}
                            >
                              <span
                                className={`h-2 w-2 rounded-full ${isSelected ? "bg-emerald-300" : "bg-zinc-300"
                                  }`}
                              />
                              <span>{tm.name}</span>
                              <span className="text-[10px] opacity-75">(@{tm.username})</span>

                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selectedReviewerIds.length > 0 ? (
                      selectedReviewerIds.map((rid) => {
                        const tm =
                          teamMembers.find((m) => m.id === rid) ||
                          (story.reviewers || []).find(
                            (r: any) => r.user_id === rid || r.id === rid || r.team_user_id === rid
                          );
                        if (!tm) return null;
                        return (
                          <span
                            key={rid}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(74,61,100,0.12)] bg-white px-2.5 py-1 text-xs text-[#252331]"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            <span>{tm.name}</span>
                            {tm.username && (
                              <span className="text-[10px] text-[#706C7D]">(@{tm.username})</span>
                            )}

                          </span>
                        );
                      })
                    ) : (
                      <span className="text-xs text-[#9994A5] italic">No reviewers assigned</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Linked Tasks Against This Story */}
            {storyId && projectId && (
              <div className="space-y-2.5 rounded-xl border border-[rgba(74,61,100,0.11)] bg-[#FAF9FC] p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckSquare size={14} className="text-[#80642F]" />
                    <label className="text-xs font-bold uppercase tracking-wider text-[#252331]">
                      Story Tasks
                    </label>
                    <span className="rounded-full bg-[rgba(184,148,78,0.12)] px-2 py-0.2 text-[10px] font-bold text-[#80642F]">
                      {storyTasks.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTaskModalOpen(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#80642F] hover:underline"
                  >
                    <Plus size={12} /> Add Task
                  </button>
                </div>

                {loadingTasks ? (
                  <p className="text-xs text-[#9994A5]">Loading tasks...</p>
                ) : storyTasks.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[rgba(74,61,100,0.1)] p-3 text-center">
                    <p className="text-xs text-[#706C7D]">No tasks created against this story yet.</p>
                    <button
                      type="button"
                      onClick={() => setTaskModalOpen(true)}
                      className="mt-1 text-xs font-semibold text-[#80642F] hover:underline inline-flex items-center gap-1"
                    >
                      <Plus size={11} /> Create first task
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {storyTasks.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTaskId(t.id)}
                        className="rounded-lg border border-[rgba(74,61,100,0.08)] bg-white p-2.5 hover:border-[#B8944E]/40 transition cursor-pointer flex items-center justify-between gap-2"
                      >
                        <div className="flex flex-col min-w-0">
                          <span className={`text-xs font-semibold text-[#252331] truncate ${t.status === "done" ? "line-through text-zinc-400" : ""}`}>
                            {t.title}
                          </span>
                          <span className="text-[10px] text-[#706C7D] flex items-center gap-1.5 mt-0.5">
                            {t.assignee_name ? (
                              <span className="font-medium text-[#252331]">
                                {t.assignee_name}
                              </span>
                            ) : (
                              <span className="text-[#9994A5] italic">Unassigned</span>
                            )}
                            {t.due_date && <span>• Due {new Date(t.due_date).toLocaleDateString([], { month: "short", day: "numeric" })}</span>}
                          </span>
                        </div>
                        <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-700 shrink-0">
                          {t.status.replace("_", " ")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 2. Assumptions */}
            <section className="space-y-3 pt-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-[#252331] tracking-tight">
                    Assumptions
                  </h4>
                  <p className="text-xs text-[#706C7D]">
                    Underlying technical or product expectations.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => add("assumptions")}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[#80642F] hover:bg-[rgba(184,148,78,0.08)] transition shrink-0 whitespace-nowrap cursor-pointer"
                >
                  <Plus size={13} />
                  <span>Add assumption</span>
                </button>
              </div>

              <div className="space-y-2">
                {((Array.isArray(value.assumptions) ? value.assumptions : []) as string[]).map((item: string, i: number) => {
                  const itemId = `assump-${i}`;
                  return (
                    <div
                      key={i}
                      className="rounded-xl border border-[rgba(74,61,100,0.08)] bg-[#FAF9FC] p-2.5 transition focus-within:border-[#B8944E] focus-within:bg-white"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-[#9994A5] font-bold text-sm shrink-0 mt-0.5">•</span>
                        <Textarea
                          rows={1}
                          value={item}
                          onChange={(e) => updateList("assumptions", i, e.target.value)}
                          placeholder="e.g. Users already have an account."
                          containerClassName="flex-1 min-w-0"
                          className="w-full text-xs sm:text-sm text-[#252331] placeholder-[#9994A5] bg-transparent outline-none leading-relaxed"
                          actionSize="sm"
                          actionSlot={
                            <button
                              type="button"
                              onClick={() => remove("assumptions", i)}
                              aria-label="Remove assumption"
                              className="grid h-6 w-6 place-items-center rounded text-[#9994A5] hover:bg-rose-50/80 hover:text-[#C25D72] transition cursor-pointer"
                            >
                              <Trash2 size={12} />
                            </button>
                          }
                        />
                      </div>

                      {storyId && (
                        <div className="mt-1 pl-4">
                          <ContextualFeedbackThread
                            storyId={storyId}
                            sectionType="assumption"
                            itemId={itemId}
                            itemText={item}
                            pointNumber={i}
                            actionLabel="Discuss"
                            viewerType={effectiveViewer}
                            viewerId={currentUserId}
                            threads={threads}
                            onThreadCreated={handleThreadCreated}
                            onMessageAdded={(tid, m) => {
                              setThreads((prev) =>
                                prev.map((t) =>
                                  t.id === tid ? { ...t, messages: [...t.messages, m] } : t
                                )
                              );
                              onFeedbackChange?.();
                            }}
                            onStatusUpdated={handleThreadStatusUpdated}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 3. Clarifications */}
            <section className="space-y-3 pt-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-[#252331] tracking-tight">
                    Clarifications & Open Questions
                  </h4>
                  <p className="text-xs text-[#706C7D]">
                    Questions awaiting client answers or team decisions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => add("clarifications")}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[#A87936] hover:bg-[rgba(168,121,54,0.08)] transition shrink-0 whitespace-nowrap cursor-pointer"
                >
                  <Plus size={13} />
                  <span>Add clarification</span>
                </button>
              </div>

              <div className="space-y-2">
                {((Array.isArray(value.clarifications) ? value.clarifications : []) as string[]).map((item: string, i: number) => {
                  const itemId = `clarif-${i}`;
                  return (
                    <div
                      key={i}
                      className="rounded-xl border border-[rgba(168,121,54,0.16)] bg-[rgba(168,121,54,0.04)] p-2.5 transition focus-within:border-[#A87936] focus-within:bg-white"
                    >
                      <div className="flex items-start gap-2">
                        <HelpCircle size={14} className="text-[#A87936] shrink-0 mt-1" />
                        <Textarea
                          rows={1}
                          value={item}
                          onChange={(e) => updateList("clarifications", i, e.target.value)}
                          placeholder="e.g. Should email changes require verification?"
                          containerClassName="flex-1 min-w-0"
                          className="w-full text-xs sm:text-sm text-[#252331] placeholder-[#9994A5] bg-transparent outline-none leading-relaxed"
                          actionSize="sm"
                          actionSlot={
                            <button
                              type="button"
                              onClick={() => remove("clarifications", i)}
                              aria-label="Remove clarification"
                              className="grid h-6 w-6 place-items-center rounded text-[#9994A5] hover:bg-rose-50/80 hover:text-[#C25D72] transition cursor-pointer"
                            >
                              <Trash2 size={12} />
                            </button>
                          }
                        />
                      </div>

                      {storyId && (
                        <div className="mt-1 pl-5">
                          <ContextualFeedbackThread
                            storyId={storyId}
                            sectionType="clarification"
                            itemId={itemId}
                            itemText={item}
                            pointNumber={i}
                            actionLabel="Respond"
                            viewerType={effectiveViewer}
                            viewerId={currentUserId}
                            isReadOnly={isReadOnly}
                            threads={threads}
                            onThreadCreated={handleThreadCreated}
                            onMessageAdded={(tid, m) => {
                              setThreads((prev) =>
                                prev.map((t) =>
                                  t.id === tid ? { ...t, messages: [...t.messages, m] } : t
                                )
                              );
                              onFeedbackChange?.();
                            }}
                            onStatusUpdated={handleThreadStatusUpdated}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* General Story Feedback section */}
            {storyId && (
              <div className="rounded-xl border border-[rgba(74,61,100,0.08)] bg-[#FAF9FC] p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#252331] mb-1">
                  General Feedback & Story Discussion
                </h4>
                <p className="text-xs text-[#706C7D] mb-2">
                  Non-point specific collaboration or broad change requests.
                </p>
                <ContextualFeedbackThread
                  storyId={storyId}
                  sectionType="general"
                  itemId={null}
                  itemText={null}
                  actionLabel="Add general note"
                  viewerType={effectiveViewer}
                  viewerId={currentUserId}
                  isReadOnly={isReadOnly}
                  threads={threads}
                  onThreadCreated={handleThreadCreated}
                  onMessageAdded={(tid, m) => {
                    setThreads((prev) =>
                      prev.map((t) =>
                        t.id === tid ? { ...t, messages: [...t.messages, m] } : t
                      )
                    );
                    onFeedbackChange?.();
                  }}
                  onStatusUpdated={handleThreadStatusUpdated}
                />
              </div>
            )}

          </div>
        </div>
      ) : (
        <div className="space-y-5 sm:space-y-6 mt-5">
          {/* Read-Only Warning Banner */}
          {isReadOnly && (
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 p-3.5 flex items-start gap-2.5 text-xs text-amber-900">
              <AlertCircle size={15} className="shrink-0 text-amber-600 mt-0.5" />
              <div>
                <span className="font-semibold">Read-only access: </span>
                You are viewing this story as a non-reviewer team member. You can inspect criteria, assumptions, clarifications, and discussions, but only assigned reviewers can participate in discussions, request changes, or approve.
              </div>
            </div>
          )}

          {/* Story Status Control */}
          {renderStatusSelector()}

          {/* Epic Assignment */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5] mb-1.5">
              Assigned Epic
            </label>
            <select
              value={value.epic_id || ""}
              onChange={(e) =>
                setValue({ ...value, epic_id: e.target.value || null })
              }
              className="h-10 w-full rounded-xl border border-[rgba(74,61,100,0.11)] bg-white px-3 text-sm text-[#252331] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)] cursor-pointer"
            >
              <option value="">No Epic assigned (Uncategorized)</option>
              {epics.map((epic) => (
                <option key={epic.id} value={epic.id}>
                  {epic.name}
                </option>
              ))}
            </select>
            {story.suggestedEpic && !suggestedEpicExists && (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-[rgba(184,148,78,0.15)] bg-[rgba(184,148,78,0.06)] p-2.5 text-xs text-[#80642F]">
                <span>
                  Suggested Epic: <strong>{story.suggestedEpic}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => onCreateEpic(story.suggestedEpic!)}
                  className="font-medium text-[#80642F] hover:underline shrink-0"
                >
                  + Create Epic
                </button>
              </div>
            )}
          </div>

          {/* Story Title */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5] mb-1.5">
              Story Title
            </label>
            <input
              type="text"
              value={value.title}
              onChange={(e) => setValue({ ...value, title: e.target.value })}
              placeholder="e.g. Manage User Profile"
              className="h-10 w-full rounded-xl border border-[rgba(74,61,100,0.11)] bg-white px-3.5 text-sm font-medium text-[#252331] placeholder-[#9994A5] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)]"
            />
          </div>

          {/* Story Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5] mb-1.5">
              Description
            </label>
            <Textarea
              rows={3}
              value={value.description}
              onChange={(e) => setValue({ ...value, description: e.target.value })}
              placeholder="Describe the user capability and business value..."
              className="w-full rounded-xl border border-[rgba(74,61,100,0.11)] bg-white p-3 text-sm text-[#252331] placeholder-[#9994A5] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)]"
            />
          </div>

          {/* Story Reviewers Section */}
          {projectId && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5]">
                  Assigned Reviewers
                </label>
                <span className="text-xs text-[#706C7D]">
                  {selectedReviewerIds.length}{" "}
                  {selectedReviewerIds.length === 1 ? "reviewer" : "reviewers"}
                </span>
              </div>
              <p className="text-xs text-[#706C7D]">
                Only assigned reviewers can discuss, request changes, and approve this story.
              </p>

              {canManageReviewers ? (
                <div className="rounded-xl border border-[rgba(74,61,100,0.11)] bg-[#FAF9FC] p-3">
                  {loadingTeam ? (
                    <p className="text-xs text-[#9994A5]">Loading team members...</p>
                  ) : candidateReviewers.length === 0 ? (
                    <p className="text-xs text-[#706C7D]">
                      No other team members found in this project. Only client or team members verifying this story should be assigned as reviewers.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {candidateReviewers.map((tm) => {
                        const isSelected = selectedReviewerIds.includes(tm.id);
                        return (
                          <button
                            key={tm.id}
                            type="button"
                            onClick={() => {
                              setSelectedReviewerIds((prev) =>
                                isSelected
                                  ? prev.filter((id) => id !== tm.id)
                                  : [...prev, tm.id]
                              );
                            }}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${isSelected
                                ? "bg-[#80642F] text-white shadow-2xs"
                                : "border border-[rgba(74,61,100,0.12)] bg-white text-[#252331] hover:bg-[#FAF9FC]"
                              }`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${isSelected ? "bg-emerald-300" : "bg-zinc-300"
                                }`}
                            />
                            <span>{tm.name}</span>
                            <span className="text-[10px] opacity-75">(@{tm.username})</span>
                            {tm.role && tm.role !== "member" && (
                              <span
                                className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-semibold ${isSelected
                                    ? "bg-white/20 text-white"
                                    : "bg-zinc-100 text-zinc-600 border border-zinc-200"
                                  }`}
                              >
                                {tm.role}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedReviewerIds.length > 0 ? (
                    selectedReviewerIds.map((rid) => {
                      const tm =
                        teamMembers.find((m) => m.id === rid) ||
                        (story.reviewers || []).find(
                          (r: any) => r.user_id === rid || r.id === rid || r.team_user_id === rid
                        );
                      if (!tm) return null;
                      return (
                        <span
                          key={rid}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(74,61,100,0.12)] bg-white px-2.5 py-1 text-xs text-[#252331]"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          <span>{tm.name}</span>
                          {tm.username && (
                            <span className="text-[10px] text-[#706C7D]">(@{tm.username})</span>
                          )}
                          {tm.role && tm.role !== "member" && (
                            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-semibold text-zinc-600 border border-zinc-200">
                              {tm.role}
                            </span>
                          )}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-xs text-[#9994A5] italic">No reviewers assigned</span>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="border-t border-[rgba(74,61,100,0.06)] my-4" />
          {/* 1. Acceptance Criteria */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold text-[#252331] tracking-tight">
                  Acceptance Criteria
                </h4>
                <p className="text-xs text-[#706C7D]">
                  Precise testable statements for client validation and sign-off.
                </p>
              </div>
              <button
                type="button"
                onClick={() => add("acceptance_criteria")}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[#80642F] hover:bg-[rgba(184,148,78,0.08)] transition shrink-0 whitespace-nowrap cursor-pointer"
              >
                <Plus size={13} />
                <span>Add criterion</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {((Array.isArray(value.acceptance_criteria) ? value.acceptance_criteria : []) as string[]).map((item: string, i: number) => {
                const itemId = `ac-${i}`;
                return (
                  <div
                    key={i}
                    className="rounded-xl border border-[rgba(74,61,100,0.08)] bg-[#FAF9FC] p-3 transition focus-within:border-[#B8944E] focus-within:bg-white"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="font-mono text-[11px] font-bold text-[#80642F] bg-[rgba(184,148,78,0.10)] border border-[rgba(184,148,78,0.15)] rounded px-1.5 py-0.5 shrink-0 mt-0.5">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <Textarea
                        rows={1}
                        value={item}
                        onChange={(e) => updateList("acceptance_criteria", i, e.target.value)}
                        placeholder="Describe specific validation or behavior..."
                        containerClassName="flex-1 min-w-0"
                        className="w-full text-xs sm:text-sm text-[#252331] placeholder-[#9994A5] bg-transparent outline-none leading-relaxed"
                        actionSlot={
                          <button
                            type="button"
                            onClick={() => remove("acceptance_criteria", i)}
                            aria-label="Remove criterion"
                            className="grid h-7 w-7 place-items-center rounded-lg text-[#9994A5] hover:bg-rose-50/80 hover:text-[#C25D72] transition cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        }
                      />
                    </div>

                    {storyId && (
                      <div className="mt-1.5 pl-8">
                        <ContextualFeedbackThread
                          storyId={storyId}
                          sectionType="acceptance_criteria"
                          itemId={itemId}
                          itemText={item}
                          pointNumber={i}
                          actionLabel="Discuss criterion"
                          viewerType={effectiveViewer}
                          viewerId={currentUserId}
                          isReadOnly={isReadOnly}
                          threads={threads}
                          onThreadCreated={handleThreadCreated}
                          onMessageAdded={(tid, m) => {
                            setThreads((prev) =>
                              prev.map((t) =>
                                t.id === tid ? { ...t, messages: [...t.messages, m] } : t
                              )
                            );
                            onFeedbackChange?.();
                          }}
                          onStatusUpdated={handleThreadStatusUpdated}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* 2. Assumptions */}
          <section className="space-y-3 pt-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold text-[#252331] tracking-tight">
                  Assumptions
                </h4>
                <p className="text-xs text-[#706C7D]">
                  Underlying technical or product expectations.
                </p>
              </div>
              <button
                type="button"
                onClick={() => add("assumptions")}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[#80642F] hover:bg-[rgba(184,148,78,0.08)] transition shrink-0 whitespace-nowrap cursor-pointer"
              >
                <Plus size={13} />
                <span>Add assumption</span>
              </button>
            </div>

            <div className="space-y-2">
              {((Array.isArray(value.assumptions) ? value.assumptions : []) as string[]).map((item: string, i: number) => {
                const itemId = `assump-${i}`;
                return (
                  <div
                    key={i}
                    className="rounded-xl border border-[rgba(74,61,100,0.08)] bg-[#FAF9FC] p-2.5 transition focus-within:border-[#B8944E] focus-within:bg-white"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-[#9994A5] font-bold text-sm shrink-0 mt-0.5">•</span>
                      <Textarea
                        rows={1}
                        value={item}
                        onChange={(e) => updateList("assumptions", i, e.target.value)}
                        placeholder="e.g. Users already have an account."
                        containerClassName="flex-1 min-w-0"
                        className="w-full text-xs sm:text-sm text-[#252331] placeholder-[#9994A5] bg-transparent outline-none leading-relaxed"
                        actionSize="sm"
                        actionSlot={
                          <button
                            type="button"
                            onClick={() => remove("assumptions", i)}
                            aria-label="Remove assumption"
                            className="grid h-6 w-6 place-items-center rounded text-[#9994A5] hover:bg-rose-50/80 hover:text-[#C25D72] transition cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        }
                      />
                    </div>

                    {storyId && (
                      <div className="mt-1 pl-4">
                        <ContextualFeedbackThread
                          storyId={storyId}
                          sectionType="assumption"
                          itemId={itemId}
                          itemText={item}
                          pointNumber={i}
                          actionLabel="Discuss"
                          viewerType={effectiveViewer}
                          viewerId={currentUserId}
                          threads={threads}
                          onThreadCreated={handleThreadCreated}
                          onMessageAdded={(tid, m) => {
                            setThreads((prev) =>
                              prev.map((t) =>
                                t.id === tid ? { ...t, messages: [...t.messages, m] } : t
                              )
                            );
                            onFeedbackChange?.();
                          }}
                          onStatusUpdated={handleThreadStatusUpdated}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* 3. Clarifications */}
          <section className="space-y-3 pt-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold text-[#252331] tracking-tight">
                  Clarifications & Open Questions
                </h4>
                <p className="text-xs text-[#706C7D]">
                  Questions awaiting client answers or team decisions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => add("clarifications")}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[#A87936] hover:bg-[rgba(168,121,54,0.08)] transition shrink-0 whitespace-nowrap cursor-pointer"
              >
                <Plus size={13} />
                <span>Add clarification</span>
              </button>
            </div>

            <div className="space-y-2">
              {((Array.isArray(value.clarifications) ? value.clarifications : []) as string[]).map((item: string, i: number) => {
                const itemId = `clarif-${i}`;
                return (
                  <div
                    key={i}
                    className="rounded-xl border border-[rgba(168,121,54,0.16)] bg-[rgba(168,121,54,0.04)] p-2.5 transition focus-within:border-[#A87936] focus-within:bg-white"
                  >
                    <div className="flex items-start gap-2">
                      <HelpCircle size={14} className="text-[#A87936] shrink-0 mt-1" />
                      <Textarea
                        rows={1}
                        value={item}
                        onChange={(e) => updateList("clarifications", i, e.target.value)}
                        placeholder="e.g. Should email changes require verification?"
                        containerClassName="flex-1 min-w-0"
                        className="w-full text-xs sm:text-sm text-[#252331] placeholder-[#9994A5] bg-transparent outline-none leading-relaxed"
                        actionSize="sm"
                        actionSlot={
                          <button
                            type="button"
                            onClick={() => remove("clarifications", i)}
                            aria-label="Remove clarification"
                            className="grid h-6 w-6 place-items-center rounded text-[#9994A5] hover:bg-rose-50/80 hover:text-[#C25D72] transition cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        }
                      />
                    </div>

                    {storyId && (
                      <div className="mt-1 pl-5">
                        <ContextualFeedbackThread
                          storyId={storyId}
                          sectionType="clarification"
                          itemId={itemId}
                          itemText={item}
                          pointNumber={i}
                          actionLabel="Respond"
                          viewerType={effectiveViewer}
                          viewerId={currentUserId}
                          isReadOnly={isReadOnly}
                          threads={threads}
                          onThreadCreated={handleThreadCreated}
                          onMessageAdded={(tid, m) => {
                            setThreads((prev) =>
                              prev.map((t) =>
                                t.id === tid ? { ...t, messages: [...t.messages, m] } : t
                              )
                            );
                            onFeedbackChange?.();
                          }}
                          onStatusUpdated={handleThreadStatusUpdated}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* General Story Feedback section */}
          {storyId && (
            <div className="rounded-xl border border-[rgba(74,61,100,0.08)] bg-[#FAF9FC] p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#252331] mb-1">
                General Feedback & Story Discussion
              </h4>
              <p className="text-xs text-[#706C7D] mb-2">
                Non-point specific collaboration or broad change requests.
              </p>
              <ContextualFeedbackThread
                storyId={storyId}
                sectionType="general"
                itemId={null}
                itemText={null}
                actionLabel="Add general note"
                viewerType={effectiveViewer}
                viewerId={currentUserId}
                isReadOnly={isReadOnly}
                threads={threads}
                onThreadCreated={handleThreadCreated}
                onMessageAdded={(tid, m) => {
                  setThreads((prev) =>
                    prev.map((t) =>
                      t.id === tid ? { ...t, messages: [...t.messages, m] } : t
                    )
                  );
                  onFeedbackChange?.();
                }}
                onStatusUpdated={handleThreadStatusUpdated}
              />
            </div>
          )}

        </div>
      )}

      {/* Action Footer */}
      {layout === "sidebar" && (
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-[rgba(74,61,100,0.06)] pt-5">
          <div className="flex items-center gap-2">
            {onDelete && (
              <Button
                variant="danger"
                size="sm"
                leftIcon={<Trash2 size={14} />}
                onClick={onDelete}
              >
                Delete story
              </Button>
            )}
            {onApprove && !isReadOnly && (
              <Button
                variant={isTeamApproved ? "secondary" : "primary"}
                size="sm"
                leftIcon={
                  <CheckCircle2
                    size={14}
                    className={isTeamApproved ? "text-[#2E8B70]" : "text-white"}
                  />
                }
                onClick={() => onApprove(storyId!)}
                isLoading={approving}
              >
                {isTeamApproved ? "Team Approved" : "Approve for Team"}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() =>
                onSave({
                  ...value,
                  status: (value.status || "new") as StoryStatus,
                  reviewer_ids: selectedReviewerIds,
                } as any)
              }
            >
              Save changes
            </Button>
          </div>
        </div>
      )}

      {agentPromptOpen && (
        <AiAgentPromptModal
          isOpen={agentPromptOpen}
          onClose={() => setAgentPromptOpen(false)}
          story={value}
          epicName={assignedEpic?.name}
          epicDescription={assignedEpic?.description || undefined}
        />
      )}

      {/* Task Creation Modal */}
      {taskModalOpen && projectId && (
        <TaskModal
          isOpen={taskModalOpen}
          onClose={() => setTaskModalOpen(false)}
          onSaved={(newTask) => {
            setStoryTasks((prev) => [newTask, ...prev]);
            toast.success("Task created and linked to this story!");
          }}
          onBatchSaved={(newTasks) => {
            setStoryTasks((prev) => [...newTasks, ...prev]);
            toast.success(`${newTasks.length} tasks created and linked to this story!`);
          }}
          defaultProjectId={projectId}
          defaultStoryId={storyId}
          projects={[{ id: projectId, name: "Current Project" }]}
        />
      )}

      {/* Task Detail Drawer */}
      {selectedTaskId && (
        <TaskDetailDrawer
          taskId={selectedTaskId}
          isOpen={Boolean(selectedTaskId)}
          onClose={() => setSelectedTaskId(null)}
          onTaskUpdated={(updatedTask) => {
            setStoryTasks((prev) =>
              prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
            );
          }}
          onTaskDeleted={(deletedId) => {
            setStoryTasks((prev) => prev.filter((t) => t.id !== deletedId));
          }}
          onEditRequest={() => {
            setTaskModalOpen(true);
          }}
        />
      )}
    </div>
  );
}

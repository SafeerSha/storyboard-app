"use client";

import { useState, useEffect } from "react";
import {
  AlertCircle,
  HelpCircle,
  MessageSquare,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { ContextualFeedbackThread } from "@/components/ContextualFeedbackThread";
import { Button } from "@/components/ui/Button";
import type {
  GeneratedStory,
  Epic,
  Story,
  FeedbackThread,
  FeedbackAuthorType,
} from "@/lib/types";

export function StoryEditor({
  story,
  epics,
  onSave,
  onCancel,
  onCreateEpic,
  onDelete,
  onFeedbackChange,
  viewerType,
  currentUserId,
  isReviewer,
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
  onFeedbackChange?: () => void;
  viewerType?: FeedbackAuthorType;
  currentUserId?: string;
  isReviewer?: boolean;
}) {
  const [value, setValue] = useState(story);
  const storyId = story.id;
  const [threads, setThreads] = useState<FeedbackThread[]>([]);
  const effectiveViewer = viewerType || "freelancer";

  const isReadOnly = effectiveViewer === "team_user" && isReviewer === false;

  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; name: string; username: string; role?: string }>>([]);
  const [selectedReviewerIds, setSelectedReviewerIds] = useState<string[]>(
    story.reviewer_ids || []
  );
  const [loadingTeam, setLoadingTeam] = useState(false);

  useEffect(() => {
    setValue(story);
    setSelectedReviewerIds(story.reviewer_ids || []);
  }, [story]);

  const projectId = (story as any).project_id;
  useEffect(() => {
    if (!projectId) return;
    let active = true;
    setLoadingTeam(true);
    fetch(`/api/projects/${projectId}/team-members`)
      .then((r) => (r.ok ? r.json() : { teamMembers: [] }))
      .then((d) => {
        if (active && d.teamMembers) {
          setTeamMembers(d.teamMembers);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingTeam(false);
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  const canManageReviewers =
    effectiveViewer === "freelancer" ||
    (Boolean(story.created_by_id) && story.created_by_id === currentUserId);

  useEffect(() => {
    if (!storyId) return;
    let active = true;
    fetch(`/api/stories/${storyId}/feedback`)
      .then((r) => (r.ok ? r.json() : { threads: [] }))
      .then((d) => {
        if (active && d.threads) setThreads(d.threads);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [storyId]);

  const updateList = (
    key: "acceptance_criteria" | "assumptions" | "clarifications",
    index: number,
    text: string
  ) =>
    setValue((v) => ({
      ...v,
      [key]: (v[key] as string[]).map((x: string, i: number) =>
        i === index ? text : x
      ),
    }));

  const add = (key: "acceptance_criteria" | "assumptions" | "clarifications") =>
    setValue((v) => ({
      ...v,
      [key]: [...(v[key] as string[]), ""],
    }));

  const remove = (
    key: "acceptance_criteria" | "assumptions" | "clarifications",
    index: number
  ) =>
    setValue((v) => ({
      ...v,
      [key]: (v[key] as string[]).filter((_: string, i: number) => i !== index),
    }));

  const suggestedEpicExists = epics.some((e) => e.name === story.suggestedEpic);
  const openFeedbackCount = threads.filter((t) => t.status === "open").length;

  const assignedEpic = epics.find((e) => e.id === value.epic_id);
  const statusLabel =
    value.status === "approved"
      ? "Story · Approved"
      : value.status === "changes_requested"
      ? "Story · Changes Requested"
      : "Story · In Review";

  return (
    <div className="rounded-[18px] border border-[rgba(74,61,100,0.08)] bg-white p-5 sm:p-7 shadow-[0_8px_30px_rgba(70,55,95,0.055)] space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-[rgba(74,61,100,0.06)] pb-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9994A5]">
              {assignedEpic ? `← ${assignedEpic.name}` : "REQUIREMENTS"}
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
          <p className="mt-0.5 text-xs text-[#706C7D] font-medium">
            {statusLabel}
          </p>
        </div>

        <button
          type="button"
          onClick={onCancel}
          aria-label="Close story editor"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#9994A5] hover:bg-[#E9E3F4]/30 hover:text-[#252331] transition"
        >
          <X size={16} />
        </button>
      </div>

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
        <textarea
          rows={3}
          value={value.description}
          onChange={(e) => setValue({ ...value, description: e.target.value })}
          placeholder="Describe the user capability and business value..."
          className="w-full rounded-xl border border-[rgba(74,61,100,0.11)] bg-white p-3 text-sm text-[#252331] placeholder-[#9994A5] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)] resize-y"
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
              ) : teamMembers.length === 0 ? (
                <p className="text-xs text-[#9994A5]">No team members found in this project.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {teamMembers.map((tm) => {
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
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                          isSelected
                            ? "bg-[#80642F] text-white shadow-2xs"
                            : "border border-[rgba(74,61,100,0.12)] bg-white text-[#252331] hover:bg-[#FAF9FC]"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            isSelected ? "bg-emerald-300" : "bg-zinc-300"
                          }`}
                        />
                        <span>{tm.name}</span>
                        <span className="text-[10px] opacity-75">(@{tm.username})</span>
                        {tm.role && tm.role !== "member" && (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-semibold ${
                              isSelected
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
                teamMembers
                  .filter((tm) => selectedReviewerIds.includes(tm.id))
                  .map((tm) => (
                    <span
                      key={tm.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(74,61,100,0.12)] bg-white px-2.5 py-1 text-xs text-[#252331]"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span>{tm.name}</span>
                      <span className="text-[10px] text-[#706C7D]">(@{tm.username})</span>
                      {tm.role && tm.role !== "member" && (
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-semibold text-zinc-600 border border-zinc-200">
                          {tm.role}
                        </span>
                      )}
                    </span>
                  ))
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
        <div className="flex items-center justify-between">
          <div>
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
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[#80642F] hover:bg-[rgba(184,148,78,0.08)] transition"
          >
            <Plus size={13} />
            <span>Add criterion</span>
          </button>
        </div>

        <div className="space-y-2.5">
          {(value.acceptance_criteria as string[]).map((item, i) => {
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
                  <textarea
                    rows={2}
                    value={item}
                    onChange={(e) => updateList("acceptance_criteria", i, e.target.value)}
                    placeholder="Describe specific validation or behavior..."
                    className="flex-1 text-xs sm:text-sm text-[#252331] placeholder-[#9994A5] bg-transparent outline-none resize-none leading-relaxed"
                  />
                  <button
                    type="button"
                    onClick={() => remove("acceptance_criteria", i)}
                    aria-label="Remove criterion"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[#9994A5] hover:bg-rose-50/80 hover:text-[#C25D72] transition"
                  >
                    <Trash2 size={13} />
                  </button>
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
                      isReadOnly={isReadOnly}
                      threads={threads}
                      onThreadCreated={(t) => {
                        setThreads((prev) => [...prev, t]);
                        onFeedbackChange?.();
                      }}
                      onMessageAdded={(tid, m) => {
                        setThreads((prev) =>
                          prev.map((t) =>
                            t.id === tid ? { ...t, messages: [...t.messages, m] } : t
                          )
                        );
                        onFeedbackChange?.();
                      }}
                      onStatusUpdated={(tid, s) => {
                        setThreads((prev) =>
                          prev.map((t) => (t.id === tid ? { ...t, status: s } : t))
                        );
                        onFeedbackChange?.();
                      }}
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
        <div className="flex items-center justify-between">
          <div>
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
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[#80642F] hover:bg-[rgba(184,148,78,0.08)] transition"
          >
            <Plus size={13} />
            <span>Add assumption</span>
          </button>
        </div>

        <div className="space-y-2">
          {(value.assumptions as string[]).map((item, i) => {
            const itemId = `assump-${i}`;
            return (
              <div
                key={i}
                className="rounded-xl border border-[rgba(74,61,100,0.08)] bg-[#FAF9FC] p-2.5 transition focus-within:border-[#B8944E] focus-within:bg-white"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[#9994A5] font-bold text-sm shrink-0">•</span>
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => updateList("assumptions", i, e.target.value)}
                    placeholder="e.g. Users already have an account."
                    className="flex-1 text-xs sm:text-sm text-[#252331] placeholder-[#9994A5] bg-transparent outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => remove("assumptions", i)}
                    aria-label="Remove assumption"
                    className="grid h-6 w-6 shrink-0 place-items-center rounded text-[#9994A5] hover:bg-rose-50/80 hover:text-[#C25D72] transition"
                  >
                    <Trash2 size={12} />
                  </button>
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
                      threads={threads}
                      onThreadCreated={(t) => {
                        setThreads((prev) => [...prev, t]);
                        onFeedbackChange?.();
                      }}
                      onMessageAdded={(tid, m) => {
                        setThreads((prev) =>
                          prev.map((t) =>
                            t.id === tid ? { ...t, messages: [...t.messages, m] } : t
                          )
                        );
                        onFeedbackChange?.();
                      }}
                      onStatusUpdated={(tid, s) => {
                        setThreads((prev) =>
                          prev.map((t) => (t.id === tid ? { ...t, status: s } : t))
                        );
                        onFeedbackChange?.();
                      }}
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
        <div className="flex items-center justify-between">
          <div>
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
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[#A87936] hover:bg-[rgba(168,121,54,0.08)] transition"
          >
            <Plus size={13} />
            <span>Add clarification</span>
          </button>
        </div>

        <div className="space-y-2">
          {(value.clarifications as string[]).map((item, i) => {
            const itemId = `clarif-${i}`;
            return (
              <div
                key={i}
                className="rounded-xl border border-[rgba(168,121,54,0.16)] bg-[rgba(168,121,54,0.04)] p-2.5 transition focus-within:border-[#A87936] focus-within:bg-white"
              >
                <div className="flex items-center gap-2">
                  <HelpCircle size={14} className="text-[#A87936] shrink-0" />
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => updateList("clarifications", i, e.target.value)}
                    placeholder="e.g. Should email changes require verification?"
                    className="flex-1 text-xs sm:text-sm text-[#252331] placeholder-[#9994A5] bg-transparent outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => remove("clarifications", i)}
                    aria-label="Remove clarification"
                    className="grid h-6 w-6 shrink-0 place-items-center rounded text-[#9994A5] hover:bg-rose-50/80 hover:text-[#C25D72] transition"
                  >
                    <Trash2 size={12} />
                  </button>
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
                      isReadOnly={isReadOnly}
                      threads={threads}
                      onThreadCreated={(t) => {
                        setThreads((prev) => [...prev, t]);
                        onFeedbackChange?.();
                      }}
                      onMessageAdded={(tid, m) => {
                        setThreads((prev) =>
                          prev.map((t) =>
                            t.id === tid ? { ...t, messages: [...t.messages, m] } : t
                          )
                        );
                        onFeedbackChange?.();
                      }}
                      onStatusUpdated={(tid, s) => {
                        setThreads((prev) =>
                          prev.map((t) => (t.id === tid ? { ...t, status: s } : t))
                        );
                        onFeedbackChange?.();
                      }}
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
            isReadOnly={isReadOnly}
            threads={threads}
            onThreadCreated={(t) => {
              setThreads((prev) => [...prev, t]);
              onFeedbackChange?.();
            }}
            onMessageAdded={(tid, m) => {
              setThreads((prev) =>
                prev.map((t) =>
                  t.id === tid ? { ...t, messages: [...t.messages, m] } : t
                )
              );
              onFeedbackChange?.();
            }}
            onStatusUpdated={(tid, s) => {
              setThreads((prev) =>
                prev.map((t) => (t.id === tid ? { ...t, status: s } : t))
              );
              onFeedbackChange?.();
            }}
          />
        </div>
      )}

      {/* Action Footer */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-[rgba(74,61,100,0.06)] pt-5">
        <div>
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
                reviewer_ids: selectedReviewerIds,
              })
            }
          >
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}

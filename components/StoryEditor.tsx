"use client";

import { useState, useEffect } from "react";
import {
  HelpCircle,
  MessageSquare,
  Plus,
  Trash2,
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
}: {
  story: (GeneratedStory | Story) & {
    raw_requirement?: string | null;
    id?: string;
    suggestedEpic?: string;
  };
  epics: Epic[];
  onSave: (story: (GeneratedStory | Story) & { raw_requirement?: string | null }) => void;
  onCancel: () => void;
  onCreateEpic: (name: string) => void;
  onDelete?: () => void;
  onFeedbackChange?: () => void;
  viewerType?: FeedbackAuthorType;
}) {
  const [value, setValue] = useState(story);
  const storyId = story.id;
  const [threads, setThreads] = useState<FeedbackThread[]>([]);
  const effectiveViewer = viewerType || "freelancer";

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
    <div className="rounded-2xl border border-zinc-200/90 bg-white p-5 sm:p-7 shadow-card space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {assignedEpic ? `← ${assignedEpic.name}` : "REQUIREMENTS"}
            </span>
            {openFeedbackCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200/80">
                <MessageSquare size={11} />
                {openFeedbackCount} open feedback
              </span>
            )}
          </div>
          <h3 className="text-lg font-semibold tracking-tight text-[#111827] truncate">
            {value.title || "Untitled Story"}
          </h3>
          <p className="mt-0.5 text-xs text-[#64748B] font-medium">
            {statusLabel}
          </p>
        </div>

        <button
          type="button"
          onClick={onCancel}
          aria-label="Close story editor"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition"
        >
          <X size={16} />
        </button>
      </div>

      {/* Epic Assignment */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
          Assigned Epic
        </label>
        <select
          value={value.epic_id || ""}
          onChange={(e) =>
            setValue({ ...value, epic_id: e.target.value || null })
          }
          className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
        >
          <option value="">No Epic assigned (Uncategorized)</option>
          {epics.map((epic) => (
            <option key={epic.id} value={epic.id}>
              {epic.name}
            </option>
          ))}
        </select>
        {story.suggestedEpic && !suggestedEpicExists && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-indigo-100 bg-indigo-50/50 p-2.5 text-xs text-indigo-900">
            <span>
              Suggested Epic: <strong>{story.suggestedEpic}</strong>
            </span>
            <button
              type="button"
              onClick={() => onCreateEpic(story.suggestedEpic!)}
              className="font-medium text-indigo-600 hover:underline shrink-0"
            >
              + Create Epic
            </button>
          </div>
        )}
      </div>

      {/* Story Title */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
          Story Title
        </label>
        <input
          type="text"
          value={value.title}
          onChange={(e) => setValue({ ...value, title: e.target.value })}
          placeholder="e.g. Manage User Profile"
          className="h-10 w-full rounded-xl border border-zinc-200 px-3.5 text-sm font-medium text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Story Description */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
          Description
        </label>
        <textarea
          rows={3}
          value={value.description}
          onChange={(e) => setValue({ ...value, description: e.target.value })}
          placeholder="Describe the user capability and business value..."
          className="w-full rounded-xl border border-zinc-200 p-3 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-y"
        />
      </div>

      <div className="border-t border-zinc-100 my-4" />

      {/* 1. Acceptance Criteria */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-slate-900 tracking-tight">
              Acceptance Criteria
            </h4>
            <p className="text-xs text-zinc-500">
              Precise testable statements for client validation and sign-off.
            </p>
          </div>
          <button
            type="button"
            onClick={() => add("acceptance_criteria")}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition"
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
                className="rounded-xl border border-zinc-200/80 bg-zinc-50/40 p-3 transition focus-within:border-indigo-400 focus-within:bg-white"
              >
                <div className="flex items-start gap-2.5">
                  <span className="font-mono text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5 shrink-0 mt-0.5">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <textarea
                    rows={2}
                    value={item}
                    onChange={(e) => updateList("acceptance_criteria", i, e.target.value)}
                    placeholder="Describe specific validation or behavior..."
                    className="flex-1 text-xs sm:text-sm text-zinc-900 bg-transparent outline-none resize-none leading-relaxed"
                  />
                  <button
                    type="button"
                    onClick={() => remove("acceptance_criteria", i)}
                    aria-label="Remove criterion"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-zinc-400 hover:bg-rose-50 hover:text-rose-600 transition"
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
            <h4 className="text-sm font-semibold text-slate-900 tracking-tight">
              Assumptions
            </h4>
            <p className="text-xs text-zinc-500">
              Underlying technical or product expectations.
            </p>
          </div>
          <button
            type="button"
            onClick={() => add("assumptions")}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 transition"
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
                className="rounded-xl border border-zinc-200/70 bg-zinc-50/30 p-2.5 transition focus-within:border-zinc-300 focus-within:bg-white"
              >
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 font-bold text-sm shrink-0">•</span>
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => updateList("assumptions", i, e.target.value)}
                    placeholder="e.g. Users already have an account."
                    className="flex-1 text-xs sm:text-sm text-zinc-800 bg-transparent outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => remove("assumptions", i)}
                    aria-label="Remove assumption"
                    className="grid h-6 w-6 shrink-0 place-items-center rounded text-zinc-400 hover:bg-rose-50 hover:text-rose-600 transition"
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
            <h4 className="text-sm font-semibold text-slate-900 tracking-tight">
              Clarifications & Open Questions
            </h4>
            <p className="text-xs text-zinc-500">
              Questions awaiting client answers or team decisions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => add("clarifications")}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 transition"
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
                className="rounded-xl border border-amber-200/60 bg-amber-50/20 p-2.5 transition focus-within:border-amber-300 focus-within:bg-white"
              >
                <div className="flex items-center gap-2">
                  <HelpCircle size={14} className="text-amber-600 shrink-0" />
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => updateList("clarifications", i, e.target.value)}
                    placeholder="e.g. Should email changes require verification?"
                    className="flex-1 text-xs sm:text-sm text-zinc-800 bg-transparent outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => remove("clarifications", i)}
                    aria-label="Remove clarification"
                    className="grid h-6 w-6 shrink-0 place-items-center rounded text-zinc-400 hover:bg-rose-50 hover:text-rose-600 transition"
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
        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1">
            General Feedback & Story Discussion
          </h4>
          <p className="text-xs text-zinc-400 mb-2">
            Non-point specific collaboration or broad change requests.
          </p>
          <ContextualFeedbackThread
            storyId={storyId}
            sectionType="general"
            itemId={null}
            itemText={null}
            actionLabel="Add general note"
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

      {/* Action Footer */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-zinc-100 pt-5">
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
          <Button variant="primary" size="sm" onClick={() => onSave(value)}>
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}

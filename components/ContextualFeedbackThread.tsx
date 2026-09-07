"use client";

import { useState } from "react";
import {
  CheckCircle2,
  CornerDownRight,
  MessageSquare,
  Plus,
  RotateCcw,
  Send,
  X,
} from "lucide-react";
import type {
  FeedbackThread,
  FeedbackMessage,
  FeedbackSectionType,
  FeedbackThreadStatus,
  FeedbackAuthorType,
} from "@/lib/types";
import { toast } from "@/lib/toast";

interface ContextualFeedbackThreadProps {
  storyId: string;
  sectionType: FeedbackSectionType;
  itemId?: string | null;
  itemText?: string | null;
  pointNumber?: number;
  actionLabel?: string;
  viewerType: FeedbackAuthorType;
  threads: FeedbackThread[];
  onThreadCreated?: (thread: FeedbackThread) => void;
  onMessageAdded?: (threadId: string, message: FeedbackMessage) => void;
  onStatusUpdated?: (threadId: string, status: FeedbackThreadStatus) => void;
}

export function ContextualFeedbackThread({
  storyId,
  sectionType,
  itemId,
  itemText,
  pointNumber,
  actionLabel = "Request change",
  viewerType,
  threads,
  onThreadCreated,
  onMessageAdded,
  onStatusUpdated,
}: ContextualFeedbackThreadProps) {
  const [isOpenInput, setIsOpenInput] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [expandedThreads, setExpandedThreads] = useState(true);

  // Filter threads that match this specific item / section
  const relevantThreads = threads.filter((t) => {
    if (sectionType === "general") {
      return t.section_type === "general";
    }
    return (
      t.section_type === sectionType &&
      (t.item_id === itemId || (!t.item_id && !itemId))
    );
  });

  const openThreads = relevantThreads.filter((t) => t.status === "open");
  const hasThreads = relevantThreads.length > 0;

  async function handleCreateThread() {
    if (!newComment.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/stories/${storyId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionType,
          itemId: itemId || null,
          itemText: itemText || null,
          body: newComment.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit feedback");

      setNewComment("");
      setIsOpenInput(false);
      if (onThreadCreated && data.thread) {
        onThreadCreated(data.thread);
      }
      toast.success("Comment added");
    } catch {
      toast.error("Unable to add comment");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendReply(threadId: string) {
    const text = replyTextMap[threadId]?.trim();
    if (!text) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/feedback/${threadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId,
          body: text,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send reply");

      setReplyTextMap((prev) => ({ ...prev, [threadId]: "" }));
      if (onMessageAdded && data.message) {
        onMessageAdded(threadId, data.message);
      }
      toast.success("Reply added");
    } catch {
      toast.error("Unable to send reply");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleStatus(
    threadId: string,
    currentStatus: FeedbackThreadStatus
  ) {
    const nextStatus: FeedbackThreadStatus =
      currentStatus === "open" ? "resolved" : "open";
    setLoading(true);
    try {
      const res = await fetch(`/api/feedback/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId,
          status: nextStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");

      if (onStatusUpdated) {
        onStatusUpdated(threadId, nextStatus);
      }
      toast.success(nextStatus === "resolved" ? "Comment thread resolved" : "Comment thread reopened");
    } catch {
      toast.error("Unable to update status");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      {/* Existing Threads Header & List */}
      {hasThreads && (
        <div className="space-y-2">
          {relevantThreads.map((thread) => {
            const isOpen = thread.status === "open";
            return (
              <div
                key={thread.id}
                className={`rounded-xl border p-3 sm:p-3.5 text-xs sm:text-sm transition-colors ${
                  isOpen
                    ? "border-amber-200/80 bg-amber-50/30"
                    : "border-zinc-200/70 bg-zinc-50/60"
                }`}
              >
                {/* Thread Header */}
                <div className="flex items-center justify-between gap-2 border-b border-zinc-200/60 pb-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        isOpen
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {isOpen ? "● Open change request" : "✓ Resolved"}
                    </span>
                    {thread.messages.length > 0 && (
                      <span className="text-[11px] text-zinc-400">
                        {thread.messages.length}{" "}
                        {thread.messages.length === 1 ? "note" : "notes"}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleToggleStatus(thread.id, thread.status)}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition ${
                      isOpen
                        ? "text-emerald-700 hover:bg-emerald-100/70"
                        : "text-zinc-600 hover:bg-zinc-200/60"
                    }`}
                  >
                    {isOpen ? (
                      <>
                        <CheckCircle2 size={12} className="stroke-[2.5]" />
                        <span>Resolve</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw size={12} />
                        <span>Reopen</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Messages in thread */}
                <div className="space-y-2">
                  {thread.messages.map((msg) => {
                    const isTeamUser = msg.author_type === "team_user";
                    const isClient = msg.author_type === "client";
                    const initials = msg.author_name
                      ? msg.author_name.slice(0, 2).toUpperCase()
                      : "U";

                    return (
                      <div
                        key={msg.id}
                        className={`rounded-lg p-2.5 border transition-colors ${
                          isTeamUser
                            ? "bg-emerald-50/50 border-emerald-100"
                            : isClient
                            ? "bg-white border-zinc-200/80 shadow-2xs"
                            : "bg-indigo-50/50 border-indigo-100"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-1">
                          <div className="flex items-center gap-1.5">
                            <div className="grid h-5 w-5 place-items-center rounded-full bg-slate-900 text-[10px] font-semibold text-white">
                              {initials}
                            </div>
                            <span className="font-semibold text-slate-900">
                              {msg.author_name}
                            </span>
                            <span
                              className={`rounded-full px-1.5 py-0.2 text-[10px] font-medium ${
                                isTeamUser
                                  ? "bg-emerald-100 text-emerald-800"
                                  : isClient
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-indigo-100 text-indigo-800"
                              }`}
                            >
                              {isTeamUser
                                ? "Team"
                                : isClient
                                ? "Client"
                                : "Freelancer"}
                            </span>
                          </div>
                          <span className="text-[11px] text-zinc-400">
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-zinc-700 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap pl-6">
                          {msg.body}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Reply Composer */}
                <div className="mt-2.5 pt-2 border-t border-zinc-200/60">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={replyTextMap[thread.id] || ""}
                      onChange={(e) =>
                        setReplyTextMap((prev) => ({
                          ...prev,
                          [thread.id]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendReply(thread.id);
                        }
                      }}
                      placeholder="Write a reply..."
                      className="h-8 flex-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs text-zinc-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      disabled={loading || !replyTextMap[thread.id]?.trim()}
                      onClick={() => handleSendReply(thread.id)}
                      className="inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white disabled:opacity-40 hover:bg-slate-800 transition"
                    >
                      <Send size={11} />
                      <span>Reply</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Action / Trigger Row */}
      {!isOpenInput ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsOpenInput(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition p-1 rounded hover:bg-indigo-50/60"
          >
            <MessageSquare size={13} />
            <span>{actionLabel}</span>
          </button>

          {openThreads.length > 0 && !hasThreads && (
            <span className="text-xs text-amber-700 font-medium">
              💬 {openThreads.length} open discussion
            </span>
          )}
        </div>
      ) : (
        /* New Thread Composer */
        <div className="rounded-xl border border-indigo-200 bg-white p-3 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-900">
              {pointNumber !== undefined
                ? `${
                    sectionType === "acceptance_criteria"
                      ? "Criterion"
                      : sectionType === "assumption"
                      ? "Assumption"
                      : "Clarification"
                  } #${pointNumber + 1}`
                : "Feedback & Changes"}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsOpenInput(false);
                setNewComment("");
              }}
              className="text-zinc-400 hover:text-zinc-700 p-0.5 rounded"
            >
              <X size={14} />
            </button>
          </div>

          <textarea
            rows={2}
            autoFocus
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={
              viewerType === "client"
                ? "Describe what should be adjusted or clarified..."
                : "Add a discussion note or feedback item..."
            }
            className="w-full rounded-lg border border-zinc-200 p-2.5 text-xs sm:text-sm text-zinc-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
          />

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsOpenInput(false);
                setNewComment("");
              }}
              className="rounded-lg px-2.5 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading || !newComment.trim()}
              onClick={handleCreateThread}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-40 transition"
            >
              <Send size={11} />
              <span>Submit note</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

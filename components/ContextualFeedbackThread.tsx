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
  Edit2,
  Trash2,
} from "lucide-react";
import type {
  FeedbackThread,
  FeedbackMessage,
  FeedbackSectionType,
  FeedbackThreadStatus,
  FeedbackAuthorType,
} from "@/lib/types";
import { toast } from "@/lib/toast";
import { VoiceTextarea } from "@/components/ui/VoiceTextarea";
import { VoiceInput } from "@/components/ui/VoiceInput";
import { Button } from "@/components/ui/Button";

interface ContextualFeedbackThreadProps {
  storyId: string;
  sectionType: FeedbackSectionType;
  itemId?: string | null;
  itemText?: string | null;
  pointNumber?: number;
  actionLabel?: string;
  viewerType: FeedbackAuthorType;
  viewerId?: string;
  threads: FeedbackThread[];
  isReadOnly?: boolean;
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
  viewerId,
  threads,
  isReadOnly = false,
  onThreadCreated,
  onMessageAdded,
  onStatusUpdated,
}: ContextualFeedbackThreadProps) {
  const [isOpenInput, setIsOpenInput] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [expandedThreads, setExpandedThreads] = useState(true);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isUpdatingMessage, setIsUpdatingMessage] = useState(false);

  // Filter threads that match this specific item / section
  const threadList = Array.isArray(threads) ? threads : [];
  const relevantThreads = threadList.filter((t) => {
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
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("storyboard:review-updated"));
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
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("storyboard:review-updated"));
      }
      toast.success("Thread resolved");
    } catch {
      toast.error("Unable to update status");
    } finally {
      setLoading(false);
    }
  }

  async function handleEditMessage(threadId: string, messageId: string) {
    if (!editContent.trim()) return;
    setIsUpdatingMessage(true);
    try {
      const res = await fetch(`/api/stories/${storyId}/feedback/messages/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: editContent.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update message");

      // We use the event to trigger a re-fetch since `threads` are state from parent
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("storyboard:review-updated"));
        window.dispatchEvent(new CustomEvent("storyboard:client-review-updated"));
      }
      setEditingMessageId(null);
      setEditContent("");
      toast.success("Message updated");
    } catch {
      toast.error("Unable to update message");
    } finally {
      setIsUpdatingMessage(false);
    }
  }

  async function handleDeleteMessage(threadId: string, messageId: string) {
    if (!confirm("Are you sure you want to delete this message?")) return;
    setIsUpdatingMessage(true);
    try {
      const res = await fetch(`/api/stories/${storyId}/feedback/messages/${messageId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete message");

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("storyboard:review-updated"));
        window.dispatchEvent(new CustomEvent("storyboard:client-review-updated"));
      }
      toast.success("Message deleted");
    } catch {
      toast.error("Unable to delete message");
    } finally {
      setIsUpdatingMessage(false);
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

                  {!isReadOnly && (
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
                  )}
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
                            : "bg-[rgba(184,148,78,0.06)] border-[rgba(184,148,78,0.15)]"
                        } group`}
                      >
                        <div className="flex items-center justify-between text-xs mb-1">
                          <div className="flex items-center gap-1.5">
                            <div className="grid h-5 w-5 place-items-center rounded-full bg-slate-900 text-[10px] font-semibold text-white">
                              {initials}
                            </div>
                            <span className="font-semibold text-slate-900">
                              {msg.author_name}
                            </span>
                            {!isClient && (
                              <span
                                className={`rounded-full px-1.5 py-0.2 text-[10px] font-medium ${
                                  isTeamUser
                                    ? "bg-emerald-100 text-emerald-800"
                                    : msg.author_type === "admin"
                                    ? "bg-purple-100 text-purple-800"
                                    : "bg-[rgba(184,148,78,0.12)] text-[#80642F]"
                                }`}
                              >
                                {isTeamUser
                                  ? "Team"
                                  : msg.author_type === "admin"
                                  ? "Admin"
                                  : "Freelancer"}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] text-zinc-400">
                              {new Date(msg.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {viewerId && msg.author_id === viewerId && !isReadOnly && (
                              <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1.5">
                                <button
                                  type="button"
                                  title="Edit message"
                                  onClick={() => {
                                    setEditingMessageId(msg.id);
                                    setEditContent(msg.body);
                                  }}
                                  className="text-zinc-400 hover:text-[#B8944E] transition"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  title="Delete message"
                                  onClick={() => handleDeleteMessage(thread.id, msg.id)}
                                  className="text-zinc-400 hover:text-rose-500 transition"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        {editingMessageId === msg.id ? (
                          <div className="mt-1 pl-6">
                            <VoiceTextarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="w-full text-xs min-h-[60px] rounded-lg border border-zinc-200 bg-white p-2 outline-none focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)]"
                              autoFocus
                            />
                            <div className="flex items-center gap-2 mt-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[10px] px-2"
                                onClick={() => {
                                  setEditingMessageId(null);
                                  setEditContent("");
                                }}
                                disabled={isUpdatingMessage}
                              >
                                Cancel
                              </Button>
                              <Button
                                variant="primary"
                                size="sm"
                                className="h-6 text-[10px] px-2"
                                onClick={() => handleEditMessage(thread.id, msg.id)}
                                 isLoading={isUpdatingMessage}
                              >
                                Save
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-zinc-700 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap pl-6">
                            {msg.body}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Reply Composer */}
                <div className="mt-2.5 pt-2 border-t border-zinc-200/60">
                  {isReadOnly ? (
                    <div className="text-[11px] text-zinc-400 italic px-1">
                      Read-only: only assigned reviewers can reply.
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <VoiceInput
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
                        containerClassName="flex-1 min-w-0"
                        className="h-8 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs text-zinc-900 outline-none focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)]"
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
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Action / Trigger Row */}
      {!isReadOnly && !isOpenInput && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsOpenInput(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#80642F] hover:text-[#B8944E] transition p-1 rounded hover:bg-[rgba(184,148,78,0.06)]"
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
      )}

      {!isReadOnly && isOpenInput && (
        <div className="rounded-xl border border-[rgba(184,148,78,0.2)] bg-white p-3 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#80642F]">
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

          <VoiceTextarea
            rows={2}
            autoFocus
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={
              viewerType === "client"
                ? "Describe what should be adjusted or clarified..."
                : "Add a discussion note or feedback item..."
            }
            className="w-full rounded-lg border border-zinc-200 p-2.5 text-xs sm:text-sm text-zinc-900 outline-none focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)] resize-none"
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

      {isReadOnly && openThreads.length > 0 && !hasThreads && (
        <span className="text-xs text-amber-700 font-medium">
          💬 {openThreads.length} open discussion
        </span>
      )}
    </div>
  );
}

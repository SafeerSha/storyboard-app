"use client";

import { useState, useEffect } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  HelpCircle,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { ContextualFeedbackThread } from "@/components/ContextualFeedbackThread";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/lib/toast";
import type { Story, FeedbackThread, FeedbackMessage, FeedbackThreadStatus } from "@/lib/types";

interface ClientStoryReviewProps {
  story: Story;
  initialThreads?: FeedbackThread[];
  viewerId?: string;
  onStatusChange?: (newStatus: string) => void;
}

export function ClientStoryReview({
  story,
  initialThreads = [],
  viewerId,
  onStatusChange,
}: ClientStoryReviewProps) {
  const [threads, setThreads] = useState<FeedbackThread[]>(initialThreads);
  const [storyStatus, setStoryStatus] = useState(story.status);
  const [approving, setApproving] = useState(false);
  const [approvalError, setApprovalError] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Fetch feedback threads on mount if not provided
  useEffect(() => {
    let isMounted = true;
    async function loadFeedback() {
      try {
        const res = await fetch(`/api/stories/${story.id}/feedback`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.threads) {
            setThreads(data.threads);
          }
        }
      } catch {
        // Silently catch
      }
    }
    loadFeedback();
    return () => {
      isMounted = false;
    };
  }, [story.id]);

  const openThreadsCount = threads.filter((t) => t.status === "open").length;

  function handleThreadCreated(newThread: FeedbackThread) {
    setThreads((prev) => [...prev, newThread]);
    setStoryStatus("changes_requested");
    if (onStatusChange) onStatusChange("changes_requested");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("storyboard:client-review-updated"));
    }
  }

  function handleMessageAdded(threadId: string, newMsg: FeedbackMessage) {
    setThreads((prev) =>
      prev.map((t) =>
        t.id === threadId ? { ...t, messages: [...t.messages, newMsg] } : t
      )
    );
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("storyboard:client-review-updated"));
    }
  }

  function handleStatusUpdated(
    threadId: string,
    nextStatus: FeedbackThreadStatus
  ) {
    setThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, status: nextStatus } : t))
    );
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("storyboard:client-review-updated"));
    }
  }

  async function handleApprove(confirmWithUnresolved = false) {
    setApproving(true);
    setApprovalError("");
    try {
      const res = await fetch(`/api/client/stories/${story.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmWithUnresolved }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.requiresConfirmation) {
          setShowConfirmModal(true);
          setApprovalError(data.error);
          return;
        }
        throw new Error(data.error || "Approval failed");
      }

      setStoryStatus("approved");
      setShowConfirmModal(false);
      setThreads((prev) => prev.map((t) => ({ ...t, status: "resolved" })));
      if (onStatusChange) onStatusChange("approved");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("storyboard:client-review-updated"));
      }
      toast.success("Story approved");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Approval failed";
      setApprovalError(msg);
      toast.error("Unable to approve story");
    } finally {
      setApproving(false);
    }
  }

  const isApproved = storyStatus === "approved";

  return (
    <div className="space-y-6 pt-2">
      {/* 1. Acceptance Criteria */}
      <section className="space-y-3">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Acceptance Criteria
          </h4>
          <p className="text-xs text-zinc-500 mt-0.5">
            Requirements to be verified and tested for sign-off.
          </p>
        </div>

        {story.acceptance_criteria && story.acceptance_criteria.length > 0 ? (
          <div className="space-y-2.5">
            {story.acceptance_criteria.map((c, i) => (
              <div
                key={i}
                className="rounded-xl border border-zinc-200/80 bg-zinc-50/40 p-3.5 transition"
              >
                <div className="flex items-start gap-2.5">
                  <span className="font-mono text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5 shrink-0 mt-0.5">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="text-xs sm:text-sm text-zinc-800 leading-relaxed break-words flex-1">
                    {c}
                  </p>
                </div>

                {/* Contextual Feedback on this criterion */}
                <div className="mt-1 pl-7">
                  <ContextualFeedbackThread
                    storyId={story.id}
                    sectionType="acceptance_criteria"
                    itemId={`ac-${i}`}
                    itemText={c}
                    pointNumber={i}
                    actionLabel="Request change"
                    viewerType="client"
                    viewerId={viewerId}
                    threads={threads}
                    onThreadCreated={handleThreadCreated}
                    onMessageAdded={handleMessageAdded}
                    onStatusUpdated={handleStatusUpdated}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-400 italic">No criteria specified yet.</p>
        )}
      </section>

      {/* 2. Assumptions */}
      {story.assumptions && story.assumptions.length > 0 && (
        <section className="space-y-3 pt-2">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Assumptions
            </h4>
            <p className="text-xs text-zinc-500 mt-0.5">
              Underlying assumptions made when drafting these requirements.
            </p>
          </div>

          <div className="space-y-2">
            {story.assumptions.map((a, i) => (
              <div
                key={i}
                className="rounded-xl border border-zinc-200/70 bg-zinc-50/30 p-2.5"
              >
                <div className="flex items-start gap-2 text-xs sm:text-sm text-zinc-800">
                  <span className="text-zinc-400 font-bold">•</span>
                  <p className="leading-relaxed flex-1">{a}</p>
                </div>

                <div className="mt-1 pl-4">
                  <ContextualFeedbackThread
                    storyId={story.id}
                    sectionType="assumption"
                    itemId={`assump-${i}`}
                    itemText={a}
                    pointNumber={i}
                    actionLabel="Comment"
                    viewerType="client"
                    viewerId={viewerId}
                    threads={threads}
                    onThreadCreated={handleThreadCreated}
                    onMessageAdded={handleMessageAdded}
                    onStatusUpdated={handleStatusUpdated}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. Clarifications */}
      {story.clarifications && story.clarifications.length > 0 && (
        <section className="space-y-3 pt-2">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Clarifications & Open Questions
            </h4>
            <p className="text-xs text-zinc-500 mt-0.5">
              Decisions the development team is seeking clarification on.
            </p>
          </div>

          <div className="space-y-2">
            {story.clarifications.map((cl, i) => (
              <div
                key={i}
                className="rounded-xl border border-amber-200/60 bg-amber-50/20 p-2.5"
              >
                <div className="flex items-start gap-2 text-xs sm:text-sm text-zinc-800">
                  <HelpCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="leading-relaxed flex-1">{cl}</p>
                </div>

                <div className="mt-1 pl-5">
                  <ContextualFeedbackThread
                    storyId={story.id}
                    sectionType="clarification"
                    itemId={`clarif-${i}`}
                    itemText={cl}
                    pointNumber={i}
                    actionLabel="Respond"
                    viewerType="client"
                    viewerId={viewerId}
                    threads={threads}
                    onThreadCreated={handleThreadCreated}
                    onMessageAdded={handleMessageAdded}
                    onStatusUpdated={handleStatusUpdated}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. General Feedback */}
      <section className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1">
          General Feedback & Questions
        </h4>
        <p className="text-xs text-zinc-400 mb-2">
          Feedback that applies to the entire story rather than a specific item.
        </p>
        <ContextualFeedbackThread
          storyId={story.id}
          sectionType="general"
          itemId={null}
          itemText={null}
          actionLabel="Request general changes"
          viewerType="client"
          viewerId={viewerId}
          threads={threads}
          onThreadCreated={handleThreadCreated}
          onMessageAdded={handleMessageAdded}
          onStatusUpdated={handleStatusUpdated}
        />
      </section>

      {/* 5. Deliberate Approval Section */}
      <section className="border-t border-zinc-200/80 pt-5 space-y-3">
        {story.team_review_status === "approved" && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50/60 border border-emerald-200/80 px-3.5 py-2 text-xs text-emerald-800">
            <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
            <span>
              Internal Team Review: Approved{" "}
              {story.team_approved_by_name ? `by ${story.team_approved_by_name}` : ""}
            </span>
          </div>
        )}

        {isApproved ? (
          <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs sm:text-sm text-emerald-900">
            <CheckCircle2 size={20} className="text-emerald-600 shrink-0 stroke-[2.5]" />
            <div>
              <p className="font-semibold">Story Approved by Client</p>
              <p className="text-xs text-emerald-700 mt-0.5">
                This requirement is confirmed and ready for development.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">
                  Ready to approve?
                </h4>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Confirm all acceptance criteria match your project expectations.
                </p>
              </div>

              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  openThreadsCount > 0
                    ? "bg-amber-50 text-amber-800 border border-amber-200"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                }`}
              >
                {openThreadsCount > 0
                  ? `${openThreadsCount} open change request${openThreadsCount === 1 ? "" : "s"}`
                  : "No open change requests"}
              </span>
            </div>

            {/* Checklist Counts */}
            <div className="grid grid-cols-3 gap-2 py-2 border-y border-zinc-100 text-xs text-zinc-600">
              <div>
                <span className="text-[10px] uppercase text-zinc-400 block font-semibold">
                  Criteria
                </span>
                <span className="font-semibold text-slate-900">
                  {story.acceptance_criteria?.length ?? 0}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-zinc-400 block font-semibold">
                  Assumptions
                </span>
                <span className="font-semibold text-slate-900">
                  {story.assumptions?.length ?? 0}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-zinc-400 block font-semibold">
                  Clarifications
                </span>
                <span className="font-semibold text-slate-900">
                  {story.clarifications?.length ?? 0}
                </span>
              </div>
            </div>

            {approvalError && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800">
                <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-600" />
                <span>{approvalError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="primary"
                size="md"
                isLoading={approving}
                leftIcon={<Check size={14} />}
                onClick={() => handleApprove(false)}
              >
                Approve story
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Confirmation Modal if approving with open change requests */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Unresolved Change Requests"
        description={`This story still has ${openThreadsCount} unresolved change request${openThreadsCount === 1 ? '' : 's'}. Approving now will automatically mark these requests as resolved and queue the story for development.`}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setShowConfirmModal(false)}
            >
              Keep reviewing
            </Button>
            <Button
              variant="primary"
              isLoading={approving}
              onClick={() => handleApprove(true)}
            >
              Confirm & Approve Story
            </Button>
          </>
        }
      >
        <p className="text-xs text-zinc-500">
          Make sure your team is aligned on the requirements before giving final sign-off.
        </p>
      </Modal>
    </div>
  );
}

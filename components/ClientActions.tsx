"use client";
import { useState } from "react";
import { Check, MessageSquare, Send } from "lucide-react";
import { toast } from "@/lib/toast";
import { Textarea } from "@/components/ui/Textarea";

export function ClientActions({ storyId, status }: { storyId: string; status: string }) {
  const [comment, setComment] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(
    status === "approved" ? "approved" : status === "changes_requested" ? "changes_requested" : ""
  );

  async function action(actionType: "approve" | "request_changes") {
    setLoading(true);
    try {
      const url = actionType === "approve"
        ? `/api/client/stories/${storyId}/approve`
        : `/api/client/stories/${storyId}/request-changes`;
      const bodyStr = actionType === "approve" ? "{}" : JSON.stringify({ comment });
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bodyStr,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setDone(d.status);
      setComment("");
      setOpen(false);
      if (actionType === "approve") {
        toast.success("Story approved");
      } else {
        toast.success("Change request submitted");
      }
    } catch {
      toast.error(actionType === "approve" ? "Unable to approve story" : "Unable to submit change request");
    } finally {
      setLoading(false);
    }
  }

  if (done === "approved") {
    return (
      <div className="mt-6 flex items-center gap-2 border-t border-line pt-5 text-sm font-medium text-emerald-700">
        <Check size={17} /> Approved. This requirement is confirmed.
      </div>
    );
  }

  return (
    <div className="mt-6 border-t border-line pt-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => action("approve")}
          disabled={loading}
          className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 active:scale-[0.98] transition-all"
        >
          <Check size={16} /> Approve
        </button>
        <button
          onClick={() => setOpen(v => !v)}
          className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-line px-5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 active:scale-[0.98] transition-all"
        >
          <MessageSquare size={16} /> Request changes
        </button>
      </div>
      {open && (
        <div className="mt-4 rounded-xl bg-neutral-50 p-3 sm:p-4">
          <Textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Tell the freelancer what needs to change..."
            className="min-h-24 w-full rounded-xl border border-line bg-white p-3 text-sm outline-none focus:border-indigo-400 resize-y"
          />
          <button
            disabled={loading || !comment.trim()}
            onClick={() => action("request_changes")}
            className="mt-3 inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-ink px-5 py-2 text-sm font-medium text-white disabled:opacity-40 active:scale-[0.98] transition-all"
          >
            <Send size={14} /> Send changes
          </button>
        </div>
      )}
    </div>
  );
}

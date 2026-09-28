"use client";

import React, { useState } from "react";
import { Lightbulb, Sparkles } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import { Textarea } from "@/components/ui/Textarea";
import type { InboxItemPriority, InboxItemStatus, InboxItemType, ProjectInboxItem } from "@/lib/types";

interface CaptureIdeaModalProps {
  open: boolean;
  onClose: () => void;
  onCaptured: (item: ProjectInboxItem) => void;
}

export function CaptureIdeaModal({ open, onClose, onCaptured }: CaptureIdeaModalProps) {
  const [ideaText, setIdeaText] = useState("");
  const [explicitTitle, setExplicitTitle] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [type, setType] = useState<InboxItemType>("idea");
  const [priority, setPriority] = useState<InboxItemPriority>("medium");
  const [status, setStatus] = useState<InboxItemStatus>("inbox");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const resetForm = () => {
    setIdeaText("");
    setExplicitTitle("");
    setShowDetails(false);
    setType("idea");
    setPriority("medium");
    setStatus("inbox");
    setError("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = ideaText.trim();
    if (!content && !explicitTitle.trim()) {
      setError("Please write down what is on your mind.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: explicitTitle.trim() || content,
          description: explicitTitle.trim() ? content : "",
          type,
          priority,
          status,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save idea.");
      }

      toast.success("Idea captured");
      onCaptured(data.item);
      handleClose();
    } catch (err: any) {
      const msg = err.message || "Failed to capture idea.";
      setError(msg);
      toast.error("Unable to capture idea", { description: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={handleClose} title="Capture Idea" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-[#64748B]">
          A personal space to log raw thoughts, upcoming projects, and technical concepts without formal setup.
        </p>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            What is on your mind?
          </label>
          <Textarea
            autoFocus
            rows={4}
            value={ideaText}
            onChange={(e) => setIdeaText(e.target.value)}
            placeholder="e.g. AI tool that automatically reads PDF invoices and generates concise vendor summaries..."
            className="w-full rounded-xl border border-[#E2E6EF] bg-white p-3 text-sm text-[#111827] outline-none transition focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleSubmit(e);
              }
            }}
          />
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>Press Cmd+Enter or Ctrl+Enter to save</span>
            <button
              type="button"
              onClick={() => setShowDetails((prev) => !prev)}
              className="text-[#4F46E5] hover:underline font-medium"
            >
              {showDetails ? "Hide options" : "+ Add title & options"}
            </button>
          </div>
        </div>

        {showDetails && (
          <div className="space-y-3.5 rounded-xl border border-[#E2E6EF] bg-[#F8F9FC] p-3.5 animate-in fade-in duration-150">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Custom Title (Optional)
              </label>
              <input
                type="text"
                value={explicitTitle}
                onChange={(e) => setExplicitTitle(e.target.value)}
                placeholder="e.g. AI Invoice Assistant"
                className="h-9 w-full rounded-lg border border-[#E2E6EF] bg-white px-3 text-xs sm:text-sm text-[#111827] outline-none transition focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as InboxItemType)}
                  className="h-8 w-full rounded-lg border border-[#E2E6EF] bg-white px-2.5 text-xs text-[#111827] outline-none transition focus:border-[#4F46E5] cursor-pointer"
                >
                  <option value="idea">Idea</option>
                  <option value="upcoming_project">Upcoming Project</option>
                  <option value="research">Research</option>
                  <option value="opportunity">Opportunity</option>
                  <option value="experiment">Experiment</option>
                  <option value="feature">Feature</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as InboxItemPriority)}
                  className="h-8 w-full rounded-lg border border-[#E2E6EF] bg-white px-2.5 text-xs text-[#111827] outline-none transition focus:border-[#4F46E5] cursor-pointer"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as InboxItemStatus)}
                  className="h-8 w-full rounded-lg border border-[#E2E6EF] bg-white px-2.5 text-xs text-[#111827] outline-none transition focus:border-[#4F46E5] cursor-pointer"
                >
                  <option value="inbox">Inbox</option>
                  <option value="exploring">Exploring</option>
                  <option value="researching">Researching</option>
                  <option value="planned">Planned</option>
                  <option value="ready">Ready</option>
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#E2E6EF]">
          <Button type="button" variant="secondary" size="md" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={saving}
            leftIcon={<Sparkles size={14} />}
          >
            Save idea
          </Button>
        </div>
      </form>
    </Modal>
  );
}

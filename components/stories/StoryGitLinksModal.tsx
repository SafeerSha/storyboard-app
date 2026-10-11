"use client";

import { useEffect, useState } from "react";
import { ExternalLink, GitBranch, GitPullRequest, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import type { Story } from "@/lib/types";

export type StoryGitLinkField = "feature_branch" | "pull_request_url";

interface StoryGitLinksModalProps {
  story: Story;
  field: StoryGitLinkField;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (story: Story) => void;
}

const FIELD_META: Record<
  StoryGitLinkField,
  {
    label: string;
    placeholder: string;
    hint: string;
    icon: typeof GitBranch;
  }
> = {
  feature_branch: {
    label: "Feature Branch",
    placeholder: "e.g. feature/requirements-hierarchy-toggle",
    hint: "The Git branch where this story is being implemented.",
    icon: GitBranch,
  },
  pull_request_url: {
    label: "Pull Request",
    placeholder: "https://github.com/org/repo/pull/123",
    hint: "Link to the pull request raised for this story.",
    icon: GitPullRequest,
  },
};

export function StoryGitLinksModal({ story, field, isOpen, onClose, onSaved }: StoryGitLinksModalProps) {
  const meta = FIELD_META[field];
  const currentValue = story[field] ?? "";

  const [value, setValue] = useState(currentValue);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setValue(story[field] ?? "");
  }, [isOpen, story, field]);

  const handleSubmit = async (nextValue: string | null) => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/stories/${story.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: nextValue ? nextValue.trim() || null : null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to update ${meta.label.toLowerCase()}`);

      onSaved(data.story);
      toast.success(
        nextValue ? `${meta.label} updated` : `${meta.label} removed`
      );
      onClose();
    } catch (err: any) {
      toast.error(err.message || `Failed to update ${meta.label.toLowerCase()}`);
    } finally {
      setSaving(false);
    }
  };

  const isUrl = field === "pull_request_url";
  const trimmed = value.trim();
  const canOpen = isUrl && /^https?:\/\/\S+$/i.test(trimmed);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${currentValue ? "Edit" : "Add"} ${meta.label}`}
      description={story.title}
      maxWidth="sm"
      footer={
        <>
          {currentValue && (
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash2 size={14} />}
              onClick={() => handleSubmit(null)}
              isLoading={saving}
            >
              Remove
            </Button>
          )}
          <div className="flex items-center gap-2.5 sm:ml-auto">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleSubmit(trimmed)}
              isLoading={saving}
              disabled={!trimmed && !currentValue}
            >
              Save
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#9994A5]">
          <meta.icon size={13} className="text-[#80642F]" />
          {meta.label}
        </label>
        <input
          type={isUrl ? "url" : "text"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (trimmed) handleSubmit(trimmed);
            }
          }}
          placeholder={meta.placeholder}
          autoFocus
          className="h-10 w-full rounded-xl border border-[rgba(74,61,100,0.11)] bg-white px-3.5 font-mono text-xs text-[#252331] placeholder-[#9994A5] placeholder:font-sans outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)]"
        />
        <p className="text-xs text-[#706C7D]">{meta.hint}</p>
        {canOpen && (
          <a
            href={trimmed}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#80642F] hover:underline"
          >
            <ExternalLink size={12} />
            Open current link
          </a>
        )}
      </div>
    </Modal>
  );
}

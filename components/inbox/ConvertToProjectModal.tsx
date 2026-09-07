"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FolderKanban } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import type { ProjectInboxItem } from "@/lib/types";

interface ConvertToProjectModalProps {
  open: boolean;
  item: ProjectInboxItem | null;
  onClose: () => void;
  onConverted?: (project: { id: string; name: string }) => void;
}

export function ConvertToProjectModal({
  open,
  item,
  onClose,
  onConverted,
}: ConvertToProjectModalProps) {
  const router = useRouter();
  const [name, setName] = useState(item?.title || "");
  const [description, setDescription] = useState(item?.description || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Sync state when item changes
  React.useEffect(() => {
    if (item) {
      setName(item.title);
      setDescription(item.description);
      setError("");
    }
  }, [item]);

  if (!item) return null;

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Project name cannot be empty.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/inbox/${item.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to convert to project.");
      }

      toast.flash("success", "Project created successfully");
      toast.success("Project created successfully");

      if (onConverted) {
        onConverted(data.project);
      }

      onClose();
      router.push(`/project/${data.project.id}`);
    } catch (err: any) {
      const msg = err.message || "Failed to convert idea into project.";
      setError(msg);
      toast.error("Unable to convert to project", { description: msg });
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Convert Idea to Project" maxWidth="md">
      <form onSubmit={handleConvert} className="space-y-4">
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3.5 text-xs text-indigo-950 flex items-start gap-3">
          <FolderKanban size={18} className="text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Formalizing Idea</p>
            <p className="mt-0.5 text-indigo-700/90 leading-relaxed">
              This will initialize an authoritative StoryBoard Project from your idea. The original inbox item will remain as historical thinking context.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Project Name
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10 w-full rounded-xl border border-[#E2E6EF] bg-white px-3.5 text-sm font-medium text-[#111827] outline-none transition focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            Project Description
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl border border-[#E2E6EF] bg-white p-3 text-sm text-[#111827] outline-none transition focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#E2E6EF]">
          <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={loading}
            rightIcon={<ArrowRight size={14} />}
          >
            Create Project
          </Button>
        </div>
      </form>
    </Modal>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { Check, Loader2, Search, User, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";

interface CandidateUser {
  id: string;
  name: string;
  username: string;
  type: "team_user" | "freelancer";
  roleTitle: string;
}

interface AddCollaboratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  inboxItemId: string;
  onAdded: () => void;
}

export function AddCollaboratorModal({
  isOpen,
  onClose,
  inboxItemId,
  onAdded,
}: AddCollaboratorModalProps) {
  const [candidates, setCandidates] = useState<CandidateUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadCandidates = async (query = "") => {
    setLoading(true);
    setError("");
    try {
      const q = query ? `?query=${encodeURIComponent(query)}` : "";
      const res = await fetch(`/api/inbox/${inboxItemId}/collaborator-candidates${q}`);
      const data = await res.json();
      if (res.ok && data.candidates) {
        setCandidates(data.candidates);
      } else {
        setError(data.error || "Failed to load eligible users.");
      }
    } catch {
      setError("Unable to connect to server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set());
      setSearch("");
      loadCandidates("");
    }
  }, [isOpen, inboxItemId]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = async () => {
    if (selectedIds.size === 0 || submitting) return;

    setSubmitting(true);
    try {
      const selectedCandidates = candidates.filter((c) => selectedIds.has(c.id));
      const res = await fetch(`/api/inbox/${inboxItemId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidates: selectedCandidates.map((c) => ({
            userId: c.id,
            userType: c.type,
          })),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(
          selectedIds.size === 1 ? "Person added to idea." : `${selectedIds.size} people added to idea.`
        );
        onAdded();
        onClose();
      } else {
        toast.error("Unable to add person", { description: data?.error || "Please try again." });
      }
    } catch {
      toast.error("Unable to add person", { description: "An unexpected network error occurred." });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#14121B]/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl border border-[#E2E6EF] bg-white p-5 sm:p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-50 text-[#4F46E5]">
              <UserPlus size={16} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#111827]">
                Add people to this idea
              </h3>
              <p className="text-xs text-slate-500">
                Grant item-level access to collaborate on this research.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X size={15} />
          </button>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              loadCandidates(e.target.value);
            }}
            className="h-9 w-full rounded-xl border border-[#E2E6EF] bg-slate-50/50 pl-9 pr-3 text-xs sm:text-sm text-[#111827] outline-none transition focus:border-[#4F46E5] focus:bg-white"
          />
        </div>

        {/* Candidates List */}
        <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 -mx-1 px-1">
          {loading ? (
            <div className="py-8 flex items-center justify-center gap-2 text-xs text-slate-400">
              <Loader2 size={15} className="animate-spin text-[#4F46E5]" />
              <span>Finding eligible members...</span>
            </div>
          ) : error ? (
            <p className="py-6 text-center text-xs text-rose-600">{error}</p>
          ) : candidates.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs text-slate-500 font-medium">No matching people</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {search ? "Try a different search term." : "All eligible internal team members are already collaborators."}
              </p>
            </div>
          ) : (
            candidates.map((c) => {
              const isSelected = selectedIds.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleSelect(c.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition ${
                    isSelected ? "bg-indigo-50/60" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    {/* Custom Checkbox */}
                    <div
                      className={`grid h-4 w-4 shrink-0 place-items-center rounded border transition ${
                        isSelected
                          ? "bg-[#4F46E5] border-[#4F46E5] text-white"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {isSelected && <Check size={11} strokeWidth={3} />}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-[#111827]">
                        {c.name}
                      </p>
                      <p className="truncate text-[11px] text-slate-400">
                        {c.roleTitle} {c.username ? `(@${c.username})` : ""}
                      </p>
                    </div>
                  </div>

                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 shrink-0 capitalize">
                    {c.roleTitle}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-xs text-slate-400">
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select users to add"}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              isLoading={submitting}
              disabled={selectedIds.size === 0 || submitting}
              onClick={handleAdd}
            >
              Add
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

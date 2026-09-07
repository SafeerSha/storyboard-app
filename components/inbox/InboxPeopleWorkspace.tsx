"use client";

import React, { useState } from "react";
import { Plus, Shield, Trash2, User, UserCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AddCollaboratorModal } from "./AddCollaboratorModal";
import { toast } from "@/lib/toast";
import type { ProjectInboxMember } from "@/lib/types";

interface InboxPeopleWorkspaceProps {
  inboxItemId: string;
  members: ProjectInboxMember[];
  canManageCollaborators: boolean;
  onRefresh: () => void;
}

export function InboxPeopleWorkspace({
  inboxItemId,
  members,
  canManageCollaborators,
  onRefresh,
}: InboxPeopleWorkspaceProps) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<ProjectInboxMember | null>(null);
  const [removing, setRemoving] = useState(false);

  const handleConfirmRemove = async () => {
    if (!memberToRemove) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/inbox/${inboxItemId}/members/${memberToRemove.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Collaborator removed");
        onRefresh();
        setMemberToRemove(null);
      } else {
        toast.error("Unable to remove collaborator", { description: data?.error || "Please try again." });
      }
    } catch {
      toast.error("Unable to remove collaborator", { description: "An unexpected error occurred." });
    } finally {
      setRemoving(false);
    }
  };

  const ownerMember = members.find((m) => m.role === "owner");
  const collaborators = members.filter((m) => m.role !== "owner");

  return (
    <div className="space-y-6">
      {/* People Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[#E2E6EF] bg-white p-5 sm:p-6 shadow-card">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-[#4F46E5]">
            <Users size={18} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#111827]">People with access</h3>
            <p className="text-xs text-slate-500">
              {members.length} {members.length === 1 ? "person has" : "people have"} access to this idea.
            </p>
          </div>
        </div>

        {canManageCollaborators && (
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus size={14} />}
            onClick={() => setAddModalOpen(true)}
          >
            Add people
          </Button>
        )}
      </div>

      {/* People Cards Grid */}
      <div className="rounded-2xl border border-[#E2E6EF] bg-white shadow-card divide-y divide-slate-100 overflow-hidden">
        {/* Owner Row */}
        {ownerMember && (
          <div className="flex items-center justify-between p-4 sm:px-6">
            <div className="flex items-center gap-3 min-w-0">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-100 text-xs font-bold text-indigo-700">
                {(ownerMember.name || "Owner").slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[#111827] truncate">
                    {ownerMember.name || "Idea Owner"}
                  </p>
                  <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700 border border-indigo-200">
                    Owner
                  </span>
                </div>
                <p className="text-xs text-slate-400 truncate">
                  {ownerMember.email || ownerMember.username || "Full access"}
                </p>
              </div>
            </div>
            <span className="text-xs text-slate-400 hidden sm:inline">Created this idea</span>
          </div>
        )}

        {/* Collaborator Rows */}
        {collaborators.map((c) => (
          <div key={c.id} className="flex items-center justify-between p-4 sm:px-6 hover:bg-slate-50/50 transition">
            <div className="flex items-center gap-3 min-w-0">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-xs font-bold text-slate-700">
                {(c.name || "Collaborator").slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[#111827] truncate">
                    {c.name || "Team Member"}
                  </p>
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                    Collaborator
                  </span>
                </div>
                <p className="text-xs text-slate-400 truncate">
                  {c.username ? `@${c.username}` : c.email || "Item-level access"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 hidden sm:inline">
                Added {new Date(c.created_at).toLocaleDateString()}
              </span>

              {canManageCollaborators && (
                <button
                  type="button"
                  onClick={() => setMemberToRemove(c)}
                  title="Remove collaborator"
                  className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Empty collaborators state */}
        {collaborators.length === 0 && (
          <div className="p-8 text-center space-y-2">
            <p className="text-sm font-medium text-slate-600">Only you have access to this idea.</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Add team members to discuss MVP scope, validate technical risks, and save research findings together.
            </p>
            {canManageCollaborators && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Plus size={13} />}
                className="mt-2"
                onClick={() => setAddModalOpen(true)}
              >
                Add people
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Add Collaborator Modal */}
      <AddCollaboratorModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        inboxItemId={inboxItemId}
        onAdded={onRefresh}
      />

      {/* Remove Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(memberToRemove)}
        title="Remove Collaborator"
        description={`Remove ${memberToRemove?.name || "this user"} from this idea? They will lose access to its discussions and insights.`}
        confirmLabel="Remove"
        variant="danger"
        isLoading={removing}
        onConfirm={handleConfirmRemove}
        onClose={() => setMemberToRemove(null)}
      />
    </div>
  );
}

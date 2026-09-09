"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { StoryEditor } from "@/components/StoryEditor";
import type { Story, Epic } from "@/lib/types";
import { toast } from "@/lib/toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface ReviewClientProps {
  initialStory: Story;
  epics: Epic[];
  teamUser: any;
  isReviewer: boolean;
}

export function ReviewClient({ initialStory, epics, teamUser, isReviewer }: ReviewClientProps) {
  const router = useRouter();
  const [story, setStory] = useState<Story>(initialStory);
  const [deletingStoryId, setDeletingStoryId] = useState<string | null>(null);
  const [approvingStoryId, setApprovingStoryId] = useState<string | null>(null);
  const [confirmUnresolved, setConfirmUnresolved] = useState<{ storyId: string; count: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedbackKey, setFeedbackKey] = useState(0); // For forcing feedback reload

  async function handleSaveStoryEditor(updated: any) {
    try {
      const res = await fetch(`/api/stories/${story.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: updated.title,
          description: updated.description,
          acceptance_criteria: updated.acceptance_criteria,
          assumptions: updated.assumptions,
          clarifications: updated.clarifications,
          raw_requirement: updated.raw_requirement,
          epic_id: updated.epic_id,
          reviewer_ids: updated.reviewer_ids,
          status: updated.status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update story");

      setStory(data.story);
      setFeedbackKey((k) => k + 1);
      toast.success("Story updated successfully");
    } catch (e: any) {
      toast.error(e.message || "Unable to update story");
    }
  }

  async function confirmDeleteStory() {
    if (!deletingStoryId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/stories/${deletingStoryId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete story");
      }
      toast.success("Story deleted");
      router.push("/team/reviews");
    } catch (e: any) {
      toast.error(e.message || "Unable to delete story");
      setLoading(false);
      setDeletingStoryId(null);
    }
  }

  async function handleApproveStory(storyId: string, confirmWithUnresolved = false) {
    setApprovingStoryId(storyId);
    try {
      const res = await fetch(`/api/team/stories/${storyId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmWithUnresolved }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.requiresConfirmation) {
          setConfirmUnresolved({ storyId, count: data.unresolvedCount });
          return;
        }
        throw new Error(data.error || "Approval failed.");
      }

      setStory((prev) => ({
        ...prev,
        team_review_status: "approved",
        team_approved_by_id: teamUser.id,
        team_approved_by_name: teamUser.name,
        team_approved_at: new Date().toISOString(),
      }));
      
      setConfirmUnresolved(null);
      toast.success("Story approved successfully!");
      router.push("/team/reviews");
    } catch (err: any) {
      toast.error(err.message || "Approval failed");
    } finally {
      if (!confirmUnresolved) {
        setApprovingStoryId(null);
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF9FB] p-4 sm:p-6 md:p-8 flex justify-center items-start overflow-y-auto">
      <div className="w-full max-w-6xl mb-12">
        <StoryEditor
          layout="standalone"
          key={`story-editor-${feedbackKey}`}
          story={story}
          epics={epics}
          viewerType="team_user"
          currentUserId={teamUser.id}
          isReviewer={isReviewer}
          onCancel={() => router.push("/team/reviews")}
          onFeedbackChange={() => setFeedbackKey((k) => k + 1)}
          onSave={handleSaveStoryEditor}
          onCreateEpic={() => {
            toast.error("Epic creation is disabled in single review mode.");
          }}
          onDelete={() => setDeletingStoryId(story.id)}
          onApprove={() => handleApproveStory(story.id)}
          isTeamApproved={story.team_review_status === "approved"}
          approving={approvingStoryId === story.id}
        />
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={Boolean(deletingStoryId)}
        onClose={() => setDeletingStoryId(null)}
        onConfirm={confirmDeleteStory}
        title="Delete Story"
        description="Are you sure you want to delete this story? This action cannot be undone and will permanently remove all associated data and feedback."
        confirmLabel="Delete Story"
        variant="danger"
        isLoading={loading}
      />

      {/* Unresolved Feedback Confirmation Modal */}
      <Modal
        isOpen={Boolean(confirmUnresolved)}
        onClose={() => {
          setConfirmUnresolved(null);
          setApprovingStoryId(null);
        }}
        title="Unresolved Feedback Notice"
        description={`This story has ${confirmUnresolved?.count} open change request${confirmUnresolved?.count === 1 ? '' : 's'}. Approving now indicates your team is satisfied with the criteria.`}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmUnresolved(null);
                setApprovingStoryId(null);
              }}
              disabled={approvingStoryId === story.id && !!confirmUnresolved}
            >
              Review Feedback
            </Button>
            <Button
              variant="primary"
              className="bg-[#B8944E] hover:bg-[#9F7D3E] text-white border-none shadow-[0_4px_14px_rgba(184,148,78,0.22)]"
              isLoading={approvingStoryId === story.id && !!confirmUnresolved}
              onClick={() => confirmUnresolved && handleApproveStory(confirmUnresolved.storyId, true)}
            >
              Approve Anyway
            </Button>
          </>
        }
      >
        <p className="text-xs text-[#706C7D]">
          The open discussions will remain visible for client review.
        </p>
      </Modal>
    </div>
  );
}

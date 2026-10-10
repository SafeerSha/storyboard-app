"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, XCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import { ProjectMeeting } from "@/lib/types/meeting";

interface CancelMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  meeting: ProjectMeeting | null;
  onSuccess: (updated: ProjectMeeting) => void;
}

export function CancelMeetingModal({
  isOpen,
  onClose,
  meeting,
  onSuccess,
}: CancelMeetingModalProps) {
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  if (!meeting) return null;

  const handleConfirmCancel = async () => {
    setCancelling(true);
    try {
      const res = await fetch(`/api/projects/${meeting.project_id}/meetings/${meeting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "cancelled",
          cancellation_reason: reason.trim() || "Cancelled by project organizer",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel meeting");

      toast.success("Meeting has been cancelled.");
      onSuccess(data.meeting);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel meeting");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cancel Meeting"
      description={`Cancel "${meeting.title}"`}
      maxWidth="md"
    >
      <div className="space-y-4 pt-1">
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 flex items-start gap-3">
          <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-800 space-y-1">
            <p className="font-bold">Are you sure you want to cancel this meeting?</p>
            <p className="text-rose-700/90 leading-relaxed">
              The meeting will be marked as cancelled and preserved in project history. You can review cancelled meetings anytime.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#706C7D] mb-1.5">
            Cancellation Reason (Optional)
          </label>
          <textarea
            rows={2}
            placeholder="e.g. Rescheduling requested by client, design review postponed..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-xl border border-[rgba(74,61,100,0.15)] bg-white px-3 py-2 text-xs text-[#252331] focus:outline-none focus:ring-1 focus:ring-[#B8944E]"
          />
        </div>

        <div className="flex justify-end gap-2.5 pt-2 border-t border-[rgba(74,61,100,0.06)]">
          <Button variant="secondary" size="md" onClick={onClose} disabled={cancelling}>
            Keep Meeting
          </Button>
          <Button
            variant="danger-solid"
            size="md"
            onClick={handleConfirmCancel}
            disabled={cancelling}
            isLoading={cancelling}
            leftIcon={<XCircle size={14} />}
          >
            Cancel Meeting
          </Button>
        </div>
      </div>
    </Modal>
  );
}

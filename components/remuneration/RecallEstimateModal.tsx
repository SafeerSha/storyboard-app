"use client";

import React, { useState, useEffect } from "react";
import { AlertTriangle, Undo2, Mail, MessageSquare } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import type { RemunerationPublishingInfo } from "@/lib/types";

interface RecallEstimateModalProps {
  isOpen: boolean;
  onClose: () => void;
  estimateId: string;
  projectName: string;
  currentPublishing?: RemunerationPublishingInfo | null;
  onRecalled: (publishingInfo: RemunerationPublishingInfo) => void;
}

export function RecallEstimateModal({
  isOpen,
  onClose,
  estimateId,
  projectName,
  currentPublishing,
  onRecalled,
}: RecallEstimateModalProps) {
  const [recallReason, setRecallReason] = useState<string>("");
  const [fromEmail, setFromEmail] = useState<string>(
    currentPublishing?.from_email || ""
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Fetch saved email_from setting if not already set from publishing info
  useEffect(() => {
    if (isOpen && !currentPublishing?.from_email) {
      fetch("/api/settings")
        .then((r) => r.json())
        .then((data) => {
          if (data?.ok && data?.settings?.email_from) {
            setFromEmail((prev) => prev || data.settings.email_from);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, currentPublishing?.from_email]);

  const clientCount = currentPublishing?.published_to_client_ids?.length || 1;

  const handleConfirmRecall = async () => {
    if (!estimateId) {
      toast.error("Estimate ID is missing.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/remuneration/recall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimateId,
          recallReason: recallReason.trim(),
          fromEmail: fromEmail.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to recall quotation.");
      }

      toast.success("Quotation recalled. Client portal access has been revoked and clients have been notified.");
      if (data.publishing) {
        onRecalled(data.publishing);
      }
      onClose();
    } catch (err: any) {
      console.error("Recall quotation error:", err);
      toast.error(err.message || "Unable to recall quotation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Recall / Revoke Quotation"
      description={`Withdraw the published estimation for ${projectName} from the Client Portal.`}
      maxWidth="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Keep Published
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirmRecall}
            isLoading={isSubmitting}
            className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white border-transparent"
          >
            <Undo2 className="w-4 h-4" />
            Confirm Recall &amp; Notify Client
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Warning Callout Box */}
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 leading-relaxed">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-rose-950">Immediate Client Portal Revocation</span>
            <ul className="list-disc list-inside space-y-0.5 text-rose-800 text-[11.5px] pt-0.5">
              <li>The quotation will immediately vanish from the portal for <strong>{clientCount} client(s)</strong>.</li>
              <li>An informed notification email will be dispatched to notify the client that the estimation is under revision.</li>
              <li>The estimate returns to an editable draft state in your workspace so you can re-publish anytime.</li>
            </ul>
          </div>
        </div>

        {/* Reason for Recall */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-[#B8944E]" />
            Reason for Recall (Optional)
          </label>
          <textarea
            rows={2}
            value={recallReason}
            onChange={(e) => setRecallReason(e.target.value)}
            placeholder="e.g., Adjusting sprint timeline, test allocations, and feature scope."
            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-[#B8944E] focus:ring-1 focus:ring-[#B8944E]/30 focus:outline-none resize-none"
          />
          <p className="text-[11px] text-zinc-500">
            This note will be included in the email dispatched to your client.
          </p>
        </div>

        {/* Sender Email Address */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-[#B8944E]" />
            Sender / From Email Address
          </label>
          <input
            type="text"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            placeholder="e.g., Project Workspace <onboarding@resend.dev> or Safeer <hello@yourdomain.com>"
            className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-[#B8944E] focus:ring-1 focus:ring-[#B8944E]/30 focus:outline-none"
          />
        </div>
      </div>
    </Modal>
  );
}

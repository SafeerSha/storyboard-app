"use client";

import React, { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "primary";
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  isLoading = false,
}: ConfirmDialogProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const loading = isLoading || internalLoading;

  async function handleConfirm() {
    try {
      setInternalLoading(true);
      await onConfirm();
    } finally {
      setInternalLoading(false);
    }
  }

  const iconBadge =
    variant === "danger" ? (
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-status-error/15 text-status-error border border-status-error/20">
        <Trash2 size={18} strokeWidth={2} />
      </div>
    ) : variant === "warning" ? (
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-status-warning/15 text-status-warning border border-status-warning/20">
        <AlertTriangle size={18} strokeWidth={2} />
      </div>
    ) : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !loading && onClose()}
      title={title}
      maxWidth="sm"
      footer={
        <>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            size="sm"
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            onClick={handleConfirm}
            isLoading={loading}
            size="sm"
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3.5 py-1">
        {iconBadge}
        <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed pt-1">
          {description}
        </p>
      </div>
    </Modal>
  );
}

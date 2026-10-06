"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { MediaUploadZone, MediaUploadResult } from "@/components/media/MediaUploadZone";
import { Layers, CheckCircle2, Film, FileImage, ExternalLink } from "lucide-react";
import type { Epic } from "@/lib/types";
import { toast } from "@/lib/toast";

interface EpicMediaModalProps {
  isOpen?: boolean;
  onClose: () => void;
  epic?: Epic;
  epicId?: string;
  epicName?: string;
  onMediaAttached?: (epicId: string, mediaUrl: string, mediaType: "image" | "video") => void;
}

export function EpicMediaModal({
  isOpen = true,
  onClose,
  epic,
  epicId,
  epicName,
  onMediaAttached,
}: EpicMediaModalProps) {
  const [uploadedMedia, setUploadedMedia] = useState<MediaUploadResult | null>(null);

  const targetId = epic?.id || epicId || "";
  const targetName = epic?.name || epicName || "Epic";

  function handleUploadComplete(result: MediaUploadResult) {
    setUploadedMedia(result);
    onMediaAttached?.(targetId, result.url, result.mediaType);
    toast.success("Media attached", `${result.mediaType === "video" ? "Video" : "Image"} successfully attached to epic.`);
  }

  function handleClose() {
    setUploadedMedia(null);
    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Attach Media to Epic"
      description={`Upload and attach reference images, mockups, or demo videos to ${targetName}.`}
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Epic Info Header */}
        <div className="rounded-xl border border-[rgba(74,61,100,0.08)] bg-[#FAF9FC] p-3 flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[rgba(184,148,78,0.12)] text-[#80642F] shrink-0">
            <Layers size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#9994A5]">
              Target Epic
            </span>
            <span className="block text-xs font-bold text-[#252331] truncate">
              {targetName}
            </span>
          </div>
        </div>

        {/* Media Upload Zone (AC-2.1, AC-2.2, AC-2.3, AC-2.4) */}
        <MediaUploadZone
          folder="epics"
          label="Select Media File"
          description="Upload an image (PNG, JPG, WebP, GIF, SVG) or video (MP4, WebM, MOV) up to 100MB"
          onUploadComplete={handleUploadComplete}
          onRemove={() => setUploadedMedia(null)}
        />

        {uploadedMedia && (
          <div className="rounded-xl bg-emerald-50/80 border border-emerald-200/80 p-3 text-xs text-emerald-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span className="truncate">
                Attached to <strong>{targetName}</strong>
              </span>
            </div>
            <a
              href={uploadedMedia.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline shrink-0"
            >
              <span>View</span>
              <ExternalLink size={12} />
            </a>
          </div>
        )}

        <div className="pt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            {uploadedMedia ? "Done" : "Cancel"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

"use client";

import React, { useState, useRef, useCallback } from "react";
import {
  UploadCloud,
  FileImage,
  Film,
  X,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Eye,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface MediaUploadResult {
  url: string;
  fileName: string;
  fileType: string;
  size: number;
  mediaType: "image" | "video";
}

export interface MediaUploadZoneProps {
  folder?: string;
  currentMediaUrl?: string | null;
  currentMediaType?: "image" | "video" | null;
  onUploadComplete?: (result: MediaUploadResult) => void;
  onRemove?: () => void;
  label?: string;
  description?: string;
  maxImageMb?: number;
  maxVideoMb?: number;
  className?: string;
}

const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
];

const SUPPORTED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/ogg",
  "video/x-matroska",
];

export function MediaUploadZone({
  folder = "media",
  currentMediaUrl,
  currentMediaType,
  onUploadComplete,
  onRemove,
  label = "Upload Image or Video",
  description = "Supports PNG, JPG, WebP, GIF, SVG or MP4, WebM, MOV (Max 15MB images, 100MB videos)",
  maxImageMb = 15,
  maxVideoMb = 100,
  className = "",
}: MediaUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<MediaUploadResult | null>(
    currentMediaUrl
      ? {
          url: currentMediaUrl,
          fileName: "Current Media",
          fileType: currentMediaType === "video" ? "video/mp4" : "image/jpeg",
          size: 0,
          mediaType: currentMediaType || "image",
        }
      : null
  );

  // Keep reference to the last selected file for retry capability (AC-2.4)
  const lastSelectedFileRef = useRef<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Validate file client-side (AC-2.2)
  const validateFile = useCallback(
    (file: File): string | null => {
      const type = file.type?.toLowerCase() || "";
      const isImg = SUPPORTED_IMAGE_TYPES.includes(type);
      const isVid = SUPPORTED_VIDEO_TYPES.includes(type);

      if (!isImg && !isVid) {
        return `Unsupported file format (${type || "unknown"}). Only standard image (JPEG, PNG, WebP, GIF, SVG) and video (MP4, WebM, MOV) formats are supported.`;
      }

      const limitBytes = isVid ? maxVideoMb * 1024 * 1024 : maxImageMb * 1024 * 1024;
      const limitLabel = isVid ? `${maxVideoMb}MB` : `${maxImageMb}MB`;

      if (file.size > limitBytes) {
        const fileMb = (file.size / (1024 * 1024)).toFixed(1);
        return `File size (${fileMb}MB) exceeds the maximum allowed limit of ${limitLabel} for ${
          isVid ? "videos" : "images"
        }.`;
      }

      return null;
    },
    [maxImageMb, maxVideoMb]
  );

  // Perform upload (AC-2.1, AC-2.3, AC-2.4)
  const performUpload = useCallback(
    async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setError(null);
      setUploading(true);
      lastSelectedFileRef.current = file;

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", folder);

        const res = await fetch("/api/media/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Upload failed due to a server error.");
        }

        const result: MediaUploadResult = {
          url: data.url,
          fileName: data.fileName || file.name,
          fileType: data.fileType || file.type,
          size: data.size || file.size,
          mediaType: data.mediaType || (file.type.startsWith("video/") ? "video" : "image"),
        };

        // AC-2.3: Display preview and confirmation
        setPreviewResult(result);
        onUploadComplete?.(result);
      } catch (err: any) {
        // AC-2.4: Inform user of failure and enable retry
        const message =
          err?.message ||
          "Failed to upload due to a network or server issue. Please check your connection and retry.";
        setError(message);
      } finally {
        setUploading(false);
      }
    },
    [folder, onUploadComplete, validateFile]
  );

  // File input change handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      performUpload(file);
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      performUpload(file);
    }
  };

  // AC-2.4: Retry function
  const handleRetry = () => {
    if (lastSelectedFileRef.current) {
      performUpload(lastSelectedFileRef.current);
    } else if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleClear = () => {
    setPreviewResult(null);
    setError(null);
    lastSelectedFileRef.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onRemove?.();
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5]">
            {label}
          </label>
          {previewResult && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <CheckCircle2 size={12} />
              Attached
            </span>
          )}
        </div>
      )}

      {/* Error alert with retry option (AC-2.2, AC-2.4) */}
      {error && (
        <div className="rounded-xl bg-rose-50/90 border border-rose-200 p-3 text-xs text-[#C25D72] flex items-start justify-between gap-3 animate-in fade-in duration-150">
          <div className="flex items-start gap-2 min-w-0">
            <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600" />
            <span className="leading-relaxed">{error}</span>
          </div>
          {lastSelectedFileRef.current && (
            <button
              type="button"
              onClick={handleRetry}
              disabled={uploading}
              className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 hover:text-rose-900 shrink-0 underline disabled:opacity-50"
            >
              <RefreshCw size={12} />
              Retry
            </button>
          )}
        </div>
      )}

      {/* PREVIEW CARD (AC-2.3) */}
      {previewResult && (
        <div className="relative rounded-2xl border border-[rgba(74,61,100,0.12)] bg-white/90 p-3 shadow-sm backdrop-blur-md space-y-3 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between gap-2 border-b border-[rgba(74,61,100,0.06)] pb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              {previewResult.mediaType === "video" ? (
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                  <Film size={14} />
                </div>
              ) : (
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-[rgba(184,148,78,0.12)] text-[#80642F] border border-[rgba(184,148,78,0.25)] shrink-0">
                  <FileImage size={14} />
                </div>
              )}
              <div className="min-w-0">
                <span className="block text-xs font-bold text-[#252331] truncate" title={previewResult.fileName}>
                  {previewResult.fileName}
                </span>
                <span className="block text-[10px] text-[#9994A5]">
                  {previewResult.mediaType.toUpperCase()}
                  {previewResult.size > 0 && ` • ${(previewResult.size / (1024 * 1024)).toFixed(2)} MB`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Replace file"
                className="rounded-lg p-1.5 text-[#706C7D] hover:text-[#80642F] hover:bg-[rgba(184,148,78,0.08)] transition text-xs font-medium"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={handleClear}
                title="Remove file"
                className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 transition"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Media preview element (AC-2.3) */}
          <div className="relative rounded-xl overflow-hidden bg-slate-900/5 max-h-72 flex items-center justify-center border border-[rgba(74,61,100,0.06)]">
            {previewResult.mediaType === "video" ? (
              <video
                src={previewResult.url}
                controls
                className="w-full max-h-72 rounded-xl object-contain bg-black/90"
              />
            ) : (
              <img
                src={previewResult.url}
                alt={previewResult.fileName}
                className="w-full max-h-72 rounded-xl object-contain"
              />
            )}
          </div>
        </div>
      )}

      {/* DROP ZONE (AC-2.1) */}
      {!previewResult && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`relative rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? "border-[#B8944E] bg-[rgba(184,148,78,0.06)] scale-[0.99]"
              : "border-[rgba(74,61,100,0.15)] bg-white/70 hover:border-[#B8944E]/60 hover:bg-[rgba(184,148,78,0.02)]"
          } ${uploading ? "pointer-events-none opacity-60" : ""}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,video/mp4,video/webm,video/quicktime,video/ogg,video/x-matroska"
            onChange={handleFileChange}
            disabled={uploading}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center space-y-2">
            <div
              className={`grid h-12 w-12 place-items-center rounded-2xl transition-transform ${
                isDragging
                  ? "bg-[#B8944E] text-white scale-110 shadow-md"
                  : "bg-[rgba(184,148,78,0.1)] text-[#80642F]"
              }`}
            >
              {uploading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#B8944E] border-t-transparent" />
              ) : (
                <UploadCloud size={24} />
              )}
            </div>

            <div className="space-y-1">
              <p className="text-sm font-bold text-[#252331]">
                {uploading
                  ? "Uploading media..."
                  : isDragging
                  ? "Drop your media file here"
                  : "Click to upload or drag & drop"}
              </p>
              <p className="text-[11px] text-[#706C7D] max-w-sm mx-auto leading-relaxed">
                {description}
              </p>
            </div>

            <div className="pt-1 flex items-center gap-2 text-[10px] font-semibold text-[#9994A5]">
              <span className="inline-flex items-center gap-1">
                <FileImage size={11} className="text-[#B8944E]" />
                Images up to {maxImageMb}MB
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1">
                <Film size={11} className="text-purple-600" />
                Videos up to {maxVideoMb}MB
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState, useRef, useCallback } from "react";
import {
  Image as ImageIcon,
  Upload,
  Trash2,
  Maximize2,
  ExternalLink,
  Copy,
  Check,
  X,
  Loader2,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { convertImageToWebP, formatBytes } from "@/lib/image-utils";
import { toast } from "@/lib/toast";
import type { NoteImage } from "@/lib/types";

interface NoteImageGalleryProps {
  projectId: string;
  noteId: string;
  images: NoteImage[];
  onImagesChange: (updatedImages: NoteImage[]) => void;
  onInsertMarkdown?: (markdownSnippet: string) => void;
  disabled?: boolean;
}

export function NoteImageGallery({
  projectId,
  noteId,
  images,
  onImagesChange,
  onInsertMarkdown,
  disabled = false,
}: NoteImageGalleryProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [activePreviewImage, setActivePreviewImage] = useState<NoteImage | null>(null);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload handler for single or multiple files
  const processAndUploadFiles = useCallback(
    async (fileList: FileList | File[]) => {
      if (disabled || !noteId) return;
      const files = Array.from(fileList).filter((f) => f.type.startsWith("image/") || f.name.match(/\.(png|jpe?g|webp|gif|bmp|svg|tiff|avif|heic)$/i));

      if (files.length === 0) {
        toast.error("Please select valid image files.");
        return;
      }

      setIsUploading(true);
      let currentList = [...images];

      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setUploadStatusText(
            `Converting ${file.name} to optimized WebP (${i + 1}/${files.length})...`
          );

          // 1. Convert to high-quality WebP in the browser
          const conversion = await convertImageToWebP(file, { quality: 0.88 });

          setUploadStatusText(
            `Uploading ${conversion.file.name} (${formatBytes(conversion.optimizedSize)})...`
          );

          // 2. Prepare FormData for API upload
          const formData = new FormData();
          formData.append("file", conversion.file);
          formData.append("name", conversion.file.name);
          formData.append("width", String(conversion.width));
          formData.append("height", String(conversion.height));
          formData.append("originalSize", String(conversion.originalSize));

          // 3. Post to backend (Cloudflare R2 + Supabase)
          const res = await fetch(`/api/projects/${projectId}/notes/${noteId}/images`, {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Failed to upload ${file.name}`);
          }

          const data = await res.json();
          if (data.image) {
            currentList = [...currentList, data.image];
            onImagesChange(currentList);
          }
        }

        const count = files.length;
        toast.success(
          `${count} image${count > 1 ? "s" : ""} converted to WebP & saved`
        );
      } catch (err: any) {
        toast.error(err.message || "Failed to upload image");
      } finally {
        setIsUploading(false);
        setUploadStatusText("");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [disabled, noteId, projectId, images, onImagesChange]
  );

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled || !e.dataTransfer.files) return;
    processAndUploadFiles(e.dataTransfer.files);
  };

  // Delete image confirmation
  const handleDeleteConfirm = async () => {
    if (!deletingImageId) return;

    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/notes/${noteId}/images?imageId=${deletingImageId}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete image");
      }

      const updated = images.filter((img) => img.id !== deletingImageId);
      onImagesChange(updated);

      if (activePreviewImage?.id === deletingImageId) {
        setActivePreviewImage(null);
      }

      toast.success("Image deleted from discussion note");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete image");
    } finally {
      setIsDeleting(false);
      setDeletingImageId(null);
    }
  };

  // Copy markdown link
  const handleCopyMarkdown = (img: NoteImage) => {
    const md = `![${img.name}](${img.url})`;
    navigator.clipboard.writeText(md);
    setCopiedId(img.id);
    toast.success("Image Markdown copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Insert markdown link into note textarea
  const handleInsertIntoNote = (img: NoteImage) => {
    if (onInsertMarkdown) {
      const md = `\n\n![${img.name}](${img.url})\n`;
      onInsertMarkdown(md);
      toast.success("Image added to note text");
    }
  };

  return (
    <div className="space-y-3 pt-2">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            processAndUploadFiles(e.target.files);
          }
        }}
        disabled={disabled || isUploading}
      />

      {/* Header bar for Discussion Images */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="grid h-6 w-6 place-items-center rounded-lg bg-[rgba(184,148,78,0.12)] text-[#80642F]">
            <ImageIcon size={13} />
          </div>
          <span className="text-xs font-bold text-[#252331]">
            Attached Discussion Images
          </span>
          {images.length > 0 && (
            <span className="rounded-full bg-[rgba(74,61,100,0.08)] px-2 py-0.2 text-[10px] font-semibold text-[#706C7D]">
              {images.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={
              isUploading ? (
                <Loader2 size={12} className="animate-spin text-[#B8944E]" />
              ) : (
                <Upload size={12} />
              )
            }
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            className="text-xs h-7 px-2.5"
            title="Upload images (auto-converted to WebP)"
          >
            {isUploading ? "Converting..." : "Add Images"}
          </Button>
        </div>
      </div>

      {/* Uploading indicator alert if active */}
      {isUploading && (
        <div className="rounded-xl border border-[rgba(184,148,78,0.3)] bg-[rgba(184,148,78,0.06)] px-3 py-2 flex items-center gap-2.5 text-xs text-[#80642F] animate-pulse">
          <Sparkles size={14} className="shrink-0 text-[#B8944E]" />
          <span className="font-medium">{uploadStatusText}</span>
        </div>
      )}

      {/* Images Grid or Empty Dropzone */}
      {images.length === 0 ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => {
            if (!disabled && !isUploading) fileInputRef.current?.click();
          }}
          className={`cursor-pointer rounded-xl border border-dashed transition p-4 sm:p-5 text-center flex flex-col items-center justify-center gap-2 group ${
            isDragging
              ? "border-[#B8944E] bg-[rgba(184,148,78,0.08)] ring-2 ring-[rgba(184,148,78,0.2)]"
              : "border-[rgba(74,61,100,0.15)] bg-[#FAF9FC]/60 hover:bg-[#FAF9FC] hover:border-[rgba(74,61,100,0.25)]"
          }`}
        >
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-white text-[#9994A5] group-hover:text-[#80642F] group-hover:bg-[rgba(184,148,78,0.12)] border border-[rgba(74,61,100,0.10)] transition">
            <Upload size={16} />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#252331]">
              Attach mockups, diagrams, or meeting screenshots
            </p>
            <p className="text-[11px] text-[#706C7D]">
              Click to browse, drag & drop, or paste (<kbd className="rounded bg-gray-100 px-1 py-0.5 border text-[10px] font-mono">Ctrl+V</kbd>) inside the editor.
            </p>
            <p className="text-[10px] text-[#9994A5] pt-0.5">
              Auto-converted to high-clarity WebP for maximum space savings.
            </p>
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-2 rounded-xl transition ${
            isDragging ? "bg-[rgba(184,148,78,0.06)] border border-dashed border-[#B8944E]" : ""
          }`}
        >
          {images.map((img) => {
            const savingsPercent =
              img.originalSize && img.originalSize > img.size
                ? Math.round(((img.originalSize - img.size) / img.originalSize) * 100)
                : 0;

            return (
              <div
                key={img.id}
                className="group relative rounded-xl border border-[rgba(74,61,100,0.10)] bg-white shadow-2xs overflow-hidden flex flex-col transition hover:shadow-xs hover:border-[rgba(184,148,78,0.35)]"
              >
                {/* Thumbnail Image */}
                <div
                  className="relative aspect-[4/3] w-full bg-[#FAF9FC] overflow-hidden cursor-pointer flex items-center justify-center"
                  onClick={() => setActivePreviewImage(img)}
                  title="Click to view full resolution"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />

                  {/* Hover Overlay with Preview Icon */}
                  <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-white/90 text-[#252331] shadow-xs">
                      <Maximize2 size={13} />
                    </span>
                  </div>

                  {/* WebP Format Badge */}
                  <div className="absolute top-1.5 left-1.5">
                    <span className="inline-flex items-center gap-0.5 rounded-md bg-black/60 backdrop-blur-xs px-1.5 py-0.5 text-[9px] font-bold text-white tracking-wide">
                      WebP
                    </span>
                  </div>

                  {/* Delete Button (Corner Control) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingImageId(img.id);
                    }}
                    className="absolute top-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-md bg-white/90 text-rose-600 shadow-xs hover:bg-rose-500 hover:text-white transition cursor-pointer"
                    title="Delete image from note"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* Card Info & Actions Footer */}
                <div className="p-2 space-y-1 bg-white border-t border-[rgba(74,61,100,0.06)]">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-[11px] font-semibold text-[#252331] truncate" title={img.name}>
                      {img.name}
                    </p>
                  </div>

                  {/* Size and savings indicator */}
                  <div className="flex items-center justify-between text-[10px] text-[#706C7D]">
                    <span className="font-medium text-[#252331]">
                      {formatBytes(img.size)}
                    </span>
                    {savingsPercent > 0 && (
                      <span className="font-semibold text-emerald-700 bg-emerald-50 px-1 rounded text-[9px]">
                        -{savingsPercent}%
                      </span>
                    )}
                  </div>

                  {/* Bottom Action Buttons */}
                  <div className="flex items-center justify-end gap-1 pt-1 border-t border-[rgba(74,61,100,0.04)]">
                    {onInsertMarkdown && (
                      <button
                        type="button"
                        onClick={() => handleInsertIntoNote(img)}
                        className="text-[10px] text-[#706C7D] hover:text-[#B8944E] px-1 py-0.5 rounded hover:bg-[#FAF9FC] transition cursor-pointer"
                        title="Insert markdown into note body"
                      >
                        Insert
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleCopyMarkdown(img)}
                      className="text-[10px] text-[#706C7D] hover:text-[#252331] p-1 rounded hover:bg-[#FAF9FC] transition cursor-pointer"
                      title="Copy Markdown link"
                    >
                      {copiedId === img.id ? (
                        <Check size={11} className="text-emerald-600" />
                      ) : (
                        <Copy size={11} />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeletingImageId(img.id)}
                      className="text-[10px] text-[#C25D72] hover:bg-rose-50 p-1 rounded transition cursor-pointer"
                      title="Delete image"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* "+ Add More" Drop card in grid */}
          <div
            onClick={() => {
              if (!disabled && !isUploading) fileInputRef.current?.click();
            }}
            className="cursor-pointer rounded-xl border border-dashed border-[rgba(74,61,100,0.15)] bg-[#FAF9FC]/50 hover:bg-[#FAF9FC] hover:border-[rgba(184,148,78,0.3)] transition p-3 flex flex-col items-center justify-center gap-1.5 text-center aspect-[4/3] group"
          >
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-white text-[#9994A5] group-hover:text-[#80642F] group-hover:bg-[rgba(184,148,78,0.12)] border border-[rgba(74,61,100,0.08)] transition">
              <Upload size={13} />
            </div>
            <span className="text-[10px] font-semibold text-[#706C7D] group-hover:text-[#252331]">
              Add More
            </span>
          </div>
        </div>
      )}

      {/* Lightbox / Fullscreen Modal */}
      {activePreviewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setActivePreviewImage(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-4xl w-full bg-[#1E1B28] rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5 text-white">
              <div className="flex items-center gap-2 truncate pr-4">
                <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-mono font-bold">
                  WebP
                </span>
                <span className="text-xs sm:text-sm font-semibold truncate">
                  {activePreviewImage.name}
                </span>
                <span className="text-[11px] text-gray-400 shrink-0">
                  ({formatBytes(activePreviewImage.size)})
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={activePreviewImage.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="grid h-7 w-7 place-items-center rounded-lg bg-white/10 text-gray-200 hover:bg-white/20 hover:text-white transition"
                  title="Open original in new tab"
                >
                  <ExternalLink size={13} />
                </a>

                <button
                  type="button"
                  onClick={() => {
                    setDeletingImageId(activePreviewImage.id);
                  }}
                  className="grid h-7 w-7 place-items-center rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500 hover:text-white transition cursor-pointer"
                  title="Delete image"
                >
                  <Trash2 size={13} />
                </button>

                <button
                  type="button"
                  onClick={() => setActivePreviewImage(null)}
                  className="grid h-7 w-7 place-items-center rounded-lg bg-white/10 text-gray-200 hover:bg-white/20 hover:text-white transition cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Modal Image View */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/40 min-h-[300px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activePreviewImage.url}
                alt={activePreviewImage.name}
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-lg shadow-lg"
              />
            </div>

            {/* Modal Footer with quick actions */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-white/5 border-t border-white/10 text-xs text-gray-300">
              <span className="text-[11px] text-gray-400">
                {activePreviewImage.width && activePreviewImage.height
                  ? `${activePreviewImage.width} × ${activePreviewImage.height} px`
                  : "Optimized WebP Image"}
              </span>

              <div className="flex items-center gap-2">
                {onInsertMarkdown && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      handleInsertIntoNote(activePreviewImage);
                      setActivePreviewImage(null);
                    }}
                    className="text-xs h-7 bg-white/10 text-white border-white/20 hover:bg-white/20"
                  >
                    Insert into Note
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Copy size={11} />}
                  onClick={() => handleCopyMarkdown(activePreviewImage)}
                  className="text-xs h-7"
                >
                  Copy Markdown
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingImageId)}
        onClose={() => setDeletingImageId(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Image"
        description="Are you sure you want to delete this image from the discussion note and storage? This action cannot be undone."
        confirmLabel={isDeleting ? "Deleting..." : "Delete Image"}
        variant="danger"
      />
    </div>
  );
}

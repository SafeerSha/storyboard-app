"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  FileText,
  Plus,
  X,
  Trash2,
  Calendar,
  Tag,
  Eye,
  EyeOff,
  CheckCircle2,
  Clock,
  Layers,
  Search,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Textarea } from "@/components/ui/Textarea";
import { NoteImageGallery } from "@/components/notes/NoteImageGallery";
import { toast } from "@/lib/toast";
import type { Epic, ProjectNote, NoteImage } from "@/lib/types";

interface EpicNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  epic: Epic;
  projectId: string;
  notes: ProjectNote[];
  onNotesChange: (updatedNotes: ProjectNote[]) => void;
}

export function EpicNotesModal({
  isOpen,
  onClose,
  epic,
  projectId,
  notes,
  onNotesChange,
}: EpicNotesModalProps) {
  const [mounted, setMounted] = useState(false);

  // Filter notes belonging to this epic
  const epicNotes = notes.filter((n) => n.epic_id === epic.id && n.status !== "archived");

  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  // Editor form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [images, setImages] = useState<NoteImage[]>([]);
  const [isClientVisible, setIsClientVisible] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "unsaved" | "saving">("saved");

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // When modal opens or epic changes, set default active note
  useEffect(() => {
    if (isOpen) {
      if (epicNotes.length > 0 && (!activeNoteId || !epicNotes.some((n) => n.id === activeNoteId))) {
        setActiveNoteId(epicNotes[0].id);
      }
    }
  }, [isOpen, epic.id, epicNotes.length]);

  // Sync editor state when activeNote changes
  const activeNote = epicNotes.find((n) => n.id === activeNoteId) || null;

  useEffect(() => {
    if (activeNote) {
      setTitle(activeNote.title || "");
      setContent(activeNote.content || "");
      setTags(activeNote.tags || []);
      setImages(activeNote.images || []);
      setIsClientVisible(Boolean(activeNote.is_client_visible));
      setSaveStatus("saved");
    } else {
      setTitle("");
      setContent("");
      setTags([]);
      setImages([]);
      setIsClientVisible(false);
      setSaveStatus("saved");
    }
  }, [activeNoteId]);

  // ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  // Persist note changes
  const saveActiveNote = useCallback(
    async (
      noteTitle: string,
      noteContent: string,
      noteTags: string[],
      noteImages?: NoteImage[],
      clientVisible?: boolean
    ) => {
      if (!activeNoteId) return;

      setSaveStatus("saving");
      const finalClientVisible = clientVisible !== undefined ? clientVisible : isClientVisible;

      try {
        const res = await fetch(`/api/projects/${projectId}/notes/${activeNoteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: noteTitle,
            content: noteContent,
            tags: noteTags,
            images: noteImages !== undefined ? noteImages : images,
            is_client_visible: finalClientVisible,
            epic_id: epic.id,
          }),
        });

        if (!res.ok) throw new Error("Failed to save note");

        const data = await res.json();
        onNotesChange(
          notes.map((n) => (n.id === activeNoteId ? { ...n, ...data.note, epic_id: epic.id } : n))
        );
        setSaveStatus("saved");
      } catch {
        setSaveStatus("unsaved");
      }
    },
    [activeNoteId, projectId, images, isClientVisible, epic.id, notes, onNotesChange]
  );

  // Auto-save debounce on typing
  const triggerAutoSave = (newTitle: string, newContent: string, newTags: string[]) => {
    setSaveStatus("unsaved");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveActiveNote(newTitle, newContent, newTags);
    }, 700);
  };

// Helper to optimize and normalize Epic display name (e.g. converting shouty ALL-CAPS into clean Title Case)
function formatEpicDisplayName(name: string): string {
  if (!name) return "Epic";
  const trimmed = name.trim();
  const isAllCaps = trimmed.length > 3 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
  if (isAllCaps) {
    const minorWords = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "in", "nor", "of", "on", "or", "so", "the", "to", "up", "yet", "&"]);
    return trimmed
      .toLowerCase()
      .split(/\s+/)
      .map((word, idx) => {
        if (idx !== 0 && minorWords.has(word)) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(" ");
  }
  return trimmed;
}

  // Create new note for this epic
  const formattedEpicName = useMemo(() => formatEpicDisplayName(epic.name), [epic.name]);

  const handleCreateNote = async () => {
    setIsCreating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Note - ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
          content: "",
          tags: ["epic-notes"],
          images: [],
          is_client_visible: false,
          epic_id: epic.id,
        }),
      });

      if (!res.ok) throw new Error("Failed to create note");

      const data = await res.json();
      const newNote: ProjectNote = { ...data.note, epic_id: epic.id };
      onNotesChange([newNote, ...notes]);
      setActiveNoteId(newNote.id);
      toast.success(`New note added to ${formattedEpicName}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create note");
    } finally {
      setIsCreating(false);
    }
  };

  // Toggle client visibility
  const handleToggleClientVisible = async () => {
    if (!activeNote) return;
    const nextVal = !isClientVisible;
    setIsClientVisible(nextVal);
    await saveActiveNote(title, content, tags, images, nextVal);
    toast.success(
      nextVal ? "Note made visible to the client" : "Note made private (internal only)"
    );
  };

  // Delete note
  const confirmDeleteNote = async () => {
    if (!deletingNoteId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/notes/${deletingNoteId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete note");

      const updated = notes.filter((n) => n.id !== deletingNoteId);
      onNotesChange(updated);

      if (activeNoteId === deletingNoteId) {
        const remainingForEpic = updated.filter((n) => n.epic_id === epic.id);
        setActiveNoteId(remainingForEpic[0]?.id || null);
      }
      toast.success("Note deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete note");
    } finally {
      setDeletingNoteId(null);
    }
  };

  // Filter notes by search
  const filteredEpicNotes = epicNotes.filter((n) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      (n.content && n.content.toLowerCase().includes(q)) ||
      (n.tags && n.tags.some((t) => t.toLowerCase().includes(q)))
    );
  });

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-5xl rounded-2xl bg-white border border-[rgba(74,61,100,0.12)] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] z-10 animate-in fade-in-50 zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-[rgba(74,61,100,0.08)] bg-gradient-to-r from-amber-50/60 via-white to-amber-50/30">
          <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[rgba(184,148,78,0.12)] text-[#80642F] border border-[rgba(184,148,78,0.22)]">
              <FileText size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(184,148,78,0.12)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#80642F] border border-[rgba(184,148,78,0.20)] shrink-0">
                  <Layers size={10} />
                  <span>Epic Notes</span>
                </span>
                <span className="text-[rgba(74,61,100,0.25)] text-xs">•</span>
                <span className="text-[11px] font-semibold text-[#706C7D] shrink-0">
                  {epicNotes.length} {epicNotes.length === 1 ? "note" : "notes"}
                </span>
              </div>
              <h2
                className="text-base sm:text-lg font-bold text-[#252331] tracking-tight line-clamp-1 leading-snug"
                title={formattedEpicName}
              >
                {formattedEpicName}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus size={13} />}
              onClick={handleCreateNote}
              isLoading={isCreating}
              className="text-xs"
            >
              <span>New Note</span>
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-lg text-[#9994A5] hover:bg-neutral-100 hover:text-[#252331] transition"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Split View: List on left, Editor on right */}
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] flex-1 overflow-hidden min-h-[500px]">
          {/* Left Column: Note List */}
          <div className="border-r border-[rgba(74,61,100,0.08)] bg-[#FAF9FC]/70 flex flex-col h-full overflow-hidden">
            {/* Search */}
            <div className="p-3 border-b border-[rgba(74,61,100,0.06)]">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9994A5]" />
                <input
                  type="text"
                  placeholder="Search epic notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8 pl-8 pr-2.5 rounded-xl border border-[rgba(74,61,100,0.10)] bg-white text-xs text-[#252331] outline-none transition focus:border-[#B8944E]"
                />
              </div>
            </div>

            {/* Note Cards List */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
              {filteredEpicNotes.length === 0 ? (
                <div className="py-8 px-4 text-center space-y-2">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-[rgba(184,148,78,0.10)] text-[#80642F] mx-auto border border-[rgba(184,148,78,0.16)]">
                    <FileText size={16} />
                  </div>
                  <p className="text-xs text-[#706C7D]">
                    {searchQuery ? "No matching notes found." : "No notes for this epic yet."}
                  </p>
                  {!searchQuery && (
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<Plus size={12} />}
                      onClick={handleCreateNote}
                      isLoading={isCreating}
                      className="text-xs mt-1"
                    >
                      Create first note
                    </Button>
                  )}
                </div>
              ) : (
                filteredEpicNotes.map((note) => {
                  const isSelected = note.id === activeNoteId;
                  const imgCount = (note.images || []).length;

                  return (
                    <button
                      key={note.id}
                      type="button"
                      onClick={() => setActiveNoteId(note.id)}
                      className={`w-full text-left p-3 rounded-xl transition border cursor-pointer ${
                        isSelected
                          ? "bg-white border-[#B8944E] shadow-sm ring-1 ring-[#B8944E]/20"
                          : "bg-white/70 border-[rgba(74,61,100,0.08)] hover:bg-white hover:border-[rgba(184,148,78,0.3)]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5 mb-1">
                        <span className="text-xs font-bold text-[#252331] truncate flex-1">
                          {note.title || "Untitled Note"}
                        </span>
                        {note.is_client_visible ? (
                          <span className="shrink-0 inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Client
                          </span>
                        ) : (
                          <span className="shrink-0 text-[9px] font-medium text-[#9994A5]">
                            Internal
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-[#706C7D] line-clamp-2 leading-relaxed">
                        {note.content || "Empty note content..."}
                      </p>

                      <div className="mt-2 flex items-center justify-between text-[10px] text-[#9994A5]">
                        <span className="flex items-center gap-1">
                          <Calendar size={10} />
                          {new Date(note.updated_at || note.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>

                        {imgCount > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[#80642F] font-semibold">
                            <ImageIcon size={10} />
                            {imgCount}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Note Editor */}
          {activeNote ? (
            <div className="flex flex-col h-full overflow-y-auto p-4 sm:p-6 space-y-4">
              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[rgba(74,61,100,0.06)] pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#9994A5] font-medium">
                    {saveStatus === "saving" ? (
                      <span className="flex items-center gap-1 text-[#80642F]">
                        <Loader2 size={12} className="animate-spin" /> Saving...
                      </span>
                    ) : saveStatus === "unsaved" ? (
                      <span className="text-amber-600">Unsaved changes</span>
                    ) : (
                      <span className="flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 size={12} /> All changes saved
                      </span>
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Client Visibility Toggle */}
                  <button
                    type="button"
                    onClick={handleToggleClientVisible}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border transition cursor-pointer ${
                      isClientVisible
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/70"
                        : "bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100"
                    }`}
                    title={
                      isClientVisible
                        ? "This note is visible to clients mapped to the project"
                        : "This note is internal-only and hidden from clients"
                    }
                  >
                    {isClientVisible ? (
                      <>
                        <Eye size={12} className="text-emerald-600" />
                        <span>Visible to Client</span>
                      </>
                    ) : (
                      <>
                        <EyeOff size={12} className="text-neutral-500" />
                        <span>Internal Only</span>
                      </>
                    )}
                  </button>

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => setDeletingNoteId(activeNote.id)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg transition"
                    title="Delete note"
                  >
                    <Trash2 size={13} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>

              {/* Title input */}
              <div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    triggerAutoSave(e.target.value, content, tags);
                  }}
                  placeholder="Note Title..."
                  className="w-full text-lg sm:text-xl font-bold text-[#252331] outline-none placeholder:text-neutral-300 border-b border-transparent focus:border-[rgba(184,148,78,0.3)] pb-1 transition"
                />
              </div>

              {/* Tags Editor */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <Tag size={12} className="text-[#9994A5]" />
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-md bg-[rgba(74,61,100,0.06)] px-2 py-0.5 text-[11px] font-medium text-[#706C7D]"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => {
                        const next = tags.filter((t) => t !== tag);
                        setTags(next);
                        triggerAutoSave(title, content, next);
                      }}
                      className="hover:text-rose-600"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}

                <input
                  type="text"
                  placeholder="+ Add tag..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      const val = tagInput.trim().replace(/^#/, "");
                      if (val && !tags.includes(val)) {
                        const next = [...tags, val];
                        setTags(next);
                        setTagInput("");
                        triggerAutoSave(title, content, next);
                      }
                    }
                  }}
                  className="h-6 w-24 text-[11px] bg-transparent outline-none placeholder:text-[#9994A5] text-[#252331]"
                />
              </div>

              {/* Note Content Textarea */}
              <div className="flex-1 min-h-[160px]">
                <Textarea
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value);
                    triggerAutoSave(title, e.target.value, tags);
                  }}
                  rows={8}
                  placeholder={`Write discussion notes, meeting decisions, or requirements specific to ${formattedEpicName}...`}
                  className="w-full h-full rounded-xl border border-[rgba(74,61,100,0.10)] p-3.5 text-xs sm:text-sm text-[#252331] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.15)] leading-relaxed resize-y bg-[#FAF9FC]/40"
                />
              </div>

              {/* Note Image Attachments Gallery */}
              <div className="border-t border-[rgba(74,61,100,0.06)] pt-4">
                <NoteImageGallery
                  projectId={projectId}
                  noteId={activeNote.id}
                  images={images}
                  onImagesChange={(updatedImages) => {
                    setImages(updatedImages);
                    saveActiveNote(title, content, tags, updatedImages);
                  }}
                  onInsertMarkdown={(snippet) => {
                    const newContent = content ? `${content}\n\n${snippet}` : snippet;
                    setContent(newContent);
                    triggerAutoSave(title, newContent, tags);
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[rgba(184,148,78,0.10)] text-[#80642F] border border-[rgba(184,148,78,0.2)]">
                <FileText size={22} />
              </div>
              <h3 className="text-base font-bold text-[#252331]">No Note Selected</h3>
              <p className="text-xs text-[#706C7D] max-w-sm">
                Select a note on the left or create a new note for this epic to record call notes, specs, or attach visual screenshots.
              </p>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus size={13} />}
                onClick={handleCreateNote}
                isLoading={isCreating}
              >
                New Epic Note
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deletingNoteId)}
        onClose={() => setDeletingNoteId(null)}
        onConfirm={confirmDeleteNote}
        title="Delete Epic Note"
        description="Are you sure you want to delete this note? Any attached images will also be removed."
        confirmLabel="Delete Note"
        variant="danger"
      />
    </div>,
    document.body
  );
}

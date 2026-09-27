"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  FileText,
  Plus,
  Search,
  Sparkles,
  Trash2,
  CheckCircle2,
  Calendar,
  Tag,
  ArrowRight,
  Clock,
  User,
  Save,
  Check,
  ExternalLink,
  Layers,
  Mic,
  Image as ImageIcon,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { VoiceTextarea } from "@/components/ui/VoiceTextarea";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ConvertNoteModal } from "@/components/notes/ConvertNoteModal";
import { NoteImageGallery } from "@/components/notes/NoteImageGallery";
import { convertImageToWebP } from "@/lib/image-utils";
import { toast } from "@/lib/toast";
import type { ProjectNote, Epic, Story, NoteImage } from "@/lib/types";

interface ProjectNotesWorkspaceProps {
  projectId: string;
  epics: Epic[];
  initialNotes: ProjectNote[];
  onConversionComplete: (result: {
    epic: Epic;
    stories: Story[];
    note: ProjectNote;
  }) => void;
  onNavigateToEpic?: (epicId: string) => void;
}

export function ProjectNotesWorkspace({
  projectId,
  epics,
  initialNotes,
  onConversionComplete,
  onNavigateToEpic,
}: ProjectNotesWorkspaceProps) {
  const [notes, setNotes] = useState<ProjectNote[]>(initialNotes);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(
    initialNotes[0]?.id || null
  );

  // Editor states for active note
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [images, setImages] = useState<NoteImage[]>([]);
  const [isClientVisible, setIsClientVisible] = useState(false);
  const [epicId, setEpicId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "unsaved" | "saving">("saved");

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "converted" | "client">("all");
  const [epicFilter, setEpicFilter] = useState<string>("all");

  // Delete modal state
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  // Conversion modal state
  const [convertModalOpen, setConvertModalOpen] = useState(false);

  // Debounce auto-save ref
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Active note lookup
  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeNoteId) || null,
    [notes, activeNoteId]
  );

  // Sync editor fields when active note changes
  useEffect(() => {
    if (activeNote) {
      setTitle(activeNote.title);
      setContent(activeNote.content);
      setTags(activeNote.tags || []);
      setImages(activeNote.images || []);
      setIsClientVisible(Boolean(activeNote.is_client_visible));
      setEpicId(activeNote.epic_id || null);
      setSaveStatus("saved");
    } else {
      setTitle("");
      setContent("");
      setTags([]);
      setImages([]);
      setIsClientVisible(false);
      setEpicId(null);
      setSaveStatus("saved");
    }
  }, [activeNoteId]);

  // Sync initialNotes prop
  useEffect(() => {
    setNotes(initialNotes);
    if (!activeNoteId && initialNotes.length > 0) {
      setActiveNoteId(initialNotes[0].id);
    }
  }, [initialNotes]);

  // Save changes to backend
  const saveActiveNote = useCallback(
    async (
      noteTitle: string,
      noteContent: string,
      noteTags: string[],
      noteImages?: NoteImage[],
      clientVisible?: boolean,
      assignedEpicId?: string | null
    ) => {
      if (!activeNoteId) return;

      setIsSaving(true);
      setSaveStatus("saving");

      const finalClientVisible = clientVisible !== undefined ? clientVisible : isClientVisible;
      const finalEpicId = assignedEpicId !== undefined ? assignedEpicId : epicId;

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
            epic_id: finalEpicId,
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to save note");
        }

        const data = await res.json();
        setNotes((prev) =>
          prev.map((n) => (n.id === activeNoteId ? { ...n, ...data.note, epic_id: finalEpicId } : n))
        );
        setSaveStatus("saved");
      } catch {
        setSaveStatus("unsaved");
      } finally {
        setIsSaving(false);
      }
    },
    [activeNoteId, projectId, images, isClientVisible, epicId]
  );

  // Toggle client visibility
  const handleToggleClientVisible = () => {
    const nextVal = !isClientVisible;
    setIsClientVisible(nextVal);
    saveActiveNote(title, content, tags, images, nextVal);
    toast.success(
      nextVal ? "Visible to client" : "Made internal only",
      nextVal
        ? "Clients mapped to this project can now view this note in their portal."
        : "This note is now private and hidden from mapped clients."
    );
  };

  // Trigger auto-save on field edits
  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setSaveStatus("unsaved");

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveActiveNote(title, newContent, tags, images);
    }, 1400);
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    setSaveStatus("unsaved");

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveActiveNote(newTitle, content, tags, images);
    }, 1400);
  };

  // Clipboard paste handler for screenshots & images directly in editor
  const handlePasteInEditor = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items || !activeNoteId) return;

    const filesToUpload: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) filesToUpload.push(file);
      }
    }

    if (filesToUpload.length === 0) return;

    e.preventDefault();
    try {
      for (const rawFile of filesToUpload) {
        toast.info("Converting pasted screenshot to WebP...");
        const conversion = await convertImageToWebP(rawFile, { quality: 0.88 });

        const formData = new FormData();
        formData.append("file", conversion.file);
        formData.append("name", `screenshot-${Date.now()}.webp`);
        formData.append("width", String(conversion.width));
        formData.append("height", String(conversion.height));
        formData.append("originalSize", String(conversion.originalSize));

        const res = await fetch(`/api/projects/${projectId}/notes/${activeNoteId}/images`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          throw new Error("Failed to upload pasted image");
        }

        const data = await res.json();
        if (data.image) {
          const updated = [...images, data.image];
          setImages(updated);
          setNotes((prev) =>
            prev.map((n) => (n.id === activeNoteId ? { ...n, images: updated } : n))
          );
          toast.success("Pasted screenshot converted to WebP & attached!");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to process pasted screenshot");
    }
  };

  // Add new note
  async function handleCreateNote() {
    try {
      const defaultTitle = `Discussion Note - ${new Date().toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })}`;

      const res = await fetch(`/api/projects/${projectId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: defaultTitle,
          content: "",
          tags: ["discussion"],
          epic_id: epicFilter && epicFilter !== "all" && epicFilter !== "none" ? epicFilter : null,
        }),
      });

      if (!res.ok) throw new Error("Could not create note");
      const data = await res.json();

      setNotes((prev) => [data.note, ...prev]);
      setActiveNoteId(data.note.id);
      toast.success("New discussion note created");
    } catch {
      toast.error("Unable to create note");
    }
  }

  // Delete note
  async function confirmDeleteNote() {
    if (!deletingNoteId) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/notes/${deletingNoteId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete note");

      setNotes((prev) => prev.filter((n) => n.id !== deletingNoteId));
      if (activeNoteId === deletingNoteId) {
        const remaining = notes.filter((n) => n.id !== deletingNoteId);
        setActiveNoteId(remaining[0]?.id || null);
      }

      toast.success("Note deleted");
    } catch {
      toast.error("Unable to delete note");
    } finally {
      setDeletingNoteId(null);
    }
  }

  // Add tag
  function handleAddTag() {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      const updated = [...tags, trimmed];
      setTags(updated);
      setTagInput("");
      saveActiveNote(title, content, updated, images);
    }
  }

  function handleRemoveTag(t: string) {
    const updated = tags.filter((x) => x !== t);
    setTags(updated);
    saveActiveNote(title, content, updated, images);
  }

  // Filter notes
  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      if (statusFilter === "client") {
        if (!n.is_client_visible) return false;
      } else if (statusFilter !== "all" && n.status !== statusFilter) {
        return false;
      }
      if (epicFilter === "none") {
        if (n.epic_id) return false;
      } else if (epicFilter !== "all") {
        if (n.epic_id !== epicFilter) return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const inTitle = n.title.toLowerCase().includes(q);
      const inContent = n.content.toLowerCase().includes(q);
      const inTags = (n.tags || []).some((t) => t.toLowerCase().includes(q));
      return inTitle || inContent || inTags;
    });
  }, [notes, statusFilter, epicFilter, searchQuery]);

  // Converted Epic name lookup if active note is converted
  const convertedEpic = useMemo(() => {
    if (!activeNote?.converted_epic_id) return null;
    return epics.find((e) => e.id === activeNote.converted_epic_id) || null;
  }, [activeNote, epics]);

  return (
    <div className="rounded-[18px] border border-[rgba(74,61,100,0.08)] bg-white/88 shadow-[0_8px_30px_rgba(70,55,95,0.055)] backdrop-blur-[16px] overflow-hidden">
      {/* Top Banner / Explainer */}
      <div className="border-b border-[rgba(74,61,100,0.06)] bg-[#FAF9FC]/90 px-4 py-3 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-[rgba(184,148,78,0.10)] text-[#80642F] border border-[rgba(184,148,78,0.20)] shrink-0">
            <FileText size={15} />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-[#252331] leading-tight">
              Discussion & Meeting Notes
            </h3>
            <p className="text-[11px] text-[#706C7D]">
              Jot down client requirements during calls, then convert them directly into Epics and User Stories.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus size={13} />}
            onClick={handleCreateNote}
            className="text-xs px-3"
          >
            New Note
          </Button>
        </div>
      </div>

      {/* Main Workspace Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] min-h-[560px]">
        {/* Left Column: Notes List & Search */}
        <div className="border-b lg:border-b-0 lg:border-r border-[rgba(74,61,100,0.08)] flex flex-col bg-[#FAF9FC]/40">
          {/* Search & Filter Header */}
          <div className="p-3 sm:p-4 border-b border-[rgba(74,61,100,0.06)] space-y-2.5">
            <div className="relative">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9994A5]"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes or tags..."
                className="w-full h-8 pl-8 pr-3 text-xs rounded-xl border border-[rgba(74,61,100,0.10)] bg-white text-[#252331] outline-none focus:border-[#B8944E]"
              />
            </div>

            {/* Segmented Filter */}
            <div className="grid grid-cols-4 gap-1 bg-[#FAF9FC] p-0.5 rounded-xl border border-[rgba(74,61,100,0.08)] text-[10px]">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`py-1 rounded-lg font-medium transition cursor-pointer text-center ${
                  statusFilter === "all"
                    ? "bg-white text-[#252331] shadow-2xs font-semibold"
                    : "text-[#706C7D] hover:text-[#252331]"
                }`}
              >
                All ({notes.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("active")}
                className={`py-1 rounded-lg font-medium transition cursor-pointer text-center ${
                  statusFilter === "active"
                    ? "bg-white text-[#252331] shadow-2xs font-semibold"
                    : "text-[#706C7D] hover:text-[#252331]"
                }`}
              >
                Drafts ({notes.filter((n) => n.status === "active").length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("converted")}
                className={`py-1 rounded-lg font-medium transition cursor-pointer text-center ${
                  statusFilter === "converted"
                    ? "bg-white text-[#252331] shadow-2xs font-semibold"
                    : "text-[#706C7D] hover:text-[#252331]"
                }`}
              >
                Done ({notes.filter((n) => n.status === "converted").length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("client")}
                className={`py-1 rounded-lg font-medium transition cursor-pointer text-center ${
                  statusFilter === "client"
                    ? "bg-white text-emerald-800 shadow-2xs font-semibold"
                    : "text-[#706C7D] hover:text-emerald-700"
                }`}
              >
                Client ({notes.filter((n) => n.is_client_visible).length})
              </button>
            </div>

            {/* Epic Filter Dropdown */}
            {epics.length > 0 && (
              <div className="flex items-center gap-1.5 pt-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#9994A5] shrink-0">
                  Epic:
                </span>
                <select
                  value={epicFilter}
                  onChange={(e) => setEpicFilter(e.target.value)}
                  className="w-full h-7 rounded-lg border border-[rgba(74,61,100,0.10)] bg-white px-2 text-[11px] font-medium text-[#252331] outline-none transition focus:border-[#B8944E]"
                >
                  <option value="all">All Epics &amp; General ({notes.length})</option>
                  <option value="none">Project-wide Only ({notes.filter((n) => !n.epic_id).length})</option>
                  {epics.map((ep) => {
                    const count = notes.filter((n) => n.epic_id === ep.id).length;
                    return (
                      <option key={ep.id} value={ep.id}>
                        {ep.name} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>

          {/* Notes Scroll List */}
          <div className="flex-1 overflow-y-auto max-h-[600px] p-2 space-y-1.5">
            {filteredNotes.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <FileText size={20} className="mx-auto text-[#9994A5]" />
                <p className="text-xs font-semibold text-[#252331]">No notes found</p>
                <p className="text-[11px] text-[#706C7D]">
                  {searchQuery ? "Try a different search term" : "Click 'New Note' to start noting discussion points."}
                </p>
              </div>
            ) : (
              filteredNotes.map((noteItem) => {
                const isSelected = noteItem.id === activeNoteId;
                const isConverted = noteItem.status === "converted";
                const linkedEpic = noteItem.epic_id ? epics.find((e) => e.id === noteItem.epic_id) : null;

                return (
                  <button
                    key={noteItem.id}
                    type="button"
                    onClick={() => setActiveNoteId(noteItem.id)}
                    className={`w-full text-left p-3 rounded-xl transition border cursor-pointer flex flex-col gap-1.5 ${
                      isSelected
                        ? "border-[#B8944E] bg-white shadow-xs ring-1 ring-[#B8944E]"
                        : "border-transparent hover:border-[rgba(74,61,100,0.08)] hover:bg-white/80"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-[#252331] line-clamp-1">
                        {noteItem.title || "Untitled Note"}
                      </h4>
                      <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                        {linkedEpic && (
                          <span
                            className="inline-flex items-center gap-0.5 rounded-md bg-[rgba(184,148,78,0.12)] px-1.5 py-0.5 text-[9px] font-semibold text-[#80642F] border border-[rgba(184,148,78,0.20)] truncate max-w-[90px]"
                            title={`Linked Epic: ${linkedEpic.name}`}
                          >
                            <Layers size={8} />
                            <span className="truncate">{linkedEpic.name}</span>
                          </span>
                        )}
                        {noteItem.is_client_visible && (
                          <span
                            className="inline-flex items-center gap-0.5 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 border border-emerald-200/80"
                            title="Visible to clients mapped to this project"
                          >
                            <Eye size={9} />
                            Client
                          </span>
                        )}
                        {isConverted && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 border border-emerald-200/80">
                            <CheckCircle2 size={10} />
                            Converted
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-[11px] text-[#706C7D] line-clamp-2">
                      {noteItem.content || "Empty note. Click to start typing..."}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-[#9994A5] pt-1">
                      <div className="flex items-center gap-1.5">
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {new Date(noteItem.updated_at || noteItem.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        {noteItem.images && noteItem.images.length > 0 && (
                          <span
                            className="inline-flex items-center gap-0.5 rounded-md bg-[rgba(184,148,78,0.12)] px-1.5 py-0.2 text-[9px] font-bold text-[#80642F]"
                            title={`${noteItem.images.length} image(s) attached`}
                          >
                            <ImageIcon size={9} />
                            {noteItem.images.length}
                          </span>
                        )}
                      </div>
                      {noteItem.created_by_name && (
                        <span className="truncate max-w-[100px]">
                          {noteItem.created_by_name}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Note Editor & Action Bar */}
        {activeNote ? (
          <div className="flex flex-col bg-white">
            {/* Action Bar Header */}
            <div className="border-b border-[rgba(74,61,100,0.08)] px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 bg-[#FAF9FC]/60">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] text-[#706C7D] font-medium">
                  {saveStatus === "saving" ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-[#B8944E] animate-pulse" />
                      Saving changes...
                    </>
                  ) : saveStatus === "saved" ? (
                    <>
                      <Check size={12} className="text-emerald-600" />
                      All changes saved
                    </>
                  ) : (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      Unsaved edits
                    </>
                  )}
                </span>
              </div>

              {/* Conversion and Note Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Client Visibility Toggle */}
                <button
                  type="button"
                  onClick={handleToggleClientVisible}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition border cursor-pointer ${
                    isClientVisible
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100/80 shadow-2xs"
                      : "bg-white text-[#706C7D] border-[rgba(74,61,100,0.12)] hover:bg-[#FAF9FC] hover:text-[#252331]"
                  }`}
                  title={
                    isClientVisible
                      ? "Currently visible to clients mapped to this project. Click to make internal only."
                      : "Currently private/internal. Click to make visible to mapped clients."
                  }
                >
                  {isClientVisible ? (
                    <>
                      <Eye size={13} className="text-emerald-600" />
                      <span>Visible to Client</span>
                    </>
                  ) : (
                    <>
                      <EyeOff size={13} className="text-[#9994A5]" />
                      <span>Internal Only</span>
                    </>
                  )}
                </button>

                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Trash2 size={13} className="text-[#C25D72]" />}
                  onClick={() => setDeletingNoteId(activeNote.id)}
                  className="text-xs text-[#C25D72] hover:bg-rose-50"
                  title="Delete note"
                >
                  Delete
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Save size={13} />}
                  onClick={() => saveActiveNote(title, content, tags)}
                  disabled={isSaving}
                  className="text-xs"
                >
                  Save
                </Button>

                {/* Primary Conversion Trigger */}
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Sparkles size={13} className="text-[#80642F]" />}
                  onClick={() => setConvertModalOpen(true)}
                  className="text-xs font-semibold bg-gradient-to-r from-[rgba(184,148,78,0.18)] to-[rgba(184,148,78,0.28)] text-[#80642F] border border-[rgba(184,148,78,0.35)] hover:bg-[rgba(184,148,78,0.3)] shadow-2xs"
                  title="Convert discussion into Epic and Stories"
                >
                  Convert to Epic & Stories
                </Button>
              </div>
            </div>

            {/* If Note Converted: Highlight Banner */}
            {activeNote.status === "converted" && (
              <div className="bg-emerald-50/90 border-b border-emerald-200/70 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 text-xs text-emerald-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <span>
                    This note was converted into requirements
                    {convertedEpic ? ` (Epic: "${convertedEpic.name}")` : ""}.
                  </span>
                </div>

                {convertedEpic && onNavigateToEpic && (
                  <button
                    type="button"
                    onClick={() => onNavigateToEpic(convertedEpic.id)}
                    className="inline-flex items-center gap-1 font-semibold text-emerald-900 hover:underline shrink-0 cursor-pointer"
                  >
                    <span>View Epic</span>
                    <ArrowRight size={12} />
                  </button>
                )}
              </div>
            )}

            {/* Note Editor Fields */}
            <div className="p-4 sm:p-6 flex-1 flex flex-col space-y-4">
              {/* Client Visibility Pill */}
              <div
                className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl text-xs border transition-colors ${
                  isClientVisible
                    ? "bg-emerald-50/80 border-emerald-200/80 text-emerald-900"
                    : "bg-[#FAF9FC] border-[rgba(74,61,100,0.06)] text-[#706C7D]"
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {isClientVisible ? (
                    <>
                      <Eye size={13} className="text-emerald-600 shrink-0" />
                      <span className="truncate">
                        <strong>Shared with Client:</strong> Mapped clients can view this note in their portal.
                      </span>
                    </>
                  ) : (
                    <>
                      <EyeOff size={13} className="text-[#9994A5] shrink-0" />
                      <span className="truncate">
                        <strong>Internal Note:</strong> Only visible to you and assigned team members.
                      </span>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleToggleClientVisible}
                  className="text-[11px] font-semibold underline hover:opacity-80 shrink-0 cursor-pointer text-[#80642F]"
                >
                  {isClientVisible ? "Make Internal" : "Share with Client"}
                </button>
              </div>

              {/* Linked Epic Selector */}
              {epics.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9994A5] flex items-center gap-1 shrink-0">
                    <Layers size={12} className="text-[#B8944E]" />
                    <span>Linked Epic:</span>
                  </span>
                  <select
                    value={epicId || ""}
                    onChange={(e) => {
                      const nextEpicId = e.target.value || null;
                      setEpicId(nextEpicId);
                      saveActiveNote(title, content, tags, images, isClientVisible, nextEpicId);
                      toast.success(
                        nextEpicId
                          ? `Note linked to Epic: ${epics.find((ep) => ep.id === nextEpicId)?.name}`
                          : "Note detached to project-wide"
                      );
                    }}
                    className="h-7 rounded-lg border border-[rgba(74,61,100,0.12)] bg-[#FAF9FC] px-2.5 text-xs font-semibold text-[#80642F] outline-none transition focus:border-[#B8944E] cursor-pointer shadow-2xs"
                  >
                    <option value="">Project-wide (General Note)</option>
                    {epics.map((ep) => (
                      <option key={ep.id} value={ep.id}>
                        Epic: {ep.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Note Title Input */}
              <input
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Note Title (e.g. Kickoff Discussion - User Roles & Auth)"
                className="w-full text-base sm:text-xl font-bold tracking-tight text-[#252331] outline-none placeholder:text-[#9994A5] bg-transparent border-b border-transparent focus:border-[rgba(74,61,100,0.12)] pb-1 transition"
              />

              {/* Tags row */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <Tag size={12} className="text-[#9994A5] shrink-0" />
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 text-[11px] rounded-md bg-[rgba(74,61,100,0.06)] text-[#706C7D] px-2 py-0.5"
                  >
                    <span>#{t}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      className="hover:text-[#252331]"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="+ Add tag..."
                  className="text-xs bg-transparent text-[#252331] outline-none placeholder:text-[#9994A5] w-24 py-0.5"
                />
              </div>

              {/* Content Textarea with Voice Dictation & Screenshot Paste */}
              <div className="flex-1 flex flex-col pt-2" onPaste={handlePasteInEditor}>
                <VoiceTextarea
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  rows={10}
                  placeholder={`Capture discussion points, client decisions, and meeting notes here...

Tip: You can paste screenshots (Ctrl+V) directly into this editor.

Example:
• Client wants multi-tenant team members with custom roles.
• Login should support Email + Password and Magic Link via Resend.
• Profile page should allow changing notification preferences.
• Stripe integration needed for monthly recurring subscriptions.`}
                  className="w-full flex-1 rounded-xl border border-[rgba(74,61,100,0.10)] p-4 text-xs sm:text-sm text-[#252331] leading-relaxed outline-none focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)] bg-[#FAF9FC]/30 resize-none font-sans"
                />
              </div>

              {/* Discussion Note Attached Images Gallery & Upload Controls */}
              <div className="border-t border-[rgba(74,61,100,0.08)] pt-3">
                <NoteImageGallery
                  projectId={projectId}
                  noteId={activeNote.id}
                  images={images}
                  onImagesChange={(newImages) => {
                    setImages(newImages);
                    setNotes((prev) =>
                      prev.map((n) => (n.id === activeNote.id ? { ...n, images: newImages } : n))
                    );
                  }}
                  onInsertMarkdown={(snippet) => {
                    const updated = content + snippet;
                    handleContentChange(updated);
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid place-items-center p-12 text-center">
            <div className="space-y-3 max-w-sm">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[rgba(184,148,78,0.10)] text-[#80642F] mx-auto border border-[rgba(184,148,78,0.20)]">
                <FileText size={22} />
              </div>
              <h4 className="text-sm font-bold text-[#252331]">No note selected</h4>
              <p className="text-xs text-[#706C7D]">
                Select a note from the left to review or edit, or create a new note for your ongoing meeting.
              </p>
              <Button
                variant="primary"
                size="md"
                leftIcon={<Plus size={14} />}
                onClick={handleCreateNote}
              >
                Create New Note
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Convert Note Modal */}
      {activeNote && (
        <ConvertNoteModal
          projectId={projectId}
          note={activeNote}
          epics={epics}
          isOpen={convertModalOpen}
          onClose={() => setConvertModalOpen(false)}
          onConversionComplete={(res) => {
            setNotes((prev) =>
              prev.map((n) => (n.id === res.note.id ? res.note : n))
            );
            onConversionComplete(res);
          }}
        />
      )}

      {/* Delete Note Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingNoteId)}
        onClose={() => setDeletingNoteId(null)}
        onConfirm={confirmDeleteNote}
        title="Delete Discussion Note"
        description="Are you sure you want to delete this discussion note? This action cannot be undone."
        confirmLabel="Delete Note"
        variant="danger"
      />
    </div>
  );
}

"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  X,
  Calendar,
  CheckCircle2,
  Clock,
  MessageSquare,
  Paperclip,
  User,
  Trash2,
  Edit2,
  BookOpen,
  Send,
  Upload,
  Download,
  ExternalLink,
  AlertCircle,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Check,
  ChevronRight,
  Bell,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/lib/toast";
import type {
  Task,
  TaskNote,
  TaskAttachment,
  TaskStatus,
  TaskPriority,
  TaskAssigneeOption,
} from "@/lib/types/task";
import {
  getTaskStatusLabel,
  getTaskPriorityLabel,
  getTaskCategoryBadge,
} from "@/lib/types/task";

interface TaskDetailDrawerProps {
  taskId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated: (updatedTask: Task) => void;
  onTaskDeleted: (taskId: string) => void;
  onEditRequest: (task: Task) => void;
}

export function TaskDetailDrawer({
  taskId,
  isOpen,
  onClose,
  onTaskUpdated,
  onTaskDeleted,
  onEditRequest,
}: TaskDetailDrawerProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"notes" | "attachments">("notes");

  // Notes state
  const [notes, setNotes] = useState<TaskNote[]>([]);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);

  // Attachments state
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Re-assign / Story linking state
  const [assigneeOptions, setAssigneeOptions] = useState<TaskAssigneeOption[]>([]);
  const [storyOptions, setStoryOptions] = useState<Array<{ id: string; title: string }>>([]);
  const [updatingAssignee, setUpdatingAssignee] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch task details whenever taskId changes
  useEffect(() => {
    if (!taskId || !isOpen) return;

    setLoading(true);
    fetch(`/api/tasks/${taskId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.task) {
          setTask(data.task);
          setNotes(data.task.notes || []);
          setAttachments(data.task.attachments || []);

          // Load project assignees and stories for quick updates
          if (data.task.project_id) {
            fetch(`/api/projects/${data.task.project_id}/assignees`)
              .then((r) => r.json())
              .then((aData) => setAssigneeOptions(aData.assignees || []))
              .catch(() => {});

            fetch(`/api/projects/${data.task.project_id}/stories/options`)
              .then((r) => r.json())
              .then((sData) => setStoryOptions(sData.stories || []))
              .catch(() => {});
          }
        }
      })
      .catch((err) => {
        toast.error("Failed to load task details");
      })
      .finally(() => setLoading(false));
  }, [taskId, isOpen]);

  if (!isOpen || !taskId) return null;

  // Status transitions
  const statusSteps: { id: TaskStatus; label: string }[] = [
    { id: "todo", label: "To Do" },
    { id: "in_progress", label: "In Progress" },
    { id: "in_review", label: "In Review" },
    { id: "done", label: "Done" },
  ];

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (!task) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setTask((prev) => (prev ? { ...prev, status: newStatus } : null));
      onTaskUpdated(data.task);
      toast.success(`Task status moved to ${getTaskStatusLabel(newStatus)}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const handleAssigneeChange = async (newAssigneeId: string) => {
    if (!task) return;
    setUpdatingAssignee(true);
    try {
      const selected = assigneeOptions.find((a) => a.id === newAssigneeId);
      const payload = {
        assignee_id: selected ? selected.id : null,
        assignee_type: selected ? selected.type : null,
        assignee_name: selected ? selected.name : null,
        assignee_email: selected ? selected.email : null,
      };

      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setTask((prev) => (prev ? { ...prev, ...payload } : null));
      onTaskUpdated(data.task);
      toast.success(
        selected
          ? `Assigned to ${selected.name} & notification sent!`
          : "Task unassigned"
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to update assignee");
    } finally {
      setUpdatingAssignee(false);
    }
  };

  const handleStoryChange = async (newStoryId: string) => {
    if (!task) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ story_id: newStoryId || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const linkedStory = storyOptions.find((s) => s.id === newStoryId);
      setTask((prev) =>
        prev
          ? {
              ...prev,
              story_id: newStoryId || null,
              story: linkedStory ? { id: linkedStory.id, title: linkedStory.title } : null,
            }
          : null
      );
      onTaskUpdated(data.task);
      toast.success(newStoryId ? "Linked to story" : "Story unlinked");
    } catch (err: any) {
      toast.error(err.message || "Failed to link story");
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim() || !task) return;

    setSubmittingNote(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newNoteContent.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setNotes((prev) => [...prev, data.note]);
      setNewNoteContent("");
      setTask((prev) =>
        prev ? { ...prev, notes_count: (prev.notes_count || 0) + 1 } : null
      );
      toast.success("Note added");
    } catch (err: any) {
      toast.error(err.message || "Failed to add note");
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !task) return;

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/tasks/${task.id}/attachments`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setAttachments((prev) => [data.attachment, ...prev]);
      setTask((prev) =>
        prev
          ? { ...prev, attachments_count: (prev.attachments_count || 0) + 1 }
          : null
      );
      toast.success("File attached successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload file");
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!task) return;
    try {
      const res = await fetch(
        `/api/tasks/${task.id}/attachments/${attachmentId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete attachment");

      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      setTask((prev) =>
        prev
          ? {
              ...prev,
              attachments_count: Math.max(0, (prev.attachments_count || 1) - 1),
            }
          : null
      );
      toast.success("Attachment deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  const handleDeleteTask = async () => {
    if (!task) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete task");

      toast.success("Task deleted successfully");
      onTaskDeleted(task.id);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete task");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return "0 KB";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileType?: string | null) => {
    if (!fileType) return <FileText size={18} className="text-zinc-500" />;
    if (fileType.startsWith("image/"))
      return <ImageIcon size={18} className="text-indigo-500" />;
    if (fileType.includes("sheet") || fileType.includes("csv") || fileType.includes("excel"))
      return <FileSpreadsheet size={18} className="text-emerald-500" />;
    return <FileText size={18} className="text-[#80642F]" />;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 bg-[#252331]/40 backdrop-blur-xs transition-opacity animate-in fade-in-0 duration-200"
      />

      {/* Drawer Container (Side Slide-over on Desktop, Full Drawer on Mobile) */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-250">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-[rgba(74,61,100,0.08)] px-4 sm:px-5 py-3.5 sm:py-4 bg-[#FAF9FC]">
          <div className="flex flex-col min-w-0 pr-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9994A5]">
              {task?.project?.name || "Project Task"}
            </span>
            <h2 className="text-base font-bold text-[#252331] truncate">
              {loading ? "Loading task..." : task?.title}
            </h2>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {task && (
              <>
                <button
                  type="button"
                  onClick={() => onEditRequest(task)}
                  className="rounded-lg p-2 text-[#706C7D] hover:bg-zinc-100 hover:text-[#252331] transition-colors"
                  title="Edit Task Details"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="rounded-lg p-2 text-[#706C7D] hover:bg-rose-50 hover:text-rose-600 transition-colors"
                  title="Delete Task"
                >
                  <Trash2 size={16} />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-[#706C7D] hover:bg-zinc-100 hover:text-[#252331] transition-colors"
              aria-label="Close details"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center p-8 text-[#9994A5]">
            <Loader2 size={24} className="animate-spin text-[#B8944E]" />
          </div>
        ) : task ? (
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-5 sm:space-y-6">
            {/* Status Progress Stepper */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#9994A5] mb-2">
                Status Lifecycle
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {statusSteps.map((step, idx) => {
                  const isActive = task.status === step.id;
                  const isPast =
                    statusSteps.findIndex((s) => s.id === task.status) >= idx;

                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => handleStatusChange(step.id)}
                      className={`flex items-center justify-center p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                        isActive
                          ? "border-[#B8944E] bg-[rgba(184,148,78,0.12)] text-[#80642F] shadow-xs"
                          : isPast
                          ? "border-emerald-200 bg-emerald-50/60 text-emerald-700"
                          : "border-[rgba(74,61,100,0.08)] bg-white text-[#706C7D] hover:border-zinc-300"
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        {isPast && !isActive && <Check size={12} className="stroke-[3]" />}
                        {step.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Meta Controls: Assignee & Story Linking */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border border-[rgba(74,61,100,0.08)] bg-[#FBFAFD] p-4">
              {/* Assignee Box */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#252331] uppercase tracking-wider flex items-center gap-1.5">
                    <User size={13} className="text-[#80642F]" />
                    Assignee
                  </label>
                  {updatingAssignee && (
                    <Loader2 size={12} className="animate-spin text-[#B8944E]" />
                  )}
                </div>
                <select
                  value={task.assignee_id || ""}
                  onChange={(e) => handleAssigneeChange(e.target.value)}
                  disabled={updatingAssignee}
                  className="w-full rounded-lg border border-[rgba(74,61,100,0.12)] bg-white px-2.5 py-1.5 text-xs font-medium text-[#252331] focus:border-[#B8944E] focus:outline-none"
                >
                  <option value="">Unassigned</option>
                  {assigneeOptions.map((a, idx) => (
                    <option key={`${a.type}-${a.id}-${idx}`} value={a.id}>
                      {a.name} ({a.type === "team_user" ? "Team" : a.type === "client" ? "Client" : "Owner"})
                    </option>
                  ))}
                </select>

                {task.assignees && task.assignees.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {task.assignees.map((a) => (
                      <span
                        key={a.id}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white border border-[rgba(74,61,100,0.12)] text-xs text-[#252331] font-medium shadow-2xs"
                      >
                        <span className="h-4 w-4 rounded-full bg-[#B8944E]/20 text-[#80642F] text-[9px] font-bold grid place-items-center">
                          {a.name?.[0]?.toUpperCase() || "U"}
                        </span>
                        <span>{a.name}</span>
                        <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-slate-100 text-slate-700 font-bold">
                          {a.type === "team_user" ? "Team" : a.type === "client" ? "Client" : "Owner"}
                        </span>
                      </span>
                    ))}
                  </div>
                ) : task.assignee_name ? (
                  <p className="mt-1 text-[11px] text-[#706C7D] flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Assigned: <strong>{task.assignee_name}</strong>
                  </p>
                ) : null}
              </div>

              {/* Linked Story Box */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#252331] uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen size={13} className="text-[#80642F]" />
                    Linked Story
                  </label>
                  {task.story_id && (
                    <Link
                      href={`/project/${task.project_id}?storyId=${task.story_id}`}
                      className="text-[11px] text-[#80642F] hover:underline flex items-center gap-0.5"
                    >
                      View Story <ExternalLink size={10} />
                    </Link>
                  )}
                </div>
                <select
                  value={task.story_id || ""}
                  onChange={(e) => handleStoryChange(e.target.value)}
                  className="w-full rounded-lg border border-[rgba(74,61,100,0.12)] bg-white px-2.5 py-1.5 text-xs font-medium text-[#252331] focus:border-[#B8944E] focus:outline-none"
                >
                  <option value="">No Story (Standalone Task)</option>
                  {storyOptions.map((s, idx) => (
                    <option key={`${s.id}-${idx}`} value={s.id}>
                      Story: {s.title}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-[#9994A5]">
                  {task.story_id ? "Linked to active story" : "Click to link to a story"}
                </p>
              </div>
            </div>

            {/* Priority & Due Date Pills */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-[#706C7D]">
              {task.category && (() => {
                const catBadge = getTaskCategoryBadge(task.category);
                if (!catBadge) return null;
                return (
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-[#252331]">Domain:</span>
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-[11px] font-bold border ${catBadge.bg} ${catBadge.text} ${catBadge.border}`}
                    >
                      {catBadge.label}
                    </span>
                  </div>
                );
              })()}

              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[#252331]">Priority:</span>
                <span className="capitalize font-bold text-[#80642F]">
                  {getTaskPriorityLabel(task.priority)}
                </span>
              </div>
              {task.due_date && (
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} />
                  <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                </div>
              )}
              {task.created_by_name && (
                <div className="flex items-center gap-1.5 text-[#9994A5]">
                  <span>Created by {task.created_by_name}</span>
                </div>
              )}
            </div>

            {/* Description */}
            {task.description && (
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#9994A5] mb-1.5">
                  Description
                </label>
                <div className="rounded-xl border border-[rgba(74,61,100,0.06)] bg-[#FAF9FC] p-3.5 text-xs text-[#252331] leading-relaxed whitespace-pre-wrap">
                  {task.description}
                </div>
              </div>
            )}

            {/* Tabs Bar: Notes vs Attachments */}
            <div className="border-t border-[rgba(74,61,100,0.08)] pt-4">
              <div className="flex items-center gap-4 border-b border-[rgba(74,61,100,0.08)] mb-4">
                <button
                  type="button"
                  onClick={() => setActiveTab("notes")}
                  className={`pb-2 text-xs font-bold transition-colors relative ${
                    activeTab === "notes"
                      ? "text-[#80642F]"
                      : "text-[#706C7D] hover:text-[#252331]"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <MessageSquare size={14} />
                    Notes ({notes.length})
                  </span>
                  {activeTab === "notes" && (
                    <span className="absolute bottom-0 inset-x-0 h-0.5 bg-[#B8944E]" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("attachments")}
                  className={`pb-2 text-xs font-bold transition-colors relative ${
                    activeTab === "attachments"
                      ? "text-[#80642F]"
                      : "text-[#706C7D] hover:text-[#252331]"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Paperclip size={14} />
                    Attachments ({attachments.length})
                  </span>
                  {activeTab === "attachments" && (
                    <span className="absolute bottom-0 inset-x-0 h-0.5 bg-[#B8944E]" />
                  )}
                </button>
              </div>

              {/* Tab: Notes */}
              {activeTab === "notes" && (
                <div className="space-y-4">
                  {/* Notes Timeline */}
                  <div className="space-y-3">
                    {notes.length > 0 ? (
                      notes.map((note) => (
                        <div
                          key={note.id}
                          className="rounded-xl border border-[rgba(74,61,100,0.06)] bg-[#FAF9FC] p-3.5"
                        >
                          <div className="flex items-center justify-between mb-1 text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-[#252331]">
                                {note.author_name}
                              </span>
                              <span className="rounded bg-zinc-200/70 px-1.5 py-0.2 text-[9px] font-semibold text-zinc-700 capitalize">
                                {note.author_type}
                              </span>
                            </div>
                            <span className="text-[#9994A5]">
                              {new Date(note.created_at).toLocaleString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <p className="text-xs text-[#252331] whitespace-pre-wrap leading-relaxed">
                            {note.content}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-[#9994A5] text-center py-6 border border-dashed rounded-xl">
                        No notes yet. Add updates or comments below.
                      </p>
                    )}
                  </div>

                  {/* Add Note Form */}
                  <form onSubmit={handleAddNote} className="space-y-2">
                    <Textarea
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      placeholder="Write an internal note or progress update..."
                      rows={2}
                    />
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        isLoading={submittingNote}
                        leftIcon={<Send size={13} />}
                      >
                        Add Note
                      </Button>
                    </div>
                  </form>
                </div>
              )}

              {/* Tab: Attachments */}
              {activeTab === "attachments" && (
                <div className="space-y-4">
                  {/* Upload Dropzone */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-[rgba(184,148,78,0.3)] bg-[rgba(184,148,78,0.03)] hover:bg-[rgba(184,148,78,0.06)] transition-colors cursor-pointer text-center"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={uploadingFile}
                    />
                    {uploadingFile ? (
                      <div className="flex items-center gap-2 text-xs text-[#80642F] font-semibold">
                        <Loader2 size={16} className="animate-spin text-[#B8944E]" />
                        Uploading file...
                      </div>
                    ) : (
                      <>
                        <Upload size={20} className="text-[#B8944E] mb-1.5" />
                        <span className="text-xs font-bold text-[#252331]">
                          Click to upload an attachment
                        </span>
                        <span className="text-[11px] text-[#9994A5] mt-0.5">
                          PDFs, images, documents, wireframes (up to 25MB)
                        </span>
                      </>
                    )}
                  </div>

                  {/* Attachments List */}
                  <div className="space-y-2">
                    {attachments.length > 0 ? (
                      attachments.map((att) => (
                        <div
                          key={att.id}
                          className="flex items-center justify-between p-3 rounded-xl border border-[rgba(74,61,100,0.08)] bg-white hover:border-[#B8944E]/30 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-8 w-8 rounded-lg bg-zinc-100 grid place-items-center shrink-0">
                              {getFileIcon(att.file_type)}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-semibold text-[#252331] truncate">
                                {att.name}
                              </span>
                              <span className="text-[10px] text-[#9994A5]">
                                {formatFileSize(att.file_size)} • Uploaded by {att.uploaded_by_name || "Member"}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <a
                              href={att.file_url}
                              target="_blank"
                              rel="noreferrer"
                              download={att.name}
                              className="rounded-lg p-1.5 text-[#706C7D] hover:text-[#80642F] hover:bg-[rgba(184,148,78,0.08)] transition-colors"
                              title="Download"
                            >
                              <Download size={14} />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDeleteAttachment(att.id)}
                              className="rounded-lg p-1.5 text-[#706C7D] hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Delete Attachment"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-[#9994A5] text-center py-6 border border-dashed rounded-xl">
                        No attachments uploaded yet.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteTask}
        title="Delete Task"
        description="Are you sure you want to delete this task? All attached notes and files will also be removed. This action cannot be undone."
        confirmLabel="Delete Task"
        variant="danger"
        isLoading={deleting}
      />
    </>
  );
}

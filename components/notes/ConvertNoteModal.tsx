"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
  FileText,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  ArrowRight,
  RotateCcw,
  Check,
  Bot,
  Bug,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import type { Epic, Story, ProjectNote } from "@/lib/types";
import { AiAgentPromptModal } from "@/components/stories/AiAgentPromptModal";

interface ConvertNoteModalProps {
  projectId: string;
  note: ProjectNote;
  epics: Epic[];
  isOpen: boolean;
  onClose: () => void;
  onConversionComplete: (result: {
    epic: Epic;
    stories: Story[];
    note: ProjectNote;
  }) => void;
}

interface PreviewStory {
  title: string;
  storyType?: "bug" | "feature_change" | "new_feature";
  severity?: "critical" | "high" | "medium" | "low";
  description: string;
  acceptanceCriteria: string[];
  assumptions: string[];
  clarifications: string[];
  enabled: boolean;
  isExpanded?: boolean;
}

export function ConvertNoteModal({
  projectId,
  note,
  epics,
  isOpen,
  onClose,
  onConversionComplete,
}: ConvertNoteModalProps) {
  const [mode, setMode] = useState<"new_epic_and_stories" | "existing_epic_stories" | "epic_only">(
    "new_epic_and_stories"
  );
  const [selectedEpicId, setSelectedEpicId] = useState<string>(
    epics[0]?.id || ""
  );

  // AI loading and step state
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [error, setError] = useState("");

  // Preview state
  const [previewEpic, setPreviewEpic] = useState({ name: "", description: "" });
  const [previewStories, setPreviewStories] = useState<PreviewStory[]>([]);
  const [meetingActionItems, setMeetingActionItems] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<"all" | "bug" | "feature_change" | "new_feature">("all");
  const [copiedActionItems, setCopiedActionItems] = useState(false);
  const [hasPreview, setHasPreview] = useState(false);
  const [promptStory, setPromptStory] = useState<PreviewStory | null>(null);

  const steps = [
    "Reading live demo & meeting notes...",
    "Autonomously detecting bugs, changes & new features...",
    "Synthesizing structured defect & feature stories...",
    "Consolidating client-ready acceptance criteria...",
  ];

  useEffect(() => {
    if (!loading) return;
    setGenerationStep(0);
    const interval = setInterval(() => {
      setGenerationStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 2200);
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (isOpen) {
      setHasPreview(false);
      setError("");
      setLoading(false);
      setCommitting(false);
      setPreviewEpic({
        name: note.title !== "Untitled Note" ? note.title : "Feature Module",
        description: "",
      });
      setPreviewStories([]);
      setMeetingActionItems([]);
      setFilterType("all");
      setCopiedActionItems(false);
      if (epics.length > 0 && !selectedEpicId) {
        setSelectedEpicId(epics[0].id);
      }
    }
  }, [isOpen, note, epics]);

  if (!isOpen) return null;

  async function handleGeneratePreview() {
    if (!note.content.trim() && !note.title.trim()) {
      setError("This note has no content to convert. Please add some notes first.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/projects/${projectId}/notes/${note.id}/convert/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetEpicId: mode === "existing_epic_stories" ? selectedEpicId : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate requirements preview.");

      setPreviewEpic({
        name: data.epic?.name || note.title,
        description: data.epic?.description || "",
      });

      setPreviewStories(
        (data.stories || []).map((s: any) => ({
          title: s.title || "Untitled Story",
          storyType: s.storyType || "new_feature",
          severity: s.severity || undefined,
          description: s.description || "",
          acceptanceCriteria: Array.isArray(s.acceptanceCriteria) ? s.acceptanceCriteria : [],
          assumptions: Array.isArray(s.assumptions) ? s.assumptions : [],
          clarifications: Array.isArray(s.clarifications) ? s.clarifications : [],
          enabled: true,
          isExpanded: false,
        }))
      );

      setMeetingActionItems(Array.isArray(data.meetingActionItems) ? data.meetingActionItems : []);
      setHasPreview(true);
    } catch (err: any) {
      setError(err.message || "Failed to generate preview. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCommitConversion() {
    if (mode !== "existing_epic_stories" && !previewEpic.name.trim()) {
      setError("Epic name is required.");
      return;
    }

    const enabledStories = previewStories.filter((s) => s.enabled);
    if (mode !== "epic_only" && enabledStories.length === 0) {
      setError("Please select at least one story to create, or choose 'Epic only' mode.");
      return;
    }

    setCommitting(true);
    setError("");

    try {
      const res = await fetch(`/api/projects/${projectId}/notes/${note.id}/convert/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          targetEpicId: mode === "existing_epic_stories" ? selectedEpicId : null,
          epic: mode !== "existing_epic_stories" ? previewEpic : undefined,
          stories:
            mode !== "epic_only"
              ? enabledStories.map((s) => ({
                  title: s.title,
                  description: s.description,
                  acceptanceCriteria: s.acceptanceCriteria,
                  assumptions: s.assumptions,
                  clarifications: s.clarifications,
                }))
              : [],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to commit conversion.");

      toast.success(
        mode === "epic_only"
          ? `Epic "${data.epic.name}" created from note`
          : `Created Epic "${data.epic.name}" with ${data.stories.length} stories`
      );

      onConversionComplete({
        epic: data.epic,
        stories: data.stories || [],
        note: data.note,
      });

      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to finalize conversion.");
    } finally {
      setCommitting(false);
    }
  }

  const selectedCount = previewStories.filter((s) => s.enabled).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={() => !loading && !committing && onClose()}
      />

      {/* Modal Surface */}
      <div className="relative w-full max-w-2xl rounded-2xl border border-[rgba(15,23,42,0.12)] bg-white p-5 sm:p-7 shadow-[0_20px_50px_rgba(15,23,42,0.18)] animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col my-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={loading || committing}
          aria-label="Close modal"
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-xl text-[#334155] hover:bg-[#F8F9FB] hover:text-[#0F172A] disabled:opacity-40 transition"
        >
          <X size={16} />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-3.5 mb-5 shrink-0">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[rgba(204,160,56,0.12)] text-[#785312] border border-[rgba(204,160,56,0.22)]">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold tracking-tight text-[#0F172A]">
              Convert Note to Requirements
            </h3>
            <p className="text-xs text-[#334155] mt-0.5">
              Transform discussion notes into structured Epics and user stories with AI assistance.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50/90 p-3 text-xs text-[#E11D48] flex items-center gap-2 shrink-0">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Modal Body: Scrollable */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-5">
          {/* Note Context Snapshot Card */}
          <div className="rounded-xl border border-[rgba(15,23,42,0.08)] bg-[#F8F9FB] p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1">
                <FileText size={11} /> Source Note
              </span>
              <span className="text-[11px] text-[#334155]">{note.title}</span>
            </div>
            <p className="text-xs text-[#334155] line-clamp-3 italic whitespace-pre-wrap">
              {note.content || "No content provided."}
            </p>
          </div>

          {!hasPreview ? (
            /* Mode Selection Screen */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-2">
                  Conversion Destination
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setMode("new_epic_and_stories")}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-2 cursor-pointer ${
                      mode === "new_epic_and_stories"
                        ? "border-[#CCA038] bg-[rgba(204,160,56,0.06)] ring-1 ring-[#CCA038]"
                        : "border-[rgba(15,23,42,0.10)] bg-white hover:border-[rgba(204,160,56,0.3)]"
                    }`}
                  >
                    <div>
                      <span className="font-semibold text-xs text-[#0F172A] block">
                        New Epic + Stories
                      </span>
                      <span className="text-[11px] text-[#334155] mt-1 block">
                        Synthesizes an overarching theme and multiple feature stories.
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-[#785312] uppercase tracking-wider">
                      Recommended
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={epics.length === 0}
                    onClick={() => setMode("existing_epic_stories")}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-2 cursor-pointer ${
                      epics.length === 0 ? "opacity-50 cursor-not-allowed" : ""
                    } ${
                      mode === "existing_epic_stories"
                        ? "border-[#CCA038] bg-[rgba(204,160,56,0.06)] ring-1 ring-[#CCA038]"
                        : "border-[rgba(15,23,42,0.10)] bg-white hover:border-[rgba(204,160,56,0.3)]"
                    }`}
                  >
                    <div>
                      <span className="font-semibold text-xs text-[#0F172A] block">
                        Add to Existing Epic
                      </span>
                      <span className="text-[11px] text-[#334155] mt-1 block">
                        Appends newly generated stories under an existing project Epic.
                      </span>
                    </div>
                    <span className="text-[10px] text-[#334155]">
                      {epics.length} Epics available
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode("epic_only")}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-2 cursor-pointer ${
                      mode === "epic_only"
                        ? "border-[#CCA038] bg-[rgba(204,160,56,0.06)] ring-1 ring-[#CCA038]"
                        : "border-[rgba(15,23,42,0.10)] bg-white hover:border-[rgba(204,160,56,0.3)]"
                    }`}
                  >
                    <div>
                      <span className="font-semibold text-xs text-[#0F172A] block">
                        Epic Only
                      </span>
                      <span className="text-[11px] text-[#334155] mt-1 block">
                        Creates a parent Epic theme with discussion scope summary.
                      </span>
                    </div>
                    <span className="text-[10px] text-[#334155]">No stories generated</span>
                  </button>
                </div>
              </div>

              {mode === "existing_epic_stories" && epics.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1.5">
                    Select Target Epic <span className="text-[#E11D48]">*</span>
                  </label>
                  <select
                    value={selectedEpicId}
                    onChange={(e) => setSelectedEpicId(e.target.value)}
                    className="w-full h-10 rounded-xl border border-[rgba(15,23,42,0.12)] bg-[#F8F9FB] px-3 text-xs font-medium text-[#0F172A] outline-none focus:border-[#CCA038] focus:bg-white"
                  >
                    {epics.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {loading ? (
                /* AI Loading steps */
                <div className="rounded-xl border border-[rgba(204,160,56,0.2)] bg-[rgba(204,160,56,0.04)] p-5 text-center space-y-3">
                  <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-white text-[#785312] shadow-sm border border-[rgba(204,160,56,0.2)] animate-pulse">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#0F172A]">
                      {steps[generationStep]}
                    </h4>
                    <p className="text-[11px] text-[#334155] mt-0.5">
                      Synthesizing requirements from meeting discussion...
                    </p>
                  </div>
                  <div className="w-full max-w-xs mx-auto h-1.5 bg-[rgba(15,23,42,0.08)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#CCA038] transition-all duration-500"
                      style={{ width: `${((generationStep + 1) / steps.length) * 100}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="pt-2">
                  <Button
                    variant="primary"
                    size="md"
                    className="w-full py-2.5"
                    leftIcon={<Sparkles size={14} />}
                    onClick={handleGeneratePreview}
                  >
                    Generate Requirements Preview with AI
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* Interactive Preview Screen */
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                    Review & Customize Requirements
                  </span>
                  <p className="text-[11px] text-[#334155] mt-0.5">
                    AI classified items from your notes into bugs, feature changes, and new features.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHasPreview(false)}
                  className="text-xs font-medium text-[#785312] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw size={11} /> Change settings
                </button>
              </div>

              {/* Epic Details Section */}
              {mode !== "existing_epic_stories" && (
                <div className="rounded-xl border border-[rgba(15,23,42,0.12)] bg-[#F8F9FB] p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#0F172A]">
                    <Layers size={14} className="text-[#CCA038]" />
                    <span>Proposed Epic</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#334155] mb-1">
                      Epic Name
                    </label>
                    <input
                      type="text"
                      value={previewEpic.name}
                      onChange={(e) =>
                        setPreviewEpic((prev) => ({ ...prev, name: e.target.value }))
                      }
                      className="w-full h-9 rounded-lg border border-[rgba(15,23,42,0.12)] bg-white px-3 text-xs font-semibold text-[#0F172A] outline-none focus:border-[#CCA038]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#334155] mb-1">
                      Description & Scope
                    </label>
                    <textarea
                      rows={2}
                      value={previewEpic.description}
                      onChange={(e) =>
                        setPreviewEpic((prev) => ({ ...prev, description: e.target.value }))
                      }
                      className="w-full rounded-lg border border-[rgba(15,23,42,0.12)] bg-white p-2.5 text-xs text-[#0F172A] outline-none focus:border-[#CCA038] resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Non-story meeting action items (if detected) */}
              {meetingActionItems.length > 0 && (
                <div className="rounded-xl border border-[rgba(204,160,56,0.22)] bg-[rgba(204,160,56,0.05)] p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#785312] flex items-center gap-1.5">
                      <FileText size={12} /> Meeting Action Items & Follow-ups ({meetingActionItems.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          meetingActionItems.map((item) => `• ${item}`).join("\n")
                        );
                        setCopiedActionItems(true);
                        setTimeout(() => setCopiedActionItems(false), 2000);
                        toast.success("Action items copied to clipboard");
                      }}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#785312] hover:underline cursor-pointer"
                    >
                      {copiedActionItems ? (
                        <Check size={11} className="text-emerald-600" />
                      ) : (
                        <Copy size={11} />
                      )}
                      <span>{copiedActionItems ? "Copied" : "Copy All"}</span>
                    </button>
                  </div>
                  <ul className="space-y-1">
                    {meetingActionItems.map((item, i) => (
                      <li key={i} className="text-[11px] text-[#334155] flex items-start gap-1.5">
                        <span className="text-[#785312] font-bold">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Stories List Section */}
              {mode !== "epic_only" && (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setFilterType("all")}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition cursor-pointer ${
                          filterType === "all"
                            ? "bg-[#0F172A] text-white"
                            : "bg-[#F8F9FB] text-[#334155] hover:bg-slate-100"
                        }`}
                      >
                        All ({previewStories.length})
                      </button>
                      {previewStories.some((s) => s.storyType === "bug") && (
                        <button
                          type="button"
                          onClick={() => setFilterType("bug")}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition cursor-pointer ${
                            filterType === "bug"
                              ? "bg-rose-700 text-white"
                              : "bg-rose-50 text-rose-700 hover:bg-rose-100/80 border border-rose-200/80"
                          }`}
                        >
                          <Bug size={11} />
                          Bugs ({previewStories.filter((s) => s.storyType === "bug").length})
                        </button>
                      )}
                      {previewStories.some((s) => s.storyType === "feature_change") && (
                        <button
                          type="button"
                          onClick={() => setFilterType("feature_change")}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition cursor-pointer ${
                            filterType === "feature_change"
                              ? "bg-sky-700 text-white"
                              : "bg-sky-50 text-sky-700 hover:bg-sky-100/80 border border-sky-200/80"
                          }`}
                        >
                          <RotateCcw size={10} />
                          Changes ({previewStories.filter((s) => s.storyType === "feature_change").length})
                        </button>
                      )}
                      {previewStories.some((s) => s.storyType === "new_feature" || !s.storyType) && (
                        <button
                          type="button"
                          onClick={() => setFilterType("new_feature")}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition cursor-pointer ${
                            filterType === "new_feature"
                              ? "bg-emerald-700 text-white"
                              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80 border border-emerald-200/80"
                          }`}
                        >
                          <Sparkles size={10} />
                          Features ({previewStories.filter((s) => s.storyType === "new_feature" || !s.storyType).length})
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const allSelected = previewStories.every((s) => s.enabled);
                        setPreviewStories((prev) =>
                          prev.map((s) => ({ ...s, enabled: !allSelected }))
                        );
                      }}
                      className="text-[11px] font-medium text-[#785312] hover:underline"
                    >
                      {previewStories.every((s) => s.enabled) ? "Deselect all" : "Select all"}
                    </button>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {previewStories
                      .filter((s) => {
                        if (filterType === "all") return true;
                        if (filterType === "new_feature") return s.storyType === "new_feature" || !s.storyType;
                        return s.storyType === filterType;
                      })
                      .map((story) => {
                        const originalIdx = previewStories.findIndex((orig) => orig === story);
                        return (
                          <div
                            key={originalIdx}
                            className={`rounded-xl border transition p-3 space-y-2 ${
                              story.enabled
                                ? "border-[rgba(15,23,42,0.12)] bg-white"
                                : "border-slate-100 bg-slate-50/60 opacity-60"
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              <input
                                type="checkbox"
                                checked={story.enabled}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setPreviewStories((prev) =>
                                    prev.map((s, i) =>
                                      i === originalIdx ? { ...s, enabled: checked } : s
                                    )
                                  );
                                }}
                                className="mt-1 h-4 w-4 rounded border-slate-300 text-[#CCA038] focus:ring-[#CCA038] cursor-pointer"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                  {story.storyType === "bug" && (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                                      <Bug size={10} />
                                      Bug Fix
                                      {story.severity && (
                                        <span className="capitalize text-[9px] opacity-80">
                                          ({story.severity})
                                        </span>
                                      )}
                                    </span>
                                  )}
                                  {story.storyType === "feature_change" && (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 border border-sky-200">
                                      <RotateCcw size={9} />
                                      Feature Change
                                    </span>
                                  )}
                                  {(!story.storyType || story.storyType === "new_feature") && (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                                      <Sparkles size={9} />
                                      New Feature
                                    </span>
                                  )}
                                </div>
                                <input
                                  type="text"
                                  value={story.title}
                                  disabled={!story.enabled}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPreviewStories((prev) =>
                                      prev.map((s, i) =>
                                        i === originalIdx ? { ...s, title: val } : s
                                      )
                                    );
                                  }}
                                  className="w-full text-xs font-semibold text-[#0F172A] bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-[#CCA038] rounded px-1.5 py-0.5 border border-transparent focus:border-[rgba(15,23,42,0.12)]"
                                />
                                {story.description && (
                                  <p className="text-[11px] text-[#334155] mt-0.5 px-1.5 whitespace-pre-line">
                                    {story.description}
                                  </p>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => setPromptStory(story)}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#785312] bg-[rgba(204,160,56,0.08)] hover:bg-[rgba(204,160,56,0.16)] px-2 py-1 rounded-lg border border-[rgba(204,160,56,0.18)] transition shrink-0 cursor-pointer"
                                title="Convert to AI Agent Prompt"
                              >
                                <Bot size={12} />
                                <span className="hidden sm:inline">AI Prompt</span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewStories((prev) =>
                                    prev.map((s, i) =>
                                      i === originalIdx
                                        ? { ...s, isExpanded: !s.isExpanded }
                                        : s
                                    )
                                  )
                                }
                                className="grid h-6 w-6 place-items-center text-[#334155] hover:text-[#0F172A] rounded"
                                title="Toggle criteria"
                              >
                                {story.isExpanded ? (
                                  <ChevronDown size={14} />
                                ) : (
                                  <ChevronRight size={14} />
                                )}
                              </button>
                            </div>

                            {/* Expandable Criteria Checklist */}
                            {story.isExpanded && story.enabled && (
                              <div className="pl-6 pt-1 border-t border-[rgba(15,23,42,0.06)] space-y-2 text-xs">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                                  Acceptance Criteria ({story.acceptanceCriteria.length})
                                </span>
                                <ul className="space-y-1">
                                  {story.acceptanceCriteria.map((ac, acIdx) => (
                                    <li
                                      key={acIdx}
                                      className="flex items-start gap-1.5 text-[11px] text-[#0F172A]"
                                    >
                                      <span className="text-emerald-600 mt-0.5">•</span>
                                      <span className="flex-1">{ac}</span>
                                    </li>
                                  ))}
                                </ul>
                                <div className="pt-2 flex items-center justify-between border-t border-[rgba(15,23,42,0.06)] text-[11px]">
                                  <span className="text-[#334155]">Ready for AI agent?</span>
                                  <button
                                    type="button"
                                    onClick={() => setPromptStory(story)}
                                    className="inline-flex items-center gap-1 font-semibold text-[#785312] hover:text-[#CCA038] cursor-pointer"
                                  >
                                    <Bot size={12} />
                                    <span>Get AI Agent Prompt &rarr;</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-4 mt-4 border-t border-[rgba(15,23,42,0.08)] flex items-center justify-between gap-3 shrink-0">
          <Button
            variant="outline"
            size="md"
            disabled={loading || committing}
            onClick={onClose}
          >
            Cancel
          </Button>

          {hasPreview && (
            <Button
              variant="primary"
              size="md"
              isLoading={committing}
              disabled={
                loading ||
                (mode !== "existing_epic_stories" && !previewEpic.name.trim()) ||
                (mode !== "epic_only" && selectedCount === 0)
              }
              leftIcon={<Check size={14} />}
              onClick={handleCommitConversion}
            >
              {committing ? "Converting..." : `Create ${mode === "epic_only" ? "Epic" : `Epic & ${selectedCount} Stories`}`}
            </Button>
          )}
        </div>
      </div>

      {promptStory && (
        <AiAgentPromptModal
          isOpen={Boolean(promptStory)}
          onClose={() => setPromptStory(null)}
          story={promptStory}
          epicName={previewEpic.name}
          epicDescription={previewEpic.description}
        />
      )}
    </div>
  );
}

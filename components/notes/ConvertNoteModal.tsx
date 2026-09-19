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
  const [hasPreview, setHasPreview] = useState(false);
  const [promptStory, setPromptStory] = useState<PreviewStory | null>(null);

  const steps = [
    "Reading discussion notes & context...",
    "Identifying Epic theme & boundary...",
    "Synthesizing client-friendly User Stories...",
    "Consolidating acceptance criteria...",
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
          description: s.description || "",
          acceptanceCriteria: Array.isArray(s.acceptanceCriteria) ? s.acceptanceCriteria : [],
          assumptions: Array.isArray(s.assumptions) ? s.assumptions : [],
          clarifications: Array.isArray(s.clarifications) ? s.clarifications : [],
          enabled: true,
          isExpanded: false,
        }))
      );

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
      <div className="relative w-full max-w-2xl rounded-2xl border border-[rgba(74,61,100,0.12)] bg-white p-5 sm:p-7 shadow-[0_20px_50px_rgba(70,55,95,0.18)] animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col my-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={loading || committing}
          aria-label="Close modal"
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-xl text-[#706C7D] hover:bg-[#FAF9FC] hover:text-[#252331] disabled:opacity-40 transition"
        >
          <X size={16} />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-3.5 mb-5 shrink-0">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[rgba(184,148,78,0.12)] text-[#80642F] border border-[rgba(184,148,78,0.22)]">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold tracking-tight text-[#252331]">
              Convert Note to Requirements
            </h3>
            <p className="text-xs text-[#706C7D] mt-0.5">
              Transform discussion notes into structured Epics and user stories with AI assistance.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50/90 p-3 text-xs text-[#C25D72] flex items-center gap-2 shrink-0">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Modal Body: Scrollable */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-5">
          {/* Note Context Snapshot Card */}
          <div className="rounded-xl border border-[rgba(74,61,100,0.08)] bg-[#FAF9FC] p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#9994A5] flex items-center gap-1">
                <FileText size={11} /> Source Note
              </span>
              <span className="text-[11px] text-[#706C7D]">{note.title}</span>
            </div>
            <p className="text-xs text-[#706C7D] line-clamp-3 italic whitespace-pre-wrap">
              {note.content || "No content provided."}
            </p>
          </div>

          {!hasPreview ? (
            /* Mode Selection Screen */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5] mb-2">
                  Conversion Destination
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setMode("new_epic_and_stories")}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-2 cursor-pointer ${
                      mode === "new_epic_and_stories"
                        ? "border-[#B8944E] bg-[rgba(184,148,78,0.06)] ring-1 ring-[#B8944E]"
                        : "border-[rgba(74,61,100,0.10)] bg-white hover:border-[rgba(184,148,78,0.3)]"
                    }`}
                  >
                    <div>
                      <span className="font-semibold text-xs text-[#252331] block">
                        New Epic + Stories
                      </span>
                      <span className="text-[11px] text-[#706C7D] mt-1 block">
                        Synthesizes an overarching theme and multiple feature stories.
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-[#80642F] uppercase tracking-wider">
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
                        ? "border-[#B8944E] bg-[rgba(184,148,78,0.06)] ring-1 ring-[#B8944E]"
                        : "border-[rgba(74,61,100,0.10)] bg-white hover:border-[rgba(184,148,78,0.3)]"
                    }`}
                  >
                    <div>
                      <span className="font-semibold text-xs text-[#252331] block">
                        Add to Existing Epic
                      </span>
                      <span className="text-[11px] text-[#706C7D] mt-1 block">
                        Appends newly generated stories under an existing project Epic.
                      </span>
                    </div>
                    <span className="text-[10px] text-[#706C7D]">
                      {epics.length} Epics available
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode("epic_only")}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-2 cursor-pointer ${
                      mode === "epic_only"
                        ? "border-[#B8944E] bg-[rgba(184,148,78,0.06)] ring-1 ring-[#B8944E]"
                        : "border-[rgba(74,61,100,0.10)] bg-white hover:border-[rgba(184,148,78,0.3)]"
                    }`}
                  >
                    <div>
                      <span className="font-semibold text-xs text-[#252331] block">
                        Epic Only
                      </span>
                      <span className="text-[11px] text-[#706C7D] mt-1 block">
                        Creates a parent Epic theme with discussion scope summary.
                      </span>
                    </div>
                    <span className="text-[10px] text-[#706C7D]">No stories generated</span>
                  </button>
                </div>
              </div>

              {mode === "existing_epic_stories" && epics.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#9994A5] mb-1.5">
                    Select Target Epic <span className="text-[#C25D72]">*</span>
                  </label>
                  <select
                    value={selectedEpicId}
                    onChange={(e) => setSelectedEpicId(e.target.value)}
                    className="w-full h-10 rounded-xl border border-[rgba(74,61,100,0.12)] bg-[#FAF9FC] px-3 text-xs font-medium text-[#252331] outline-none focus:border-[#B8944E] focus:bg-white"
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
                <div className="rounded-xl border border-[rgba(184,148,78,0.2)] bg-[rgba(184,148,78,0.04)] p-5 text-center space-y-3">
                  <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-white text-[#80642F] shadow-sm border border-[rgba(184,148,78,0.2)] animate-pulse">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#252331]">
                      {steps[generationStep]}
                    </h4>
                    <p className="text-[11px] text-[#706C7D] mt-0.5">
                      Synthesizing requirements from meeting discussion...
                    </p>
                  </div>
                  <div className="w-full max-w-xs mx-auto h-1.5 bg-[rgba(74,61,100,0.08)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#B8944E] transition-all duration-500"
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
                <span className="text-xs font-semibold uppercase tracking-wider text-[#9994A5]">
                  Review & Customize Requirements
                </span>
                <button
                  type="button"
                  onClick={() => setHasPreview(false)}
                  className="text-xs font-medium text-[#80642F] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw size={11} /> Change settings
                </button>
              </div>

              {/* Epic Details Section */}
              {mode !== "existing_epic_stories" && (
                <div className="rounded-xl border border-[rgba(74,61,100,0.12)] bg-[#FAF9FC] p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#252331]">
                    <Layers size={14} className="text-[#B8944E]" />
                    <span>Proposed Epic</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#706C7D] mb-1">
                      Epic Name
                    </label>
                    <input
                      type="text"
                      value={previewEpic.name}
                      onChange={(e) =>
                        setPreviewEpic((prev) => ({ ...prev, name: e.target.value }))
                      }
                      className="w-full h-9 rounded-lg border border-[rgba(74,61,100,0.12)] bg-white px-3 text-xs font-semibold text-[#252331] outline-none focus:border-[#B8944E]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#706C7D] mb-1">
                      Description & Scope
                    </label>
                    <textarea
                      rows={2}
                      value={previewEpic.description}
                      onChange={(e) =>
                        setPreviewEpic((prev) => ({ ...prev, description: e.target.value }))
                      }
                      className="w-full rounded-lg border border-[rgba(74,61,100,0.12)] bg-white p-2.5 text-xs text-[#252331] outline-none focus:border-[#B8944E] resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Stories List Section */}
              {mode !== "epic_only" && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#252331]">
                      Generated Stories ({selectedCount} selected)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const allSelected = previewStories.every((s) => s.enabled);
                        setPreviewStories((prev) =>
                          prev.map((s) => ({ ...s, enabled: !allSelected }))
                        );
                      }}
                      className="text-[11px] font-medium text-[#80642F] hover:underline"
                    >
                      {previewStories.every((s) => s.enabled) ? "Deselect all" : "Select all"}
                    </button>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {previewStories.map((story, idx) => (
                      <div
                        key={idx}
                        className={`rounded-xl border transition p-3 space-y-2 ${
                          story.enabled
                            ? "border-[rgba(74,61,100,0.12)] bg-white"
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
                                prev.map((s, i) => (i === idx ? { ...s, enabled: checked } : s))
                              );
                            }}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-[#B8944E] focus:ring-[#B8944E] cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <input
                              type="text"
                              value={story.title}
                              disabled={!story.enabled}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPreviewStories((prev) =>
                                  prev.map((s, i) => (i === idx ? { ...s, title: val } : s))
                                );
                              }}
                              className="w-full text-xs font-semibold text-[#252331] bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-[#B8944E] rounded px-1.5 py-0.5 border border-transparent focus:border-[rgba(74,61,100,0.12)]"
                            />
                            {story.description && (
                              <p className="text-[11px] text-[#706C7D] mt-0.5 px-1.5">
                                {story.description}
                              </p>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => setPromptStory(story)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#80642F] bg-[rgba(184,148,78,0.08)] hover:bg-[rgba(184,148,78,0.16)] px-2 py-1 rounded-lg border border-[rgba(184,148,78,0.18)] transition shrink-0 cursor-pointer"
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
                                  i === idx ? { ...s, isExpanded: !s.isExpanded } : s
                                )
                              )
                            }
                            className="grid h-6 w-6 place-items-center text-[#706C7D] hover:text-[#252331] rounded"
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
                          <div className="pl-6 pt-1 border-t border-[rgba(74,61,100,0.06)] space-y-2 text-xs">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#9994A5]">
                              Acceptance Criteria ({story.acceptanceCriteria.length})
                            </span>
                            <ul className="space-y-1">
                              {story.acceptanceCriteria.map((ac, acIdx) => (
                                <li key={acIdx} className="flex items-start gap-1.5 text-[11px] text-[#252331]">
                                  <span className="text-emerald-600 mt-0.5">•</span>
                                  <span className="flex-1">{ac}</span>
                                </li>
                              ))}
                            </ul>
                            <div className="pt-2 flex items-center justify-between border-t border-[rgba(74,61,100,0.06)] text-[11px]">
                              <span className="text-[#706C7D]">Ready for AI agent?</span>
                              <button
                                type="button"
                                onClick={() => setPromptStory(story)}
                                className="inline-flex items-center gap-1 font-semibold text-[#80642F] hover:text-[#B8944E] cursor-pointer"
                              >
                                <Bot size={12} />
                                <span>Get AI Agent Prompt &rarr;</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-4 mt-4 border-t border-[rgba(74,61,100,0.08)] flex items-center justify-between gap-3 shrink-0">
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

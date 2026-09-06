"use client";

import { useState, useEffect } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileText,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { Story } from "@/lib/types";

export function GenerateStoriesModal({
  projectId,
  epicId,
  onClose,
  onStoriesGenerated,
}: {
  projectId: string;
  epicId: string;
  onClose: () => void;
  onStoriesGenerated: (stories: Story[]) => void;
}) {
  const [requirement, setRequirement] = useState("");
  const [loading, setLoading] = useState(false);
  const [generationStep, setGenerationStep] = useState<number>(0);
  const [error, setError] = useState("");
  const [generatedStories, setGeneratedStories] = useState<Story[] | null>(null);

  const steps = [
    "Analyzing requirement...",
    "Identifying story boundaries...",
    "Generating acceptance criteria & assumptions...",
  ];

  useEffect(() => {
    if (!loading) return;
    setGenerationStep(0);
    const interval = setInterval(() => {
      setGenerationStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 2400);
    return () => clearInterval(interval);
  }, [loading]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!requirement.trim()) return;
    setLoading(true);
    setError("");
    setGeneratedStories(null);

    try {
      const res = await fetch("/api/generate-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirement, projectId, epicId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      const newStories = data.stories as Story[];
      setGeneratedStories(newStories);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleComplete() {
    if (generatedStories) {
      onStoriesGenerated(generatedStories);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={() => !loading && onClose()}
      />

      {/* Modal Surface */}
      <div className="relative w-full max-w-lg rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-modal animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          aria-label="Close modal"
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-40 transition"
        >
          <X size={16} />
        </button>

        {/* Results Screen */}
        {generatedStories ? (
          <div className="py-2 space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/70">
                <CheckCircle2 size={20} className="stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {generatedStories.length}{" "}
                  {generatedStories.length === 1 ? "story" : "stories"} generated
                </h3>
                <p className="text-xs text-zinc-500">
                  Ready to review, adjust criteria, and present for client approval.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3.5 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Generated Requirements
              </p>
              <div className="space-y-1.5">
                {generatedStories.map((story, i) => (
                  <div
                    key={story.id || i}
                    className="flex items-center gap-2.5 rounded-lg bg-white p-2.5 border border-zinc-200/60 shadow-2xs"
                  >
                    <FileText size={14} className="text-indigo-600 shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-slate-900 truncate">
                      {story.title}
                    </span>
                    <span className="ml-auto text-[11px] text-zinc-400 shrink-0">
                      {story.acceptance_criteria?.length ?? 0} criteria
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="primary"
                size="md"
                rightIcon={<ArrowRight size={14} />}
                onClick={handleComplete}
              >
                Review stories
              </Button>
            </div>
          </div>
        ) : loading ? (
          /* Meaningful Multi-Step Loading Screen */
          <div className="py-8 px-2 text-center space-y-5">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-xs">
              <Sparkles size={22} className="animate-pulse" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-semibold text-slate-900">
                AI Generation in Progress
              </h3>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                Analyzing technical requirements and structuring client acceptance criteria.
              </p>
            </div>

            {/* Step list indicator */}
            <div className="mx-auto max-w-xs space-y-2 text-left pt-2">
              {steps.map((stepText, idx) => {
                const isCurrent = idx === generationStep;
                const isDone = idx < generationStep;
                return (
                  <div
                    key={stepText}
                    className={`flex items-center gap-2.5 text-xs transition-opacity ${
                      isCurrent
                        ? "text-indigo-700 font-semibold opacity-100"
                        : isDone
                        ? "text-zinc-500 opacity-60"
                        : "text-zinc-400 opacity-30"
                    }`}
                  >
                    {isCurrent ? (
                      <Loader2 size={13} className="animate-spin text-indigo-600 shrink-0" />
                    ) : isDone ? (
                      <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                    ) : (
                      <div className="h-1.5 w-1.5 rounded-full bg-zinc-300 ml-1 mr-0.5 shrink-0" />
                    )}
                    <span>{stepText}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Generation Input Form */
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="flex items-center gap-3 pr-8">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="text-base font-semibold tracking-tight text-slate-900">
                  Generate Stories
                </h3>
                <p className="text-xs text-zinc-500">
                  Turn a client requirement into one or more focused stories.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                Requirement
              </label>
              <textarea
                rows={4}
                required
                autoFocus
                value={requirement}
                onChange={(e) => setRequirement(e.target.value)}
                placeholder="e.g. Users should be able to manage their profile, update email and password, and upload an avatar."
                className="w-full rounded-xl border border-zinc-200 p-3 text-xs sm:text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-y leading-relaxed"
              />
              <p className="mt-1.5 text-xs text-zinc-400">
                The AI will determine whether the requirement should be one story or multiple stories.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="md"
                type="button"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                type="submit"
                disabled={!requirement.trim()}
                leftIcon={<Sparkles size={14} />}
              >
                Generate stories
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

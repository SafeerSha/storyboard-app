"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Check,
  Code2,
  Copy,
  Download,
  Layers,
  Sparkles,
  Terminal,
  Eye,
  Settings2,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import {
  buildDeterministicEpicAgentPrompt,
  type AgentPromptPreset,
  type EpicPromptInput,
} from "@/lib/ai/agent-prompt";

export interface AiEpicAgentPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  epic: {
    name: string;
    description?: string | null;
  };
  stories: Array<{
    title: string;
    description?: string;
    acceptance_criteria?: string[];
    acceptanceCriteria?: string[];
  }>;
}

export function AiEpicAgentPromptModal({
  isOpen,
  onClose,
  epic,
  stories,
}: AiEpicAgentPromptModalProps) {
  const [preset, setPreset] = useState<AgentPromptPreset>("fullstack");
  const [techStackHint, setTechStackHint] = useState("Next.js, TypeScript, Tailwind CSS, Supabase");
  const [showTechSettings, setShowTechSettings] = useState(false);
  const [viewMode, setViewMode] = useState<"raw" | "preview">("preview");

  const [enhancedPrompt, setEnhancedPrompt] = useState<string | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [copied, setCopied] = useState(false);

  const inputPayload: EpicPromptInput = useMemo(() => {
    return {
      epic: {
        name: epic.name || "Feature Module",
        description: epic.description || "",
      },
      stories: stories.map((s) => ({
        title: s.title,
        description: s.description,
        acceptanceCriteria: Array.isArray(s.acceptance_criteria)
          ? s.acceptance_criteria
          : Array.isArray(s.acceptanceCriteria)
          ? s.acceptanceCriteria
          : [],
      })),
      techStackHint,
      preset,
    };
  }, [epic, stories, techStackHint, preset]);

  // Deterministic local prompt generated instantly
  const deterministicPrompt = useMemo(() => {
    return buildDeterministicEpicAgentPrompt(inputPayload);
  }, [inputPayload]);

  // Current active prompt text
  const activePrompt = enhancedPrompt || deterministicPrompt;

  // Reset enhancement state when epic or preset changes
  useEffect(() => {
    setEnhancedPrompt(null);
    setCopied(false);
  }, [epic.name, preset]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(activePrompt);
      setCopied(true);
      toast.success("AI Agent Prompt copied to clipboard!", "Paste directly into Cursor, Claude Code, or Copilot.");
      setTimeout(() => setCopied(false), 2400);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  }, [activePrompt]);

  const handleDownloadMd = useCallback(() => {
    try {
      const sanitizedTitle = (epic.name || "epic")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const filename = `agent-prompt-${sanitizedTitle || "epic"}.md`;
      const blob = new Blob([activePrompt], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Saved as ${filename}`);
    } catch {
      toast.error("Failed to download prompt markdown");
    }
  }, [activePrompt, epic.name]);

  const handleEnhanceWithAi = useCallback(async () => {
    setIsEnhancing(true);
    try {
      const res = await fetch("/api/ai/epic-agent-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...inputPayload,
          enhanceWithAi: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "AI enhancement failed");
      }

      if (data.prompt) {
        setEnhancedPrompt(data.prompt);
        toast.success("Prompt enriched with Gemini AI!", "Deep architectural specs & execution steps synthesized.");
      }
    } catch (err: any) {
      toast.error("AI Enhancement unavailable", err.message || "Using high-detail template.");
    } finally {
      setIsEnhancing(false);
    }
  }, [inputPayload]);

  const presetsList: Array<{ id: AgentPromptPreset; label: string; icon: string }> = [
    { id: "fullstack", label: "Full-Stack", icon: "🛠️" },
    { id: "frontend", label: "Frontend / UI", icon: "🎨" },
    { id: "backend", label: "Backend / API", icon: "⚡" },
    { id: "tdd", label: "TDD / Tests", icon: "🧪" },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Epic AI Agent Prompt Generator"
      description="Converts this Epic and its stories into an actionable, high-precision prompt for Cursor, Claude Code, Copilot, Antigravity, or Devin."
      maxWidth="xl"
      footer={
        <div className="flex w-full flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[#706C7D]">
            <span className="inline-flex items-center gap-1 font-mono font-semibold text-[#80642F] bg-[rgba(184,148,78,0.10)] px-2 py-0.5 rounded border border-[rgba(184,148,78,0.18)]">
              {stories.length} {stories.length === 1 ? "story" : "stories"}
            </span>
            <span>•</span>
            <span>{activePrompt.split(/\s+/).length} words</span>
            {enhancedPrompt && (
              <>
                <span>•</span>
                <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-medium">
                  <Sparkles size={11} /> Gemini Enhanced
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download size={14} />}
              onClick={handleDownloadMd}
              title="Download prompt as markdown file"
            >
              Download .md
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              onClick={handleCopy}
              className={copied ? "!bg-emerald-600 !border-emerald-600" : ""}
            >
              {copied ? "Copied to Clipboard!" : "Copy for AI Agent"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Controls Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#FAF9FC] border border-[rgba(74,61,100,0.08)]">
          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9994A5] mr-1">
              Preset:
            </span>
            {presetsList.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition cursor-pointer ${
                  preset === p.id
                    ? "bg-[#80642F] text-white shadow-2xs font-semibold"
                    : "bg-white text-[#252331] hover:bg-slate-100 border border-[rgba(74,61,100,0.12)]"
                }`}
              >
                <span>{p.icon}</span>
                <span>{p.label}</span>
              </button>
            ))}
          </div>

          {/* Enhancement & View Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Sparkles size={13} className={isEnhancing ? "animate-spin text-[#80642F]" : "text-[#80642F]"} />}
              isLoading={isEnhancing}
              onClick={handleEnhanceWithAi}
              className="text-xs text-[#80642F] hover:bg-[rgba(184,148,78,0.08)]"
              title="Enrich with Gemini AI to generate tailored file structures, code patterns, and edge cases"
            >
              {enhancedPrompt ? "Regenerate with AI" : "Deepen with Gemini AI"}
            </Button>

            {/* View Mode Toggle */}
            <div className="inline-flex rounded-lg border border-[rgba(74,61,100,0.12)] bg-white p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode("preview")}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition cursor-pointer ${
                  viewMode === "preview"
                    ? "bg-[#80642F] text-white shadow-2xs"
                    : "text-[#706C7D] hover:text-[#252331]"
                }`}
                title="Structured view"
              >
                <Eye size={12} />
                <span>Formatted</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("raw")}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition cursor-pointer ${
                  viewMode === "raw"
                    ? "bg-[#80642F] text-white shadow-2xs"
                    : "text-[#706C7D] hover:text-[#252331]"
                }`}
                title="Raw markdown code"
              >
                <Terminal size={12} />
                <span>Raw Markdown</span>
              </button>
            </div>

            {/* Tech Stack Customizer Toggle */}
            <button
              type="button"
              onClick={() => setShowTechSettings((prev) => !prev)}
              className={`grid h-7 w-7 place-items-center rounded-lg border transition cursor-pointer ${
                showTechSettings
                  ? "bg-[#80642F]/10 border-[#80642F] text-[#80642F]"
                  : "bg-white border-[rgba(74,61,100,0.12)] text-[#706C7D] hover:text-[#252331]"
              }`}
              title="Customize tech stack"
            >
              <Settings2 size={13} />
            </button>
          </div>
        </div>

        {/* Collapsible Tech Stack Settings */}
        {showTechSettings && (
          <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/70 text-xs space-y-1.5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-amber-950">Target Tech Stack Context:</span>
              <span className="text-[11px] text-amber-800">Informs the AI agent of your codebase tech choices</span>
            </div>
            <input
              type="text"
              value={techStackHint}
              onChange={(e) => setTechStackHint(e.target.value)}
              placeholder="e.g. Next.js 15, TypeScript, Tailwind CSS, Supabase, Prisma"
              className="w-full rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs text-amber-950 outline-none focus:border-[#80642F] focus:ring-1 focus:ring-[#80642F]"
            />
          </div>
        )}

        {/* Story Metadata Banner */}
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/80 text-xs">
          <div className="flex items-center gap-2 truncate">
            <Layers size={14} className="text-slate-500" />
            <span className="font-semibold text-slate-900 truncate">Epic: {epic.name}</span>
          </div>
          <span className="text-[11px] font-medium text-slate-500 shrink-0">
            Ready for Cursor · Claude Code · Copilot · Antigravity
          </span>
        </div>

        {/* Prompt Content Area */}
        {viewMode === "raw" ? (
          <div className="relative">
            <textarea
              readOnly
              value={activePrompt}
              rows={16}
              className="w-full rounded-xl border border-slate-300 bg-slate-900 p-4 font-mono text-xs text-emerald-300 outline-none leading-relaxed selection:bg-emerald-800 selection:text-white"
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
            <button
              type="button"
              onClick={handleCopy}
              className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 transition border border-slate-700 cursor-pointer shadow-sm"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
        ) : (
          <div className="max-h-[460px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 text-xs text-slate-800 space-y-4 leading-relaxed shadow-inner">
            <div className="space-y-1 border-b border-slate-100 pb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                AI Coding Agent Epic Prompt
              </span>
              <h3 className="text-base font-bold text-slate-950 mt-1">{epic.name}</h3>
              {epic.description && (
                <p className="text-slate-600 text-xs">{epic.description}</p>
              )}
            </div>

            {/* Stories Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-slate-900 uppercase text-[11px] tracking-wider text-[#80642F]">
                  Feature Stories ({stories.length})
                </h4>
                <span className="text-[11px] text-slate-400">Strict verification requirements</span>
              </div>
              <div className="space-y-2">
                {stories.map((story, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200/80"
                  >
                    <div className="flex items-start gap-2">
                      <span className="font-mono text-[10px] font-bold text-[#80642F] bg-[rgba(184,148,78,0.12)] px-1.5 py-0.5 rounded shrink-0">
                        Story {idx + 1}
                      </span>
                      <span className="text-slate-800 font-semibold">{story.title}</span>
                    </div>
                    {story.description && (
                      <p className="text-slate-600 text-xs pl-8">{story.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Full Prompt Preview Snippet */}
            <div className="p-3.5 rounded-lg bg-slate-900 text-slate-200 font-mono text-[11px] leading-relaxed space-y-2 border border-slate-800 mt-4">
              <div className="flex items-center justify-between text-slate-400 pb-1.5 border-b border-slate-800 text-[10px]">
                <span>AGENT PROMPT PREVIEW</span>
                <span>Click "Copy for AI Agent" to copy the complete text</span>
              </div>
              <pre className="whitespace-pre-wrap max-h-48 overflow-y-auto pr-2 font-mono text-xs text-slate-300">
                {activePrompt.slice(0, 800)}...
              </pre>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

"use client";
import { useState } from "react";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
import type { GeneratedStory } from "@/lib/types";

function toSnakeCase(obj: Record<string, unknown>): GeneratedStory {
  return {
    title: String(obj.title || ""),
    description: String(obj.description || ""),
    acceptance_criteria: Array.isArray(obj.acceptanceCriteria) ? obj.acceptanceCriteria.map(String) : [],
    assumptions: Array.isArray(obj.assumptions) ? obj.assumptions.map(String) : [],
    clarifications: Array.isArray(obj.clarifications) ? obj.clarifications.map(String) : [],
    status: String(obj.status || "draft") as GeneratedStory["status"],
    suggestedEpic: obj.suggestedEpic ? String(obj.suggestedEpic) : undefined,
  };
}

export function GenerateStory({ onGenerated }: { onGenerated: (story: GeneratedStory & { raw_requirement: string }) => void }) {
  const [requirement, setRequirement] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    if (!requirement.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/generate-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirement }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      onGenerated({ ...toSnakeCase(data), raw_requirement: requirement });
      setRequirement("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-6 shadow-soft">
      <div className="mb-4 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Sparkles size={16} /></span>
        <div>
          <h2 className="font-semibold">Turn a requirement into a story</h2>
          <p className="text-xs text-neutral-400">Describe it naturally. Gemini will structure it for review.</p>
        </div>
      </div>
      <textarea value={requirement} onChange={e => setRequirement(e.target.value)} placeholder="e.g. Admin should be able to add products..." className="min-h-28 w-full resize-y rounded-xl border border-line bg-neutral-50 p-4 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50" />
      {error && <div className="mt-3 flex gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700"><AlertCircle size={17} />{error}</div>}
      <div className="mt-4 flex justify-end">
        <button disabled={loading || !requirement.trim()} onClick={generate} className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40">
          {loading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
          {loading ? "Generating..." : "Generate story"}
        </button>
      </div>
    </div>
  );
}

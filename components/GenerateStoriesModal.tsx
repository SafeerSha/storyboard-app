"use client";

import { useState } from "react";
import { Sparkles, Loader2, AlertCircle, X } from "lucide-react";
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
  const [error, setError] = useState("");
  const [successCount, setSuccessCount] = useState<number | null>(null);

  async function generate() {
    if (!requirement.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/generate-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirement, projectId, epicId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      
      const newStories = data.stories as Story[];
      setSuccessCount(newStories.length);
      
      // Delay closing to show success message
      setTimeout(() => {
        onStoriesGenerated(newStories);
      }, 1500);
      
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-white p-6 shadow-xl relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-2 text-neutral-400 hover:text-neutral-900 rounded-lg hover:bg-neutral-100 transition"
          disabled={loading || successCount !== null}
        >
          <X size={18} />
        </button>
        
        {successCount !== null ? (
          <div className="py-12 text-center flex flex-col items-center justify-center">
            <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600">
              <Sparkles size={24} />
            </div>
            <h2 className="text-xl font-semibold text-neutral-900">
              {successCount} {successCount === 1 ? 'story' : 'stories'} generated
            </h2>
            <p className="mt-2 text-sm text-neutral-500">Adding them to your Epic...</p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                <Sparkles size={20} />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">Generate Stories</h2>
                <p className="text-xs text-neutral-500">The AI will determine if this should be one or multiple stories.</p>
              </div>
            </div>
            
            <textarea
              value={requirement}
              onChange={e => setRequirement(e.target.value)}
              placeholder="e.g. Users should be able to register, log in, and reset their password."
              className="min-h-[140px] w-full resize-y rounded-xl border border-line bg-neutral-50 p-4 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50/50"
              disabled={loading}
            />
            
            {error && (
              <div className="mt-3 flex gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
                <AlertCircle size={17} className="shrink-0" />
                <p>{error}</p>
              </div>
            )}
            
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={onClose}
                disabled={loading}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 transition"
              >
                Cancel
              </button>
              <button
                disabled={loading || !requirement.trim()}
                onClick={generate}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                {loading ? "Analyzing requirement..." : "Generate Stories"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

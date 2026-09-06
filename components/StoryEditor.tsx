"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { GeneratedStory, Epic } from "@/lib/types";

export function StoryEditor({ story, epics, onSave, onCancel, onCreateEpic, onDelete }: { story: GeneratedStory & { raw_requirement?: string | null }; epics: Epic[]; onSave: (story: GeneratedStory & { raw_requirement?: string | null }) => void; onCancel: () => void; onCreateEpic: (name: string) => void; onDelete?: () => void }) {
  const [value, setValue] = useState(story);
  const updateList = (key: "acceptance_criteria" | "assumptions" | "clarifications", index: number, text: string) =>
    setValue(v => ({ ...v, [key]: v[key].map((x: string, i: number) => (i === index ? text : x)) }));
  const add = (key: "acceptance_criteria" | "assumptions" | "clarifications") => setValue(v => ({ ...v, [key]: [...v[key], ""] }));
  const remove = (key: "acceptance_criteria" | "assumptions" | "clarifications", index: number) =>
    setValue(v => ({ ...v, [key]: v[key].filter((_: string, i: number) => i !== index) }));

  // Helper to check if suggestedEpic exists in DB
  const suggestedEpicExists = epics.some(e => e.name === story.suggestedEpic);

  return (
    <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-soft">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-indigo-500">New feature story</p>
          <h2 className="mt-1 text-xl font-semibold">Review before saving</h2>
        </div>
        <button onClick={onCancel} className="text-sm text-neutral-500 hover:text-neutral-900">Cancel</button>
      </div>
      
      <label className="text-sm font-medium">Epic</label>
      <div className="mt-2 mb-5">
        <select value={value.epic_id || ""} onChange={e => setValue({ ...value, epic_id: e.target.value || null })} className="w-full rounded-xl border border-line px-4 py-3 outline-none focus:border-indigo-400">
          <option value="">No Epic</option>
          {epics.map(epic => (
            <option key={epic.id} value={epic.id}>{epic.name}</option>
          ))}
        </select>
        {story.suggestedEpic && !suggestedEpicExists && (
          <div className="mt-2 text-sm text-neutral-600 bg-indigo-50 p-3 rounded-lg flex items-center justify-between">
            <span>Suggested Epic: <strong>{story.suggestedEpic}</strong></span>
            <button onClick={() => onCreateEpic(story.suggestedEpic!)} className="text-indigo-600 font-medium hover:underline">Create Epic</button>
          </div>
        )}
      </div>

      <label className="text-sm font-medium">Title</label>
      <input value={value.title} onChange={e => setValue({ ...value, title: e.target.value })} className="mt-2 mb-5 w-full rounded-xl border border-line px-4 py-3 outline-none focus:border-indigo-400" />
      <label className="text-sm font-medium">Description</label>
      <textarea value={value.description} onChange={e => setValue({ ...value, description: e.target.value })} className="mt-2 mb-5 min-h-28 w-full rounded-xl border border-line px-4 py-3 outline-none focus:border-indigo-400" />
      {(
        [
          ["acceptance_criteria", "Acceptance criteria"],
          ["assumptions", "Assumptions"],
          ["clarifications", "Clarifications"],
        ] as const
      ).map(([key, label]) => (
        <section key={key} className="mb-5">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium">{label}</label>
            <button onClick={() => add(key)} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600">
              <Plus size={14} /> Add
            </button>
          </div>
          <div className="space-y-2">
            {(value[key] as string[]).map((item: string, i: number) => (
              <div className="flex gap-2" key={i}>
                <input value={item} onChange={e => updateList(key, i, e.target.value)} className="flex-1 rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-indigo-400" />
                <button onClick={() => remove(key, i)} className="rounded-xl p-2 text-neutral-400 hover:bg-rose-50 hover:text-rose-600">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}
      <div className="flex justify-between items-center border-t border-line pt-5">
        <div>
          {onDelete && (
            <button onClick={onDelete} className="rounded-xl px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 inline-flex items-center gap-1.5">
              <Trash2 size={16} /> Delete story
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="rounded-xl px-4 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50">Cancel</button>
          <button onClick={() => onSave(value)} className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white">Save draft</button>
        </div>
      </div>
    </div>
  );
}

"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, LayoutList, Loader2, Plus, Edit2, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { GenerateStory } from "@/components/GenerateStory";
import { StoryEditor } from "@/components/StoryEditor";
import { StoryCard } from "@/components/StoryCard";
import type { GeneratedStory, Story, Epic } from "@/lib/types";

type ProjectWorkspaceProps = {
  projectId: string;
  projectName: string;
  initialStories: Story[];
  initialEpics: Epic[];
};

export function ProjectWorkspace({ projectId, projectName, initialStories, initialEpics }: ProjectWorkspaceProps) {
  const [stories, setStories] = useState<Story[]>(initialStories);
  const [epics, setEpics] = useState<Epic[]>(initialEpics);
  
  const [generated, setGenerated] = useState<(GeneratedStory & { raw_requirement?: string }) | null>(null);
  const [editing, setEditing] = useState<Story | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Epic creation/editing state
  const [epicModalOpen, setEpicModalOpen] = useState(false);
  const [editingEpic, setEditingEpic] = useState<Epic | null>(null);
  const [epicForm, setEpicForm] = useState({ name: "", description: "", status: "active" });

  const [epicFilter, setEpicFilter] = useState<string>("all");

  useEffect(() => {
    setStories(initialStories);
    setEpics(initialEpics);
  }, [initialStories, initialEpics]);

  // Story Actions
  async function saveStory(story: GeneratedStory & { raw_requirement: string }) {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/stories?projectId=${encodeURIComponent(projectId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...story, project_id: projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStories(v => [...v, data.story]);
      setGenerated(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to save story"); } finally { setLoading(false); }
  }

  async function updateStory(id: string, updates: Partial<Story>) {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/stories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStories(v => v.map(s => s.id === id ? data.story : s));
      setEditing(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to update story"); } finally { setLoading(false); }
  }

  // Epic Actions
  async function saveEpic() {
    if (!epicForm.name.trim()) return;
    setLoading(true); setError("");
    try {
      if (editingEpic) {
        const res = await fetch(`/api/epics/${editingEpic.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(epicForm)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setEpics(v => v.map(e => e.id === editingEpic.id ? data : e));
      } else {
        const res = await fetch(`/api/epics`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...epicForm, projectId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setEpics(v => [...v, data]);
      }
      setEpicModalOpen(false);
      setEditingEpic(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to save Epic"); } finally { setLoading(false); }
  }

  async function deleteEpic(id: string) {
    if (stories.some(s => s.epic_id === id)) {
      alert("This Epic contains stories. Move or remove its stories before deleting the Epic.");
      return;
    }
    if (!confirm("Are you sure you want to delete this Epic?")) return;
    
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/epics/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setEpics(v => v.filter(e => e.id !== id));
      if (epicFilter === id) setEpicFilter("all");
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to delete Epic"); } finally { setLoading(false); }
  }

  function openCreateEpic(name = "") {
    setEpicForm({ name, description: "", status: "active" });
    setEditingEpic(null);
    setEpicModalOpen(true);
  }

  const filteredEpics = epicFilter === "all" ? epics : epics.filter(e => e.id === epicFilter);

  return (
    <main className="min-h-screen">
      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur-xl">
          <div className="flex min-h-[72px] items-center justify-between px-6 lg:px-9">
            <div className="flex items-center gap-3">
              <Link href="/" className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100"><ArrowLeft size={18} /></Link>
              <div>
                <p className="text-xs text-neutral-400">PROJECT</p>
                <h1 className="font-semibold">{projectName}</h1>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium">
                <ExternalLink size={15} /> Share
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1320px] px-6 py-8 lg:px-9">
          <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm text-neutral-400"><LayoutList size={16} /> Requirements</div>
              <h2 className="text-3xl font-semibold tracking-tight">Feature stories</h2>
              <p className="mt-2 text-sm text-neutral-500">Group related feature stories into Epics to keep this project organized.</p>
            </div>
            <div className="text-right flex items-center md:items-end gap-6 flex-row-reverse md:flex-row">
              <div className="flex gap-3 items-center">
                <select value={epicFilter} onChange={e => setEpicFilter(e.target.value)} className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none font-medium text-neutral-700">
                  <option value="all">All Epics</option>
                  {epics.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <button onClick={() => openCreateEpic()} className="inline-flex items-center gap-1 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800">
                  <Plus size={16} /> Add Epic
                </button>
              </div>
              <div className="hidden md:block border-l border-line h-10"></div>
              <div>
                <p className="text-2xl font-semibold">{stories.filter(s => s.status === "approved").length}<span className="text-neutral-300"> / {stories.length}</span></p>
                <p className="text-xs text-neutral-400">approved</p>
              </div>
            </div>
          </div>

          {error && <div className="mb-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

          <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr] items-start relative">
            <div className="space-y-8">
              {loading && stories.length === 0 && epics.length === 0 ? (
                <div className="flex items-center gap-2 rounded-2xl border border-line bg-white p-6 text-sm text-neutral-500">
                  <Loader2 className="animate-spin" size={17} /> Loading workspace...
                </div>
              ) : epics.length === 0 && stories.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-neutral-300 p-12 text-center">
                  <p className="text-sm font-medium text-neutral-900">No Epics yet</p>
                  <p className="mt-1 text-sm text-neutral-500 mb-4">Group related feature stories into Epics to keep this project organized.</p>
                  <button onClick={() => openCreateEpic()} className="inline-flex items-center gap-1 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800">
                    <Plus size={16} /> Create Epic
                  </button>
                </div>
              ) : (
                <>
                  {filteredEpics.map(epic => {
                    const epicStories = stories.filter(s => s.epic_id === epic.id);
                    const approvedCount = epicStories.filter(s => s.status === "approved").length;
                    const progress = epicStories.length > 0 ? (approvedCount / epicStories.length) * 100 : 0;

                    return (
                      <div key={epic.id} className="rounded-2xl border border-line bg-white shadow-sm overflow-hidden">
                        <div className="bg-neutral-50/50 p-5 border-b border-line flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-neutral-900">{epic.name}</h3>
                            {epic.description && <p className="text-sm text-neutral-500 mt-1">{epic.description}</p>}
                            <div className="mt-3 flex items-center gap-3">
                              <span className="text-xs font-medium text-neutral-500 bg-neutral-100 px-2 py-1 rounded-md">{epicStories.length} stories</span>
                              <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-md">{approvedCount} approved</span>
                            </div>
                            {epicStories.length > 0 && (
                              <div className="mt-4 h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setEditingEpic(epic); setEpicForm({ name: epic.name, description: epic.description || "", status: epic.status }); setEpicModalOpen(true); }} className="p-2 text-neutral-400 hover:text-neutral-900 rounded-lg hover:bg-white"><Edit2 size={16} /></button>
                            <button onClick={() => deleteEpic(epic.id)} className="p-2 text-neutral-400 hover:text-rose-600 rounded-lg hover:bg-white"><Trash2 size={16} /></button>
                          </div>
                        </div>
                        <div className="p-5 flex flex-col gap-4 bg-neutral-50/30">
                          {epicStories.length === 0 ? (
                            <div className="text-center py-6 text-sm text-neutral-500">No stories in this Epic yet</div>
                          ) : (
                            epicStories.map(s => <StoryCard key={s.id} story={s} onClick={() => setEditing(s)} />)
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Uncategorized Stories */}
                  {(epicFilter === "all" && stories.some(s => s.epic_id === null)) && (
                    <div className="rounded-2xl border border-line bg-white shadow-sm overflow-hidden">
                      <div className="bg-neutral-50/50 p-5 border-b border-line">
                        <h3 className="text-lg font-semibold text-neutral-900">Uncategorized</h3>
                        <p className="text-sm text-neutral-500 mt-1">Stories without an assigned Epic</p>
                      </div>
                      <div className="p-5 flex flex-col gap-4 bg-neutral-50/30">
                        {stories.filter(s => s.epic_id === null).map(s => <StoryCard key={s.id} story={s} onClick={() => setEditing(s)} />)}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            
            <div className="lg:sticky lg:top-24 lg:self-start z-10">
              {editing ? (
                <StoryEditor
                  story={editing}
                  epics={epics}
                  onCancel={() => setEditing(null)}
                  onSave={async (story) => {
                    await updateStory(editing.id, {
                      title: story.title,
                      description: story.description,
                      acceptance_criteria: story.acceptance_criteria,
                      assumptions: story.assumptions,
                      clarifications: story.clarifications,
                      raw_requirement: story.raw_requirement,
                      epic_id: story.epic_id,
                    });
                  }}
                  onCreateEpic={openCreateEpic}
                />
              ) : generated ? (
                <StoryEditor
                  story={generated}
                  epics={epics}
                  onCancel={() => setGenerated(null)}
                  onSave={async (story) => {
                    await saveStory({ ...story, raw_requirement: story.raw_requirement ?? "" });
                  }}
                  onCreateEpic={openCreateEpic}
                />
              ) : (
                <GenerateStory onGenerated={setGenerated} />
              )}
            </div>
          </div>
        </div>
      </div>

      {epicModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl border border-line">
            <h3 className="text-lg font-semibold mb-4">{editingEpic ? "Edit Epic" : "Create Epic"}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <input value={epicForm.name} onChange={e => setEpicForm(f => ({ ...f, name: e.target.value }))} className="mt-1 w-full rounded-xl border border-line px-4 py-2.5 outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <textarea value={epicForm.description} onChange={e => setEpicForm(f => ({ ...f, description: e.target.value }))} className="mt-1 w-full rounded-xl border border-line px-4 py-2.5 outline-none focus:border-indigo-400 min-h-24 resize-none" />
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <select value={epicForm.status} onChange={e => setEpicForm(f => ({ ...f, status: e.target.value }))} className="mt-1 w-full rounded-xl border border-line px-4 py-2.5 outline-none focus:border-indigo-400">
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setEpicModalOpen(false)} className="rounded-xl px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100">Cancel</button>
              <button onClick={saveEpic} disabled={loading || !epicForm.name.trim()} className="rounded-xl bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
                {loading ? "Saving..." : "Save Epic"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

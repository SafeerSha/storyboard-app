"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FolderKanban, Loader2, Plus, Trash2 } from "lucide-react";

type Project = { id: string; name: string; description: string; total: number; approved: number; created_at?: string };

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProjects(data.projects ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function create() {
    if (!name.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProjects(v => [data.project, ...v]);
      setName("");
      setDescription("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this project and all its stories?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProjects(v => v.filter(p => p.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete project");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-paper">
      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur-xl">
          <div className="flex h-[72px] items-center justify-between px-6 lg:px-9">
            <div className="flex items-center gap-3">
              <Link href="/" className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100"><ArrowLeft size={18} /></Link>
              <div>
                <p className="text-xs text-neutral-400">MANAGE</p>
                <h1 className="font-semibold">Projects</h1>
              </div>
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-[1200px] px-6 py-8 lg:px-9">
          <div className="mb-7">
            <h2 className="text-3xl font-semibold tracking-tight">Projects</h2>
            <p className="mt-2 text-sm text-neutral-500">Organize requirements by client or initiative.</p>
          </div>

          {error && <div className="mb-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

          <div className="mb-8 rounded-2xl border border-line bg-white p-6 shadow-soft">
            <h3 className="mb-4 text-sm font-semibold">Create new project</h3>
            <div className="grid gap-4 sm:grid-cols-[1fr_2fr_auto]">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Project name" className="rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-indigo-400" />
              <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description (optional)" className="rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-indigo-400" />
              <button disabled={creating || !name.trim()} onClick={create} className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
                <Plus size={16} /> {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 rounded-2xl border border-line bg-white p-6 text-sm text-neutral-500">
              <Loader2 className="animate-spin" size={17} /> Loading projects...
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 p-12 text-center">
              <p className="text-sm font-medium text-neutral-900">Your workspace is empty</p>
              <p className="mt-1 text-sm text-neutral-500">Create your first project to start turning client requirements into feature stories.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
              {projects.map(p => (
                <div key={p.id} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-neutral-100 text-sm font-semibold text-neutral-600">
                    {p.name.slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/project/${p.id}`} className="text-sm font-medium hover:text-indigo-600">{p.name}</Link>
                    <p className="text-xs text-neutral-400">{p.total || 0} stories · {p.approved || 0} approved</p>
                  </div>
                  <button onClick={() => remove(p.id)} className="rounded-xl p-2 text-neutral-400 hover:bg-rose-50 hover:text-rose-600">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

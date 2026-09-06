"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Trash2, Edit3, X } from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

type Project = {
  id: string;
  name: string;
  description: string;
  status: string;
  total: number;
  approved: number;
  created_at?: string;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [editing, setEditing] = useState<Project | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [updating, setUpdating] = useState(false);
  const [editError, setEditError] = useState("");

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

  useEffect(() => {
    load();
  }, []);

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

  async function update() {
    if (!editing || !editName.trim()) return;
    setUpdating(true);
    setEditError("");
    try {
      const res = await fetch(`/api/projects/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), description: editDesc.trim(), status: editStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProjects(v => v.map(p => p.id === editing.id ? { ...p, ...data.project } : p));
      setEditing(null);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Failed to update project");
    } finally {
      setUpdating(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("This action cannot be undone. This project contains Epics, Stories, or Clients. Deleting the project may affect associated data. Are you sure?")) return;
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
    <div>
      <DashboardHeader category="MANAGE" title="Projects" />

      <main className="mx-auto max-w-[1200px] px-6 py-8 lg:px-9">
        <div className="mb-7">
          <h2 className="text-3xl font-semibold tracking-tight text-neutral-950">Projects</h2>
          <p className="mt-2 text-sm text-neutral-500">Organize requirements by client or initiative.</p>
        </div>

        {error && <div className="mb-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

        <div className="mb-8 rounded-2xl border border-line bg-white p-6 shadow-soft">
          <h3 className="mb-4 text-sm font-semibold text-neutral-900">Create new project</h3>
          <div className="grid gap-4 sm:grid-cols-[1fr_2fr_auto]">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Project name"
              className="rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-indigo-400"
            />
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Short description (optional)"
              className="rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-indigo-400"
            />
            <button
              disabled={creating || !name.trim()}
              onClick={create}
              className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
            >
              <Plus size={16} /> {creating ? "Creating..." : "Create"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-white p-6 text-sm text-neutral-500">
            <Loader2 className="animate-spin" size={17} /> Loading projects...
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 p-12 text-center bg-white">
            <p className="text-sm font-medium text-neutral-900">Your workspace is empty</p>
            <p className="mt-1 text-sm text-neutral-500">Create your first project to start turning client requirements into feature stories.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
            {projects.map(p => (
              <div key={p.id} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0 hover:bg-neutral-50/50 transition">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-neutral-100 text-sm font-semibold text-neutral-600">
                  {p.name.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link href={`/project/${p.id}`} className="text-sm font-medium text-neutral-900 hover:text-indigo-600 transition">
                      {p.name}
                    </Link>
                    <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
                      {p.status || "active"}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">{p.description}</p>
                  <p className="text-xs text-neutral-400 mt-1">{p.total || 0} stories · {p.approved || 0} approved</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditing(p);
                      setEditName(p.name);
                      setEditDesc(p.description || "");
                      setEditStatus(p.status || "active");
                    }}
                    className="rounded-xl p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 transition"
                    aria-label={`Edit ${p.name}`}
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    onClick={() => remove(p.id)}
                    className="rounded-xl p-2 text-neutral-400 hover:bg-rose-50 hover:text-rose-600 transition"
                    aria-label={`Delete ${p.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Edit Project Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-5">
          <div className="w-full max-w-lg rounded-3xl border border-line bg-white p-7 shadow-2xl">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold text-neutral-900">Edit Project</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-neutral-800">Project Name</label>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-indigo-400"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-800">Description</label>
                <textarea
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-indigo-400 min-h-[80px]"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-800">Status</label>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-indigo-400"
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {editError && <p className="text-sm text-rose-600">{editError}</p>}
              
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={update}
                  disabled={updating || !editName.trim()}
                  className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 transition disabled:opacity-50"
                >
                  {updating ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

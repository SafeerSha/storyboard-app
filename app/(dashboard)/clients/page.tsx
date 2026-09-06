"use client";

import { useEffect, useState } from "react";
import { Copy, Plus, UserRound, X, Check, Edit3, KeyRound } from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

type Client = {
  id: string;
  name: string;
  login_id: string;
  status: string;
  project_id: string;
  projects?: { name: string } | null;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  
  // Create state
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [created, setCreated] = useState<{ login: string; password: string } | null>(null);
  const [error, setError] = useState("");

  // Edit state
  const [editing, setEditing] = useState<Client | null>(null);
  const [editName, setEditName] = useState("");
  const [editProjectId, setEditProjectId] = useState("");
  const [editLoginId, setEditLoginId] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editError, setEditError] = useState("");
  const [updating, setUpdating] = useState(false);

  // Reset password state
  const [resetting, setResetting] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/clients")
      .then(r => r.json())
      .then(d => {
        if (d.clients) setClients(d.clients);
      });
    fetch("/api/projects")
      .then(r => r.json())
      .then(d => {
        if (d.projects) {
          setProjects(d.projects);
          if (d.projects[0]) setProjectId(d.projects[0].id);
        }
      });
  }, []);

  function randomId(setter: (id: string) => void) {
    setter(String(Math.floor(100000 + Math.random() * 900000)));
  }

  function generatePassword() {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let p = "";
    for (let i = 0; i < 12; i++) p += chars[Math.floor(Math.random() * chars.length)];
    return p;
  }

  async function create() {
    setError("");
    const r = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, projectId, loginId, password }),
    });
    const d = await r.json();
    if (!r.ok) {
      setError(d.error);
      return;
    }
    setClients(v => [d.client, ...v]);
    setCreated({ login: d.client.login_id, password: d.generatedPassword });
    setName("");
    setProjectId("");
    setLoginId("");
    setPassword("");
  }

  async function update() {
    if (!editing) return;
    setUpdating(true);
    setEditError("");
    try {
      const res = await fetch(`/api/clients/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          project_id: editProjectId,
          login_id: editLoginId,
          status: editStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setClients(v => v.map(c => c.id === editing.id ? data.client : c));
      setEditing(null);
    } catch (e: any) {
      setEditError(e.message || "Failed to update client.");
    } finally {
      setUpdating(false);
    }
  }

  async function resetPassword() {
    if (!editing) return;
    const pwd = newPassword || generatePassword();
    setResetting(true);
    setEditError("");
    try {
      const res = await fetch(`/api/clients/${editing.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResetSuccess(pwd);
    } catch (e: any) {
      setEditError(e.message || "Failed to reset password.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div>
      <DashboardHeader
        category="MANAGE"
        title="Clients"
        actions={
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setCreated(null);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-ink px-3.5 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 shadow-sm"
          >
            <Plus size={16} /> Add client
          </button>
        }
      />

      <main className="mx-auto max-w-[1200px] px-6 py-8 lg:px-9">
        <div className="mb-7">
          <h2 className="text-3xl font-semibold tracking-tight text-neutral-950">Client portal access</h2>
          <p className="mt-2 text-sm text-neutral-500">
            Create credentials and assign each client to one of the projects in the workspace.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
          <div className="grid grid-cols-[1.3fr_1.3fr_130px_130px_auto] border-b border-line px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
            <span>Client</span>
            <span>Project</span>
            <span>Login ID</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>

          {clients.length === 0 ? (
            <div className="p-12 text-center text-sm text-neutral-400">
              No clients yet. Add the first client to create portal credentials.
            </div>
          ) : (
            clients.map(c => (
              <div
                key={c.id}
                className={`grid grid-cols-[1.3fr_1.3fr_130px_130px_auto] items-center border-b border-line px-5 py-4 last:border-0 hover:bg-neutral-50/50 transition ${c.status === "disabled" ? "opacity-60 grayscale" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-neutral-100 text-neutral-500">
                    <UserRound size={16} />
                  </div>
                  <span className="text-sm font-medium text-neutral-900">{c.name}</span>
                </div>
                <span className="text-sm text-neutral-500">{c.projects?.name ?? c.project_id}</span>
                <div>
                  <code className="text-sm font-mono text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded w-fit">
                    {c.login_id}
                  </code>
                </div>
                <div>
                  <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${c.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-600"}`}>
                    {c.status}
                  </span>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setEditing(c);
                      setEditName(c.name);
                      setEditProjectId(c.project_id);
                      setEditLoginId(c.login_id);
                      setEditStatus(c.status);
                      setResetSuccess(null);
                      setNewPassword("");
                    }}
                    className="rounded-xl p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 transition"
                    aria-label={`Edit ${c.name}`}
                  >
                    <Edit3 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Edit Client Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/40 backdrop-blur-sm p-5 py-10">
          <div className="w-full max-w-lg rounded-3xl border border-line bg-white p-7 shadow-2xl my-auto">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold text-neutral-900">Edit Client</h3>
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
                <label className="text-sm font-medium text-neutral-800">Client Name</label>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-indigo-400"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-800">Assigned Project</label>
                <select
                  value={editProjectId}
                  onChange={e => setEditProjectId(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-indigo-400"
                >
                  <option value="">Select a project</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-800">Login ID</label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    inputMode="numeric"
                    maxLength={6}
                    value={editLoginId}
                    onChange={e => setEditLoginId(e.target.value.replace(/\D/g, ""))}
                    placeholder="6 digits"
                    className="w-full rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-indigo-400 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => randomId(setEditLoginId)}
                    className="shrink-0 rounded-xl border border-line px-3.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition"
                  >
                    Generate
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-neutral-800">Status</label>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-indigo-400"
                >
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
                <p className="mt-1 text-xs text-neutral-500">Disabled clients cannot access the portal.</p>
              </div>

              {/* Password Reset Section */}
              <div className="mt-6 border-t border-line pt-6">
                <h4 className="text-sm font-semibold text-neutral-900 mb-2">Reset Password</h4>
                {resetSuccess ? (
                  <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-100">
                    <p className="text-sm font-medium text-emerald-800 flex items-center gap-2">
                      <Check size={16} /> Password reset successfully
                    </p>
                    <p className="mt-2 text-xs text-emerald-700">Existing sessions have been invalidated.</p>
                    <div className="mt-3">
                      <Credential label="New Password" value={resetSuccess} />
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Leave blank to auto-generate"
                      className="w-full rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-indigo-400 font-mono"
                    />
                    <button
                      type="button"
                      onClick={resetPassword}
                      disabled={resetting}
                      className="shrink-0 rounded-xl bg-rose-50 text-rose-600 px-4 py-2.5 text-sm font-medium hover:bg-rose-100 transition disabled:opacity-50 inline-flex items-center gap-2"
                    >
                      <KeyRound size={14} />
                      {resetting ? "Resetting..." : "Reset"}
                    </button>
                  </div>
                )}
              </div>

              {editError && <p className="text-sm text-rose-600 pt-2">{editError}</p>}
              
              <div className="mt-8 flex justify-end gap-3 border-t border-line pt-5">
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
                  disabled={updating || !editName.trim() || !editProjectId || editLoginId.length !== 6}
                  className="rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 transition disabled:opacity-50"
                >
                  {updating ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Client Modal */}
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-5 py-10 overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl border border-line bg-white p-7 shadow-2xl my-auto">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold text-neutral-900">Add client</h3>
                <p className="mt-1 text-sm text-neutral-500">Create portal credentials for a project.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 transition"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {created ? (
              <div>
                <div className="rounded-2xl bg-emerald-50 p-5 border border-emerald-100">
                  <p className="font-semibold text-emerald-800">Client created ✓</p>
                  <p className="mt-1 text-sm text-emerald-700">
                    Send these credentials to the client. The password is shown only now.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Credential label="Login ID" value={created.login} />
                    <Credential label="Password" value={created.password} />
                  </div>
                </div>
                <p className="mt-4 rounded-xl bg-neutral-50 p-3 text-xs text-neutral-500">
                  Portal: {typeof window !== "undefined" ? window.location.origin : ""}/client/login
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-5 w-full rounded-xl bg-ink px-4 py-3 text-sm font-medium text-white hover:bg-neutral-800 transition"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-neutral-800">Client name</label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Acme Corp"
                    className="mt-1.5 w-full rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-800">Project</label>
                  <select
                    value={projectId}
                    onChange={e => setProjectId(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-indigo-400"
                  >
                    <option value="">Select a project</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-800">Login ID</label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      inputMode="numeric"
                      maxLength={6}
                      value={loginId}
                      onChange={e => setLoginId(e.target.value.replace(/\D/g, ""))}
                      placeholder="6 digits"
                      className="w-full rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-indigo-400 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => randomId(setLoginId)}
                      className="shrink-0 rounded-xl border border-line px-3.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition"
                    >
                      Generate
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-800">
                    Password <span className="font-normal text-neutral-400">(optional)</span>
                  </label>
                  <input
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Leave blank to auto-generate"
                    className="mt-1.5 w-full rounded-xl border border-line px-4 py-2.5 text-sm outline-none focus:border-indigo-400 font-mono"
                  />
                </div>
                {error && <p className="text-sm text-rose-600">{error}</p>}
                <button
                  type="button"
                  onClick={create}
                  disabled={!name.trim() || !projectId || loginId.length !== 6}
                  className="mt-4 w-full rounded-xl bg-ink px-4 py-3 text-sm font-medium text-white hover:bg-neutral-800 transition disabled:opacity-50"
                >
                  Create client
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Credential({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-emerald-200/80 bg-white p-3 shadow-xs">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <code className="text-sm font-mono font-medium text-neutral-900">{value}</code>
        <button
          type="button"
          onClick={copy}
          className="text-neutral-400 hover:text-neutral-900 transition p-1"
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Check,
  Copy,
  Edit3,
  ExternalLink,
  FolderKanban,
  KeyRound,
  Lock,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { TableRowSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

type Client = {
  id: string;
  name: string;
  login_id: string;
  status: string;
  project_id: string;
  projects?: { name: string } | null;
};

type ProjectOption = {
  id: string;
  name: string;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");

  // Create Client Modal State
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // One-time credential display modal
  const [createdCredentials, setCreatedCredentials] = useState<{
    name: string;
    loginId: string;
    passwordEntered: string;
    projectName: string;
  } | null>(null);
  const [copiedCreds, setCopiedCreds] = useState(false);

  // Edit Client Modal State
  const [editing, setEditing] = useState<Client | null>(null);
  const [editName, setEditName] = useState("");
  const [editProjectId, setEditProjectId] = useState("");
  const [editLoginId, setEditLoginId] = useState("");
  const [editStatus, setEditStatus] = useState("active");
  const [updating, setUpdating] = useState(false);
  const [editError, setEditError] = useState("");

  // Reset Password Modal State
  const [resettingClient, setResettingClient] = useState<Client | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetError, setResetError] = useState("");

  // Quick copied notification
  const [copiedLoginId, setCopiedLoginId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [clientsRes, projectsRes] = await Promise.all([
          fetch("/api/clients"),
          fetch("/api/projects"),
        ]);
        const clientsData = await clientsRes.json();
        const projectsData = await projectsRes.json();

        if (clientsData.clients) setClients(clientsData.clients);
        if (projectsData.projects) {
          setProjects(projectsData.projects);
          if (projectsData.projects[0] && !projectId) {
            setProjectId(projectsData.projects[0].id);
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load clients");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function generateRandomPin() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  function generateRandomPassword() {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*";
    let p = "";
    for (let i = 0; i < 10; i++) {
      p += chars[Math.floor(Math.random() * chars.length)];
    }
    return p;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !projectId) return;
    setCreating(true);
    setCreateError("");

    const effectivePin = loginId.trim() || generateRandomPin();
    const effectivePwd = password || generateRandomPassword();

    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          projectId,
          loginId: effectivePin,
          password: effectivePwd,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create client");

      const assignedProj = projects.find((p) => p.id === projectId);
      setClients((prev) => [data.client, ...prev]);
      setShowCreate(false);
      setCreatedCredentials({
        name: data.client.name,
        loginId: data.client.login_id,
        passwordEntered: data.generatedPassword || effectivePwd,
        projectName: assignedProj?.name || "Assigned Project",
      });

      setName("");
      setLoginId("");
      setPassword("");
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Failed to create client");
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !editName.trim()) return;
    setUpdating(true);
    setEditError("");
    try {
      const res = await fetch(`/api/clients/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          project_id: editProjectId,
          login_id: editLoginId.trim(),
          status: editStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update client");

      setClients((prev) =>
        prev.map((c) => (c.id === editing.id ? data.client : c))
      );
      setEditing(null);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Failed to update client");
    } finally {
      setUpdating(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resettingClient) return;
    setResetting(true);
    setResetError("");
    const pwd = newPassword || generateRandomPassword();

    try {
      const res = await fetch(`/api/clients/${resettingClient.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password");

      setResetSuccess(pwd);
    } catch (e) {
      setResetError(e instanceof Error ? e.message : "Failed to reset password");
    } finally {
      setResetting(false);
    }
  }

  async function handleDelete(id: string, clientName: string) {
    if (!confirm(`Are you sure you want to remove client "${clientName}"?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete client");
      setClients((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete client");
    } finally {
      setLoading(false);
    }
  }

  function handleCopyLoginId(pin: string) {
    navigator.clipboard.writeText(pin);
    setCopiedLoginId(pin);
    setTimeout(() => setCopiedLoginId(null), 1500);
  }

  function handleCopyPortalLink() {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/client/login`;
    navigator.clipboard.writeText(url);
    alert(`Client Portal link copied: ${url}`);
  }

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.login_id.includes(searchQuery);
      const matchesProject =
        projectFilter === "all" || c.project_id === projectFilter;
      return matchesSearch && matchesProject;
    });
  }, [clients, searchQuery, projectFilter]);

  return (
    <div>
      <DashboardHeader
        eyebrow="MANAGE"
        title="Clients"
        description="Manage client access and portals for each project."
        actions={
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus size={15} />}
            onClick={() => {
              setName("");
              setLoginId(generateRandomPin());
              setPassword(generateRandomPassword());
              setCreateError("");
              setShowCreate(true);
            }}
          >
            Add client
          </Button>
        }
      />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-6">
        {/* Search & Project Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clients by name or PIN..."
              className="h-9 w-full rounded-xl border border-zinc-200/90 bg-white pl-9 pr-3.5 text-xs sm:text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="h-9 rounded-xl border border-zinc-200/90 bg-white px-3 text-xs sm:text-sm font-medium text-zinc-700 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs sm:text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Clients Table / Cards */}
        {loading ? (
          <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-card p-4 space-y-3">
            <TableRowSkeleton cols={4} />
            <TableRowSkeleton cols={4} />
            <TableRowSkeleton cols={4} />
          </div>
        ) : filteredClients.length === 0 ? (
          clients.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No clients yet"
              description="Add your first client to give them a project-scoped portal to review and approve requirements."
              action={
                <Button
                  variant="primary"
                  leftIcon={<Plus size={15} />}
                  onClick={() => setShowCreate(true)}
                >
                  Add client
                </Button>
              }
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-white/50 p-8 text-center">
              <p className="text-sm font-medium text-zinc-800">No clients match your filter</p>
              <p className="mt-1 text-xs text-zinc-400">Try searching with a different term.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setSearchQuery("");
                  setProjectFilter("all");
                }}
              >
                Reset filters
              </Button>
            </div>
          )
        ) : (
          <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-card overflow-hidden divide-y divide-zinc-100">
            {filteredClients.map((client) => {
              const initials = client.name ? client.name.slice(0, 2).toUpperCase() : "CL";
              const projectName = client.projects?.name || "Assigned Project";
              const isCopied = copiedLoginId === client.login_id;

              return (
                <div
                  key={client.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 hover:bg-zinc-50/50 transition"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-900 text-xs font-semibold text-white">
                      {initials}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 truncate">
                          {client.name}
                        </span>
                        <Badge
                          variant={client.status === "active" ? "approved" : "neutral"}
                          size="sm"
                          showIcon={false}
                        >
                          {client.status || "active"}
                        </Badge>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                        <span className="flex items-center gap-1 font-medium text-zinc-700">
                          <FolderKanban size={12} className="text-zinc-400" />
                          {projectName}
                        </span>
                        <span className="text-zinc-300">•</span>
                        <span className="flex items-center gap-1">
                          <span className="text-zinc-400">PIN:</span>
                          <button
                            type="button"
                            onClick={() => handleCopyLoginId(client.login_id)}
                            className="font-mono text-xs font-semibold text-indigo-700 hover:underline inline-flex items-center gap-1"
                            title="Click to copy login PIN"
                          >
                            {client.login_id}
                            {isCopied ? (
                              <Check size={11} className="text-emerald-600" />
                            ) : (
                              <Copy size={11} className="text-zinc-400" />
                            )}
                          </button>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Menu */}
                  <div className="flex items-center justify-end gap-2 shrink-0 border-t border-zinc-100 sm:border-t-0 pt-2 sm:pt-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<ExternalLink size={13} />}
                      onClick={handleCopyPortalLink}
                    >
                      Portal link
                    </Button>

                    <DropdownMenu
                      ariaLabel={`Actions for ${client.name}`}
                      items={[
                        {
                          label: "Edit details",
                          icon: <Edit3 size={14} />,
                          onClick: () => {
                            setEditing(client);
                            setEditName(client.name);
                            setEditProjectId(client.project_id);
                            setEditLoginId(client.login_id);
                            setEditStatus(client.status || "active");
                            setEditError("");
                          },
                        },
                        {
                          label: "Reset password",
                          icon: <KeyRound size={14} />,
                          onClick: () => {
                            setResettingClient(client);
                            setNewPassword(generateRandomPassword());
                            setResetSuccess(null);
                            setResetError("");
                          },
                        },
                        {
                          label: "Delete client",
                          icon: <Trash2 size={14} />,
                          variant: "danger",
                          onClick: () => handleDelete(client.id, client.name),
                        },
                      ]}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Create Client Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Add client"
        description="Create a client profile and generate login access for project requirement review."
        footer={
          <>
            <Button
              variant="outline"
              type="button"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="create-client-form"
              isLoading={creating}
              disabled={!name.trim() || !projectId}
            >
              Create client
            </Button>
          </>
        }
      >
        <form id="create-client-form" onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
              Client Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sarah Jenkins"
              className="h-10 w-full rounded-xl border border-zinc-200 px-3.5 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
              Assigned Project <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  6-Digit Login PIN
                </label>
                <button
                  type="button"
                  onClick={() => setLoginId(generateRandomPin())}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Regenerate
                </button>
              </div>
              <input
                type="text"
                required
                maxLength={6}
                value={loginId}
                onChange={(e) => setLoginId(e.target.value.replace(/\D/g, ""))}
                placeholder="6-digit PIN"
                className="h-10 w-full rounded-xl border border-zinc-200 px-3.5 text-sm font-mono text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Initial Password
                </label>
                <button
                  type="button"
                  onClick={() => setPassword(generateRandomPassword())}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Regenerate
                </button>
              </div>
              <input
                type="text"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="h-10 w-full rounded-xl border border-zinc-200 px-3.5 text-sm font-mono text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {createError && (
            <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg">
              {createError}
            </p>
          )}
        </form>
      </Modal>

      {/* One-time Created Credentials Modal */}
      <Modal
        isOpen={Boolean(createdCredentials)}
        onClose={() => setCreatedCredentials(null)}
        title="Client Access Created"
        description="Share these login credentials with the client to grant portal access."
        footer={
          <Button
            variant="primary"
            onClick={() => setCreatedCredentials(null)}
          >
            Done
          </Button>
        }
      >
        {createdCredentials && (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-emerald-800 font-medium">
                <span>Client Name:</span>
                <span className="font-semibold text-slate-900">{createdCredentials.name}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-emerald-800 font-medium">
                <span>Assigned Project:</span>
                <span className="font-semibold text-slate-900">{createdCredentials.projectName}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-emerald-800 font-medium">
                <span>Login PIN:</span>
                <span className="font-mono font-bold text-slate-900">{createdCredentials.loginId}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-emerald-800 font-medium">
                <span>Password:</span>
                <span className="font-mono font-bold text-slate-900">{createdCredentials.passwordEntered}</span>
              </div>
            </div>

            <Button
              variant="secondary"
              className="w-full"
              leftIcon={copiedCreds ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              onClick={() => {
                const text = `StoryBoard Client Portal Login:\nURL: ${window.location.origin}/client/login\nProject: ${createdCredentials.projectName}\nLogin ID: ${createdCredentials.loginId}\nPassword: ${createdCredentials.passwordEntered}`;
                navigator.clipboard.writeText(text);
                setCopiedCreds(true);
                setTimeout(() => setCopiedCreds(false), 2000);
              }}
            >
              {copiedCreds ? "Credentials copied" : "Copy credentials message"}
            </Button>
          </div>
        )}
      </Modal>

      {/* Edit Client Modal */}
      <Modal
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit client"
        description="Update client name, project assignment, or access status."
        footer={
          <>
            <Button
              variant="outline"
              type="button"
              onClick={() => setEditing(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="edit-client-form"
              isLoading={updating}
              disabled={!editName.trim()}
            >
              Save changes
            </Button>
          </>
        }
      >
        <form id="edit-client-form" onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
              Client Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-10 w-full rounded-xl border border-zinc-200 px-3.5 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
              Assigned Project
            </label>
            <select
              value={editProjectId}
              onChange={(e) => setEditProjectId(e.target.value)}
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
              Login PIN
            </label>
            <input
              type="text"
              required
              maxLength={6}
              value={editLoginId}
              onChange={(e) => setEditLoginId(e.target.value.replace(/\D/g, ""))}
              className="h-10 w-full rounded-xl border border-zinc-200 px-3.5 text-sm font-mono text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
              Status
            </label>
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>

          {editError && (
            <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg">
              {editError}
            </p>
          )}
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={Boolean(resettingClient)}
        onClose={() => setResettingClient(null)}
        title="Reset Client Password"
        description={`Set a new portal password for ${resettingClient?.name}.`}
        footer={
          resetSuccess ? (
            <Button
              variant="primary"
              onClick={() => setResettingClient(null)}
            >
              Close
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                type="button"
                onClick={() => setResettingClient(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                form="reset-pwd-form"
                isLoading={resetting}
              >
                Reset password
              </Button>
            </>
          )
        }
      >
        {resetSuccess ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-center">
              <p className="text-xs text-emerald-800 font-medium">New Password for {resettingClient?.name}:</p>
              <p className="font-mono text-lg font-bold text-slate-900 mt-1">{resetSuccess}</p>
            </div>
            <Button
              variant="secondary"
              className="w-full"
              leftIcon={<Copy size={14} />}
              onClick={() => {
                navigator.clipboard.writeText(resetSuccess);
                alert("Password copied to clipboard.");
              }}
            >
              Copy new password
            </Button>
          </div>
        ) : (
          <form id="reset-pwd-form" onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  New Password
                </label>
                <button
                  type="button"
                  onClick={() => setNewPassword(generateRandomPassword())}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Generate random
                </button>
              </div>
              <input
                type="text"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-10 w-full rounded-xl border border-zinc-200 px-3.5 text-sm font-mono text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            {resetError && (
              <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg">
                {resetError}
              </p>
            )}
          </form>
        )}
      </Modal>
    </div>
  );
}

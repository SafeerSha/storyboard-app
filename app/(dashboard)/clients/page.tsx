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

import { ClientPortalShareModal } from "@/components/clients/ClientPortalShareModal";
import { generateTemporaryPassword } from "@/lib/client-credentials";
import { toast } from "@/lib/toast";

type Client = {
  id: string;
  name: string;
  login_id: string;
  status: string;
  project_id: string;
  is_password_changed?: boolean;
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

  // Dedicated Client Portal Share Modal state
  const [sharingModalData, setSharingModalData] = useState<{
    client: Client;
    projectName: string;
    initialPassword?: string;
  } | null>(null);

  // In-memory cache of initial passwords generated/provided during this session
  const [recentInitialPasswords, setRecentInitialPasswords] = useState<Record<string, string>>({});

  // Delete Client Confirmation State
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Edit Client Modal State
  const [editing, setEditing] = useState<Client | null>(null);
  const [editName, setEditName] = useState("");
  const [editProjectId, setEditProjectId] = useState("");
  const [editLoginId, setEditLoginId] = useState("");
  const [editStatus, setEditStatus] = useState("active");
  const [updating, setUpdating] = useState(false);
  const [editError, setEditError] = useState("");

  // Reset Password Confirmation State
  const [confirmResetClient, setConfirmResetClient] = useState<Client | null>(null);
  const [resetting, setResetting] = useState(false);
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
    const effectivePwd = password || generateTemporaryPassword();

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
      const projName = assignedProj?.name || "Assigned Project";
      const newClient = {
        ...data.client,
        projects: assignedProj ? { name: assignedProj.name } : null,
      };
      setClients((prev) => [newClient, ...prev]);
      setShowCreate(false);
      toast.success("Client created successfully");

      const createdPwd = data.initialPassword || data.generatedPassword || effectivePwd;

      // Cache the initial plaintext password in memory for this session
      if (createdPwd) {
        setRecentInitialPasswords((prev) => ({
          ...prev,
          [data.client.id]: createdPwd,
        }));
      }

      // Automatically open the dedicated Share Client Portal modal
      setSharingModalData({
        client: newClient,
        projectName: projName,
        initialPassword: createdPwd,
      });

      setName("");
      setLoginId("");
      setPassword("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create client";
      setCreateError(msg);
      toast.error("Unable to create client");
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
      toast.success("Client updated successfully");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update client";
      setEditError(msg);
      toast.error("Unable to update client");
    } finally {
      setUpdating(false);
    }
  }

  async function handleConfirmResetPassword() {
    if (!confirmResetClient) return;
    setResetting(true);
    setResetError("");

    try {
      const res = await fetch(`/api/clients/${confirmResetClient.id}/reset-password`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password");

      const targetClient = confirmResetClient;
      const projName = targetClient.projects?.name || "Assigned Project";

      setClients((prev) =>
        prev.map((c) =>
          c.id === targetClient.id ? { ...c, is_password_changed: false } : c
        )
      );

      setConfirmResetClient(null);
      toast.success("Client password reset successfully");

      // Cache the newly generated initial password in memory for this session
      if (data.initialPassword) {
        setRecentInitialPasswords((prev) => ({
          ...prev,
          [targetClient.id]: data.initialPassword,
        }));
      }

      // Automatically open the dedicated Share Client Portal modal with the new initial password
      setSharingModalData({
        client: targetClient,
        projectName: projName,
        initialPassword: data.initialPassword,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to reset password";
      setResetError(msg);
      toast.error("Unable to reset password");
    } finally {
      setResetting(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingClient) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/clients/${deletingClient.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete client");
      setClients((prev) => prev.filter((c) => c.id !== deletingClient.id));
      setDeletingClient(null);
      toast.success("Client deleted");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete client";
      setError(msg);
      toast.error("Unable to delete client");
    } finally {
      setDeleting(false);
    }
  }

  function handleCopyLoginId(pin: string) {
    navigator.clipboard.writeText(pin);
    setCopiedLoginId(pin);
    setTimeout(() => setCopiedLoginId(null), 1500);
    toast.success("Login PIN copied");
  }

  function handleOpenShareModal(client: Client) {
    const projName = client.projects?.name || "Assigned Project";
    const initialPwd = recentInitialPasswords[client.id];
    setSharingModalData({
      client,
      projectName: projName,
      initialPassword: initialPwd,
    });
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

      <main className="mx-auto max-w-[1720px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-6">
        {/* Search & Project Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9994A5]"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clients by name or PIN..."
              className="h-9 w-full rounded-xl border border-[#EBE7F2] bg-white/90 pl-9 pr-3.5 text-xs sm:text-sm text-[#252331] placeholder:text-[#9994A5] outline-none transition focus:bg-white focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)] shadow-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="h-9 rounded-xl border border-[#EBE7F2] bg-white/90 px-3 text-xs sm:text-sm font-medium text-[#353140] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)] cursor-pointer shadow-xs"
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
          <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-4 text-xs sm:text-sm text-[#C25D72]">
            {error}
          </div>
        )}

        {/* Clients Table / Cards */}
        {loading ? (
          <div className="rounded-2xl border border-[#EBE7F2] bg-[#FAF9FC]/88 shadow-card p-4 space-y-3">
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
            <div className="rounded-2xl border border-dashed border-[#EBE7F2] bg-[#FAF9FC]/60 p-8 text-center">
              <p className="text-sm font-medium text-[#252331]">No clients match your filter</p>
              <p className="mt-1 text-xs text-[#9994A5]">Try searching with a different term.</p>
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
          <div className="rounded-2xl border border-[#EBE7F2] bg-[#FAF9FC]/88 shadow-card backdrop-blur-xl divide-y divide-[#EBE7F2]">
            {filteredClients.map((client) => {
              const initials = client.name ? client.name.slice(0, 2).toUpperCase() : "CL";
              const projectName = client.projects?.name || "Assigned Project";
              const isCopied = copiedLoginId === client.login_id;

              return (
                <div
                  key={client.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 hover:bg-white/60 transition first:rounded-t-2xl last:rounded-b-2xl"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[rgba(184,148,78,0.10)] border border-[rgba(184,148,78,0.15)] text-xs font-semibold text-[#80642F]">
                      {initials}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[#252331] truncate">
                          {client.name}
                        </span>
                        {client.status === "disabled" ? (
                          <Badge variant="neutral" size="sm" showIcon={false}>
                            Disabled
                          </Badge>
                        ) : client.is_password_changed === false ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F8E4D7]/60 text-[#A87936] border border-[#F8E4D7]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#A87936] animate-pulse"></span>
                            Password setup pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E3F4ED] text-[#2E8B70] border border-[#C5E8DB]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#2E8B70]"></span>
                            Active
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#706C7D]">
                        <span className="flex items-center gap-1 font-medium text-[#4D4959]">
                          <FolderKanban size={12} className="text-[#9994A5]" />
                          {projectName}
                        </span>
                        <span className="text-[#EBE7F2]">•</span>
                        <span className="flex items-center gap-1">
                          <span className="text-[#9994A5]">PIN:</span>
                          <button
                            type="button"
                            onClick={() => handleCopyLoginId(client.login_id)}
                            className="font-mono text-xs font-semibold text-[#80642F] hover:underline inline-flex items-center gap-1"
                            title="Click to copy login PIN"
                          >
                            {client.login_id}
                            {isCopied ? (
                              <Check size={11} className="text-[#2E8B70]" />
                            ) : (
                              <Copy size={11} className="text-[#9994A5]" />
                            )}
                          </button>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Menu */}
                  <div className="flex items-center justify-end gap-2 shrink-0 border-t border-[#EBE7F2] sm:border-t-0 pt-2 sm:pt-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<ExternalLink size={13} />}
                      onClick={() => handleOpenShareModal(client)}
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
                            setConfirmResetClient(client);
                            setResetError("");
                          },
                        },
                        {
                          label: "Delete client",
                          icon: <Trash2 size={14} />,
                          variant: "danger",
                          onClick: () => setDeletingClient(client),
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#706C7D] mb-1.5">
              Client Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sarah Jenkins"
              className="h-10 w-full rounded-xl border border-[#EBE7F2] bg-white px-3.5 text-sm text-[#252331] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#706C7D] mb-1.5">
              Assigned Project <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="h-10 w-full rounded-xl border border-[#EBE7F2] bg-white px-3 text-sm text-[#252331] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)] cursor-pointer"
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
                <label className="text-xs font-semibold uppercase tracking-wider text-[#706C7D]">
                  6-Digit Login PIN
                </label>
                <button
                  type="button"
                  onClick={() => setLoginId(generateRandomPin())}
                  className="text-xs text-[#80642F] hover:underline"
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
                className="h-10 w-full rounded-xl border border-[#EBE7F2] bg-white px-3.5 text-sm font-mono text-[#252331] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#706C7D]">
                  Initial Password
                </label>
                <button
                  type="button"
                  onClick={() => setPassword(generateRandomPassword())}
                  className="text-xs text-[#80642F] hover:underline"
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
                className="h-10 w-full rounded-xl border border-[#EBE7F2] bg-white px-3.5 text-sm font-mono text-[#252331] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)]"
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#706C7D] mb-1.5">
              Client Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-10 w-full rounded-xl border border-[#EBE7F2] bg-white px-3.5 text-sm text-[#252331] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#706C7D] mb-1.5">
              Assigned Project
            </label>
            <select
              value={editProjectId}
              onChange={(e) => setEditProjectId(e.target.value)}
              className="h-10 w-full rounded-xl border border-[#EBE7F2] bg-white px-3 text-sm text-[#252331] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)] cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#706C7D] mb-1.5">
              Login PIN
            </label>
            <input
              type="text"
              required
              maxLength={6}
              value={editLoginId}
              onChange={(e) => setEditLoginId(e.target.value.replace(/\D/g, ""))}
              className="h-10 w-full rounded-xl border border-[#EBE7F2] bg-white px-3.5 text-sm font-mono text-[#252331] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#706C7D] mb-1.5">
              Status
            </label>
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
              className="h-10 w-full rounded-xl border border-[#EBE7F2] bg-white px-3 text-sm text-[#252331] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)] cursor-pointer"
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

      {/* Reset Confirmation Modal */}
      <Modal
        isOpen={Boolean(confirmResetClient)}
        onClose={() => setConfirmResetClient(null)}
        title="Reset client password?"
        description="The client's current password will stop working. A new initial password will be generated."
        footer={
          <>
            <Button
              variant="outline"
              type="button"
              onClick={() => setConfirmResetClient(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              type="button"
              isLoading={resetting}
              onClick={handleConfirmResetPassword}
            >
              Reset password
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-zinc-600 leading-relaxed">
            Are you sure you want to reset the portal access password for{" "}
            <strong>{confirmResetClient?.name}</strong>? A secure temporary password
            will be generated for immediate handoff, and the client will be prompted to
            configure a new password on their next sign in.
          </p>
          {resetError && (
            <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg">
              {resetError}
            </p>
          )}
        </div>
      </Modal>

      {/* Delete Client Confirmation Modal */}
      <Modal
        isOpen={Boolean(deletingClient)}
        onClose={() => setDeletingClient(null)}
        title="Remove client?"
        description="Are you sure you want to remove this client? This will revoke their portal access."
        footer={
          <>
            <Button
              variant="outline"
              type="button"
              onClick={() => setDeletingClient(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              type="button"
              isLoading={deleting}
              onClick={handleConfirmDelete}
            >
              Remove client
            </Button>
          </>
        }
      >
        <p className="text-xs text-zinc-600 leading-relaxed">
          Client <strong>{deletingClient?.name}</strong> will be permanently removed
          from this project. Their login PIN and portal access will stop working
          immediately.
        </p>
      </Modal>

      {/* Dedicated Client Portal Share Modal */}
      {sharingModalData && (
        <ClientPortalShareModal
          isOpen={Boolean(sharingModalData)}
          onClose={() => setSharingModalData(null)}
          client={sharingModalData.client}
          projectName={sharingModalData.projectName}
          initialPassword={sharingModalData.initialPassword}
          onResetPassword={() => {
            const clientToReset = sharingModalData.client;
            setSharingModalData(null);
            setConfirmResetClient(clientToReset);
            setResetError("");
          }}
        />
      )}
    </div>
  );
}

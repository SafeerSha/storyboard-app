"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Check,
  Copy,
  Edit3,
  FolderKanban,
  KeyRound,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  User,
  UserCheck,
  UserX,
} from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { TableRowSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import type { TeamUser } from "@/lib/types";

interface ProjectOption {
  id: string;
  name: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");

  // Create user modal state
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createUsername, setCreateUsername] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createProjectId, setCreateProjectId] = useState("");
  const [createStatus, setCreateStatus] = useState<"active" | "disabled">("active");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // One-time creation confirmation modal state
  const [createdSuccess, setCreatedSuccess] = useState<{
    name: string;
    username: string;
    projectName: string;
    passwordEntered: string;
  } | null>(null);
  const [copiedCreds, setCopiedCreds] = useState(false);

  // Edit user modal state
  const [editingUser, setEditingUser] = useState<TeamUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editProjectId, setEditProjectId] = useState("");
  const [editStatus, setEditStatus] = useState<"active" | "disabled">("active");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  // Reset password modal state
  const [resettingUser, setResettingUser] = useState<TeamUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccessMessage, setResetSuccessMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [usersRes, projectsRes] = await Promise.all([
        fetch("/api/team-users"),
        fetch("/api/projects"),
      ]);

      if (!usersRes.ok) {
        if (usersRes.status === 403) {
          throw new Error("Unauthorized. Only Super Admins can access this page.");
        }
        throw new Error("Failed to load team users");
      }

      const usersData = await usersRes.json();
      setUsers(usersData.users || []);

      if (projectsRes.ok) {
        const projData = await projectsRes.json();
        const projs = (projData.projects || []).map((p: any) => ({
          id: p.id,
          name: p.name,
        }));
        setProjects(projs);
        if (projs.length > 0 && !createProjectId) {
          setCreateProjectId(projs[0].id);
        }
      }
    } catch (e: any) {
      setError(e.message || "Failed to load page data.");
    } finally {
      setLoading(false);
    }
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
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/team-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName,
          username: createUsername,
          password: createPassword,
          projectId: createProjectId,
          status: createStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create team user.");

      const selectedProj = projects.find((p) => p.id === createProjectId);
      const projName = selectedProj?.name || "Assigned Project";

      setUsers((prev) => [data.user, ...prev]);
      setShowCreate(false);
      setCreatedSuccess({
        name: createName,
        username: createUsername,
        projectName: projName,
        passwordEntered: createPassword,
      });

      setCreateName("");
      setCreateUsername("");
      setCreatePassword("");
    } catch (err: any) {
      setCreateError(err.message || "Failed to create team user.");
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setSavingEdit(true);
    setEditError("");
    try {
      const res = await fetch(`/api/team-users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          projectId: editProjectId,
          status: editStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update team user.");

      setUsers((prev) =>
        prev.map((u) => (u.id === editingUser.id ? data.user : u))
      );
      setEditingUser(null);
    } catch (err: any) {
      setEditError(err.message || "Failed to update team user.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resettingUser) return;
    setResetting(true);
    setResetError("");
    setResetSuccessMessage("");

    const pwd = newPassword || generateRandomPassword();

    try {
      const res = await fetch(`/api/team-users/${resettingUser.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: pwd }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password.");

      setResetSuccessMessage(pwd);
    } catch (err: any) {
      setResetError(err.message || "Failed to reset password.");
    } finally {
      setResetting(false);
    }
  }

  async function handleDeleteUser(user: TeamUser) {
    if (!confirm(`Are you sure you want to remove team user "${user.name}" (@${user.username})?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/team-users/${user.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete team user.");

      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err: any) {
      alert(err.message || "Failed to delete team user.");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleStatus(user: TeamUser) {
    const newStatus = user.status === "active" ? "disabled" : "active";
    setLoading(true);
    try {
      const res = await fetch(`/api/team-users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update user status.");

      setUsers((prev) => prev.map((u) => (u.id === user.id ? data.user : u)));
    } catch (err: any) {
      alert(err.message || "Failed to update status.");
    } finally {
      setLoading(false);
    }
  }

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = search.toLowerCase();
      const matchesSearch =
        u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
      const matchesProject =
        projectFilter === "all" || u.project_id === projectFilter;
      return matchesSearch && matchesProject;
    });
  }, [users, search, projectFilter]);

  if (error && error.includes("Unauthorized")) {
    return (
      <div>
        <DashboardHeader eyebrow="ADMINISTRATION" title="Team Members" />
        <main className="mx-auto max-w-4xl px-4 py-12">
          <EmptyState
            icon={ShieldAlert}
            title="Access Restricted"
            description="Only Super Admins have permission to manage team accounts and project assignments."
          />
        </main>
      </div>
    );
  }

  return (
    <div>
      <DashboardHeader
        eyebrow="ADMINISTRATION"
        title="Team Members"
        description="Manage people collaborating on your projects."
        actions={
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus size={15} />}
            onClick={() => {
              setCreateName("");
              setCreateUsername("");
              setCreatePassword(generateRandomPassword());
              setCreateError("");
              setShowCreate(true);
            }}
          >
            Add User
          </Button>
        }
      />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-6">
        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or username..."
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

        {/* Users List */}
        {loading ? (
          <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-card p-4 space-y-3">
            <TableRowSkeleton cols={4} />
            <TableRowSkeleton cols={4} />
            <TableRowSkeleton cols={4} />
          </div>
        ) : filteredUsers.length === 0 ? (
          users.length === 0 ? (
            <EmptyState
              icon={User}
              title="No team members yet"
              description="Invite team members to collaborate, review requirements, and participate in discussions."
              action={
                <Button
                  variant="primary"
                  leftIcon={<Plus size={15} />}
                  onClick={() => setShowCreate(true)}
                >
                  Add team member
                </Button>
              }
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-white/50 p-8 text-center">
              <p className="text-sm font-medium text-zinc-800">No team members match your search</p>
              <p className="mt-1 text-xs text-zinc-400">Try changing your search term or filter.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setSearch("");
                  setProjectFilter("all");
                }}
              >
                Reset filters
              </Button>
            </div>
          )
        ) : (
          <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-card overflow-hidden divide-y divide-zinc-100">
            {filteredUsers.map((u) => {
              const initials = u.name ? u.name.slice(0, 2).toUpperCase() : "TU";
              const proj = projects.find((p) => p.id === u.project_id);

              return (
                <div
                  key={u.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 hover:bg-zinc-50/50 transition"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-900 text-xs font-semibold text-white">
                      {initials}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 truncate">
                          {u.name}
                        </span>
                        <span className="font-mono text-xs text-zinc-400">
                          @{u.username}
                        </span>
                        <Badge
                          variant={u.status === "active" ? "approved" : "neutral"}
                          size="sm"
                          showIcon={false}
                        >
                          {u.status || "active"}
                        </Badge>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                        <span className="flex items-center gap-1 font-medium text-zinc-700">
                          <FolderKanban size={12} className="text-zinc-400" />
                          {proj?.name || "Assigned Project"}
                        </span>
                        {u.created_at && (
                          <>
                            <span className="text-zinc-300">•</span>
                            <span>Added {new Date(u.created_at).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Menu */}
                  <div className="flex items-center justify-end gap-1 shrink-0 border-t border-zinc-100 sm:border-t-0 pt-2 sm:pt-0">
                    <DropdownMenu
                      ariaLabel={`Actions for ${u.name}`}
                      items={[
                        {
                          label: "Edit details",
                          icon: <Edit3 size={14} />,
                          onClick: () => {
                            setEditingUser(u);
                            setEditName(u.name);
                            setEditProjectId(u.project_id);
                            setEditStatus(u.status || "active");
                            setEditError("");
                          },
                        },
                        {
                          label: u.status === "active" ? "Disable user" : "Enable user",
                          icon: u.status === "active" ? <UserX size={14} /> : <UserCheck size={14} />,
                          onClick: () => handleToggleStatus(u),
                        },
                        {
                          label: "Reset password",
                          icon: <KeyRound size={14} />,
                          onClick: () => {
                            setResettingUser(u);
                            setNewPassword(generateRandomPassword());
                            setResetSuccessMessage("");
                            setResetError("");
                          },
                        },
                        {
                          label: "Delete member",
                          icon: <Trash2 size={14} />,
                          variant: "danger",
                          onClick: () => handleDeleteUser(u),
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

      {/* Create Team User Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Add team member"
        description="Create an authorized team user profile for project requirements collaboration."
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
              form="create-user-form"
              isLoading={creating}
              disabled={!createName.trim() || !createUsername.trim() || !createProjectId}
            >
              Create member
            </Button>
          </>
        }
      >
        <form id="create-user-form" onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="e.g. Alex Rivera"
              className="h-10 w-full rounded-xl border border-zinc-200 px-3.5 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
              Username <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoCapitalize="none"
              autoCorrect="off"
              value={createUsername}
              onChange={(e) =>
                setCreateUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))
              }
              placeholder="e.g. alex.rivera"
              className="h-10 w-full rounded-xl border border-zinc-200 px-3.5 text-sm font-mono text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
              Assigned Project <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={createProjectId}
              onChange={(e) => setCreateProjectId(e.target.value)}
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Initial Password
              </label>
              <button
                type="button"
                onClick={() => setCreatePassword(generateRandomPassword())}
                className="text-xs text-indigo-600 hover:underline"
              >
                Regenerate
              </button>
            </div>
            <input
              type="text"
              required
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
              className="h-10 w-full rounded-xl border border-zinc-200 px-3.5 text-sm font-mono text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
              Account Status
            </label>
            <select
              value={createStatus}
              onChange={(e) => setCreateStatus(e.target.value as "active" | "disabled")}
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="active">Active (Permitted to log in)</option>
              <option value="disabled">Disabled (Blocked from logging in)</option>
            </select>
          </div>

          {createError && (
            <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg">
              {createError}
            </p>
          )}
        </form>
      </Modal>

      {/* One-Time Credentials Modal */}
      <Modal
        isOpen={Boolean(createdSuccess)}
        onClose={() => setCreatedSuccess(null)}
        title="Team Member Created"
        description="Share these login credentials with the team member to grant access to their assigned workspace."
        footer={
          <Button
            variant="primary"
            onClick={() => setCreatedSuccess(null)}
          >
            Done
          </Button>
        }
      >
        {createdSuccess && (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-emerald-800 font-medium">
                <span>Full Name:</span>
                <span className="font-semibold text-slate-900">{createdSuccess.name}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-emerald-800 font-medium">
                <span>Username:</span>
                <span className="font-mono font-bold text-slate-900">@{createdSuccess.username}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-emerald-800 font-medium">
                <span>Assigned Project:</span>
                <span className="font-semibold text-slate-900">{createdSuccess.projectName}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-emerald-800 font-medium">
                <span>Password:</span>
                <span className="font-mono font-bold text-slate-900">{createdSuccess.passwordEntered}</span>
              </div>
            </div>

            <Button
              variant="secondary"
              className="w-full"
              leftIcon={copiedCreds ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              onClick={() => {
                const text = `StoryBoard Team Portal Login:\nURL: ${window.location.origin}/team/login\nProject: ${createdSuccess.projectName}\nUsername: ${createdSuccess.username}\nPassword: ${createdSuccess.passwordEntered}`;
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

      {/* Edit Team User Modal */}
      <Modal
        isOpen={Boolean(editingUser)}
        onClose={() => setEditingUser(null)}
        title="Edit team member"
        description="Update member details or change project assignment."
        footer={
          <>
            <Button
              variant="outline"
              type="button"
              onClick={() => setEditingUser(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="edit-user-form"
              isLoading={savingEdit}
              disabled={!editName.trim()}
            >
              Save changes
            </Button>
          </>
        }
      >
        <form id="edit-user-form" onSubmit={handleSaveEdit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
              Full Name <span className="text-rose-500">*</span>
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
              Status
            </label>
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as any)}
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
        isOpen={Boolean(resettingUser)}
        onClose={() => setResettingUser(null)}
        title="Reset Password"
        description={`Set a new portal password for ${resettingUser?.name}.`}
        footer={
          resetSuccessMessage ? (
            <Button
              variant="primary"
              onClick={() => setResettingUser(null)}
            >
              Close
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                type="button"
                onClick={() => setResettingUser(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                form="reset-pwd-user-form"
                isLoading={resetting}
              >
                Reset password
              </Button>
            </>
          )
        }
      >
        {resetSuccessMessage ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-center">
              <p className="text-xs text-emerald-800 font-medium">New Password for {resettingUser?.name}:</p>
              <p className="font-mono text-lg font-bold text-slate-900 mt-1">{resetSuccessMessage}</p>
            </div>
            <Button
              variant="secondary"
              className="w-full"
              leftIcon={<Copy size={14} />}
              onClick={() => {
                navigator.clipboard.writeText(resetSuccessMessage);
                alert("Password copied to clipboard.");
              }}
            >
              Copy new password
            </Button>
          </div>
        ) : (
          <form id="reset-pwd-user-form" onSubmit={handleResetPassword} className="space-y-4">
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

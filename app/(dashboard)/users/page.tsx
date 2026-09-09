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
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { TableRowSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/lib/toast";
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
  const [createProjectIds, setCreateProjectIds] = useState<string[]>([]);
  const [createStatus, setCreateStatus] = useState<"active" | "disabled">("active");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // One-time creation confirmation modal state
  const [createdSuccess, setCreatedSuccess] = useState<{
    name: string;
    username: string;
    projectNames: string[];
    passwordEntered: string;
  } | null>(null);
  const [copiedCreds, setCopiedCreds] = useState(false);

  // Edit user modal state
  const [editingUser, setEditingUser] = useState<TeamUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editProjectIds, setEditProjectIds] = useState<string[]>([]);
  const [editStatus, setEditStatus] = useState<"active" | "disabled">("active");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  // Reset password modal state
  const [resettingUser, setResettingUser] = useState<TeamUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccessMessage, setResetSuccessMessage] = useState("");

  // Delete user confirmation dialog state
  const [deletingUser, setDeletingUser] = useState<TeamUser | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

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
        if (projs.length > 0) {
          setCreateProjectIds((prev) => (prev.length === 0 ? [projs[0].id] : prev));
        }
      }
    } catch (e: any) {
      setError(e.message || "Failed to load data.");
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

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!createName.trim() || !createUsername.trim() || !createPassword.trim() || createProjectIds.length === 0) {
      if (createProjectIds.length === 0) setCreateError("Please select at least one project.");
      return;
    }

    setCreating(true);
    setCreateError("");

    try {
      const res = await fetch("/api/team-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(),
          username: createUsername.trim().toLowerCase(),
          password: createPassword,
          projectIds: createProjectIds,
          status: createStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create team user.");

      const selectedProjNames = projects
        .filter((p) => createProjectIds.includes(p.id))
        .map((p) => p.name);

      setUsers((prev) => [data.user, ...prev]);
      setShowCreate(false);
      toast.success("Team member created successfully");
      setCreatedSuccess({
        name: createName,
        username: createUsername,
        projectNames: selectedProjNames.length > 0 ? selectedProjNames : ["Assigned Projects"],
        passwordEntered: createPassword,
      });

      setCreateName("");
      setCreateUsername("");
      setCreatePassword("");
      if (projects.length > 0) setCreateProjectIds([projects[0].id]);
      setCreateStatus("active");
    } catch (err: any) {
      const msg = err.message || "Failed to create team user.";
      setCreateError(msg);
      toast.error("Unable to create team member");
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    if (editProjectIds.length === 0) {
      setEditError("Please select at least one project.");
      return;
    }
    setSavingEdit(true);
    setEditError("");
    try {
      const res = await fetch(`/api/team-users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          projectIds: editProjectIds,
          status: editStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update team user.");

      setUsers((prev) =>
        prev.map((u) => (u.id === editingUser.id ? data.user : u))
      );
      setEditingUser(null);
      toast.success("Team member updated successfully");
    } catch (err: any) {
      const msg = err.message || "Failed to update team user.";
      setEditError(msg);
      toast.error("Unable to update team member");
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
      toast.success("Team member password reset successfully");
    } catch (err: any) {
      const msg = err.message || "Failed to reset password.";
      setResetError(msg);
      toast.error("Unable to reset password");
    } finally {
      setResetting(false);
    }
  }

  function handleDeleteUser(user: TeamUser) {
    setDeletingUser(user);
  }

  async function confirmDeleteUser() {
    if (!deletingUser) return;
    setDeletingLoading(true);
    try {
      const res = await fetch(`/api/team-users/${deletingUser.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete team user.");

      setUsers((prev) => prev.filter((u) => u.id !== deletingUser.id));
      toast.success("Team member removed");
      setDeletingUser(null);
    } catch {
      toast.error("Unable to remove team member");
    } finally {
      setDeletingLoading(false);
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
      toast.success(newStatus === "active" ? "Team member enabled" : "Team member disabled");
    } catch {
      toast.error("Unable to update team member status");
    } finally {
      setLoading(false);
    }
  }

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = search.toLowerCase();
      const matchesSearch =
        u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
      const userProjIds = (u.project_ids && u.project_ids.length > 0)
        ? u.project_ids
        : (u.assigned_projects ? u.assigned_projects.map((p) => p.id) : (u.project_id ? [u.project_id] : []));
      const matchesProject =
        projectFilter === "all" || userProjIds.includes(projectFilter);
      return matchesSearch && matchesProject;
    });
  }, [users, search, projectFilter]);

  if (error && error.includes("Unauthorized")) {
    return (
      <div>
        <DashboardHeader eyebrow="ADMINISTRATION" title="Team Members" maxWidth="max-w-4xl" />
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
              if (projects.length > 0) setCreateProjectIds([projects[0].id]);
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
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9994A5]"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or username..."
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

        {/* Users List */}
        {loading ? (
          <div className="rounded-2xl border border-[#EBE7F2] bg-[#FAF9FC]/88 shadow-card p-4 space-y-3">
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
            <div className="rounded-2xl border border-dashed border-[#EBE7F2] bg-[#FAF9FC]/60 p-8 text-center">
              <p className="text-sm font-medium text-[#252331]">No team members match your search</p>
              <p className="mt-1 text-xs text-[#9994A5]">Try changing your search term or filter.</p>
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
          <div className="rounded-2xl border border-[#EBE7F2] bg-[#FAF9FC]/88 shadow-card backdrop-blur-xl divide-y divide-[#EBE7F2]">
            {filteredUsers.map((u) => {
              const initials = u.name ? u.name.slice(0, 2).toUpperCase() : "TU";
              const userProjects = (u.assigned_projects && u.assigned_projects.length > 0)
                ? u.assigned_projects
                : (u.project_ids && u.project_ids.length > 0)
                ? projects.filter((p) => u.project_ids?.includes(p.id))
                : (u.project_id ? projects.filter((p) => p.id === u.project_id) : []);

              return (
                <div
                  key={u.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 hover:bg-white/60 transition first:rounded-t-2xl last:rounded-b-2xl"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[rgba(184,148,78,0.10)] border border-[rgba(184,148,78,0.15)] text-xs font-semibold text-[#80642F]">
                      {initials}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[#252331] truncate">
                          {u.name}
                        </span>
                        <span className="font-mono text-xs text-[#9994A5]">
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

                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-[#706C7D]">
                        <FolderKanban size={12} className="text-[#9994A5] shrink-0" />
                        {userProjects.length > 0 ? (
                          userProjects.map((p) => (
                            <span
                              key={p.id}
                              className="inline-flex items-center rounded-md bg-[rgba(184,148,78,0.08)] px-2 py-0.5 text-[11px] font-medium text-[#80642F] border border-[rgba(184,148,78,0.18)]"
                            >
                              {p.name}
                            </span>
                          ))
                        ) : (
                          <span className="italic text-zinc-400">No projects assigned</span>
                        )}
                        {u.created_at && (
                          <>
                            <span className="text-[#EBE7F2]">•</span>
                            <span>Added {new Date(u.created_at).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Menu */}
                  <div className="flex items-center justify-end gap-1 shrink-0 border-t border-[#EBE7F2] sm:border-t-0 pt-2 sm:pt-0">
                    <DropdownMenu
                      ariaLabel={`Actions for ${u.name}`}
                      items={[
                        {
                          label: "Edit details",
                          icon: <Edit3 size={14} />,
                          onClick: () => {
                            setEditingUser(u);
                            setEditName(u.name);
                            const userProjIds = (u.project_ids && u.project_ids.length > 0)
                              ? u.project_ids
                              : (u.assigned_projects ? u.assigned_projects.map((p) => p.id) : (u.project_id ? [u.project_id] : []));
                            setEditProjectIds(userProjIds);
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
              disabled={!createName.trim() || !createUsername.trim() || createProjectIds.length === 0}
            >
              Create member
            </Button>
          </>
        }
      >
        <form id="create-user-form" onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#706C7D] mb-1.5">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="e.g. Alex Rivera"
              className="h-10 w-full rounded-xl border border-[#EBE7F2] bg-white px-3.5 text-sm text-[#252331] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#706C7D] mb-1.5">
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
              className="h-10 w-full rounded-xl border border-[#EBE7F2] bg-white px-3.5 text-sm font-mono text-[#252331] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#706C7D]">
                Assigned Projects <span className="text-rose-500">*</span>
              </label>
              <span className="text-xs text-[#80642F] font-medium">
                {createProjectIds.length} {createProjectIds.length === 1 ? "project" : "projects"} selected
              </span>
            </div>
            <div className="rounded-xl border border-[#EBE7F2] bg-[#FAF9FC] p-2 max-h-44 overflow-y-auto space-y-1.5">
              {projects.length === 0 ? (
                <p className="text-xs text-[#9994A5] p-2">No projects found.</p>
              ) : (
                projects.map((p) => {
                  const isSelected = createProjectIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setCreateProjectIds((prev) =>
                          isSelected ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                        );
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                        isSelected
                          ? "bg-[rgba(184,148,78,0.12)] border border-[#B8944E] text-[#80642F]"
                          : "bg-white border border-[#EBE7F2] text-[#252331] hover:bg-white/80"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <FolderKanban size={13} className={isSelected ? "text-[#80642F]" : "text-[#9994A5]"} />
                        <span>{p.name}</span>
                      </div>
                      <div
                        className={`h-4 w-4 rounded flex items-center justify-center border transition ${
                          isSelected
                            ? "bg-[#80642F] border-[#80642F] text-white"
                            : "border-zinc-300 bg-white"
                        }`}
                      >
                        {isSelected && <Check size={11} strokeWidth={3} />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            {createProjectIds.length === 0 && (
              <p className="text-[11px] text-rose-500 mt-1">Please select at least one project.</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#706C7D]">
                Initial Password
              </label>
              <button
                type="button"
                onClick={() => setCreatePassword(generateRandomPassword())}
                className="text-xs text-[#80642F] hover:underline"
              >
                Regenerate
              </button>
            </div>
            <input
              type="text"
              required
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
              className="h-10 w-full rounded-xl border border-[#EBE7F2] bg-white px-3.5 text-sm font-mono text-[#252331] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#706C7D] mb-1.5">
              Account Status
            </label>
            <select
              value={createStatus}
              onChange={(e) => setCreateStatus(e.target.value as "active" | "disabled")}
              className="h-10 w-full rounded-xl border border-[#EBE7F2] bg-white px-3 text-sm text-[#252331] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)] cursor-pointer"
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
            <div className="rounded-xl border border-[#C5E8DB] bg-[#E3F4ED]/60 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-[#2E8B70] font-medium">
                <span>Full Name:</span>
                <span className="font-semibold text-[#252331]">{createdSuccess.name}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-[#2E8B70] font-medium">
                <span>Username:</span>
                <span className="font-mono font-bold text-[#252331]">@{createdSuccess.username}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-[#2E8B70] font-medium">
                <span>Assigned Projects:</span>
                <span className="font-semibold text-[#252331]">{createdSuccess.projectNames.join(", ")}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-[#2E8B70] font-medium">
                <span>Password:</span>
                <span className="font-mono font-bold text-[#252331]">{createdSuccess.passwordEntered}</span>
              </div>
            </div>

            <Button
              variant="secondary"
              className="w-full"
              leftIcon={copiedCreds ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              onClick={() => {
                const text = `StoryBoard Team Portal Login:\nURL: ${window.location.origin}/login\nProjects: ${createdSuccess.projectNames.join(", ")}\nUsername: ${createdSuccess.username}\nPassword: ${createdSuccess.passwordEntered}`;
                navigator.clipboard.writeText(text);
                setCopiedCreds(true);
                setTimeout(() => setCopiedCreds(false), 2000);
                toast.success("Team member access details copied");
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
        description="Update member details or change project assignments."
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
              disabled={!editName.trim() || editProjectIds.length === 0}
            >
              Save changes
            </Button>
          </>
        }
      >
        <form id="edit-user-form" onSubmit={handleSaveEdit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#706C7D] mb-1.5">
              Full Name <span className="text-rose-500">*</span>
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#706C7D]">
                Assigned Projects <span className="text-rose-500">*</span>
              </label>
              <span className="text-xs text-[#80642F] font-medium">
                {editProjectIds.length} {editProjectIds.length === 1 ? "project" : "projects"} selected
              </span>
            </div>
            <div className="rounded-xl border border-[#EBE7F2] bg-[#FAF9FC] p-2 max-h-44 overflow-y-auto space-y-1.5">
              {projects.length === 0 ? (
                <p className="text-xs text-[#9994A5] p-2">No projects found.</p>
              ) : (
                projects.map((p) => {
                  const isSelected = editProjectIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setEditProjectIds((prev) =>
                          isSelected ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                        );
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                        isSelected
                          ? "bg-[rgba(184,148,78,0.12)] border border-[#B8944E] text-[#80642F]"
                          : "bg-white border border-[#EBE7F2] text-[#252331] hover:bg-white/80"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <FolderKanban size={13} className={isSelected ? "text-[#80642F]" : "text-[#9994A5]"} />
                        <span>{p.name}</span>
                      </div>
                      <div
                        className={`h-4 w-4 rounded flex items-center justify-center border transition ${
                          isSelected
                            ? "bg-[#80642F] border-[#80642F] text-white"
                            : "border-zinc-300 bg-white"
                        }`}
                      >
                        {isSelected && <Check size={11} strokeWidth={3} />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            {editProjectIds.length === 0 && (
              <p className="text-[11px] text-rose-500 mt-1">Please select at least one project.</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#706C7D] mb-1.5">
              Status
            </label>
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as any)}
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
            <div className="rounded-xl border border-[#C5E8DB] bg-[#E3F4ED]/60 p-4 text-center">
              <p className="text-xs text-[#2E8B70] font-medium">New Password for {resettingUser?.name}:</p>
              <p className="font-mono text-lg font-bold text-[#252331] mt-1">{resetSuccessMessage}</p>
            </div>
            <Button
              variant="secondary"
              className="w-full"
              leftIcon={<Copy size={14} />}
              onClick={() => {
                navigator.clipboard.writeText(resetSuccessMessage);
                toast.success("Password copied");
              }}
            >
              Copy new password
            </Button>
          </div>
        ) : (
          <form id="reset-pwd-user-form" onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#706C7D]">
                  New Password
                </label>
                <button
                  type="button"
                  onClick={() => setNewPassword(generateRandomPassword())}
                  className="text-xs text-[#80642F] hover:underline"
                >
                  Generate random
                </button>
              </div>
              <input
                type="text"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Leave blank to auto-generate"
                className="h-10 w-full rounded-xl border border-[#EBE7F2] bg-white px-3.5 text-sm font-mono text-[#252331] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)]"
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

      {/* Delete User Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingUser)}
        onClose={() => setDeletingUser(null)}
        onConfirm={confirmDeleteUser}
        title="Remove team member"
        description={`Are you sure you want to remove team user "${deletingUser?.name}" (@${deletingUser?.username})?`}
        confirmLabel="Remove member"
        variant="danger"
        isLoading={deletingLoading}
      />
    </div>
  );
}

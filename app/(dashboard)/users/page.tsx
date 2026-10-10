"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  AtSign,
  Briefcase,
  Building2,
  Check,
  Copy,
  Crown,
  Edit3,
  ExternalLink,
  FolderKanban,
  KeyRound,
  Mail,
  Plus,
  Search,
  Shield,
  ShieldAlert,
  Trash2,
  User,
  UserCheck,
  UserX,
  Users,
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
import type { UnifiedUser, UserType } from "@/lib/types";

interface ProjectOption {
  id: string;
  name: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UnifiedUser[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | UserType>("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "disabled">("all");

  // Create user modal state
  const [showCreate, setShowCreate] = useState(false);
  const [createType, setCreateType] = useState<UserType>("team_user");
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createUsername, setCreateUsername] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState<"freelancer" | "super_admin">("freelancer");
  const [createProjectIds, setCreateProjectIds] = useState<string[]>([]);
  const [createClientId, setCreateClientId] = useState("");
  const [createStatus, setCreateStatus] = useState<"active" | "disabled">("active");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // One-time creation confirmation modal state
  const [createdSuccess, setCreatedSuccess] = useState<{
    name: string;
    identifier: string;
    userType: string;
    projectNames: string[];
    passwordEntered: string;
  } | null>(null);
  const [copiedCreds, setCopiedCreds] = useState(false);

  // Edit user modal state
  const [editingUser, setEditingUser] = useState<UnifiedUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<string>("");
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editProjectIds, setEditProjectIds] = useState<string[]>([]);
  const [editStatus, setEditStatus] = useState<"active" | "disabled">("active");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  // Reset password modal state
  const [resettingUser, setResettingUser] = useState<UnifiedUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccessMessage, setResetSuccessMessage] = useState("");

  // Delete user confirmation dialog state
  const [deletingUser, setDeletingUser] = useState<UnifiedUser | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [usersRes, projectsRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/projects"),
      ]);

      if (!usersRes.ok) {
        if (usersRes.status === 401 || usersRes.status === 403) {
          throw new Error("Unauthorized. Please log in to manage users.");
        }
        throw new Error("Failed to load users list");
      }

      const usersData = await usersRes.json();
      setUsers(usersData.users || []);
      setIsSuperAdmin(Boolean(usersData.isSuperAdmin));

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

  function openCreateModal(type: UserType = "team_user") {
    const finalType = !isSuperAdmin && (type === "freelancer" || type === "super_admin") ? "team_user" : type;
    setCreateType(finalType);
    setCreateName("");
    setCreateEmail("");
    setCreateUsername("");
    setCreatePassword(generateRandomPassword());
    setCreateRole("freelancer");
    setCreateStatus("active");
    setCreateError("");
    if (projects.length > 0) {
      setCreateProjectIds(finalType === "freelancer" || finalType === "super_admin" ? [] : [projects[0].id]);
      setCreateClientId(projects[0].id);
    }
    setShowCreate(true);
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");

    if (!isSuperAdmin && (createType === "freelancer" || createType === "super_admin")) {
      setCreateError("Only Super Admins can create Freelancer or Super Admin accounts.");
      return;
    }

    if (!createName.trim()) {
      setCreateError("Name is required.");
      return;
    }

    if (createType === "team_user") {
      if (!createUsername.trim()) {
        setCreateError("Username is required.");
        return;
      }
      if (createProjectIds.length === 0) {
        setCreateError("Please select at least one project for the team member.");
        return;
      }
    } else if (createType === "freelancer" || createType === "super_admin") {
      if (!createEmail.trim()) {
        setCreateError("Email is required.");
        return;
      }
    } else if (createType === "client") {
      if (!createClientId) {
        setCreateError("Please select a project for this client.");
        return;
      }
    }

    if (!createPassword.trim() || createPassword.length < 6) {
      setCreateError("Password must be at least 6 characters.");
      return;
    }

    setCreating(true);

    try {
      let res: Response;
      let selectedProjNames: string[] = [];

      if (createType === "freelancer" || createType === "super_admin") {
        selectedProjNames = projects
          .filter((p) => createProjectIds.includes(p.id))
          .map((p) => p.name);

        res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userType: createType,
            name: createName.trim(),
            email: createEmail.trim().toLowerCase(),
            password: createPassword,
            role: createRole,
            projectIds: createProjectIds,
          }),
        });
      } else if (createType === "team_user") {
        selectedProjNames = projects
          .filter((p) => createProjectIds.includes(p.id))
          .map((p) => p.name);

        res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userType: "team_user",
            name: createName.trim(),
            email: createEmail.trim().toLowerCase() || null,
            username: createUsername.trim().toLowerCase(),
            password: createPassword,
            projectIds: createProjectIds,
            status: createStatus,
          }),
        });
      } else {
        // Client account creation
        const selectedProj = projects.find((p) => p.id === createClientId);
        if (selectedProj) selectedProjNames = [selectedProj.name];

        res = await fetch("/api/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: createName.trim(),
            project_id: createClientId,
            password: createPassword,
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user.");

      // Reload list to ensure all joins & roles are refreshed
      await loadData();

      setShowCreate(false);
      toast.success(
        createType === "freelancer" || createType === "super_admin"
          ? "Freelancer account created successfully"
          : createType === "team_user"
            ? "Team member created successfully"
            : "Client account created successfully"
      );

      setCreatedSuccess({
        name: createName,
        identifier:
          createType === "freelancer" || createType === "super_admin"
            ? createEmail
            : createType === "team_user"
              ? `@${createUsername}`
              : data.client?.login_id || "Client ID",
        userType:
          createType === "super_admin"
            ? "Super Admin"
            : createType === "freelancer"
              ? "Freelancer"
              : createType === "team_user"
                ? "Team Member"
                : "Client",
        projectNames: selectedProjNames.length > 0 ? selectedProjNames : ["Workspace"],
        passwordEntered: createPassword,
      });
    } catch (err: any) {
      setCreateError(err.message || "Failed to create user.");
      toast.error("Unable to create user");
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
      const isSwitchingType =
        (editingUser.userType === "team_user" && editRole !== "team_user") ||
        ((editingUser.userType === "freelancer" || editingUser.userType === "super_admin") && editRole === "team_user");

      if (isSwitchingType) {
        const res = await fetch("/api/users/switch-role", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: editingUser.id,
            currentType: editingUser.userType,
            targetType: editRole,
            name: editName.trim(),
            email: editEmail.trim().toLowerCase(),
            username: editUsername.trim().toLowerCase(),
            password: editPassword,
            projectIds: editProjectIds,
            status: editStatus,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to switch user role.");

        await loadData();
        setEditingUser(null);
        toast.success(data.message || "User role updated successfully");

        if (data.credentials) {
          const selectedProjNames = projects
            .filter((p) => editProjectIds.includes(p.id))
            .map((p) => p.name);

          setCreatedSuccess({
            name: data.credentials.name,
            identifier: data.credentials.identifier,
            userType: data.credentials.userType,
            projectNames: selectedProjNames.length > 0 ? selectedProjNames : ["Workspace"],
            passwordEntered: data.credentials.password,
          });
        }
        return;
      }

      if (editingUser.userType === "freelancer" || editingUser.userType === "super_admin") {
        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editName.trim(),
            role: editRole,
            status: editStatus,
            projectIds: editProjectIds,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update account.");
      } else if (editingUser.userType === "team_user") {
        if (editProjectIds.length === 0) {
          throw new Error("Please select at least one project for this team member.");
        }
        const res = await fetch(`/api/team-users/${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editName.trim(),
            email: editEmail.trim().toLowerCase() || null,
            projectIds: editProjectIds,
            status: editStatus,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update team member.");
      } else if (editingUser.userType === "client") {
        const res = await fetch(`/api/clients/${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editName.trim(),
            project_id: editProjectIds[0] || undefined,
            status: editStatus,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update client.");
      }

      await loadData();
      setEditingUser(null);
      toast.success("User details updated successfully");
    } catch (err: any) {
      setEditError(err.message || "Failed to update user.");
      toast.error(err.message || "Unable to update user");
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

    const pwd = newPassword.trim() || generateRandomPassword();

    try {
      let res: Response;
      if (resettingUser.userType === "freelancer" || resettingUser.userType === "super_admin") {
        res = await fetch(`/api/users/${resettingUser.id}/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPassword: pwd }),
        });
      } else if (resettingUser.userType === "team_user") {
        res = await fetch(`/api/team-users/${resettingUser.id}/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPassword: pwd }),
        });
      } else {
        res = await fetch(`/api/clients/${resettingUser.id}/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password.");

      const finalPassword = data.new_password || pwd;
      setResetSuccessMessage(finalPassword);
      toast.success("Password reset successfully");
    } catch (err: any) {
      setResetError(err.message || "Failed to reset password.");
      toast.error("Unable to reset password");
    } finally {
      setResetting(false);
    }
  }

  async function handleToggleStatus(u: UnifiedUser) {
    const nextStatus = u.status === "active" ? "disabled" : "active";
    setLoading(true);

    try {
      let res: Response;
      if (u.userType === "freelancer" || u.userType === "super_admin") {
        res = await fetch(`/api/users/${u.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        });
      } else if (u.userType === "team_user") {
        res = await fetch(`/api/team-users/${u.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        });
      } else {
        res = await fetch(`/api/clients/${u.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status.");

      setUsers((prev) =>
        prev.map((item) => (item.id === u.id ? { ...item, status: nextStatus } : item))
      );
      toast.success(nextStatus === "active" ? "User enabled" : "User disabled");
    } catch (err: any) {
      toast.error(err.message || "Unable to update status");
    } finally {
      setLoading(false);
    }
  }

  async function confirmDeleteUser() {
    if (!deletingUser) return;
    setDeletingLoading(true);

    try {
      let res: Response;
      if (deletingUser.userType === "freelancer" || deletingUser.userType === "super_admin") {
        res = await fetch(`/api/users/${deletingUser.id}`, {
          method: "DELETE",
        });
      } else if (deletingUser.userType === "team_user") {
        res = await fetch(`/api/team-users/${deletingUser.id}`, {
          method: "DELETE",
        });
      } else {
        res = await fetch(`/api/clients/${deletingUser.id}`, {
          method: "DELETE",
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete user.");

      setUsers((prev) => prev.filter((u) => u.id !== deletingUser.id));
      toast.success("User account removed");
      setDeletingUser(null);
    } catch (err: any) {
      toast.error(err.message || "Unable to remove user");
    } finally {
      setDeletingLoading(false);
    }
  }

  // Filtered and searched list
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // 1. Tab filter
      if (activeTab !== "all" && u.userType !== activeTab) {
        return false;
      }

      // 2. Status filter
      if (statusFilter !== "all" && u.status !== statusFilter) {
        return false;
      }

      // 3. Project filter
      if (projectFilter !== "all") {
        const userProjectIds = u.projects.map((p) => p.id);
        if (!userProjectIds.includes(projectFilter)) {
          return false;
        }
      }

      // 4. Search text
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = u.name?.toLowerCase().includes(q);
        const matchesEmail = u.email?.toLowerCase().includes(q);
        const matchesUsername = u.username?.toLowerCase().includes(q);
        const matchesLoginId = u.loginId?.toLowerCase().includes(q);
        const matchesRole = u.roleDisplay?.toLowerCase().includes(q);
        const matchesProjects = u.projects.some((p) => p.name.toLowerCase().includes(q));

        if (
          !matchesName &&
          !matchesEmail &&
          !matchesUsername &&
          !matchesLoginId &&
          !matchesRole &&
          !matchesProjects
        ) {
          return false;
        }
      }

      return true;
    });
  }, [users, activeTab, statusFilter, projectFilter, search]);

  // Aggregated tab counts
  const counts = useMemo(() => {
    return {
      all: users.length,
      freelancer: users.filter((u) => u.userType === "freelancer").length,
      team_user: users.filter((u) => u.userType === "team_user").length,
      client: users.filter((u) => u.userType === "client").length,
      super_admin: users.filter((u) => u.userType === "super_admin").length,
    };
  }, [users]);

  // Renders the role-specific icon & avatar
  const renderUserAvatar = (u: UnifiedUser) => {
    const initials = u.name ? u.name.slice(0, 2).toUpperCase() : "U";

    if (u.userType === "super_admin") {
      return (
        <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 border border-amber-300/80 text-xs font-bold text-amber-800 shadow-xs">
          <span>{initials}</span>
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white shadow-xs">
            <Crown size={10} />
          </span>
        </div>
      );
    }

    if (u.userType === "freelancer") {
      return (
        <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-50/90 border border-rose-200/80 text-xs font-bold text-rose-700 shadow-xs">
          <span>{initials}</span>
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-white shadow-xs">
            <Briefcase size={9} />
          </span>
        </div>
      );
    }

    if (u.userType === "client") {
      return (
        <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50/90 border border-emerald-200/80 text-xs font-bold text-emerald-700 shadow-xs">
          <span>{initials}</span>
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs">
            <Building2 size={9} />
          </span>
        </div>
      );
    }

    // Default: Team User
    return (
      <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[rgba(184,148,78,0.10)] border border-[rgba(184,148,78,0.22)] text-xs font-bold text-[#80642F] shadow-xs">
        <span>{initials}</span>
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#B8944E] text-white shadow-xs">
          <Users size={9} />
        </span>
      </div>
    );
  };

  // Render role badge pill
  const renderRoleBadge = (u: UnifiedUser) => {
    switch (u.userType) {
      case "super_admin":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/90 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">
            <Crown size={11} className="text-amber-600" />
            Super Admin
          </span>
        );
      case "freelancer":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 border border-rose-200">
            <Briefcase size={11} className="text-rose-600" />
            Freelancer
          </span>
        );
      case "client":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
            <Building2 size={11} className="text-emerald-600" />
            Client
          </span>
        );
      case "team_user":
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(184,148,78,0.08)] px-2.5 py-0.5 text-[11px] font-semibold text-[#80642F] border border-[rgba(184,148,78,0.20)]">
            <Users size={11} className="text-[#80642F]" />
            Team Member
          </span>
        );
    }
  };

  if (error && error.includes("Unauthorized")) {
    return (
      <div>
        <DashboardHeader eyebrow="ADMINISTRATION" title="Users Directory" maxWidth="max-w-4xl" />
        <main className="mx-auto max-w-4xl px-4 py-12">
          <EmptyState
            icon={ShieldAlert}
            title="Access Restricted"
            description="You must be logged in with administrative access to view and manage users."
          />
        </main>
      </div>
    );
  }

  return (
    <div>
      <DashboardHeader
        eyebrow="ADMINISTRATION"
        title="Users Directory"
        description="Centralized administration for platform freelancers, team members, and client permissions."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus size={15} />}
              onClick={() => openCreateModal("team_user")}
            >
              Add User
            </Button>
          </div>
        }
      />

      <main className="mx-auto max-w-[1720px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-6">
        {/* User Type Quick Filter Tabs with Counts */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[#EBE7F2] pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold transition ${activeTab === "all"
                ? "bg-[#252331] text-white shadow-xs"
                : "bg-white/80 text-[#706C7D] hover:bg-[#FAF9FC] hover:text-[#252331] border border-[#EBE7F2]"
              }`}
          >
            <span>All Users</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[11px] font-mono ${activeTab === "all" ? "bg-white/20 text-white" : "bg-neutral-100 text-[#706C7D]"
                }`}
            >
              {counts.all}
            </span>
          </button>

          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab("freelancer")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold transition ${activeTab === "freelancer"
                  ? "bg-rose-600 text-white shadow-xs hover:bg-rose-700"
                  : "bg-white/80 text-[#706C7D] hover:bg-rose-50/60 hover:text-rose-700 border border-[#EBE7F2]"
                }`}
            >
              <Briefcase size={14} />
              <span>Freelancers</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[11px] font-mono ${activeTab === "freelancer"
                    ? "bg-white/20 text-white"
                    : "bg-rose-50 text-rose-700 border border-rose-200/50"
                  }`}
              >
                {counts.freelancer}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab("team_user")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold transition ${activeTab === "team_user"
                ? "bg-[#80642F] text-white shadow-xs"
                : "bg-white/80 text-[#706C7D] hover:bg-[rgba(184,148,78,0.06)] hover:text-[#80642F] border border-[#EBE7F2]"
              }`}
          >
            <Users size={14} />
            <span>Team Members</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[11px] font-mono ${activeTab === "team_user"
                  ? "bg-white/20 text-white"
                  : "bg-[rgba(184,148,78,0.12)] text-[#80642F]"
                }`}
            >
              {counts.team_user}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("client")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold transition ${activeTab === "client"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-white/80 text-[#706C7D] hover:bg-emerald-50/50 hover:text-emerald-700 border border-[#EBE7F2]"
              }`}
          >
            <Building2 size={14} />
            <span>Clients</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[11px] font-mono ${activeTab === "client"
                  ? "bg-white/20 text-white"
                  : "bg-emerald-50 text-emerald-700"
                }`}
            >
              {counts.client}
            </span>
          </button>

          {counts.super_admin > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab("super_admin")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold transition ${activeTab === "super_admin"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-white/80 text-[#706C7D] hover:bg-amber-50/50 hover:text-amber-800 border border-[#EBE7F2]"
                }`}
            >
              <Crown size={14} />
              <span>Super Admins</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[11px] font-mono ${activeTab === "super_admin"
                    ? "bg-white/20 text-white"
                    : "bg-amber-100 text-amber-800"
                  }`}
              >
                {counts.super_admin}
              </span>
            </button>
          )}
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9994A5]"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, username, or login ID..."
              className="h-10 w-full rounded-xl border border-[#EBE7F2] bg-white/90 pl-9 pr-3.5 text-xs sm:text-sm text-[#252331] placeholder:text-[#9994A5] outline-none transition focus:bg-white focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)] shadow-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Project Filter */}
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="h-10 rounded-xl border border-[#EBE7F2] bg-white/90 px-3 text-xs sm:text-sm font-medium text-[#353140] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)] cursor-pointer shadow-xs"
            >
              <option value="all">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-10 rounded-xl border border-[#EBE7F2] bg-white/90 px-3 text-xs sm:text-sm font-medium text-[#353140] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)] cursor-pointer shadow-xs"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="disabled">Disabled Only</option>
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
            <TableRowSkeleton cols={4} />
          </div>
        ) : filteredUsers.length === 0 ? (
          users.length === 0 ? (
            <EmptyState
              icon={User}
              title="No users found"
              description={
                isSuperAdmin
                  ? "Create your first team member or freelancer account to get started collaborating."
                  : "Create your first team member or client account to get started collaborating."
              }
              action={
                <Button
                  variant="primary"
                  leftIcon={<Plus size={15} />}
                  onClick={() => openCreateModal("team_user")}
                >
                  Add User
                </Button>
              }
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-[#EBE7F2] bg-[#FAF9FC]/60 p-8 text-center">
              <p className="text-sm font-medium text-[#252331]">No users match your criteria</p>
              <p className="mt-1 text-xs text-[#9994A5]">Try changing your search term, tab, or project filter.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setSearch("");
                  setActiveTab("all");
                  setProjectFilter("all");
                  setStatusFilter("all");
                }}
              >
                Reset all filters
              </Button>
            </div>
          )
        ) : (
          <div className="rounded-2xl border border-[#EBE7F2] bg-[#FAF9FC]/88 shadow-card backdrop-blur-xl divide-y divide-[#EBE7F2]">
            {filteredUsers.map((u) => {
              // Deduplicate project pills by ID
              const userProjects = Array.from(
                new Map((u.projects || []).map((p) => [p.id, p])).values()
              );

              return (
                <div
                  key={`${u.userType}-${u.id}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 p-4 sm:p-5 hover:bg-white/60 transition first:rounded-t-2xl last:rounded-b-2xl"
                >
                  {/* Avatar & User Details */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {renderUserAvatar(u)}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[#252331] truncate">
                          {u.name}
                        </span>

                        {/* Handle / Identifier */}
                        {u.username && (
                          <span className="inline-flex items-center gap-0.5 font-mono text-xs text-[#706C7D]">
                            <AtSign size={11} className="text-[#9994A5]" />
                            {u.username}
                          </span>
                        )}
                        {u.email && (
                          <span className="inline-flex items-center gap-1 font-mono text-xs text-[#706C7D]">
                            <Mail size={11} className="text-[#9994A5]" />
                            {u.email}
                          </span>
                        )}
                        {u.loginId && (
                          <span className="inline-flex items-center gap-1 font-mono text-xs text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            <KeyRound size={10} />
                            ID: {u.loginId}
                          </span>
                        )}

                        {/* Role Badge */}
                        {renderRoleBadge(u)}

                        {/* Status Badge */}
                        <Badge
                          variant={u.status === "active" ? "approved" : "neutral"}
                          size="sm"
                          showIcon={false}
                        >
                          {u.status || "active"}
                        </Badge>
                      </div>

                      {/* Associated Projects and Metadata */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-[#706C7D]">
                        <FolderKanban size={13} className="text-[#9994A5] shrink-0" />
                        {userProjects.length > 0 ? (
                          userProjects.map((p) => (
                            <span
                              key={p.id}
                              className="inline-flex items-center gap-1 rounded-md bg-[rgba(184,148,78,0.08)] px-2 py-0.5 text-[11px] font-medium text-[#80642F] border border-[rgba(184,148,78,0.18)]"
                            >
                              {p.name}
                              {u.userType === "freelancer" && (
                                <span className="text-[9px] uppercase tracking-wider text-[#B8944E] font-bold">
                                  lead
                                </span>
                              )}
                            </span>
                          ))
                        ) : u.userType === "super_admin" ? (
                          <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 border border-amber-200">
                            All Workspace Projects
                          </span>
                        ) : (
                          <span className="italic text-zinc-400">No project assignments</span>
                        )}

                        {u.created_at && (
                          <>
                            <span className="text-[#EBE7F2]">•</span>
                            <span className="text-[11px] text-[#9994A5]">
                              Added {new Date(u.created_at).toLocaleDateString()}
                            </span>
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
                            setEditRole(u.userType === "team_user" ? "team_user" : u.role || "freelancer");
                            setEditUsername(u.username || u.email?.split("@")[0] || "");
                            setEditEmail(u.email || (u.username?.includes("@") ? u.username : ""));
                            setEditPassword(generateRandomPassword());
                            setEditProjectIds(u.projects.map((p) => p.id));
                            setEditStatus(u.status || "active");
                            setEditError("");
                          },
                        },
                        {
                          label: u.status === "active" ? "Disable account" : "Enable account",
                          icon: u.status === "active" ? <UserX size={14} /> : <UserCheck size={14} />,
                          onClick: () => handleToggleStatus(u),
                        },
                        {
                          label: "Reset password",
                          icon: <KeyRound size={14} />,
                          onClick: () => {
                            setResettingUser(u);
                            setNewPassword(generateRandomPassword());
                            setResetError("");
                            setResetSuccessMessage("");
                          },
                        },
                        {
                          label: "Delete user",
                          icon: <Trash2 size={14} className="text-rose-500" />,
                          onClick: () => setDeletingUser(u),
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

      {/* ============================================================== */}
      {/* 1. Add User Modal (Supports Freelancers, Team Users & Clients) */}
      {/* ============================================================== */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Add New User"
        description="Select the type of user you wish to create and grant permissions."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          {/* User Type Switcher Tabs */}
          <div className={`grid ${isSuperAdmin ? "grid-cols-3" : "grid-cols-2"} gap-2 rounded-xl bg-[#FAF9FC] p-1.5 border border-[#EBE7F2]`}>
            <button
              type="button"
              onClick={() => setCreateType("team_user")}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${createType === "team_user"
                  ? "bg-white text-[#80642F] shadow-xs border border-[#EBE7F2]"
                  : "text-[#706C7D] hover:text-[#252331]"
                }`}
            >
              <Users size={14} />
              <span>Team Member</span>
            </button>
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => setCreateType("freelancer")}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${createType === "freelancer" || createType === "super_admin"
                    ? "bg-white text-rose-700 shadow-xs border border-[#EBE7F2]"
                    : "text-[#706C7D] hover:text-[#252331]"
                  }`}
              >
                <Briefcase size={14} />
                <span>Freelancer / Admin</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setCreateType("client")}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${createType === "client"
                  ? "bg-white text-emerald-700 shadow-xs border border-[#EBE7F2]"
                  : "text-[#706C7D] hover:text-[#252331]"
                }`}
            >
              <Building2 size={14} />
              <span>Client</span>
            </button>
          </div>

          {/* Form Fields: Shared Full Name */}
          <div>
            <label className="block text-xs font-semibold text-[#252331] mb-1">Full Name</label>
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="e.g. Vivek Babu"
              className="h-10 w-full rounded-xl border border-[#EBE7F2] bg-white px-3 text-sm text-[#252331] outline-none transition focus:border-[#B8944E]"
              required
            />
          </div>

          {/* Freelancer Specific: Email & Role */}
          {(createType === "freelancer" || createType === "super_admin") && (
            <>
              <div>
                <label className="block text-xs font-semibold text-[#252331] mb-1">
                  Email Address (Login Identity)
                </label>
                <input
                  type="email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  placeholder="e.g. vivek@company.com"
                  className="h-10 w-full rounded-xl border border-[#EBE7F2] bg-white px-3 text-sm text-[#252331] outline-none transition focus:border-[#B8944E]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#252331] mb-1">
                  Platform Role
                </label>
                <select
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value as any)}
                  className="h-10 w-full rounded-xl border border-[#EBE7F2] bg-white px-3 text-sm text-[#252331] outline-none transition focus:border-[#B8944E]"
                >
                  <option value="freelancer">Freelancer (Create & manage projects)</option>
                  <option value="super_admin">Super Admin (Full platform governance)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-[#252331]">
                    Map Initial Projects (Optional)
                  </label>
                  <span className="text-[11px] text-[#706C7D]">
                    {createProjectIds.length} selected
                  </span>
                </div>
                <p className="text-[11px] text-[#9994A5] mb-2">
                  Assign workspace projects created by Super Admin to this freelancer as Project Lead.
                </p>
                {projects.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#EBE7F2] p-4 text-center text-xs text-zinc-400">
                    No workspace projects available.
                  </div>
                ) : (
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-[#EBE7F2] bg-white p-2 space-y-1.5">
                    {projects.map((p) => {
                      const checked = createProjectIds.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium cursor-pointer transition ${checked
                              ? "bg-[rgba(184,148,78,0.10)] text-[#80642F] border border-[rgba(184,148,78,0.22)]"
                              : "hover:bg-[#FAF9FC] text-[#353140] border border-transparent"
                            }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setCreateProjectIds((prev) => [...prev, p.id]);
                                } else {
                                  setCreateProjectIds((prev) => prev.filter((id) => id !== p.id));
                                }
                              }}
                              className="h-4 w-4 rounded border-gray-300 text-[#B8944E] focus:ring-[#B8944E]"
                            />
                            <span>{p.name}</span>
                          </div>
                          {checked && (
                            <span className="text-[10px] uppercase font-bold tracking-wider text-[#80642F] bg-white/80 px-1.5 py-0.5 rounded border border-[rgba(184,148,78,0.25)]">
                              Lead
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Team Member Specific: Username & Multi-project */}
          {createType === "team_user" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-[#252331] mb-1">
                  Username (Team Login Identifier)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#9994A5]">
                    @
                  </span>
                  <input
                    type="text"
                    value={createUsername}
                    onChange={(e) => setCreateUsername(e.target.value.toLowerCase())}
                    placeholder="vivek.b"
                    className="h-10 w-full rounded-xl border border-[#EBE7F2] bg-white pl-7 pr-3 text-sm text-[#252331] outline-none transition focus:border-[#B8944E]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#252331] mb-1">
                  Email Address <span className="text-[#9994A5] font-normal">(Optional)</span>
                </label>
                <input
                  type="email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  placeholder="e.g. member@company.com"
                  className="h-10 w-full rounded-xl border border-[#EBE7F2] bg-white px-3 text-sm text-[#252331] outline-none transition focus:border-[#B8944E]"
                />
                <p className="text-[11px] text-[#9994A5] mt-1">
                  Used for meeting invitations, task notifications & remuneration allocations.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#252331] mb-1">
                  Map to Projects (Multi-Select)
                </label>
                <p className="text-[11px] text-[#9994A5] mb-2">
                  Select which projects this team member will have access to in their portal.
                </p>
                <div className="max-h-36 overflow-y-auto rounded-xl border border-[#EBE7F2] bg-white p-2 space-y-1.5">
                  {projects.map((p) => {
                    const checked = createProjectIds.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium cursor-pointer transition ${checked
                            ? "bg-[rgba(184,148,78,0.10)] text-[#80642F]"
                            : "hover:bg-[#FAF9FC] text-[#353140]"
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCreateProjectIds((prev) => [...prev, p.id]);
                            } else {
                              setCreateProjectIds((prev) => prev.filter((id) => id !== p.id));
                            }
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-[#B8944E] focus:ring-[#B8944E]"
                        />
                        <span>{p.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Client Specific: Project selector */}
          {createType === "client" && (
            <div>
              <label className="block text-xs font-semibold text-[#252331] mb-1">
                Assigned Project
              </label>
              <select
                value={createClientId}
                onChange={(e) => setCreateClientId(e.target.value)}
                className="h-10 w-full rounded-xl border border-[#EBE7F2] bg-white px-3 text-sm text-[#252331] outline-none transition focus:border-[#B8944E]"
                required
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Password (All types) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-[#252331]">Temporary Password</label>
              <button
                type="button"
                onClick={() => setCreatePassword(generateRandomPassword())}
                className="text-[11px] font-medium text-[#80642F] hover:underline"
              >
                Generate random
              </button>
            </div>
            <input
              type="text"
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
              className="h-10 w-full rounded-xl border border-[#EBE7F2] bg-white px-3 font-mono text-sm text-[#252331] outline-none transition focus:border-[#B8944E]"
              required
            />
          </div>

          {createError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-[#C25D72]">
              {createError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={creating}>
              Create User
            </Button>
          </div>
        </form>
      </Modal>

      {/* ============================================================== */}
      {/* 2. One-Time Credentials Success Modal                          */}
      {/* ============================================================== */}
      {createdSuccess && (
        <Modal
          isOpen={true}
          onClose={() => setCreatedSuccess(null)}
          title="Account Created Successfully"
          description="Copy and share these credentials with the user. Passwords are securely hashed."
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-[rgba(184,148,78,0.25)] bg-[rgba(184,148,78,0.06)] p-4 text-xs sm:text-sm text-[#353140] space-y-2">
              <div className="flex justify-between">
                <span className="font-semibold text-[#706C7D]">User:</span>
                <span className="font-medium text-[#252331]">{createdSuccess.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-[#706C7D]">Account Type:</span>
                <span className="font-medium text-[#80642F]">{createdSuccess.userType}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-[#706C7D]">Login Handle / ID:</span>
                <span className="font-mono font-bold text-[#252331]">{createdSuccess.identifier}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-[#706C7D]">Projects:</span>
                <span className="font-medium text-[#252331]">
                  {createdSuccess.projectNames.join(", ")}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-[rgba(184,148,78,0.18)]">
                <span className="font-semibold text-[#706C7D]">Password:</span>
                <span className="font-mono font-bold text-[#80642F]">
                  {createdSuccess.passwordEntered}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                leftIcon={copiedCreds ? <Check size={14} /> : <Copy size={14} />}
                onClick={() => {
                  const text = `REQly Account Details\nName: ${createdSuccess.name}\nType: ${createdSuccess.userType}\nLogin: ${createdSuccess.identifier}\nPassword: ${createdSuccess.passwordEntered}\nProjects: ${createdSuccess.projectNames.join(", ")}`;
                  navigator.clipboard.writeText(text);
                  setCopiedCreds(true);
                  setTimeout(() => setCopiedCreds(false), 2000);
                  toast.success("Credentials copied to clipboard");
                }}
              >
                {copiedCreds ? "Copied" : "Copy Credentials"}
              </Button>
              <Button variant="primary" onClick={() => setCreatedSuccess(null)}>
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ============================================================== */}
      {/* 3. Edit User Details Modal                                    */}
      {/* ============================================================== */}
      {editingUser && (
        <Modal
          isOpen={true}
          onClose={() => setEditingUser(null)}
          title={`Edit ${editingUser.roleDisplay}: ${editingUser.name}`}
          description="Update account details, role permissions, and project assignments."
        >
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#252331] mb-1">Full Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-10 w-full rounded-xl border border-[#EBE7F2] bg-white px-3 text-sm text-[#252331] outline-none transition focus:border-[#B8944E]"
                required
              />
            </div>

            {/* Freelancer/Admin: Role Switcher & Conversion */}
            {(editingUser.userType === "freelancer" || editingUser.userType === "super_admin") && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#252331] mb-1">
                    Platform Role & Account Type
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="h-10 w-full rounded-xl border border-[#EBE7F2] bg-white px-3 text-sm text-[#252331] outline-none transition focus:border-[#B8944E]"
                  >
                    <option value="freelancer">Freelancer (Platform Lead)</option>
                    <option value="super_admin">Super Admin (Full Platform Governance)</option>
                    <option value="team_user">👥 Switch Role to: Team Member</option>
                  </select>
                </div>

                {/* If converting to Team Member */}
                {editRole === "team_user" && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 space-y-3">
                    <div className="flex items-start gap-2 text-xs text-amber-900">
                      <Users size={16} className="text-amber-700 shrink-0 mt-0.5" />
                      <p>
                        Switching <strong>{editingUser.name}</strong> to a Team Member will grant them access to the Team Portal (<span className="font-mono">/team</span>) with project assignments.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#252331] mb-1">
                        Team Username
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#9994A5]">
                          @
                        </span>
                        <input
                          type="text"
                          value={editUsername}
                          onChange={(e) => setEditUsername(e.target.value.toLowerCase())}
                          placeholder="username"
                          className="h-9 w-full rounded-lg border border-[#EBE7F2] bg-white pl-7 pr-3 text-xs sm:text-sm text-[#252331] outline-none transition focus:border-[#B8944E]"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#252331] mb-1">
                        Map to Projects (Multi-Select)
                      </label>
                      <div className="max-h-32 overflow-y-auto rounded-lg border border-[#EBE7F2] bg-white p-2 space-y-1">
                        {projects.map((p) => {
                          const checked = editProjectIds.includes(p.id);
                          return (
                            <label
                              key={p.id}
                              className={`flex items-center gap-2 rounded px-2 py-1 text-xs cursor-pointer transition ${checked
                                  ? "bg-[rgba(184,148,78,0.10)] text-[#80642F] font-semibold"
                                  : "hover:bg-[#FAF9FC] text-[#353140]"
                                }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setEditProjectIds((prev) => [...prev, p.id]);
                                  } else {
                                    setEditProjectIds((prev) => prev.filter((id) => id !== p.id));
                                  }
                                }}
                                className="h-3.5 w-3.5 rounded border-gray-300 text-[#B8944E] focus:ring-[#B8944E]"
                              />
                              <span>{p.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-[#252331]">Team Login Password</label>
                        <button
                          type="button"
                          onClick={() => setEditPassword(generateRandomPassword())}
                          className="text-[10px] font-medium text-[#80642F] hover:underline"
                        >
                          Generate new
                        </button>
                      </div>
                      <input
                        type="text"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        className="h-9 w-full rounded-lg border border-[#EBE7F2] bg-white px-3 font-mono text-xs sm:text-sm text-[#252331] outline-none transition focus:border-[#B8944E]"
                        required
                      />
                    </div>
                  </div>
                )}

                {editRole !== "team_user" && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-[#252331]">
                        Map Projects to Freelancer
                      </label>
                      <span className="text-[11px] text-[#706C7D]">
                        {editProjectIds.length} {editProjectIds.length === 1 ? "project" : "projects"} assigned
                      </span>
                    </div>
                    <p className="text-[11px] text-[#9994A5] mb-2">
                      Select workspace projects (including projects created by Super Admin) to map to this freelancer as Project Lead.
                    </p>
                    {projects.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[#EBE7F2] p-4 text-center text-xs text-zinc-400">
                        No projects found in workspace.
                      </div>
                    ) : (
                      <div className="max-h-44 overflow-y-auto rounded-xl border border-[#EBE7F2] bg-white p-2 space-y-1.5">
                        {projects.map((p) => {
                          const checked = editProjectIds.includes(p.id);
                          return (
                            <label
                              key={p.id}
                              className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium cursor-pointer transition ${checked
                                  ? "bg-[rgba(184,148,78,0.10)] text-[#80642F] border border-[rgba(184,148,78,0.22)]"
                                  : "hover:bg-[#FAF9FC] text-[#353140] border border-transparent"
                                }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setEditProjectIds((prev) => [...prev, p.id]);
                                    } else {
                                      setEditProjectIds((prev) => prev.filter((id) => id !== p.id));
                                    }
                                  }}
                                  className="h-4 w-4 rounded border-gray-300 text-[#B8944E] focus:ring-[#B8944E]"
                                />
                                <span className="font-semibold">{p.name}</span>
                              </div>
                              {checked && (
                                <span className="text-[10px] uppercase font-bold tracking-wider text-[#80642F] bg-white/80 px-1.5 py-0.5 rounded border border-[rgba(184,148,78,0.25)]">
                                  Lead
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Team User: Role Switcher & Project Mapping */}
            {editingUser.userType === "team_user" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#252331] mb-1">
                    Role & Account Type
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="h-10 w-full rounded-xl border border-[#EBE7F2] bg-white px-3 text-sm text-[#252331] outline-none transition focus:border-[#B8944E]"
                  >
                    <option value="team_user">Team Member (Project Collaborator)</option>
                    <option value="freelancer">💼 Promote / Switch to: Freelancer</option>
                    <option value="super_admin">👑 Promote / Switch to: Super Admin</option>
                  </select>
                </div>

                {/* If converting to Freelancer or Super Admin */}
                {(editRole === "freelancer" || editRole === "super_admin") ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 space-y-3">
                    <div className="flex items-start gap-2 text-xs text-rose-900">
                      <Briefcase size={16} className="text-rose-700 shrink-0 mt-0.5" />
                      <p>
                        Promoting <strong>{editingUser.name}</strong> to a {editRole === "super_admin" ? "Super Admin" : "Freelancer"} will grant platform dashboard login access (<span className="font-mono">/login</span>) with project management capabilities.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#252331] mb-1">
                        Email Address (Dashboard Login Identity)
                      </label>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder="e.g. user@company.com"
                        className="h-9 w-full rounded-lg border border-[#EBE7F2] bg-white px-3 text-xs sm:text-sm text-[#252331] outline-none transition focus:border-[#B8944E]"
                        required
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-[#252331]">Dashboard Login Password</label>
                        <button
                          type="button"
                          onClick={() => setEditPassword(generateRandomPassword())}
                          className="text-[10px] font-medium text-rose-700 hover:underline"
                        >
                          Generate new
                        </button>
                      </div>
                      <input
                        type="text"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        className="h-9 w-full rounded-lg border border-[#EBE7F2] bg-white px-3 font-mono text-xs sm:text-sm text-[#252331] outline-none transition focus:border-[#B8944E]"
                        required
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-[#252331]">
                          Map Projects as Lead
                        </label>
                        <span className="text-[11px] text-[#706C7D]">
                          {editProjectIds.length} selected
                        </span>
                      </div>
                      <div className="max-h-32 overflow-y-auto rounded-lg border border-[#EBE7F2] bg-white p-2 space-y-1">
                        {projects.map((p) => {
                          const checked = editProjectIds.includes(p.id);
                          return (
                            <label
                              key={p.id}
                              className={`flex items-center justify-between rounded px-2 py-1 text-xs cursor-pointer transition ${checked
                                  ? "bg-[rgba(184,148,78,0.10)] text-[#80642F] font-semibold"
                                  : "hover:bg-[#FAF9FC] text-[#353140]"
                                }`}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setEditProjectIds((prev) => [...prev, p.id]);
                                    } else {
                                      setEditProjectIds((prev) => prev.filter((id) => id !== p.id));
                                    }
                                  }}
                                  className="h-3.5 w-3.5 rounded border-gray-300 text-[#B8944E] focus:ring-[#B8944E]"
                                />
                                <span>{p.name}</span>
                              </div>
                              {checked && (
                                <span className="text-[9px] uppercase font-bold text-[#80642F]">
                                  Lead
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#252331] mb-1">
                        Email Address <span className="text-[#9994A5] font-normal">(Optional)</span>
                      </label>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder="e.g. member@company.com"
                        className="h-10 w-full rounded-xl border border-[#EBE7F2] bg-white px-3 text-sm text-[#252331] outline-none transition focus:border-[#B8944E]"
                      />
                      <p className="text-[11px] text-[#9994A5] mt-1">
                        Used for meeting invitations, task notifications & remuneration allocations.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#252331] mb-1">
                        Assigned Projects
                      </label>
                    <div className="max-h-36 overflow-y-auto rounded-xl border border-[#EBE7F2] bg-white p-2 space-y-1.5">
                      {projects.map((p) => {
                        const checked = editProjectIds.includes(p.id);
                        return (
                          <label
                            key={p.id}
                            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium cursor-pointer transition ${checked
                                ? "bg-[rgba(184,148,78,0.10)] text-[#80642F]"
                                : "hover:bg-[#FAF9FC] text-[#353140]"
                              }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEditProjectIds((prev) => [...prev, p.id]);
                                } else {
                                  setEditProjectIds((prev) => prev.filter((id) => id !== p.id));
                                }
                              }}
                              className="h-4 w-4 rounded border-gray-300 text-[#B8944E] focus:ring-[#B8944E]"
                            />
                            <span>{p.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
            )}

            {/* Client: Project picker */}
            {editingUser.userType === "client" && (
              <div>
                <label className="block text-xs font-semibold text-[#252331] mb-1">
                  Assigned Project
                </label>
                <select
                  value={editProjectIds[0] || ""}
                  onChange={(e) => setEditProjectIds([e.target.value])}
                  className="h-10 w-full rounded-xl border border-[#EBE7F2] bg-white px-3 text-sm text-[#252331] outline-none transition focus:border-[#B8944E]"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Status */}
            <div>
              <label className="block text-xs font-semibold text-[#252331] mb-1">Account Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as any)}
                className="h-10 w-full rounded-xl border border-[#EBE7F2] bg-white px-3 text-sm text-[#252331] outline-none transition focus:border-[#B8944E]"
              >
                <option value="active">Active (Access granted)</option>
                <option value="disabled">Disabled (Access blocked)</option>
              </select>
            </div>

            {editError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-[#C25D72]">
                {editError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" type="button" onClick={() => setEditingUser(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" isLoading={savingEdit}>
                {editingUser.userType !== editRole
                  ? `Convert to ${editRole === "team_user" ? "Team Member" : editRole === "super_admin" ? "Super Admin" : "Freelancer"}`
                  : "Save Changes"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ============================================================== */}
      {/* 4. Reset Password Modal (All User Types)                      */}
      {/* ============================================================== */}
      {resettingUser && (
        <Modal
          isOpen={true}
          onClose={() => setResettingUser(null)}
          title={`Reset Password for ${resettingUser.name}`}
          description={`Set a new secure password for this ${resettingUser.roleDisplay.toLowerCase()}.`}
        >
          {resetSuccessMessage ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs sm:text-sm text-emerald-800">
                <p className="font-semibold">Password updated successfully!</p>
                <div className="mt-2 flex items-center justify-between rounded-lg bg-white p-2.5 border border-emerald-200">
                  <span className="font-mono font-bold text-sm text-[#252331]">
                    {resetSuccessMessage}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={<Copy size={13} />}
                    onClick={() => {
                      navigator.clipboard.writeText(resetSuccessMessage);
                      toast.success("Password copied");
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="primary" onClick={() => setResettingUser(null)}>
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-[#252331]">New Password</label>
                  <button
                    type="button"
                    onClick={() => setNewPassword(generateRandomPassword())}
                    className="text-[11px] font-medium text-[#80642F] hover:underline"
                  >
                    Generate random
                  </button>
                </div>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-10 w-full rounded-xl border border-[#EBE7F2] bg-white px-3 font-mono text-sm text-[#252331] outline-none transition focus:border-[#B8944E]"
                  required
                />
              </div>

              {resetError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-[#C25D72]">
                  {resetError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" type="button" onClick={() => setResettingUser(null)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" isLoading={resetting}>
                  Update Password
                </Button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* ============================================================== */}
      {/* 5. Delete User Confirmation Dialog                            */}
      {/* ============================================================== */}
      {deletingUser && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setDeletingUser(null)}
          onConfirm={confirmDeleteUser}
          title={`Remove ${deletingUser.roleDisplay}?`}
          description={`Are you sure you want to remove ${deletingUser.name} (${deletingUser.email || deletingUser.username || deletingUser.loginId || "account"
            })? They will immediately lose platform access.`}
          confirmLabel="Delete User"
          variant="danger"
          isLoading={deletingLoading}
        />
      )}
    </div>
  );
}

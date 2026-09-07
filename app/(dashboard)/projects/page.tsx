"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Edit3,
  FolderKanban,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { ProjectCardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/lib/toast";

type Project = {
  id: string;
  name: string;
  description?: string;
  status?: string;
  total: number;
  approved: number;
  epics?: number;
  created_at?: string;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Create Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Edit Modal state
  const [editing, setEditing] = useState<Project | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editStatus, setEditStatus] = useState("active");
  const [updating, setUpdating] = useState(false);
  const [editError, setEditError] = useState("");

  // Delete Project Confirmation Dialog State
  const [deletingProject, setDeletingProject] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load projects");
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create project");
      setProjects((v) => [data.project, ...v]);
      setName("");
      setDescription("");
      setCreateModalOpen(false);
      toast.success("Project created successfully");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create project";
      setCreateError(msg);
      toast.error("Unable to create project");
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
      const res = await fetch(`/api/projects/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDesc.trim(),
          status: editStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update project");
      setProjects((v) =>
        v.map((p) => (p.id === editing.id ? { ...p, ...data.project } : p))
      );
      setEditing(null);
      toast.success("Project updated successfully");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update project";
      setEditError(msg);
      toast.error("Unable to update project");
    } finally {
      setUpdating(false);
    }
  }

  function handleRemove(id: string, projectName: string) {
    setDeletingProject({ id, name: projectName });
  }

  async function confirmDeleteProject() {
    if (!deletingProject) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${deletingProject.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete project");
      setProjects((v) => v.filter((p) => p.id !== deletingProject.id));
      toast.success("Project deleted");
      setDeletingProject(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete project";
      setError(msg);
      toast.error("Unable to delete project");
    } finally {
      setDeleting(false);
    }
  }

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus =
        statusFilter === "all" || (p.status || "active").toLowerCase() === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, statusFilter]);

  return (
    <div>
      <DashboardHeader
        eyebrow="PROJECTS"
        title="Projects"
        description="Organize requirements by client or initiative."
        actions={
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus size={15} />}
            onClick={() => {
              setName("");
              setDescription("");
              setCreateError("");
              setCreateModalOpen(true);
            }}
          >
            New project
          </Button>
        }
      />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-6">
        {/* Search and Filters Bar */}
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
              placeholder="Search projects..."
              className="h-9 w-full rounded-xl border border-[rgba(74,61,100,0.11)] bg-white/85 pl-9 pr-3.5 text-xs sm:text-sm text-[#252331] placeholder-[#9994A5] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)]"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-xl border border-[rgba(74,61,100,0.11)] bg-white/85 px-3 text-xs sm:text-sm font-medium text-[#252331] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)] cursor-pointer"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200/80 bg-rose-50/80 p-4 text-xs sm:text-sm text-[#C25D72]">
            {error}
          </div>
        )}

        {/* Project Cards Grid */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ProjectCardSkeleton />
            <ProjectCardSkeleton />
            <ProjectCardSkeleton />
          </div>
        ) : filteredProjects.length === 0 ? (
          projects.length === 0 ? (
            <EmptyState
              icon={FolderKanban}
              title="No projects yet"
              description="Create your first project to start organizing client requirements into feature stories and acceptance criteria."
              action={
                <Button
                  variant="primary"
                  leftIcon={<Plus size={15} />}
                  onClick={() => setCreateModalOpen(true)}
                >
                  Create project
                </Button>
              }
            />
          ) : (
            <div className="rounded-[18px] border border-dashed border-[rgba(74,61,100,0.14)] bg-white/50 p-8 text-center">
              <p className="text-sm font-medium text-[#252331]">No projects found</p>
              <p className="mt-1 text-xs text-[#9994A5]">
                Try searching with a different term or reset the status filter.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
              >
                Reset filters
              </Button>
            </div>
          )
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => {
              const progress = project.total
                ? Math.round((project.approved / project.total) * 100)
                : 0;
              const statusRaw = (project.status || "active").toLowerCase();
              const badgeVariant =
                statusRaw === "completed"
                  ? "completed"
                  : statusRaw === "archived"
                  ? "neutral"
                  : "approved";

              return (
                <div
                  key={project.id}
                  className="group relative flex flex-col justify-between rounded-[18px] border border-[rgba(74,61,100,0.08)] bg-white/82 p-5 shadow-[0_8px_30px_rgba(70,55,95,0.055)] backdrop-blur-[16px] transition-all hover:border-[rgba(74,61,100,0.16)] hover:shadow-[0_12px_35px_rgba(70,55,95,0.08)]"
                >
                  <div>
                    {/* Top Row: Title, Status Badge, & Menu */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#FAF9FC] border border-[rgba(184,148,78,0.16)] text-xs font-semibold text-[#80642F]">
                          {project.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/project/${project.id}`}
                            className="block text-base font-semibold tracking-tight text-[#252331] group-hover:text-[#80642F] transition truncate"
                          >
                            {project.name}
                          </Link>
                          <div className="mt-1">
                            <Badge
                              variant={badgeVariant}
                              size="sm"
                              showIcon={false}
                            >
                              {project.status || "Active"}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center shrink-0">
                        <DropdownMenu
                          ariaLabel={`Options for ${project.name}`}
                          items={[
                            {
                              label: "Edit details",
                              icon: <Edit3 size={14} />,
                              onClick: () => {
                                setEditing(project);
                                setEditName(project.name);
                                setEditDesc(project.description || "");
                                setEditStatus(project.status || "active");
                                setEditError("");
                              },
                            },
                            {
                              label: "Delete project",
                              icon: <Trash2 size={14} />,
                              variant: "danger",
                              onClick: () => handleRemove(project.id, project.name),
                            },
                          ]}
                        />
                      </div>
                    </div>

                    {/* Description */}
                    <p className="mt-3 text-xs sm:text-sm text-[#706C7D] line-clamp-2 leading-relaxed min-h-[2.5rem]">
                      {project.description || "No project description provided."}
                    </p>

                    {/* Stats Hierarchy */}
                    <div className="mt-4 flex items-center gap-3 text-xs text-[#706C7D] font-medium">
                      <span>{project.epics || 0} Epics</span>
                      <span className="text-[rgba(74,61,100,0.2)]">•</span>
                      <span>{project.total || 0} Stories</span>
                      <span className="text-[rgba(74,61,100,0.2)]">•</span>
                      <span className="text-[#2E8B70] font-semibold">
                        {project.approved || 0} Approved
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[rgba(74,61,100,0.06)]">
                      <div
                        className="h-full rounded-full bg-[#B8944E] transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="mt-4 pt-3 border-t border-[rgba(74,61,100,0.06)] flex items-center justify-between text-xs text-[#706C7D]">
                    <span>{progress}% reviewed</span>
                    <Link
                      href={`/project/${project.id}`}
                      className="inline-flex items-center gap-1 font-medium text-[#252331] group-hover:text-[#80642F] transition"
                    >
                      <span>Open</span>
                      <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Create Project Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create new project"
        description="Add a workspace to turn requirements into structured, approved stories."
        footer={
          <>
            <Button
              variant="outline"
              type="button"
              onClick={() => setCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="create-project-form"
              isLoading={creating}
              disabled={!name.trim()}
            >
              Create project
            </Button>
          </>
        }
      >
        <form id="create-project-form" onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
              Project Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. OfferNearU, Customer Portal"
              className="h-10 w-full rounded-xl border border-[rgba(74,61,100,0.11)] bg-white px-3.5 text-sm text-[#252331] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#706C7D] mb-1.5">
              Short Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the product or initiative..."
              className="w-full rounded-xl border border-[rgba(74,61,100,0.11)] bg-white p-3 text-sm text-[#252331] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)] resize-none"
            />
          </div>

          {createError && (
            <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg">
              {createError}
            </p>
          )}
        </form>
      </Modal>

      {/* Edit Project Modal */}
      <Modal
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit project"
        description="Update project details or manage status."
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
              form="edit-project-form"
              isLoading={updating}
              disabled={!editName.trim()}
            >
              Save changes
            </Button>
          </>
        }
      >
        <form id="edit-project-form" onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#706C7D] mb-1.5">
              Project Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-10 w-full rounded-xl border border-[rgba(74,61,100,0.11)] bg-white px-3.5 text-sm text-[#252331] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#706C7D] mb-1.5">
              Description
            </label>
            <textarea
              rows={3}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="w-full rounded-xl border border-[rgba(74,61,100,0.11)] bg-white p-3 text-sm text-[#252331] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)] resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#706C7D] mb-1.5">
              Status
            </label>
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
              className="h-10 w-full rounded-xl border border-[rgba(74,61,100,0.11)] bg-white px-3 text-sm text-[#252331] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)] cursor-pointer"
            >
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {editError && (
            <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg">
              {editError}
            </p>
          )}
        </form>
      </Modal>

      {/* Delete Project Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingProject)}
        onClose={() => setDeletingProject(null)}
        onConfirm={confirmDeleteProject}
        title="Delete project"
        description={`Are you sure you want to delete "${deletingProject?.name}"? This action cannot be undone and will permanently remove associated epics, stories, and client access.`}
        confirmLabel="Delete project"
        variant="danger"
        isLoading={deleting}
      />
    </div>
  );
}

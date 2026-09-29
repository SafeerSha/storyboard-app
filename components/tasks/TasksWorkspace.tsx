"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  CheckSquare,
  Filter,
  Plus,
  Search,
  LayoutGrid,
  List,
  Sparkles,
  BookOpen,
  User,
  AlertCircle,
  FolderKanban,
  CheckCircle2,
  Clock,
  Layers,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { TaskKanbanBoard } from "./TaskKanbanBoard";
import { TaskTableView } from "./TaskTableView";
import { TaskModal } from "./TaskModal";
import { TaskDetailDrawer } from "./TaskDetailDrawer";
import { toast } from "@/lib/toast";
import type { Task, TaskPriority, TaskStatus } from "@/lib/types/task";

interface ProjectOption {
  id: string;
  name: string;
}

interface TasksWorkspaceProps {
  initialTasks?: Task[];
  initialProjects?: ProjectOption[];
  fixedProjectId?: string; // If set, locks the workspace to this project (e.g. inside project page)
  fixedProjectName?: string;
  defaultStoryId?: string;
}

export function TasksWorkspace({
  initialTasks = [],
  initialProjects = [],
  fixedProjectId,
  fixedProjectName,
  defaultStoryId,
}: TasksWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [projects, setProjects] = useState<ProjectOption[]>(initialProjects);
  const [loading, setLoading] = useState(initialTasks.length === 0);

  // Filters
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    fixedProjectId || searchParams.get("projectId") || "all"
  );
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get("status") || "all"
  );
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [storyFilter, setStoryFilter] = useState<"all" | "linked" | "standalone">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");

  // Modals & Drawers
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [createDefaultStatus, setCreateDefaultStatus] = useState<TaskStatus>("todo");
  const [createDefaultStoryId, setCreateDefaultStoryId] = useState<string | undefined>(defaultStoryId);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    searchParams.get("taskId") || null
  );

  // Load projects if not passed
  useEffect(() => {
    if (projects.length === 0 && !fixedProjectId) {
      fetch("/api/projects")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data?.projects)) {
            setProjects(data.projects.map((p: any) => ({ id: p.id, name: p.name })));
          }
        })
        .catch(() => {});
    }
  }, [projects.length, fixedProjectId]);

  // Fetch tasks
  const fetchTasks = async () => {
    setLoading(true);
    try {
      const pId = fixedProjectId || (selectedProjectId !== "all" ? selectedProjectId : "");
      const params = new URLSearchParams();
      if (pId) params.set("projectId", pId);
      if (defaultStoryId) params.set("storyId", defaultStoryId);

      const res = await fetch(`/api/tasks?${params.toString()}`);
      const data = await res.json();
      if (data.tasks) {
        setTasks(data.tasks);
      }
    } catch (err) {
      console.error("Failed to load tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [selectedProjectId, fixedProjectId, defaultStoryId]);

  // Handle URL params for opening task modal or drawer
  useEffect(() => {
    const urlTaskId = searchParams.get("taskId");
    if (urlTaskId) {
      setSelectedTaskId(urlTaskId);
    }
    const create = searchParams.get("create");
    if (create === "true") {
      setIsModalOpen(true);
      const urlStoryId = searchParams.get("storyId");
      if (urlStoryId) {
        setCreateDefaultStoryId(urlStoryId);
      }
    }
  }, [searchParams]);

  // Filter tasks locally
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Project filter
      if (fixedProjectId && task.project_id !== fixedProjectId) return false;
      if (!fixedProjectId && selectedProjectId !== "all" && task.project_id !== selectedProjectId) {
        return false;
      }
      // Status filter
      if (statusFilter !== "all" && task.status !== statusFilter) return false;
      // Priority filter
      if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
      // Category / Domain filter
      if (categoryFilter !== "all" && task.category !== categoryFilter) return false;
      // Story link filter
      if (storyFilter === "linked" && !task.story_id) return false;
      if (storyFilter === "standalone" && task.story_id) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesDesc = task.description?.toLowerCase().includes(q);
        const matchesAssignee = task.assignee_name?.toLowerCase().includes(q);
        const matchesAssignees = task.assignees?.some((a) => a.name.toLowerCase().includes(q));
        const matchesStory = task.story?.title?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesAssignee && !matchesAssignees && !matchesStory) {
          return false;
        }
      }
      return true;
    });
  }, [tasks, fixedProjectId, selectedProjectId, statusFilter, priorityFilter, categoryFilter, storyFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = tasks.length;
    const todo = tasks.filter((t) => t.status === "todo").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const inReview = tasks.filter((t) => t.status === "in_review").length;
    const done = tasks.filter((t) => t.status === "done").length;
    return { total, todo, inProgress, inReview, done };
  }, [tasks]);

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      );
      toast.success(`Task moved to ${newStatus.replace("_", " ").toUpperCase()}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const handleTaskSaved = (savedTask: Task) => {
    setTasks((prev) => {
      const exists = prev.some((t) => t.id === savedTask.id);
      if (exists) {
        return prev.map((t) => (t.id === savedTask.id ? savedTask : t));
      }
      return [savedTask, ...prev];
    });
  };

  const handleBatchTasksSaved = (newTasks: Task[]) => {
    setTasks((prev) => [...newTasks, ...prev]);
  };

  const handleTaskDeleted = (deletedTaskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== deletedTaskId));
  };

  return (
    <div className="w-full space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-2xl border border-[rgba(74,61,100,0.08)] bg-white p-3.5 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#9994A5]">
            Total Tasks
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#252331]">{stats.total}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-[rgba(74,61,100,0.08)] bg-white p-3.5 shadow-xs">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            To Do
          </div>
          <div className="mt-1">
            <span className="text-2xl font-black text-slate-700">{stats.todo}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-[rgba(74,61,100,0.08)] bg-white p-3.5 shadow-xs">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#80642F]">
            <span className="h-2 w-2 rounded-full bg-[#B8944E]" />
            In Progress
          </div>
          <div className="mt-1">
            <span className="text-2xl font-black text-[#80642F]">{stats.inProgress}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-[rgba(74,61,100,0.08)] bg-white p-3.5 shadow-xs">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-purple-600">
            <span className="h-2 w-2 rounded-full bg-purple-500" />
            In Review
          </div>
          <div className="mt-1">
            <span className="text-2xl font-black text-purple-700">{stats.inReview}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-[rgba(74,61,100,0.08)] bg-white p-3.5 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Completed
          </div>
          <div className="mt-1">
            <span className="text-2xl font-black text-emerald-700">{stats.done}</span>
          </div>
        </div>
      </div>

      {/* Filter & Action Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[rgba(74,61,100,0.08)] bg-white p-4 shadow-xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px]">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9994A5]"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks, descriptions, stories, or assignees..."
              className="w-full rounded-xl border border-[rgba(74,61,100,0.12)] bg-[#FAF9FC] pl-10 pr-4 py-2 text-xs text-[#252331] focus:border-[#B8944E] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#B8944E]/20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Quick Selectors & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            {/* Filter Dropdowns Grid on mobile, flex row on sm+ */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
              {/* Project Filter (if not locked to single project) */}
              {!fixedProjectId && (
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full sm:w-auto rounded-xl border border-[rgba(74,61,100,0.12)] bg-white px-2.5 py-2 text-xs font-semibold text-[#252331] focus:border-[#B8944E] focus:outline-none truncate"
                >
                  <option value="all">All Projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-auto rounded-xl border border-[rgba(74,61,100,0.12)] bg-white px-2.5 py-2 text-xs font-semibold text-[#252331] focus:border-[#B8944E] focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="in_review">In Review</option>
                <option value="done">Completed</option>
              </select>

              {/* Domain / Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full sm:w-auto rounded-xl border border-[rgba(74,61,100,0.12)] bg-white px-2.5 py-2 text-xs font-semibold text-[#252331] focus:border-[#B8944E] focus:outline-none"
              >
                <option value="all">All Domains</option>
                <option value="frontend">🎨 Frontend</option>
                <option value="backend">⚡ Backend</option>
                <option value="fullstack">🌐 Full Stack</option>
                <option value="test">🧪 Test / QA</option>
              </select>

              {/* Priority Filter */}
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full sm:w-auto rounded-xl border border-[rgba(74,61,100,0.12)] bg-white px-2.5 py-2 text-xs font-semibold text-[#252331] focus:border-[#B8944E] focus:outline-none"
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>

              {/* Story Link Filter */}
              <select
                value={storyFilter}
                onChange={(e) => setStoryFilter(e.target.value as any)}
                className="w-full sm:w-auto col-span-2 sm:col-span-1 rounded-xl border border-[rgba(74,61,100,0.12)] bg-white px-2.5 py-2 text-xs font-semibold text-[#252331] focus:border-[#B8944E] focus:outline-none"
              >
                <option value="all">All Tasks</option>
                <option value="linked">Linked to Story</option>
                <option value="standalone">Standalone Tasks</option>
              </select>
            </div>

            {/* View Mode Toggle + Create Task Button */}
            <div className="flex items-center justify-between sm:justify-start gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-[rgba(74,61,100,0.06)]">
              {/* View Mode Toggle: Kanban vs Table */}
              <div className="flex items-center rounded-xl border border-[rgba(74,61,100,0.12)] bg-[#FAF9FC] p-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode("kanban")}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all ${
                    viewMode === "kanban"
                      ? "bg-white text-[#80642F] shadow-xs border border-[rgba(184,148,78,0.2)]"
                      : "text-[#706C7D] hover:text-[#252331]"
                  }`}
                  title="Kanban Board View"
                >
                  <LayoutGrid size={14} />
                  <span>Board</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all ${
                    viewMode === "table"
                      ? "bg-white text-[#80642F] shadow-xs border border-[rgba(184,148,78,0.2)]"
                      : "text-[#706C7D] hover:text-[#252331]"
                  }`}
                  title="Table List View"
                >
                  <List size={14} />
                  <span>List</span>
                </button>
              </div>

              {/* Create Task Button */}
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setEditingTask(null);
                  setCreateDefaultStatus("todo");
                  setCreateDefaultStoryId(defaultStoryId);
                  setIsModalOpen(true);
                }}
                leftIcon={<Plus size={15} />}
                className="flex-1 sm:flex-initial h-9 justify-center"
              >
                New Task
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main View Area */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-[#9994A5]">
          <div className="h-7 w-7 rounded-full border-2 border-[#B8944E] border-t-transparent animate-spin mb-3" />
          <p className="text-xs font-semibold">Loading tasks...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[rgba(74,61,100,0.15)] bg-white/70 p-12 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-[rgba(184,148,78,0.1)] text-[#B8944E]">
            <CheckSquare size={24} />
          </div>
          <h3 className="text-base font-bold text-[#252331]">No tasks found</h3>
          <p className="mt-1 text-xs text-[#706C7D] max-w-sm mx-auto">
            {searchQuery || statusFilter !== "all" || priorityFilter !== "all"
              ? "Try adjusting your filters or search terms."
              : "Get started by creating your first to-do task, assigning team members or clients, and linking stories."}
          </p>
          <div className="mt-4">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditingTask(null);
                setCreateDefaultStatus("todo");
                setCreateDefaultStoryId(defaultStoryId);
                setIsModalOpen(true);
              }}
              leftIcon={<Plus size={14} />}
            >
              Create Task
            </Button>
          </div>
        </div>
      ) : viewMode === "kanban" ? (
        <TaskKanbanBoard
          tasks={filteredTasks}
          showProject={!fixedProjectId && selectedProjectId === "all"}
          onTaskClick={(t) => setSelectedTaskId(t.id)}
          onStatusChange={handleStatusChange}
          onCreateInStatus={(st) => {
            setEditingTask(null);
            setCreateDefaultStatus(st);
            setCreateDefaultStoryId(defaultStoryId);
            setIsModalOpen(true);
          }}
        />
      ) : (
        <TaskTableView
          tasks={filteredTasks}
          showProject={!fixedProjectId && selectedProjectId === "all"}
          onTaskClick={(t) => setSelectedTaskId(t.id)}
          onStatusChange={handleStatusChange}
          onEdit={(t) => {
            setEditingTask(t);
            setIsModalOpen(true);
          }}
          onDelete={(id) => handleTaskDeleted(id)}
        />
      )}

      {/* Task Creation & Edit Modal */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTask(null);
        }}
        onSaved={handleTaskSaved}
        onBatchSaved={handleBatchTasksSaved}
        task={editingTask}
        defaultProjectId={fixedProjectId || (selectedProjectId !== "all" ? selectedProjectId : undefined)}
        defaultStoryId={createDefaultStoryId}
        defaultStatus={createDefaultStatus}
        projects={projects}
      />

      {/* Task Detail Drawer */}
      <TaskDetailDrawer
        taskId={selectedTaskId}
        isOpen={Boolean(selectedTaskId)}
        onClose={() => setSelectedTaskId(null)}
        onTaskUpdated={handleTaskSaved}
        onTaskDeleted={handleTaskDeleted}
        onEditRequest={(t) => {
          setSelectedTaskId(null);
          setEditingTask(t);
          setIsModalOpen(true);
        }}
      />
    </div>
  );
}

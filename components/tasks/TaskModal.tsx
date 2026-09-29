"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Layers,
  Bot,
  Check,
  CheckSquare,
  Square,
  Calendar,
  Bell,
  Wand2,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Clock,
  User,
  ArrowRight,
  Monitor,
  Server,
  FlaskConical,
  X,
  Search,
  Plus,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { toast } from "@/lib/toast";
import type {
  Task,
  TaskStatus,
  TaskPriority,
  TaskCategory,
  TaskAssigneeOption,
} from "@/lib/types/task";
import { getTaskCategoryBadge } from "@/lib/types/task";

interface ProjectOption {
  id: string;
  name: string;
}

interface StoryOption {
  id: string;
  title: string;
  status?: string;
}

interface BreakdownTaskItem {
  title: string;
  description: string;
  priority: TaskPriority;
  category?: TaskCategory | null;
  due_date: string;
  assignee_id: string | null;
  assignee?: { id: string; name: string; role?: string; type: string } | null;
  selected?: boolean;
}

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (task: Task) => void;
  onBatchSaved?: (tasks: Task[]) => void;
  task?: Task | null; // If editing
  defaultProjectId?: string;
  defaultStoryId?: string;
  defaultStatus?: TaskStatus;
  projects?: ProjectOption[];
}

export function TaskModal({
  isOpen,
  onClose,
  onSaved,
  onBatchSaved,
  task,
  defaultProjectId,
  defaultStoryId,
  defaultStatus = "todo",
  projects = [],
}: TaskModalProps) {
  const isEditing = Boolean(task?.id);

  const [projectId, setProjectId] = useState<string>(
    task?.project_id || defaultProjectId || (projects[0]?.id ?? "")
  );
  const [storyId, setStoryId] = useState<string>(task?.story_id || defaultStoryId || "");
  const [title, setTitle] = useState<string>(task?.title || "");
  const [description, setDescription] = useState<string>(task?.description || "");
  const [status, setStatus] = useState<TaskStatus>(task?.status || defaultStatus);
  const [priority, setPriority] = useState<TaskPriority>(task?.priority || "medium");
  const [category, setCategory] = useState<TaskCategory | null>(task?.category || null);
  const [dueDate, setDueDate] = useState<string>(task?.due_date || "");

  // Multi-assignees state
  const [selectedAssignees, setSelectedAssignees] = useState<TaskAssigneeOption[]>([]);
  const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const assigneeDropdownRef = useRef<HTMLDivElement>(null);

  // Dynamic project data
  const [assigneeOptions, setAssigneeOptions] = useState<TaskAssigneeOption[]>([]);
  const [storyOptions, setStoryOptions] = useState<StoryOption[]>([]);
  const [loadingAssignees, setLoadingAssignees] = useState(false);
  const [loadingStories, setLoadingStories] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // AI facility state
  const [aiPrompt, setAiPrompt] = useState<string>("");
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiMode, setAiMode] = useState<"single" | "breakdown" | "polish_desc" | null>(null);
  const [breakdownTasks, setBreakdownTasks] = useState<BreakdownTaskItem[]>([]);
  const [batchSubmitting, setBatchSubmitting] = useState<boolean>(false);
  const [aiHighlight, setAiHighlight] = useState<boolean>(false);
  const [showAiPanel, setShowAiPanel] = useState<boolean>(true);

  // Sync state when task or default props change
  useEffect(() => {
    if (task) {
      setProjectId(task.project_id);
      setStoryId(task.story_id || "");
      setTitle(task.title);
      setDescription(task.description || "");
      setStatus(task.status);
      setPriority(task.priority);
      setCategory(task.category || null);
      setDueDate(task.due_date || "");

      // Resolve initial assignees
      if (Array.isArray(task.assignees) && task.assignees.length > 0) {
        setSelectedAssignees(task.assignees as TaskAssigneeOption[]);
      } else if (task.assignee_id) {
        setSelectedAssignees([
          {
            id: task.assignee_id,
            name: task.assignee_name || "Assignee",
            type: task.assignee_type || "freelancer",
            email: task.assignee_email || null,
          },
        ]);
      } else {
        setSelectedAssignees([]);
      }

      setBreakdownTasks([]);
      setAiPrompt("");
    } else {
      setProjectId(defaultProjectId || (projects[0]?.id ?? ""));
      setStoryId(defaultStoryId || "");
      setTitle("");
      setDescription("");
      setStatus(defaultStatus);
      setPriority("medium");
      setCategory(null);
      setDueDate("");
      setSelectedAssignees([]);
      setBreakdownTasks([]);
      setAiPrompt("");
    }
  }, [task, defaultProjectId, defaultStoryId, defaultStatus, isOpen]);

  // Fetch assignees and stories when projectId changes
  useEffect(() => {
    if (!projectId) return;

    // Fetch assignees (members + clients)
    setLoadingAssignees(true);
    fetch(`/api/projects/${projectId}/assignees`)
      .then((res) => res.json())
      .then((data) => {
        setAssigneeOptions(data.assignees || []);
      })
      .catch((err) => {
        console.error("Failed to load assignees:", err);
      })
      .finally(() => setLoadingAssignees(false));

    // Fetch stories for linking
    setLoadingStories(true);
    fetch(`/api/projects/${projectId}/stories/options`)
      .then((res) => res.json())
      .then((data) => {
        setStoryOptions(data.stories || []);
      })
      .catch((err) => {
        console.error("Failed to load stories:", err);
      })
      .finally(() => setLoadingStories(false));
  }, [projectId]);

  // Close assignee dropdown on outside click or mobile touch
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (
        assigneeDropdownRef.current &&
        !assigneeDropdownRef.current.contains(event.target as Node)
      ) {
        setIsAssigneeDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  // Multi-Assignee handlers
  const toggleAssignee = (opt: TaskAssigneeOption) => {
    setSelectedAssignees((prev) => {
      const exists = prev.some((a) => a.id === opt.id);
      if (exists) {
        return prev.filter((a) => a.id !== opt.id);
      } else {
        return [...prev, opt];
      }
    });
  };

  const removeAssignee = (id: string) => {
    setSelectedAssignees((prev) => prev.filter((a) => a.id !== id));
  };

  const selectAllTeam = () => {
    const teamMembers = assigneeOptions.filter((a) => a.type === "team_user" || a.type === "freelancer");
    setSelectedAssignees((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      const newlyAdded = teamMembers.filter((m) => !existingIds.has(m.id));
      return [...prev, ...newlyAdded];
    });
  };

  const clearAllAssignees = () => {
    setSelectedAssignees([]);
  };

  // Trigger AI Auto-fill for single task
  const handleAiGenerateSingle = async (customPrompt?: string) => {
    if (!projectId) {
      toast.error("Please select a project first");
      return;
    }

    setAiLoading(true);
    setAiMode("single");

    try {
      const promptToUse = customPrompt || aiPrompt || title;

      const res = await fetch("/api/tasks/ai-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          storyId: storyId || undefined,
          prompt: promptToUse,
          category: category || undefined,
          mode: "single",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate task with AI");
      }

      if (data.title) setTitle(data.title);
      if (data.description) setDescription(data.description);
      if (data.priority) setPriority(data.priority);
      if (data.category) setCategory(data.category);
      if (data.due_date) setDueDate(data.due_date);
      if (data.suggestedStoryId && !storyId) setStoryId(data.suggestedStoryId);

      // Auto-assign if match found and not already assigned
      if (data.suggestedAssigneeId) {
        const match = assigneeOptions.find((a) => a.id === data.suggestedAssigneeId);
        if (match) {
          setSelectedAssignees((prev) => {
            if (prev.some((a) => a.id === match.id)) return prev;
            return [...prev, match];
          });
        }
      }

      setAiHighlight(true);
      setTimeout(() => setAiHighlight(false), 2200);

      toast.success("✨ Task details auto-filled by AI! Review and tweak if needed.");
    } catch (err: any) {
      toast.error(err.message || "Failed to auto-fill task");
    } finally {
      setAiLoading(false);
      setAiMode(null);
    }
  };

  // Trigger AI Story Breakdown into Subtasks
  const handleAiBreakdown = async () => {
    if (!projectId) {
      toast.error("Please select a project first");
      return;
    }

    setAiLoading(true);
    setAiMode("breakdown");

    try {
      const res = await fetch("/api/tasks/ai-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          storyId: storyId || undefined,
          prompt: aiPrompt || "Breakdown into modular subtasks",
          category: category || undefined,
          mode: "breakdown",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to breakdown story");
      }

      const tasks: BreakdownTaskItem[] = (data.tasks || []).map((t: any) => ({
        ...t,
        selected: true,
      }));

      if (tasks.length === 0) {
        toast.info("No subtasks generated. Try with a more specific prompt.");
      } else {
        setBreakdownTasks(tasks);
        toast.success(`⚡ Generated ${tasks.length} subtasks! You can create all at once below.`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to breakdown story");
    } finally {
      setAiLoading(false);
      setAiMode(null);
    }
  };

  // Polish existing description into a checklist
  const handleAiPolishDescription = async () => {
    if (!description.trim()) {
      toast.error("Please enter a rough description to polish");
      return;
    }
    if (!projectId) {
      toast.error("Please select a project first");
      return;
    }

    setAiLoading(true);
    setAiMode("polish_desc");

    try {
      const res = await fetch("/api/tasks/ai-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          storyId: storyId || undefined,
          title,
          prompt: description,
          mode: "polish_desc",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to polish description");
      }

      if (data.description) {
        setDescription(data.description);
        setAiHighlight(true);
        setTimeout(() => setAiHighlight(false), 2000);
        toast.success("✨ Description enhanced into an action checklist!");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to format description");
    } finally {
      setAiLoading(false);
      setAiMode(null);
    }
  };

  // Toggle subtask selection in breakdown
  const toggleSubtaskSelected = (index: number) => {
    setBreakdownTasks((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, selected: !item.selected } : item))
    );
  };

  // Create all selected subtasks from breakdown
  const handleCreateBatchTasks = async () => {
    const selected = breakdownTasks.filter((t) => t.selected);
    if (selected.length === 0) {
      toast.error("Please select at least one task to create");
      return;
    }

    setBatchSubmitting(true);
    try {
      const payloadTasks = selected.map((t) => {
        const matched = assigneeOptions.find((a) => a.id === t.assignee_id);
        const taskAssignees = matched ? [matched] : t.assignee ? [t.assignee] : [];

        return {
          story_id: storyId || null,
          title: t.title,
          description: t.description,
          status: "todo" as TaskStatus,
          priority: t.priority,
          category: t.category || category || null,
          due_date: t.due_date || null,
          assignee_id: t.assignee_id || null,
          assignee_type: matched?.type || null,
          assignee_name: matched?.name || t.assignee?.name || null,
          assignee_email: matched?.email || null,
          assignees: taskAssignees,
        };
      });

      const res = await fetch("/api/tasks/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          story_id: storyId || null,
          tasks: payloadTasks,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create batch tasks");
      }

      const created: Task[] = data.tasks || [];
      toast.success(`⚡ Successfully created ${created.length} tasks!`);

      if (onBatchSaved) {
        onBatchSaved(created);
      } else if (created.length > 0) {
        created.forEach((t) => onSaved(t));
      }

      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to create subtasks");
    } finally {
      setBatchSubmitting(false);
    }
  };

  // Submit single task form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a task title");
      return;
    }
    if (!projectId) {
      toast.error("Please select a project");
      return;
    }

    setSubmitting(true);
    try {
      const primary = selectedAssignees[0] || null;

      const payload = {
        project_id: projectId,
        story_id: storyId || null,
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        category: category || null,
        due_date: dueDate || null,
        assignee_id: primary?.id || null,
        assignee_type: primary?.type || null,
        assignee_name: primary?.name || null,
        assignee_email: primary?.email || null,
        assignees: selectedAssignees,
      };

      const url = isEditing ? `/api/tasks/${task!.id}` : "/api/tasks";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save task");
      }

      toast.success(
        isEditing
          ? "Task updated successfully"
          : selectedAssignees.length > 0
          ? `Task created & ${selectedAssignees.length} member(s) notified!`
          : "Task created successfully"
      );
      onSaved(data.task);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedStory = storyOptions.find((s) => s.id === storyId);

  // Filter assignees in search
  const filteredAssignees = assigneeOptions.filter((a) => {
    if (!assigneeSearch.trim()) return true;
    const q = assigneeSearch.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      a.role?.toLowerCase().includes(q) ||
      a.email?.toLowerCase().includes(q)
    );
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Task" : "Create New Task"}
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Project Selector (if multiple projects and not fixed) */}
        {projects.length > 1 && !defaultProjectId && (
          <div>
            <label className="block text-xs font-semibold text-[#252331] uppercase tracking-wider mb-1.5">
              Project <span className="text-rose-500">*</span>
            </label>
            <select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setStoryId("");
                setBreakdownTasks([]);
                setSelectedAssignees([]);
              }}
              disabled={isEditing}
              className="w-full rounded-xl border border-[rgba(74,61,100,0.12)] bg-white px-3.5 py-2.5 text-sm text-[#252331] focus:border-[#B8944E] focus:outline-none focus:ring-2 focus:ring-[#B8944E]/20"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ========================================================= */}
        {/* 🌟 AI TASK ASSISTANT (Saves user from filling manually)   */}
        {/* ========================================================= */}
        <div className="rounded-2xl border border-[#B8944E]/30 bg-gradient-to-br from-[#80642F]/[0.08] via-amber-500/[0.04] to-purple-500/[0.03] p-4 shadow-xs relative overflow-hidden transition-all">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-[#80642F] to-[#B8944E] flex items-center justify-center text-white shadow-xs">
                {aiLoading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Sparkles size={15} className="animate-pulse" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-[#252331]">AI Task Auto-Fill</h4>
                  <span className="text-[10px] font-semibold bg-[#B8944E]/20 text-[#80642F] px-1.5 py-0.5 rounded-full border border-[#B8944E]/30">
                    Gemini AI
                  </span>
                </div>
                <p className="text-[11px] text-[#716B7E]">
                  Save manual work: auto-generates title, checklist, priority, due date & assignees.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAiPanel(!showAiPanel)}
              className="text-[#9994A5] hover:text-[#252331] p-1 rounded-lg hover:bg-black/5 transition"
              title={showAiPanel ? "Hide AI Panel" : "Show AI Panel"}
            >
              {showAiPanel ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          {showAiPanel && (
            <div className="space-y-3 pt-1">
              {/* If Story Linked: 1-Click Story Auto-Fill Banner */}
              {storyId && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-white/90 border border-[#B8944E]/20 rounded-xl p-2.5 text-xs shadow-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-[#B8944E]/15 text-[#80642F]">
                      ✨
                    </span>
                    <span className="text-[#252331] font-medium truncate">
                      Story:{" "}
                      <strong className="text-[#80642F]">
                        {selectedStory?.title || "Linked Story"}
                      </strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 sm:flex sm:items-center sm:gap-1.5 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      onClick={() => handleAiGenerateSingle()}
                      isLoading={aiLoading && aiMode === "single"}
                      className="h-8 px-2.5 text-xs bg-gradient-to-r from-[#80642F] to-[#B8944E] hover:from-[#6b5327] hover:to-[#a07f3f] text-white shadow-xs rounded-lg font-medium justify-center"
                    >
                      <Sparkles size={12} className="mr-1 shrink-0" />
                      <span className="truncate">Auto-Fill</span>
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleAiBreakdown()}
                      isLoading={aiLoading && aiMode === "breakdown"}
                      className="h-8 px-2.5 text-xs text-[#80642F] border-[#B8944E]/30 hover:bg-[#80642F]/10 rounded-lg font-medium justify-center"
                    >
                      <Layers size={12} className="mr-1 shrink-0" />
                      <span className="truncate">Subtasks</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* Natural Language Prompt Bar */}
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Bot size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9994A5]" />
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAiGenerateSingle();
                      }
                    }}
                    placeholder={
                      storyId
                        ? "Optional: specific instruction (e.g. 'Build UI component only')..."
                        : "Describe what needs to be done (e.g. 'Create login page with validation by Friday')..."
                    }
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-[rgba(74,61,100,0.15)] bg-white/95 text-[#252331] placeholder:text-[#9994A5] focus:outline-none focus:ring-1 focus:ring-[#B8944E] focus:border-[#B8944E]"
                    disabled={aiLoading}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={() => handleAiGenerateSingle()}
                  isLoading={aiLoading && aiMode === "single"}
                  className="h-8 px-3 text-xs bg-[#80642F] hover:bg-[#6b5327] text-white shadow-xs shrink-0 rounded-xl font-medium"
                >
                  <Wand2 size={12} className="mr-1" />
                  Auto-Fill
                </Button>
              </div>

              {/* Quick Preset Pills */}
              <div className="flex flex-wrap items-center gap-1 text-[11px] text-[#716B7E]">
                <span className="text-[10px] uppercase font-bold text-[#9994A5] mr-1">Presets:</span>
                <button
                  type="button"
                  onClick={() => {
                    setCategory("frontend");
                    handleAiGenerateSingle("Frontend UI components, styling, and user interactions");
                  }}
                  className="px-2 py-0.5 rounded-lg bg-white border border-[rgba(74,61,100,0.12)] text-[#252331] hover:border-[#B8944E] hover:text-[#80642F] transition-colors"
                >
                  🎨 Frontend UI
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCategory("backend");
                    handleAiGenerateSingle("Backend API route, database query, and validation");
                  }}
                  className="px-2 py-0.5 rounded-lg bg-white border border-[rgba(74,61,100,0.12)] text-[#252331] hover:border-[#B8944E] hover:text-[#80642F] transition-colors"
                >
                  ⚡ Backend API
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCategory("test");
                    handleAiGenerateSingle("QA test plan, edge case verification, and bug fixing");
                  }}
                  className="px-2 py-0.5 rounded-lg bg-white border border-[rgba(74,61,100,0.12)] text-[#252331] hover:border-[#B8944E] hover:text-[#80642F] transition-colors"
                >
                  🧪 QA & Tests
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCategory("fullstack");
                    handleAiGenerateSingle("End-to-end full stack capability implementation");
                  }}
                  className="px-2 py-0.5 rounded-lg bg-white border border-[rgba(74,61,100,0.12)] text-[#252331] hover:border-[#B8944E] hover:text-[#80642F] transition-colors"
                >
                  🌐 Full Stack
                </button>
              </div>

              {/* ========================================================= */}
              {/* ⚡ MULTI-TASK BREAKDOWN RESULTS (Batch Insert)            */}
              {/* ========================================================= */}
              {breakdownTasks.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[rgba(74,61,100,0.12)] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#252331] flex items-center gap-1.5">
                      <Layers size={14} className="text-[#80642F]" />
                      Story Breakdown ({breakdownTasks.filter((t) => t.selected).length}/
                      {breakdownTasks.length} selected)
                    </span>
                    <button
                      type="button"
                      onClick={() => setBreakdownTasks([])}
                      className="text-[11px] text-[#9994A5] hover:text-[#252331]"
                    >
                      Dismiss
                    </button>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {breakdownTasks.map((sub, idx) => {
                      const subCatBadge = getTaskCategoryBadge(sub.category);
                      return (
                        <div
                          key={idx}
                          onClick={() => toggleSubtaskSelected(idx)}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                            sub.selected
                              ? "bg-white border-[#B8944E]/40 shadow-xs"
                              : "bg-white/50 border-gray-200 opacity-60"
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <button
                              type="button"
                              className="mt-0.5 text-[#80642F] hover:text-[#6b5327]"
                            >
                              {sub.selected ? (
                                <CheckSquare size={16} className="text-[#80642F]" />
                              ) : (
                                <Square size={16} className="text-gray-400" />
                              )}
                            </button>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-[#252331] truncate">
                                  {sub.title}
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {subCatBadge && (
                                    <span
                                      className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${subCatBadge.bg} ${subCatBadge.text} ${subCatBadge.border}`}
                                    >
                                      {subCatBadge.label}
                                    </span>
                                  )}
                                  <span
                                    className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                      sub.priority === "urgent"
                                        ? "bg-rose-100 text-rose-700"
                                        : sub.priority === "high"
                                        ? "bg-amber-100 text-amber-700"
                                        : "bg-slate-100 text-slate-700"
                                    }`}
                                  >
                                    {sub.priority}
                                  </span>
                                  {sub.due_date && (
                                    <span className="text-[10px] text-[#716B7E] flex items-center gap-0.5">
                                      <Clock size={10} />
                                      {sub.due_date}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {sub.assignee && (
                                <div className="mt-1 flex items-center gap-1 text-[11px] text-[#80642F]">
                                  <User size={10} />
                                  <span>Suggested: {sub.assignee.name}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      onClick={handleCreateBatchTasks}
                      isLoading={batchSubmitting}
                      className="h-8 px-3 text-xs bg-gradient-to-r from-[#80642F] to-[#B8944E] text-white shadow-xs rounded-xl"
                    >
                      <Check size={13} className="mr-1.5" />
                      Create All {breakdownTasks.filter((t) => t.selected).length} Tasks
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* MANUAL FORM (Pre-filled / editable by the user)           */}
        {/* ========================================================= */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Task Title */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#252331] uppercase tracking-wider">
                Task Title <span className="text-rose-500">*</span>
              </label>

              {title.trim() && !isEditing && (
                <button
                  type="button"
                  onClick={() => handleAiGenerateSingle(title)}
                  disabled={aiLoading}
                  className="text-[11px] font-semibold text-[#80642F] hover:text-[#6b5327] flex items-center gap-1"
                  title="Auto-fill description, priority & assignees based on this title"
                >
                  <Sparkles size={11} />
                  Auto-Complete from Title
                </button>
              )}
            </div>

            <div
              className={`rounded-xl transition-all ${
                aiHighlight ? "ring-2 ring-[#B8944E] bg-amber-50/20" : ""
              }`}
            >
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Implement client review dashboard component"
                required
                autoFocus
              />
            </div>
          </div>

          {/* ========================================================= */}
          {/* OPTIONAL DOMAIN / CATEGORY SELECTOR                      */}
          {/* ========================================================= */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#252331] uppercase tracking-wider">
                Engineering Domain / Category <span className="text-[11px] text-[#9994A5] font-normal lowercase">(optional)</span>
              </label>
              {category && (
                <button
                  type="button"
                  onClick={() => setCategory(null)}
                  className="text-[11px] text-[#80642F] hover:underline"
                >
                  Clear Domain
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setCategory(category === "frontend" ? null : "frontend")}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 min-h-[42px] rounded-xl text-xs font-semibold border transition-all ${
                  category === "frontend"
                    ? "bg-sky-500 text-white border-sky-600 shadow-xs"
                    : "bg-white text-[#252331] border-[rgba(74,61,100,0.12)] hover:border-sky-400 hover:bg-sky-50/50"
                }`}
              >
                <Monitor size={14} className={category === "frontend" ? "text-white" : "text-sky-500"} />
                Frontend
              </button>

              <button
                type="button"
                onClick={() => setCategory(category === "backend" ? null : "backend")}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 min-h-[42px] rounded-xl text-xs font-semibold border transition-all ${
                  category === "backend"
                    ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                    : "bg-white text-[#252331] border-[rgba(74,61,100,0.12)] hover:border-emerald-400 hover:bg-emerald-50/50"
                }`}
              >
                <Server size={14} className={category === "backend" ? "text-white" : "text-emerald-600"} />
                Backend
              </button>

              <button
                type="button"
                onClick={() => setCategory(category === "fullstack" ? null : "fullstack")}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 min-h-[42px] rounded-xl text-xs font-semibold border transition-all ${
                  category === "fullstack"
                    ? "bg-purple-600 text-white border-purple-700 shadow-xs"
                    : "bg-white text-[#252331] border-[rgba(74,61,100,0.12)] hover:border-purple-400 hover:bg-purple-50/50"
                }`}
              >
                <Layers size={14} className={category === "fullstack" ? "text-white" : "text-purple-600"} />
                Full Stack
              </button>

              <button
                type="button"
                onClick={() => setCategory(category === "test" ? null : "test")}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 min-h-[42px] rounded-xl text-xs font-semibold border transition-all ${
                  category === "test"
                    ? "bg-amber-600 text-white border-amber-700 shadow-xs"
                    : "bg-white text-[#252331] border-[rgba(74,61,100,0.12)] hover:border-amber-400 hover:bg-amber-50/50"
                }`}
              >
                <FlaskConical size={14} className={category === "test" ? "text-white" : "text-amber-600"} />
                Test / QA
              </button>
            </div>
          </div>

          {/* Story Link Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#252331] uppercase tracking-wider">
                Linked Story (Optional)
              </label>
              {storyId && (
                <button
                  type="button"
                  onClick={() => setStoryId("")}
                  className="text-[11px] text-[#80642F] hover:underline"
                >
                  Clear Story Link
                </button>
              )}
            </div>
            <select
              value={storyId}
              onChange={(e) => setStoryId(e.target.value)}
              className="w-full rounded-xl border border-[rgba(74,61,100,0.12)] bg-white px-3.5 py-2.5 text-sm text-[#252331] focus:border-[#B8944E] focus:outline-none focus:ring-2 focus:ring-[#B8944E]/20"
            >
              <option value="">No Story (Standalone Project Task)</option>
              {loadingStories ? (
                <option disabled>Loading stories...</option>
              ) : (
                storyOptions.map((s, idx) => (
                  <option key={`${s.id}-${idx}`} value={s.id}>
                    Story: {s.title}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* ========================================================= */}
          {/* 👥 MULTI-SELECT ASSIGNEES (Connected Members & Clients)  */}
          {/* ========================================================= */}
          <div className="relative" ref={assigneeDropdownRef}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#252331] uppercase tracking-wider">
                Assign To (Multi-Select Members & Clients)
              </label>
              <div className="flex items-center gap-2">
                {selectedAssignees.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllAssignees}
                    className="text-[11px] text-[#716B7E] hover:text-rose-600"
                  >
                    Clear All
                  </button>
                )}
                {assigneeOptions.some((a) => a.type === "team_user") && (
                  <button
                    type="button"
                    onClick={selectAllTeam}
                    className="text-[11px] text-[#80642F] hover:underline font-medium"
                  >
                    + Add All Team
                  </button>
                )}
              </div>
            </div>

            {/* Selected Assignees Chips Container */}
            <div
              onClick={() => setIsAssigneeDropdownOpen(!isAssigneeDropdownOpen)}
              className={`min-h-[46px] w-full rounded-xl border border-[rgba(74,61,100,0.12)] bg-white p-2 text-sm text-[#252331] cursor-pointer hover:border-[#B8944E] transition-all flex flex-wrap items-center gap-1.5 ${
                aiHighlight ? "ring-2 ring-[#B8944E] bg-amber-50/20" : ""
              }`}
            >
              {selectedAssignees.length === 0 ? (
                <span className="text-[#9994A5] text-xs px-2 py-1 flex items-center gap-1.5">
                  <User size={13} />
                  Click to select assignees (Connected team members or clients)...
                </span>
              ) : (
                selectedAssignees.map((assignee) => (
                  <span
                    key={assignee.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[rgba(184,148,78,0.1)] border border-[rgba(184,148,78,0.25)] px-2 py-1 text-xs text-[#80642F] font-medium max-w-full"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="h-4 w-4 rounded-full bg-[#B8944E] text-white text-[9px] font-bold grid place-items-center shrink-0">
                      {assignee.name?.[0]?.toUpperCase() || "U"}
                    </span>
                    <span className="truncate max-w-[95px] sm:max-w-[150px]">{assignee.name}</span>
                    <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-white/80 text-[#80642F] font-bold shrink-0">
                      {assignee.type === "team_user" ? "Team" : assignee.type === "client" ? "Client" : "Owner"}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAssignee(assignee.id)}
                      className="text-[#80642F] hover:text-rose-600 p-1 min-w-[20px] min-h-[20px] flex items-center justify-center rounded-md shrink-0 transition-colors"
                      aria-label={`Remove ${assignee.name}`}
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))
              )}

              <div className="ml-auto flex items-center pr-1 text-[#9994A5]">
                <ChevronDown size={16} />
              </div>
            </div>

            {/* Dropdown Popover */}
            {isAssigneeDropdownOpen && (
              <div className="absolute z-30 mt-1.5 w-full rounded-2xl border border-[rgba(74,61,100,0.15)] bg-white p-3 shadow-xl max-h-64 overflow-y-auto space-y-2 animate-in fade-in-0 zoom-in-95 duration-100">
                {/* Search Bar */}
                {assigneeOptions.length > 3 && (
                  <div className="relative mb-2">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9994A5]" />
                    <input
                      type="text"
                      value={assigneeSearch}
                      onChange={(e) => setAssigneeSearch(e.target.value)}
                      placeholder="Search members or clients..."
                      className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-[rgba(74,61,100,0.1)] bg-slate-50 focus:outline-none focus:border-[#B8944E]"
                    />
                  </div>
                )}

                {loadingAssignees ? (
                  <div className="py-4 text-center text-xs text-[#9994A5]">
                    Loading assignees...
                  </div>
                ) : filteredAssignees.length === 0 ? (
                  <div className="py-4 text-center text-xs text-[#9994A5]">
                    No matching assignees found.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredAssignees.map((opt) => {
                      const isSelected = selectedAssignees.some((a) => a.id === opt.id);
                      return (
                        <div
                          key={opt.id}
                          onClick={() => toggleAssignee(opt)}
                          className={`flex items-center justify-between p-2.5 rounded-xl text-xs cursor-pointer transition-all ${
                            isSelected
                              ? "bg-[rgba(184,148,78,0.12)] border border-[rgba(184,148,78,0.3)] text-[#80642F] font-semibold"
                              : "hover:bg-slate-50 text-[#252331]"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-6 w-6 rounded-full bg-[rgba(184,148,78,0.15)] text-[#80642F] font-bold text-[10px] grid place-items-center shrink-0">
                              {opt.name?.[0]?.toUpperCase() || <User size={12} />}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="truncate">{opt.name}</span>
                              <span className="text-[10px] text-[#9994A5] truncate">
                                {opt.role || opt.email || opt.username || "Connected Member"}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                                opt.type === "client"
                                  ? "bg-sky-50 text-sky-700 border-sky-200"
                                  : opt.type === "team_user"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-purple-50 text-purple-700 border-purple-200"
                              }`}
                            >
                              {opt.type === "team_user" ? "Team" : opt.type === "client" ? "Client" : "Owner"}
                            </span>

                            {isSelected ? (
                              <CheckSquare size={16} className="text-[#80642F]" />
                            ) : (
                              <Square size={16} className="text-gray-300" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Notification alert banner */}
            {selectedAssignees.length > 0 && (
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-[rgba(184,148,78,0.06)] border border-[rgba(184,148,78,0.18)] p-2.5 text-xs text-[#80642F]">
                <Bell size={14} className="shrink-0 text-[#B8944E]" />
                <span>
                  <strong>
                    {selectedAssignees.length === 1
                      ? selectedAssignees[0].name
                      : `${selectedAssignees.length} assigned members`}
                  </strong>{" "}
                  will receive in-app and email notifications.
                </span>
              </div>
            )}
          </div>

          {/* Status, Priority & Due Date in 3 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Status */}
            <div>
              <label className="block text-xs font-semibold text-[#252331] uppercase tracking-wider mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full rounded-xl border border-[rgba(74,61,100,0.12)] bg-white px-3 py-2 text-sm text-[#252331] focus:border-[#B8944E] focus:outline-none focus:ring-2 focus:ring-[#B8944E]/20"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="in_review">In Review</option>
                <option value="done">Completed</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-semibold text-[#252331] uppercase tracking-wider mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className={`w-full rounded-xl border border-[rgba(74,61,100,0.12)] bg-white px-3 py-2 text-sm text-[#252331] focus:border-[#B8944E] focus:outline-none focus:ring-2 focus:ring-[#B8944E]/20 transition-all ${
                  aiHighlight ? "ring-2 ring-[#B8944E] bg-amber-50/20" : ""
                }`}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-xs font-semibold text-[#252331] uppercase tracking-wider mb-1.5">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`w-full rounded-xl border border-[rgba(74,61,100,0.12)] bg-white px-3 py-2 text-sm text-[#252331] focus:border-[#B8944E] focus:outline-none focus:ring-2 focus:ring-[#B8944E]/20 transition-all ${
                  aiHighlight ? "ring-2 ring-[#B8944E] bg-amber-50/20" : ""
                }`}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#252331] uppercase tracking-wider">
                Description / Instructions
              </label>
              {description.trim() && (
                <button
                  type="button"
                  onClick={handleAiPolishDescription}
                  disabled={aiLoading}
                  className="text-[11px] font-semibold text-[#80642F] hover:text-[#6b5327] flex items-center gap-1"
                  title="Format into markdown checklist with acceptance criteria"
                >
                  <Wand2 size={11} />
                  Turn into Checklist
                </button>
              )}
            </div>

            <div
              className={`rounded-xl transition-all ${
                aiHighlight ? "ring-2 ring-[#B8944E] bg-amber-50/20" : ""
              }`}
            >
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Add relevant context, acceptance points, or checklist instructions..."
              />
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-[rgba(74,61,100,0.08)]">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onClose}
              className="w-full sm:w-auto justify-center"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={submitting}
              leftIcon={isEditing ? undefined : <Check size={15} />}
              className="w-full sm:w-auto justify-center"
            >
              {isEditing ? "Save Changes" : "Create Task"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

"use client";

import React from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquare,
  Paperclip,
  User,
  AlertCircle,
  MoreVertical,
  BookOpen,
} from "lucide-react";
import type { Task, TaskPriority, TaskStatus } from "@/lib/types/task";
import {
  getTaskPriorityLabel,
  getTaskStatusLabel,
  getTaskCategoryBadge,
} from "@/lib/types/task";

interface TaskCardProps {
  task: Task;
  showProject?: boolean;
  onClick?: () => void;
  onStatusChange?: (newStatus: TaskStatus) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function TaskCard({
  task,
  showProject = false,
  onClick,
  onStatusChange,
  onEdit,
  onDelete,
}: TaskCardProps) {
  const priorityConfig: Record<
    TaskPriority,
    { label: string; bg: string; text: string; border: string; dot: string }
  > = {
    urgent: {
      label: "Urgent",
      bg: "bg-rose-50",
      text: "text-rose-700",
      border: "border-rose-200",
      dot: "bg-rose-500",
    },
    high: {
      label: "High",
      bg: "bg-orange-50",
      text: "text-orange-700",
      border: "border-orange-200",
      dot: "bg-orange-500",
    },
    medium: {
      label: "Medium",
      bg: "bg-[rgba(204,160,56,0.08)]",
      text: "text-[#785312]",
      border: "border-[rgba(204,160,56,0.2)]",
      dot: "bg-[#CCA038]",
    },
    low: {
      label: "Low",
      bg: "bg-slate-50",
      text: "text-slate-600",
      border: "border-slate-200",
      dot: "bg-slate-400",
    },
  };

  const priorityStyle = priorityConfig[task.priority] || priorityConfig.medium;
  const categoryBadge = getTaskCategoryBadge(task.category);

  // Due date status
  let dueDateText = "";
  let isOverdue = false;
  if (task.due_date) {
    const due = new Date(task.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    dueDateText = due.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (task.status !== "done" && due < today) {
      isOverdue = true;
    }
  }

  // Multi-assignees resolution
  const assigneesList =
    Array.isArray(task.assignees) && task.assignees.length > 0
      ? task.assignees
      : task.assignee_id
      ? [
          {
            id: task.assignee_id,
            name: task.assignee_name || "Assignee",
            type: task.assignee_type || "freelancer",
          },
        ]
      : [];

  const getRoleBadge = (type?: string | null) => {
    switch (type) {
      case "client":
        return (
          <span className="rounded bg-sky-50 px-1 py-0.2 text-[9px] font-semibold text-sky-700 border border-sky-200">
            Client
          </span>
        );
      case "team_user":
        return (
          <span className="rounded bg-emerald-50 px-1 py-0.2 text-[9px] font-semibold text-emerald-700 border border-emerald-200">
            Team
          </span>
        );
      case "freelancer":
        return (
          <span className="rounded bg-purple-50 px-1 py-0.2 text-[9px] font-semibold text-purple-700 border border-purple-200">
            Owner
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div
      onClick={onClick}
      className={`group relative rounded-xl border border-[rgba(15,23,42,0.08)] bg-white p-3.5 shadow-xs hover:border-[#CCA038]/30 hover:shadow-[0_4px_20px_rgba(15,23,42,0.06)] transition-all duration-150 cursor-pointer ${
        task.status === "done" ? "opacity-75 bg-[#F8F9FB]" : ""
      }`}
    >
      {/* Top Meta: Priority + Category + Project + Status action */}
      <div className="flex items-center justify-between gap-1.5 mb-2">
        <div className="flex flex-wrap items-center gap-1 min-w-0">
          <span
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9.5px] sm:text-[10px] font-semibold border shrink-0 ${priorityStyle.bg} ${priorityStyle.text} ${priorityStyle.border}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${priorityStyle.dot}`} />
            {priorityStyle.label}
          </span>

          {/* Category Pill (Frontend, Backend, Full Stack, Test) */}
          {categoryBadge && (
            <span
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9.5px] sm:text-[10px] font-semibold border shrink-0 ${categoryBadge.bg} ${categoryBadge.text} ${categoryBadge.border}`}
            >
              {categoryBadge.label}
            </span>
          )}

          {showProject && task.project && (
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[9.5px] sm:text-[10px] font-medium text-[#334155] truncate max-w-[80px] sm:max-w-[120px]">
              {task.project.name}
            </span>
          )}
        </div>

        {/* Quick status cycle button */}
        {onStatusChange && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const nextStatus: Record<TaskStatus, TaskStatus> = {
                todo: "in_progress",
                in_progress: "in_review",
                in_review: "done",
                done: "todo",
              };
              onStatusChange(nextStatus[task.status]);
            }}
            title={`Current: ${getTaskStatusLabel(task.status)}. Click to advance.`}
            className={`rounded-full p-1 transition-colors ${
              task.status === "done"
                ? "text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                : "text-zinc-400 hover:text-[#CCA038] hover:bg-[rgba(204,160,56,0.08)]"
            }`}
          >
            <CheckCircle2 size={16} className={task.status === "done" ? "fill-emerald-100" : ""} />
          </button>
        )}
      </div>

      {/* Task Title */}
      <h4
        className={`text-sm font-semibold tracking-tight text-[#0F172A] group-hover:text-[#785312] transition-colors leading-snug line-clamp-2 ${
          task.status === "done" ? "line-through text-zinc-400" : ""
        }`}
      >
        {task.title}
      </h4>

      {/* Description excerpt */}
      {task.description && (
        <p className="mt-1 text-xs text-[#334155] line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Linked Story Badge */}
      {task.story && (
        <div className="mt-2.5 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-md bg-[rgba(204,160,56,0.06)] px-2 py-0.5 text-[11px] font-medium text-[#785312] border border-[rgba(204,160,56,0.15)] truncate max-w-full">
            <BookOpen size={11} className="shrink-0 text-[#CCA038]" />
            <span className="truncate">Story: {task.story.title}</span>
          </span>
        </div>
      )}

      {/* Bottom Footer: Multi-Assignees & Meta Counts */}
      <div className="mt-3 pt-2.5 border-t border-[rgba(15,23,42,0.06)] flex items-center justify-between gap-2 text-[11px]">
        {/* Multi-Assignees */}
        <div className="flex items-center gap-1 min-w-0">
          {assigneesList.length > 0 ? (
            <div
              className="flex items-center gap-1.5 min-w-0"
              title={`Assigned to: ${assigneesList.map((a) => a.name).join(", ")}`}
            >
              {/* Avatar Stack */}
              <div className="flex -space-x-1.5 overflow-hidden shrink-0">
                {assigneesList.slice(0, 3).map((a, i) => {
                  const inits = a.name
                    ? a.name
                        .split(" ")
                        .map((p: string) => p[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()
                    : "U";
                  return (
                    <div
                      key={a.id || i}
                      className="inline-flex h-5 w-5 rounded-full ring-2 ring-white bg-[rgba(204,160,56,0.15)] text-[#785312] text-[9px] font-bold items-center justify-center"
                      title={a.name}
                    >
                      {inits}
                    </div>
                  );
                })}
              </div>

              <span className="text-[#0F172A] font-medium truncate max-w-[75px] sm:max-w-[110px]">
                {assigneesList[0].name}
              </span>

              {assigneesList.length > 1 && (
                <span className="rounded-full bg-slate-100 text-slate-700 px-1 py-0.2 text-[9px] font-bold shrink-0">
                  +{assigneesList.length - 1}
                </span>
              )}

              {assigneesList.length === 1 && getRoleBadge(assigneesList[0].type)}
            </div>
          ) : (
            <span className="text-[#64748B] italic text-[11px] flex items-center gap-1 shrink-0">
              <User size={11} /> Unassigned
            </span>
          )}
        </div>

        {/* Counts & Due Date */}
        <div className="flex items-center gap-2.5 shrink-0 text-[#334155]">
          {dueDateText && (
            <span
              className={`flex items-center gap-1 font-medium ${
                isOverdue ? "text-rose-600 font-semibold" : ""
              }`}
              title={isOverdue ? "Overdue!" : `Due: ${dueDateText}`}
            >
              <Calendar size={11} />
              {dueDateText}
            </span>
          )}

          {(task.notes_count ?? 0) > 0 && (
            <span className="flex items-center gap-1" title={`${task.notes_count} notes`}>
              <MessageSquare size={11} className="text-[#64748B]" />
              {task.notes_count}
            </span>
          )}

          {(task.attachments_count ?? 0) > 0 && (
            <span className="flex items-center gap-1" title={`${task.attachments_count} attachments`}>
              <Paperclip size={11} className="text-[#64748B]" />
              {task.attachments_count}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

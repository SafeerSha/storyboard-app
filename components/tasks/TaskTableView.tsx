"use client";

import React from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  MessageSquare,
  Paperclip,
  User,
  BookOpen,
  ChevronDown,
  Trash2,
  Edit2,
} from "lucide-react";
import type { Task, TaskPriority, TaskStatus } from "@/lib/types/task";
import {
  getTaskPriorityLabel,
  getTaskStatusLabel,
  getTaskCategoryBadge,
} from "@/lib/types/task";

interface TaskTableViewProps {
  tasks: Task[];
  showProject?: boolean;
  onTaskClick: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
}

export function TaskTableView({
  tasks,
  showProject = false,
  onTaskClick,
  onStatusChange,
  onEdit,
  onDelete,
}: TaskTableViewProps) {
  const statusOptions: { value: TaskStatus; label: string; color: string }[] = [
    { value: "todo", label: "To Do", color: "bg-slate-100 text-slate-700 border-slate-200" },
    { value: "in_progress", label: "In Progress", color: "bg-[rgba(184,148,78,0.12)] text-[#80642F] border-[rgba(184,148,78,0.25)]" },
    { value: "in_review", label: "In Review", color: "bg-purple-100 text-purple-700 border-purple-200" },
    { value: "done", label: "Completed", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  ];

  const priorityBadge: Record<TaskPriority, { bg: string; text: string; label: string }> = {
    urgent: { bg: "bg-rose-50 border-rose-200", text: "text-rose-700", label: "Urgent" },
    high: { bg: "bg-orange-50 border-orange-200", text: "text-orange-700", label: "High" },
    medium: { bg: "bg-[rgba(184,148,78,0.08)] border-[rgba(184,148,78,0.2)]", text: "text-[#80642F]", label: "Medium" },
    low: { bg: "bg-slate-50 border-slate-200", text: "text-slate-600", label: "Low" },
  };

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-[rgba(74,61,100,0.08)] bg-white shadow-xs">
      {/* Mobile Card List View (< sm screens) */}
      <div className="block sm:hidden divide-y divide-[rgba(74,61,100,0.06)]">
        {tasks.map((task) => {
          const pStyle = priorityBadge[task.priority] || priorityBadge.medium;
          const catBadge = getTaskCategoryBadge(task.category);

          let isOverdue = false;
          let dueDateFormatted = "";
          if (task.due_date) {
            const due = new Date(task.due_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            due.setHours(0, 0, 0, 0);
            dueDateFormatted = due.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            if (task.status !== "done" && due < today) {
              isOverdue = true;
            }
          }

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

          return (
            <div
              key={task.id}
              onClick={() => onTaskClick(task)}
              className={`p-3.5 space-y-2.5 transition-colors cursor-pointer hover:bg-[#FAF9FC] ${
                task.status === "done" ? "bg-zinc-50/50" : ""
              }`}
            >
              <div className="flex items-start gap-2.5">
                {/* Status Toggle Button */}
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
                    onStatusChange(task.id, nextStatus[task.status]);
                  }}
                  className={`mt-0.5 grid place-items-center h-6 w-6 rounded-md border shrink-0 transition-all ${
                    task.status === "done"
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : "border-zinc-300 text-transparent hover:border-[#B8944E]"
                  }`}
                >
                  <CheckCircle2 size={14} className={task.status === "done" ? "opacity-100" : "opacity-0"} />
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    {/* Domain Category Pill */}
                    {catBadge && (
                      <span
                        className={`inline-block rounded px-1.5 py-0.2 text-[9px] font-bold border ${catBadge.bg} ${catBadge.text} ${catBadge.border}`}
                      >
                        {catBadge.label}
                      </span>
                    )}

                    {/* Priority Pill */}
                    <span
                      className={`inline-block rounded px-1.5 py-0.2 text-[9px] font-bold border ${pStyle.bg} ${pStyle.text}`}
                    >
                      {pStyle.label}
                    </span>

                    {showProject && task.project && (
                      <span className="rounded bg-zinc-100 px-1.5 py-0.2 text-[9px] font-medium text-[#706C7D] truncate max-w-[100px]">
                        {task.project.name}
                      </span>
                    )}
                  </div>

                  <h4
                    className={`text-xs font-semibold text-[#252331] leading-snug ${
                      task.status === "done" ? "line-through text-zinc-400" : ""
                    }`}
                  >
                    {task.title}
                  </h4>

                  {task.story && (
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-[#80642F]">
                      <BookOpen size={10} className="shrink-0 text-[#B8944E]" />
                      <span className="truncate">Story: {task.story.title}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Meta on Mobile */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-[rgba(74,61,100,0.04)] text-[11px] text-[#706C7D] pl-8">
                {/* Assignees */}
                <div className="flex items-center gap-1.5 min-w-0">
                  {assigneesList.length > 0 ? (
                    <div className="flex items-center gap-1 min-w-0">
                      <div className="flex -space-x-1.5 overflow-hidden shrink-0">
                        {assigneesList.slice(0, 2).map((a, i) => (
                          <div
                            key={a.id || i}
                            className="h-5 w-5 rounded-full ring-1 ring-white bg-[rgba(184,148,78,0.15)] text-[#80642F] text-[9px] font-bold grid place-items-center shrink-0"
                          >
                            {a.name?.[0]?.toUpperCase() || "U"}
                          </div>
                        ))}
                      </div>
                      <span className="truncate max-w-[90px] font-medium text-[#252331]">
                        {assigneesList[0].name}
                      </span>
                      {assigneesList.length > 1 && (
                        <span className="rounded-full bg-slate-100 text-slate-700 px-1 text-[9px] font-bold">
                          +{assigneesList.length - 1}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[#9994A5] italic text-[10px]">Unassigned</span>
                  )}
                </div>

                {/* Due Date & Activity */}
                <div className="flex items-center gap-2 shrink-0">
                  {dueDateFormatted && (
                    <span
                      className={`flex items-center gap-1 font-medium ${
                        isOverdue ? "text-rose-600 font-semibold" : ""
                      }`}
                    >
                      <Calendar size={11} />
                      {dueDateFormatted}
                    </span>
                  )}

                  {(task.notes_count ?? 0) > 0 && (
                    <span className="flex items-center gap-0.5">
                      <MessageSquare size={11} className="text-[#9994A5]" />
                      {task.notes_count}
                    </span>
                  )}

                  {(task.attachments_count ?? 0) > 0 && (
                    <span className="flex items-center gap-0.5">
                      <Paperclip size={11} className="text-[#9994A5]" />
                      {task.attachments_count}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Multi-Column Table View (sm+ screens) */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#FAF9FC] border-b border-[rgba(74,61,100,0.08)] text-[11px] uppercase tracking-wider text-[#9994A5] font-semibold">
            <tr>
              <th className="py-3 px-4 w-10 text-center">Status</th>
              <th className="py-3 px-4 min-w-[240px]">Task & Story</th>
              {showProject && <th className="py-3 px-4 min-w-[140px]">Project</th>}
              <th className="py-3 px-4 min-w-[170px]">Assignees</th>
              <th className="py-3 px-4 min-w-[100px]">Priority</th>
              <th className="py-3 px-4 min-w-[120px]">Due Date</th>
              <th className="py-3 px-4 w-24 text-center">Activity</th>
              <th className="py-3 px-4 w-20 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(74,61,100,0.06)]">
            {tasks.map((task) => {
              const currentStatus = statusOptions.find((s) => s.value === task.status) || statusOptions[0];
              const pStyle = priorityBadge[task.priority] || priorityBadge.medium;
              const catBadge = getTaskCategoryBadge(task.category);

              let isOverdue = false;
              let dueDateFormatted = "";
              if (task.due_date) {
                const due = new Date(task.due_date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                due.setHours(0, 0, 0, 0);
                dueDateFormatted = due.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                if (task.status !== "done" && due < today) {
                  isOverdue = true;
                }
              }

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

              return (
                <tr
                  key={task.id}
                  onClick={() => onTaskClick(task)}
                  className={`group hover:bg-[#FAF9FC] transition-colors cursor-pointer ${
                    task.status === "done" ? "bg-zinc-50/50" : ""
                  }`}
                >
                  {/* Status Toggle Checkbox */}
                  <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => {
                        const nextStatus: Record<TaskStatus, TaskStatus> = {
                          todo: "in_progress",
                          in_progress: "in_review",
                          in_review: "done",
                          done: "todo",
                        };
                        onStatusChange(task.id, nextStatus[task.status]);
                      }}
                      className={`grid place-items-center h-6 w-6 rounded-md border transition-all ${
                        task.status === "done"
                          ? "bg-emerald-600 border-emerald-600 text-white"
                          : "border-zinc-300 text-transparent hover:border-[#B8944E]"
                      }`}
                    >
                      <CheckCircle2 size={14} className={task.status === "done" ? "opacity-100" : "opacity-0 group-hover:opacity-40"} />
                    </button>
                  </td>

                  {/* Task & Story */}
                  <td className="py-3.5 px-4">
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {catBadge && (
                          <span
                            className={`inline-block rounded px-1.5 py-0.2 text-[9px] font-bold border ${catBadge.bg} ${catBadge.text} ${catBadge.border}`}
                          >
                            {catBadge.label}
                          </span>
                        )}
                        <span
                          className={`text-sm font-semibold text-[#252331] group-hover:text-[#80642F] transition-colors truncate ${
                            task.status === "done" ? "line-through text-zinc-400" : ""
                          }`}
                        >
                          {task.title}
                        </span>
                      </div>
                      {task.story && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#80642F] truncate">
                          <BookOpen size={11} className="shrink-0 text-[#B8944E]" />
                          <span>Story: {task.story.title}</span>
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Project */}
                  {showProject && (
                    <td className="py-3.5 px-4 text-[#706C7D]">
                      <span className="truncate block font-medium">
                        {task.project?.name || "—"}
                      </span>
                    </td>
                  )}

                  {/* Assignee */}
                  <td className="py-3.5 px-4">
                    {assigneesList.length > 0 ? (
                      <div
                        className="flex items-center gap-2 min-w-0"
                        title={assigneesList.map((a) => a.name).join(", ")}
                      >
                        <div className="flex -space-x-1.5 overflow-hidden shrink-0">
                          {assigneesList.slice(0, 2).map((a, i) => (
                            <div
                              key={a.id || i}
                              className="h-6 w-6 rounded-full ring-2 ring-white bg-[rgba(184,148,78,0.12)] text-[#80642F] font-bold text-[10px] grid place-items-center shrink-0"
                            >
                              {a.name?.[0]?.toUpperCase() || <User size={12} />}
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-[#252331] truncate">
                            {assigneesList[0].name}
                            {assigneesList.length > 1 && ` (+${assigneesList.length - 1})`}
                          </span>
                          <span className="text-[10px] text-[#9994A5] capitalize">
                            {assigneesList.length > 1
                              ? `${assigneesList.length} members`
                              : assigneesList[0].type === "team_user"
                              ? "Team"
                              : assigneesList[0].type === "client"
                              ? "Client"
                              : "Owner"}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-[#9994A5] italic">Unassigned</span>
                    )}
                  </td>

                  {/* Priority */}
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold ${pStyle.bg} ${pStyle.text}`}
                    >
                      {pStyle.label}
                    </span>
                  </td>

                  {/* Due Date */}
                  <td className="py-3.5 px-4">
                    {dueDateFormatted ? (
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                          isOverdue ? "text-rose-600 font-semibold" : "text-[#706C7D]"
                        }`}
                      >
                        <Calendar size={12} />
                        {dueDateFormatted}
                      </span>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>

                  {/* Activity (Notes & Attachments) */}
                  <td className="py-3.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-2 text-[#706C7D]">
                      {(task.notes_count ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1" title={`${task.notes_count} notes`}>
                          <MessageSquare size={12} className="text-[#9994A5]" />
                          {task.notes_count}
                        </span>
                      )}
                      {(task.attachments_count ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1" title={`${task.attachments_count} attachments`}>
                          <Paperclip size={12} className="text-[#9994A5]" />
                          {task.attachments_count}
                        </span>
                      )}
                      {(task.notes_count ?? 0) === 0 && (task.attachments_count ?? 0) === 0 && (
                        <span className="text-zinc-300">—</span>
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {onEdit && (
                        <button
                          type="button"
                          onClick={() => onEdit(task)}
                          title="Edit Task"
                          className="p-1 text-[#9994A5] hover:text-[#80642F] hover:bg-[rgba(184,148,78,0.08)] rounded transition-colors"
                        >
                          <Edit2 size={13} />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete(task.id)}
                          title="Delete Task"
                          className="p-1 text-[#9994A5] hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

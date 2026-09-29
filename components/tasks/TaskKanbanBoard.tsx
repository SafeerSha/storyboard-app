"use client";

import React from "react";
import { Plus, CheckCircle2, Clock, CircleDot, CheckSquare } from "lucide-react";
import { TaskCard } from "./TaskCard";
import type { Task, TaskStatus } from "@/lib/types/task";
import { getTaskStatusLabel } from "@/lib/types/task";

interface TaskKanbanBoardProps {
  tasks: Task[];
  showProject?: boolean;
  onTaskClick: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onCreateInStatus?: (status: TaskStatus) => void;
}

interface ColumnConfig {
  id: TaskStatus;
  label: string;
  dotColor: string;
  badgeBg: string;
  badgeText: string;
}

export function TaskKanbanBoard({
  tasks,
  showProject = false,
  onTaskClick,
  onStatusChange,
  onCreateInStatus,
}: TaskKanbanBoardProps) {
  const [mobileActiveColumn, setMobileActiveColumn] = React.useState<TaskStatus>("todo");
  const columnRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  const scrollToColumn = (colId: TaskStatus) => {
    setMobileActiveColumn(colId);
    columnRefs.current[colId]?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  };

  const columns: ColumnConfig[] = [
    {
      id: "todo",
      label: "To Do",
      dotColor: "bg-slate-400",
      badgeBg: "bg-slate-100",
      badgeText: "text-slate-700",
    },
    {
      id: "in_progress",
      label: "In Progress",
      dotColor: "bg-[#B8944E]",
      badgeBg: "bg-[rgba(184,148,78,0.12)]",
      badgeText: "text-[#80642F]",
    },
    {
      id: "in_review",
      label: "In Review",
      dotColor: "bg-purple-500",
      badgeBg: "bg-purple-100",
      badgeText: "text-purple-700",
    },
    {
      id: "done",
      label: "Completed",
      dotColor: "bg-emerald-500",
      badgeBg: "bg-emerald-100",
      badgeText: "text-emerald-700",
    },
  ];

  const tasksByStatus = React.useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      in_review: [],
      done: [],
    };

    for (const task of tasks) {
      if (map[task.status]) {
        map[task.status].push(task);
      } else {
        map.todo.push(task);
      }
    }

    return map;
  }, [tasks]);

  return (
    <div className="w-full">
      {/* Mobile Column Tabs for 1-Tap Navigation */}
      <div className="flex md:hidden items-center gap-1.5 overflow-x-auto pb-2 mb-3 px-0.5">
        {columns.map((col) => {
          const isActive = mobileActiveColumn === col.id;
          const count = (tasksByStatus[col.id] || []).length;
          return (
            <button
              key={col.id}
              type="button"
              onClick={() => scrollToColumn(col.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                isActive
                  ? "bg-[#252331] text-white shadow-xs"
                  : "bg-white text-[#706C7D] border border-[rgba(74,61,100,0.1)] hover:bg-slate-50"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${col.dotColor}`} />
              <span>{col.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-semibold ${
                  isActive ? "bg-white/20 text-white" : `${col.badgeBg} ${col.badgeText}`
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Kanban Board Grid / Swipeable Carousel on Mobile */}
      <div className="flex md:grid md:grid-cols-2 xl:grid-cols-4 gap-4 overflow-x-auto pb-4 md:pb-0 snap-x snap-mandatory md:snap-none -mx-4 px-4 sm:mx-0 sm:px-0 items-start">
        {columns.map((col) => {
          const colTasks = tasksByStatus[col.id] || [];

          return (
            <div
              key={col.id}
              ref={(el) => {
                columnRefs.current[col.id] = el;
              }}
              className="w-[85vw] max-w-[340px] md:w-auto shrink-0 md:shrink flex flex-col rounded-2xl border border-[rgba(74,61,100,0.08)] bg-[#FBFAFD]/80 p-3 sm:p-3.5 min-h-[380px] sm:min-h-[450px] snap-center"
            >
            {/* Column Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[rgba(74,61,100,0.06)]">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${col.dotColor}`} />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#252331]">
                  {col.label}
                </h3>
                <span
                  className={`rounded-full px-2 py-0.2 text-[11px] font-semibold ${col.badgeBg} ${col.badgeText}`}
                >
                  {colTasks.length}
                </span>
              </div>

              {onCreateInStatus && (
                <button
                  type="button"
                  onClick={() => onCreateInStatus(col.id)}
                  title={`Add task to ${col.label}`}
                  className="rounded-lg p-1 text-[#706C7D] hover:text-[#80642F] hover:bg-[rgba(184,148,78,0.08)] transition-colors"
                >
                  <Plus size={15} />
                </button>
              )}
            </div>

            {/* Task Cards Column */}
            <div className="space-y-3 flex-1 overflow-y-auto">
              {colTasks.length > 0 ? (
                colTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    showProject={showProject}
                    onClick={() => onTaskClick(task)}
                    onStatusChange={(newStatus) => onStatusChange(task.id, newStatus)}
                  />
                ))
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center px-4 rounded-xl border border-dashed border-[rgba(74,61,100,0.1)] bg-white/40">
                  <p className="text-xs text-[#9994A5] font-medium">No tasks in {col.label}</p>
                  {onCreateInStatus && (
                    <button
                      type="button"
                      onClick={() => onCreateInStatus(col.id)}
                      className="mt-2 text-xs font-semibold text-[#80642F] hover:underline flex items-center gap-1"
                    >
                      <Plus size={12} /> Add task
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}

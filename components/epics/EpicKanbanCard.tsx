"use client";

import React, { useState, useEffect } from "react";
import {
  Layers,
  MoreVertical,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  CircleDot,
  PlayCircle,
  Eye,
  ArrowUp,
  ArrowDown,
  Minus,
  Paperclip,
} from "lucide-react";
import type { Epic, Story } from "@/lib/types";
import {
  type EpicKanbanStatus,
  type EpicPriority,
  EPIC_KANBAN_COLUMNS,
  EPIC_PRIORITIES,
  normalizeEpicStatus,
  getEpicStatusLabel,
  getNextEpicStatus,
  extractEpicPriority,
  cleanEpicDescription,
} from "@/lib/types/epic";
import { normalizeStoryStatus } from "@/lib/types";
import { toast } from "@/lib/toast";
import { EpicMediaModal } from "./EpicMediaModal";

interface EpicKanbanCardProps {
  epic: Epic;
  stories: Story[];
  onEditEpic: (epic: Epic) => void;
  onDeleteEpic: (epicId: string) => void;
  onAddStory: (epicId: string) => void;
  onStatusChange: (epicId: string, newStatus: EpicKanbanStatus) => void;
  onPriorityChange?: (epicId: string, newPriority: EpicPriority) => void;
  onNavigateToEpic?: (epicId: string) => void;
}

export function EpicKanbanCard({
  epic,
  stories,
  onEditEpic,
  onDeleteEpic,
  onAddStory,
  onStatusChange,
  onPriorityChange,
  onNavigateToEpic,
}: EpicKanbanCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);

  // Optimistic status state for instant visual feedback (AC-1.2)
  const [optimisticStatus, setOptimisticStatus] = useState<EpicKanbanStatus>(
    normalizeEpicStatus(epic.status)
  );

  // Optimistic priority state for instant feedback (AC-3.3)
  const [optimisticPriority, setOptimisticPriority] = useState<EpicPriority>(
    extractEpicPriority(epic)
  );

  // Sync when prop updates
  useEffect(() => {
    setOptimisticStatus(normalizeEpicStatus(epic.status));
  }, [epic.status]);

  useEffect(() => {
    setOptimisticPriority(extractEpicPriority(epic));
  }, [epic.priority, epic.description]);

  // Filter stories belonging to this epic
  const epicStories = stories.filter((s) => s.epic_id === epic.id);
  const totalStories = epicStories.length;

  const doneCount = epicStories.filter((s) => normalizeStoryStatus(s.status) === "done").length;
  const activeCount = epicStories.filter((s) => normalizeStoryStatus(s.status) === "active").length;
  const newCount = epicStories.filter((s) => normalizeStoryStatus(s.status) === "new").length;

  const changesRequestedCount = epicStories.filter(
    (s) => s.status === "changes_requested" || s.client_review_status === "changes_requested"
  ).length;

  const progressPercent = totalStories > 0 ? Math.round((doneCount / totalStories) * 100) : 0;
  const columnConfig =
    EPIC_KANBAN_COLUMNS.find((c) => c.id === optimisticStatus) || EPIC_KANBAN_COLUMNS[0];
  const priorityConfig = EPIC_PRIORITIES[optimisticPriority] || EPIC_PRIORITIES.medium;

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    setIsDragging(true);
    e.dataTransfer.setData("text/plain", epic.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // Story 1 (AC-1.2, AC-1.3): Cycle epic status via icon click
  const handleCycleStatus = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus = getNextEpicStatus(optimisticStatus);
    setOptimisticStatus(nextStatus);
    onStatusChange(epic.id, nextStatus);
    toast.success("Epic status updated", `${epic.name} moved to ${getEpicStatusLabel(nextStatus)}`);
  };

  // Story 3 (AC-3.1, AC-3.3): Change priority
  const handlePrioritySelect = (newPriority: EpicPriority) => {
    setOptimisticPriority(newPriority);
    onPriorityChange?.(epic.id, newPriority);
    toast.success("Priority updated", `${epic.name} set to ${newPriority.toUpperCase()} priority`);
  };

  // Render status indicator icon based on completion status (AC-1.1)
  const renderStatusIcon = () => {
    switch (optimisticStatus) {
      case "backlog":
        return <Clock size={14} className="text-slate-500" />;
      case "todo":
        return <CircleDot size={14} className="text-amber-600" />;
      case "in_progress":
        return <PlayCircle size={14} className="text-[#80642F]" />;
      case "qa_review":
        return <Eye size={14} className="text-purple-600" />;
      case "done":
        return <CheckCircle2 size={14} className="text-emerald-600" />;
      default:
        return <CircleDot size={14} className="text-slate-500" />;
    }
  };

  const cleanDesc = cleanEpicDescription(epic.description);

  return (
    <div
      id={`epic-kanban-card-${epic.id}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`group relative rounded-2xl border border-[rgba(74,61,100,0.09)] bg-white/95 p-4 shadow-[0_4px_20px_rgba(70,55,95,0.04)] backdrop-blur-md transition-all duration-200 hover:shadow-[0_8px_30px_rgba(70,55,95,0.08)] hover:-translate-y-0.5 select-none ${
        isDragging ? "opacity-40 scale-95 ring-2 ring-[#B8944E]" : ""
      }`}
    >
      {/* Top Header: Status Pill, Priority Badge & Top-Right Actions + Status Icon */}
      <div className="flex items-center justify-between gap-1.5 mb-2.5">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {/* Status Dropdown Indicator */}
          <div className="relative inline-flex items-center">
            <select
              value={optimisticStatus}
              onChange={(e) => {
                const s = e.target.value as EpicKanbanStatus;
                setOptimisticStatus(s);
                onStatusChange(epic.id, s);
              }}
              aria-label={`Change status for epic ${epic.name}`}
              className={`appearance-none cursor-pointer rounded-full pl-2.5 pr-6 py-0.5 text-[11px] font-bold tracking-tight border transition-colors outline-none focus:ring-1 focus:ring-[#B8944E] ${columnConfig.badgeBg} ${columnConfig.badgeText} border-transparent hover:border-black/10`}
            >
              {EPIC_KANBAN_COLUMNS.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.label}
                </option>
              ))}
            </select>
            <span
              className={`pointer-events-none absolute left-2 h-1.5 w-1.5 rounded-full ${columnConfig.dotColor}`}
            />
            <ChevronRight
              size={11}
              className={`pointer-events-none absolute right-1.5 transition-transform rotate-90 ${columnConfig.badgeText}`}
            />
          </div>

          {/* Story 3: Priority Badge (AC-3.1, AC-3.2, AC-3.3) */}
          <div className="relative inline-flex items-center">
            <select
              value={optimisticPriority}
              onChange={(e) => handlePrioritySelect(e.target.value as EpicPriority)}
              aria-label={`Change priority for epic ${epic.name}`}
              title={`Priority: ${priorityConfig.label} (Click to change)`}
              className={`appearance-none cursor-pointer rounded-md pl-4 pr-3.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border transition-colors outline-none focus:ring-1 focus:ring-[#B8944E] ${priorityConfig.badgeBg} ${priorityConfig.badgeText} ${priorityConfig.borderColor}`}
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
            </select>
            <span className="pointer-events-none absolute left-1.5 text-[9px]">
              {optimisticPriority === "high" ? (
                <ArrowUp size={10} className="text-rose-600" />
              ) : optimisticPriority === "low" ? (
                <ArrowDown size={10} className="text-slate-500" />
              ) : (
                <Minus size={10} className="text-amber-600" />
              )}
            </span>
          </div>
        </div>

        {/* Top Right Corner Controls (AC-1.1, AC-1.2, AC-1.3) */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Story 1 (AC-1.1, AC-1.2, AC-1.3): Status Indicator Icon in Top Right Corner */}
          <button
            type="button"
            onClick={handleCycleStatus}
            title={`Current status: ${getEpicStatusLabel(
              optimisticStatus
            )} • Click to advance to ${getEpicStatusLabel(getNextEpicStatus(optimisticStatus))}`}
            aria-label={`Current status: ${getEpicStatusLabel(
              optimisticStatus
            )}. Click to cycle to next status.`}
            className={`group/icon relative grid h-7 w-7 place-items-center rounded-lg border transition-all duration-150 hover:scale-105 active:scale-95 shadow-2xs ${columnConfig.badgeBg} ${columnConfig.borderColor} border-[rgba(74,61,100,0.12)] hover:border-[#B8944E]`}
          >
            {renderStatusIcon()}
            <span className="sr-only">
              {getEpicStatusLabel(optimisticStatus)} - Click to cycle
            </span>
          </button>

          <button
            type="button"
            onClick={() => onAddStory(epic.id)}
            title="Add Story to this Epic"
            className="rounded-lg p-1 text-[#706C7D] hover:text-[#80642F] hover:bg-[rgba(184,148,78,0.08)] transition"
          >
            <Plus size={14} />
          </button>

          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-expanded={isMenuOpen}
            title="More actions"
            className="rounded-lg p-1 text-[#706C7D] hover:text-[#252331] hover:bg-[rgba(74,61,100,0.06)] transition"
          >
            <MoreVertical size={14} />
          </button>

          {/* Context Dropdown Menu */}
          {isMenuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setIsMenuOpen(false)} />
              <div className="absolute right-0 top-7 z-40 w-48 rounded-xl border border-[rgba(74,61,100,0.12)] bg-white/98 p-1 shadow-lg backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onEditEpic(epic);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#252331] hover:bg-[rgba(184,148,78,0.08)] hover:text-[#80642F] transition"
                >
                  <Pencil size={13} />
                  <span>Edit Epic</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setShowMediaModal(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#252331] hover:bg-[rgba(184,148,78,0.08)] hover:text-[#80642F] transition"
                >
                  <Paperclip size={13} />
                  <span>Attach Media...</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onAddStory(epic.id);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#252331] hover:bg-[rgba(184,148,78,0.08)] hover:text-[#80642F] transition"
                >
                  <Plus size={13} />
                  <span>Add Story</span>
                </button>

                {onNavigateToEpic && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onNavigateToEpic(epic.id);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#252331] hover:bg-[rgba(184,148,78,0.08)] hover:text-[#80642F] transition"
                  >
                    <Layers size={13} />
                    <span>View in Hierarchy</span>
                  </button>
                )}

                <div className="my-1 border-t border-[rgba(74,61,100,0.08)]" />

                <div className="px-2 py-1 text-[10px] font-bold uppercase text-[#9994A5]">
                  Set Priority
                </div>
                <div className="grid grid-cols-3 gap-1 px-1 pb-1">
                  {(["low", "medium", "high"] as EpicPriority[]).map((p) => {
                    const cfg = EPIC_PRIORITIES[p];
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          handlePrioritySelect(p);
                        }}
                        className={`text-[10px] font-bold py-1 rounded border text-center transition ${
                          optimisticPriority === p
                            ? `${cfg.badgeBg} ${cfg.badgeText} ${cfg.borderColor}`
                            : "bg-slate-50 text-slate-600 border-slate-200/60 hover:bg-slate-100"
                        }`}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>

                <div className="my-1 border-t border-[rgba(74,61,100,0.08)]" />

                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onDeleteEpic(epic.id);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                >
                  <Trash2 size={13} />
                  <span>Delete Epic</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Epic Title */}
      <h4
        onClick={() => onNavigateToEpic?.(epic.id)}
        className="text-sm font-bold tracking-tight text-[#252331] group-hover:text-[#80642F] transition-colors line-clamp-2 cursor-pointer leading-snug"
        title={epic.name}
      >
        {epic.name}
      </h4>

      {/* Description Snippet */}
      {cleanDesc ? (
        <p className="mt-1 text-xs text-[#706C7D] line-clamp-2 leading-relaxed">{cleanDesc}</p>
      ) : (
        <p className="mt-1 text-[11px] italic text-[#9994A5]">No scope description provided.</p>
      )}

      {/* Progress & Stories Metrics */}
      <div className="mt-3.5 pt-3 border-t border-[rgba(74,61,100,0.06)] space-y-2">
        {/* Progress Bar Row */}
        <div className="flex items-center justify-between text-[11px] font-semibold text-[#706C7D]">
          <span className="flex items-center gap-1">
            <Layers size={12} className="text-[#B8944E]" />
            <span>
              {totalStories} {totalStories === 1 ? "Story" : "Stories"}
            </span>
          </span>
          <span className="font-mono text-[#80642F] font-bold">{progressPercent}%</span>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(74,61,100,0.07)]">
          <div
            className="h-full rounded-full bg-[#B8944E] transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Breakdown Chips */}
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5 text-[10px] font-semibold">
          {doneCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-emerald-700 border border-emerald-200/60">
              <CheckCircle2 size={10} />
              {doneCount} Done
            </span>
          )}
          {activeCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-[rgba(184,148,78,0.1)] px-1.5 py-0.5 text-[#80642F] border border-[rgba(184,148,78,0.2)]">
              <Clock size={10} />
              {activeCount} Active
            </span>
          )}
          {newCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-1.5 py-0.5 text-sky-700 border border-sky-200/60">
              <Sparkles size={10} />
              {newCount} New
            </span>
          )}
          {totalStories === 0 && (
            <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-500">
              0 Stories
            </span>
          )}
        </div>

        {/* Client feedback alerts */}
        {changesRequestedCount > 0 && (
          <div className="flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200/80">
            <AlertTriangle size={11} className="shrink-0" />
            <span>{changesRequestedCount} changes requested</span>
          </div>
        )}
      </div>

      {/* Card Footer: Quick Navigation Link */}
      {onNavigateToEpic && (
        <div className="mt-3 pt-2 flex items-center justify-between text-[11px] text-[#706C7D]">
          <span className="text-[10px] text-[#9994A5]">Drag card to move column</span>
          <button
            type="button"
            onClick={() => onNavigateToEpic(epic.id)}
            className="inline-flex items-center gap-1 font-bold text-[#80642F] hover:text-[#5B461E] transition hover:underline"
          >
            <span>Stories</span>
            <ArrowRight size={11} />
          </button>
        </div>
      )}

      {/* Story 2: Media Upload Modal */}
      {showMediaModal && (
        <EpicMediaModal
          isOpen={showMediaModal}
          onClose={() => setShowMediaModal(false)}
          epic={epic}
        />
      )}
    </div>
  );
}

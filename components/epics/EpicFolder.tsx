"use client";

import React, { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  Layers,
  AlertCircle,
  Clock,
  CircleDot,
  PlayCircle,
  Eye,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  Minus,
  Paperclip,
} from "lucide-react";
import {
  type EpicKanbanStatus,
  type EpicPriority,
  EPIC_KANBAN_COLUMNS,
  EPIC_PRIORITIES,
  normalizeEpicStatus,
  getEpicStatusLabel,
  getNextEpicStatus,
  normalizeEpicPriority,
  cleanEpicDescription,
} from "@/lib/types/epic";
import { toast } from "@/lib/toast";
import { EpicMediaModal } from "./EpicMediaModal";

export interface EpicFolderProps {
  id: string;
  name: string;
  description?: string | null;
  status?: string | null;
  priority?: EpicPriority | string | null;
  creatorName?: string;
  storyCount: number;
  isExpanded: boolean;
  onToggle: () => void;
  onStatusCycle?: (newStatus: EpicKanbanStatus) => void;
  onPriorityChange?: (newPriority: EpicPriority) => void;
  actions?: React.ReactNode;
  headerExtra?: React.ReactNode;
  emptyMessage?: string;
  emptyAction?: React.ReactNode;
  children?: React.ReactNode;
  isUncategorized?: boolean;
  discussion?: React.ReactNode;
}

export function EpicFolder({
  id,
  name,
  description,
  status,
  priority,
  creatorName,
  storyCount,
  isExpanded,
  onToggle,
  onStatusCycle,
  onPriorityChange,
  actions,
  headerExtra,
  emptyMessage = "No stories in this Epic yet.",
  emptyAction,
  children,
  isUncategorized = false,
  discussion,
}: EpicFolderProps) {
  const contentId = `epic-folder-content-${id}`;

  const [optimisticStatus, setOptimisticStatus] = useState<EpicKanbanStatus>(
    normalizeEpicStatus(status)
  );
  const [optimisticPriority, setOptimisticPriority] = useState<EpicPriority>(
    normalizeEpicPriority(priority)
  );
  const [showMediaModal, setShowMediaModal] = useState(false);

  useEffect(() => {
    setOptimisticStatus(normalizeEpicStatus(status));
  }, [status]);

  useEffect(() => {
    setOptimisticPriority(normalizeEpicPriority(priority));
  }, [priority]);

  const columnConfig =
    EPIC_KANBAN_COLUMNS.find((c) => c.id === optimisticStatus) || EPIC_KANBAN_COLUMNS[0];
  const priorityConfig = EPIC_PRIORITIES[optimisticPriority] || EPIC_PRIORITIES.medium;

  // Story 1 (AC-1.2, AC-1.3): Status cycle
  const handleCycleStatus = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = getNextEpicStatus(optimisticStatus);
    setOptimisticStatus(next);
    onStatusCycle?.(next);
    toast.success("Epic status updated", `${name} moved to ${getEpicStatusLabel(next)}`);
  };

  // Story 3 (AC-3.1, AC-3.3): Priority change
  const handlePrioritySelect = (newPriority: EpicPriority, e?: React.ChangeEvent) => {
    e?.stopPropagation();
    setOptimisticPriority(newPriority);
    onPriorityChange?.(newPriority);
    toast.success("Priority updated", `${name} set to ${newPriority.toUpperCase()} priority`);
  };

  const renderPrioritySelect = (mobileOnly = false) => {
    if (isUncategorized) return null;
    return (
      <div
        className={`relative items-center shrink-0 ${
          mobileOnly ? "sm:hidden inline-flex" : "hidden sm:inline-flex"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <select
          value={optimisticPriority}
          onChange={(e) => handlePrioritySelect(e.target.value as EpicPriority, e)}
          aria-label={`Change priority for ${name}`}
          title={`Priority: ${priorityConfig.label} (Click to change)`}
          className={`appearance-none cursor-pointer rounded-md pl-3.5 pr-2 sm:pl-4 sm:pr-3 py-0.5 text-[8.5px] sm:text-[10px] font-bold uppercase tracking-wider border transition-colors outline-none focus:ring-1 focus:ring-[#CCA038] ${priorityConfig.badgeBg} ${priorityConfig.badgeText} ${priorityConfig.borderColor}`}
        >
          <option value="low">Low Priority</option>
          <option value="medium">Medium Priority</option>
          <option value="high">High Priority</option>
        </select>
        <span className="pointer-events-none absolute left-1 text-[8px] sm:text-[9px]">
          {optimisticPriority === "high" ? (
            <ArrowUp size={8} className="text-rose-600" />
          ) : optimisticPriority === "low" ? (
            <ArrowDown size={8} className="text-slate-500" />
          ) : (
            <Minus size={8} className="text-amber-600" />
          )}
        </span>
      </div>
    );
  };

  const renderStatusIcon = () => {
    switch (optimisticStatus) {
      case "backlog":
        return <Clock size={12} className="sm:w-3.5 sm:h-3.5 text-slate-500" />;
      case "todo":
        return <CircleDot size={12} className="sm:w-3.5 sm:h-3.5 text-amber-600" />;
      case "in_progress":
        return <PlayCircle size={12} className="sm:w-3.5 sm:h-3.5 text-[#785312]" />;
      case "qa_review":
        return <Eye size={12} className="sm:w-3.5 sm:h-3.5 text-purple-600" />;
      case "done":
        return <CheckCircle2 size={12} className="sm:w-3.5 sm:h-3.5 text-emerald-600" />;
      default:
        return <CircleDot size={12} className="sm:w-3.5 sm:h-3.5 text-slate-500" />;
    }
  };

  const cleanDesc = cleanEpicDescription(description);

  return (
    <div
      id={`epic-folder-${id}`}
      className={`relative rounded-[18px] border transition-all duration-200 focus-within:z-20 hover:z-10 w-full min-w-0 overflow-hidden ${
        isUncategorized
          ? "border-amber-200/90 bg-white/95 shadow-[0_4px_24px_rgba(180,120,40,0.08)] backdrop-blur-[16px]"
          : "border-slate-200/90 bg-white/95 shadow-[0_4px_24px_rgba(15,23,42,0.05)] backdrop-blur-[16px]"
      }`}
    >
      {/* Epic Header / Accordion Button */}
      <div
        className={`border-b rounded-t-[18px] transition-colors ${
          isUncategorized
            ? "border-amber-200/70 bg-amber-50/40"
            : "border-slate-200/70 bg-[#F8F9FB]/95"
        } p-2.5 sm:p-4`}
      >
        <div className="flex items-center justify-between gap-1.5 sm:gap-3 min-w-0">
          {/* Clickable Header Button */}
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isExpanded}
            aria-controls={contentId}
            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${name} folder`}
            className="flex items-center gap-1.5 sm:gap-3 text-left min-w-0 flex-1 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#CCA038] rounded-xl py-0.5 sm:py-1 px-1 -ml-1 transition cursor-pointer overflow-hidden"
          >
            {/* Expand / Collapse Chevron */}
            <span
              className={`grid h-6 w-6 sm:h-7 sm:w-7 shrink-0 place-items-center rounded-lg border transition ${
                isUncategorized
                  ? "border-amber-200 bg-amber-100/70 text-amber-800 group-hover:bg-amber-100"
                  : "border-[rgba(15,23,42,0.10)] bg-white text-[#334155] group-hover:text-[#0F172A] group-hover:border-[rgba(204,160,56,0.3)] shadow-2xs"
              }`}
            >
              {isExpanded ? (
                <ChevronDown size={13} className="sm:w-3.5 sm:h-3.5 transition-transform" />
              ) : (
                <ChevronRight size={13} className="sm:w-3.5 sm:h-3.5 transition-transform" />
              )}
            </span>

            {/* Folder Title + Count + Priority */}
            <span className="block min-w-0 flex-1 overflow-hidden">
              <span className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                {isUncategorized ? (
                  <span className="flex items-center gap-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
                    <AlertCircle size={10} />
                    Uncategorized
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-[#64748B] shrink-0">
                    <Layers size={10} className="text-[#CCA038]" />
                    Epic
                  </span>
                )}

                <span
                  className="text-xs sm:text-base font-semibold text-[#0F172A] tracking-tight truncate group-hover:text-[#785312] transition-colors shrink min-w-0"
                  title={name}
                >
                  {name}
                </span>

                {/* Story Count Badge */}
                <span
                  className={`rounded-full px-1.5 sm:px-2 py-0.2 text-[10px] sm:text-xs font-semibold tabular-nums border shrink-0 ${
                    isUncategorized
                      ? "bg-amber-100 text-amber-900 border-amber-200"
                      : "bg-gradient-to-b from-[#FEF9EE] to-[#F5EAD4] text-[#785312] border border-[#CCA038]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_1px_2px_rgba(120,80,15,0.06)]"
                  }`}
                  title={`${storyCount} ${storyCount === 1 ? "story" : "stories"}`}
                >
                  {storyCount}
                </span>

                {/* Desktop Priority Badge (AC-3.2, AC-3.3) */}
                {renderPrioritySelect(false)}

                {/* Desktop metadata inline */}
                <span className="hidden sm:inline-flex items-center gap-1.5 shrink-0">
                  {headerExtra}
                  {creatorName && (
                    <>
                      <span className="text-[rgba(15,23,42,0.2)] text-xs">•</span>
                      <span className="text-[10px] sm:text-[11px] font-medium text-[#334155]">
                        Created by {creatorName}
                      </span>
                    </>
                  )}
                </span>
              </span>

              {/* Desktop inline description */}
              {cleanDesc && (
                <span className="hidden sm:block mt-0.5 text-xs text-[#334155] line-clamp-1 leading-relaxed">
                  {cleanDesc}
                </span>
              )}
            </span>
          </button>

          {/* Action buttons & Top Right Status Indicator Icon */}
          <div
            className="flex items-center gap-1 sm:gap-1.5 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Story 2: Attach Media */}
            {!isUncategorized && (
              <button
                type="button"
                onClick={() => setShowMediaModal(true)}
                title={`Attach media for ${name}`}
                aria-label={`Attach images and videos to ${name}`}
                className="grid h-6 w-6 sm:h-7 sm:w-7 place-items-center rounded-lg border border-[rgba(15,23,42,0.12)] bg-white text-[#334155] transition-all hover:text-[#CCA038] hover:border-[rgba(204,160,56,0.3)] shadow-2xs cursor-pointer"
              >
                <Paperclip size={12} className="sm:w-3.5 sm:h-3.5" />
              </button>
            )}

            {/* Story 1: Status Indicator Icon in top right */}
            {!isUncategorized && (
              <button
                type="button"
                onClick={handleCycleStatus}
                title={`Status: ${getEpicStatusLabel(optimisticStatus)} • Click to advance status`}
                aria-label={`Current status: ${getEpicStatusLabel(optimisticStatus)}. Click to cycle.`}
                className={`group/icon relative grid h-6 w-6 sm:h-7 sm:w-7 place-items-center rounded-lg border transition-all duration-150 hover:scale-105 active:scale-95 shadow-2xs ${columnConfig.badgeBg} ${columnConfig.borderColor} border-[rgba(15,23,42,0.12)] hover:border-[#CCA038]`}
              >
                {renderStatusIcon()}
                <span className="sr-only">
                  {getEpicStatusLabel(optimisticStatus)} - Click to cycle status
                </span>
              </button>
            )}

            {actions}
          </div>
        </div>

        {/* Mobile Sub-Row: Clean Full-Width Metadata & Clamped Description */}
        <div className="sm:hidden mt-2 pt-1.5 border-t border-[rgba(15,23,42,0.06)] pl-7 pr-1 space-y-1">
          {/* Mobile Metadata: Priority Selector + Approved Count + Creator */}
          <div className="flex items-center gap-1.5 text-[10px] text-[#475569] flex-wrap">
            {renderPrioritySelect(true)}
            {headerExtra}
            {creatorName && (
              <>
                <span className="text-[rgba(15,23,42,0.2)]">•</span>
                <span className="truncate">By {creatorName}</span>
              </>
            )}
          </div>

          {/* Mobile Description (Clamped to 2 lines, spanning full width) */}
          {cleanDesc && (
            <p className="text-[11px] text-[#475569] line-clamp-2 leading-relaxed">
              {cleanDesc}
            </p>
          )}
        </div>
      </div>

      {isExpanded && (
        <div id={contentId} className="p-2.5 sm:p-4 bg-transparent animate-in fade-in-50 duration-150">
          {discussion && <div className="mb-3 sm:mb-4">{discussion}</div>}
          {storyCount === 0 ? (
            <div className="rounded-xl border border-dashed border-[rgba(15,23,42,0.12)] bg-[#F8F9FB]/60 py-6 px-3 text-center">
              <p className="text-xs text-[#334155]">{emptyMessage}</p>
              {emptyAction && <div className="mt-3 flex justify-center">{emptyAction}</div>}
            </div>
          ) : (
            <div className="space-y-3">{children}</div>
          )}
        </div>
      )}

      {showMediaModal && (
        <EpicMediaModal
          epicId={id}
          epicName={name}
          onClose={() => setShowMediaModal(false)}
        />
      )}
    </div>
  );
}

"use client";

import React, { useState, useMemo, useRef } from "react";
import { Plus, Layers, Filter, CheckCircle2, AlertCircle } from "lucide-react";
import { EpicKanbanCard } from "./EpicKanbanCard";
import type { Epic, Story } from "@/lib/types";
import {
  type EpicKanbanStatus,
  type EpicPriority,
  EPIC_KANBAN_COLUMNS,
  normalizeEpicStatus,
} from "@/lib/types/epic";
import { Button } from "@/components/ui/Button";

interface EpicKanbanBoardProps {
  epics: Epic[];
  stories: Story[];
  onEditEpic: (epic: Epic) => void;
  onDeleteEpic: (epicId: string) => void;
  onAddStory: (epicId: string) => void;
  onStatusChange: (epicId: string, newStatus: EpicKanbanStatus) => void;
  onPriorityChange?: (epicId: string, newPriority: EpicPriority) => void;
  onCreateEpicInStatus: (status: EpicKanbanStatus) => void;
  onNavigateToEpic?: (epicId: string) => void;
  searchFilter?: string;
}

export function EpicKanbanBoard({
  epics,
  stories,
  onEditEpic,
  onDeleteEpic,
  onAddStory,
  onStatusChange,
  onPriorityChange,
  onCreateEpicInStatus,
  onNavigateToEpic,
  searchFilter = "",
}: EpicKanbanBoardProps) {
  const [mobileActiveColumn, setMobileActiveColumn] = useState<EpicKanbanStatus>("in_progress");
  const [dragOverColumn, setDragOverColumn] = useState<EpicKanbanStatus | null>(null);
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Filter epics if search is provided
  const filteredEpics = useMemo(() => {
    if (!searchFilter.trim()) return epics;
    const q = searchFilter.toLowerCase().trim();
    return epics.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.description && e.description.toLowerCase().includes(q))
    );
  }, [epics, searchFilter]);

  // Group epics into the 5 Kanban columns
  const epicsByStatus = useMemo(() => {
    const map: Record<EpicKanbanStatus, Epic[]> = {
      backlog: [],
      todo: [],
      in_progress: [],
      qa_review: [],
      done: [],
    };

    for (const epic of filteredEpics) {
      const colStatus = normalizeEpicStatus(epic.status);
      if (map[colStatus]) {
        map[colStatus].push(epic);
      } else {
        map.backlog.push(epic);
      }
    }

    return map;
  }, [filteredEpics]);

  const scrollToColumn = (colId: EpicKanbanStatus) => {
    setMobileActiveColumn(colId);
    columnRefs.current[colId]?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, colId: EpicKanbanStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverColumn !== colId) {
      setDragOverColumn(colId);
    }
  };

  const handleDragLeave = (colId: EpicKanbanStatus) => {
    if (dragOverColumn === colId) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, colId: EpicKanbanStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const epicId = e.dataTransfer.getData("text/plain");
    if (epicId) {
      onStatusChange(epicId, colId);
    }
  };

  if (epics.length === 0) {
    return (
      <div className="rounded-[20px] border border-dashed border-[rgba(74,61,100,0.14)] bg-white/80 backdrop-blur-md p-10 sm:p-14 text-center shadow-[0_8px_30px_rgba(70,55,95,0.04)]">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[rgba(184,148,78,0.10)] text-[#B8944E] mb-4 shadow-sm border border-[rgba(184,148,78,0.18)]">
          <Layers size={22} />
        </div>
        <h3 className="text-base font-bold text-[#252331]">No Epics in this project yet</h3>
        <p className="mt-1.5 text-xs text-[#706C7D] max-w-md mx-auto">
          Epics organize feature stories into structured product areas. Create your first epic to populate the Kanban board.
        </p>
        <div className="mt-5">
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus size={14} />}
            onClick={() => onCreateEpicInStatus("backlog")}
          >
            Create First Epic
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Mobile Column Navigation Tabs */}
      <div className="flex lg:hidden items-center gap-1.5 overflow-x-auto pb-2 px-0.5 no-scrollbar">
        {EPIC_KANBAN_COLUMNS.map((col) => {
          const isActive = mobileActiveColumn === col.id;
          const count = (epicsByStatus[col.id] || []).length;
          return (
            <button
              key={col.id}
              type="button"
              onClick={() => scrollToColumn(col.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                isActive
                  ? "bg-[#252331] text-white shadow-xs"
                  : "bg-white text-[#706C7D] border border-[rgba(74,61,100,0.1)] hover:bg-[#FAF9FC]"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${col.dotColor}`} />
              <span>{col.badgeLabel}</span>
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

      {/* 5-Column Kanban Board Grid */}
      <div className="flex lg:grid lg:grid-cols-5 gap-4 overflow-x-auto pb-6 lg:pb-2 snap-x snap-mandatory lg:snap-none -mx-4 px-4 sm:mx-0 sm:px-0 items-start">
        {EPIC_KANBAN_COLUMNS.map((col) => {
          const columnEpics = epicsByStatus[col.id] || [];
          const isOver = dragOverColumn === col.id;

          return (
            <div
              key={col.id}
              ref={(el) => {
                columnRefs.current[col.id] = el;
              }}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={() => handleDragLeave(col.id)}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`w-[85vw] max-w-[340px] lg:max-w-none lg:w-auto shrink-0 lg:shrink flex flex-col rounded-[20px] border transition-all duration-200 p-3 sm:p-3.5 h-[480px] sm:h-[500px] snap-center ${
                isOver
                  ? "border-[#B8944E] bg-[rgba(184,148,78,0.06)] ring-2 ring-[#B8944E]/30"
                  : "border-[rgba(74,61,100,0.08)] bg-[#FBFAFD]/85"
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[rgba(74,61,100,0.06)]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${col.dotColor}`} />
                  <h3
                    className="text-xs font-bold uppercase tracking-wider text-[#252331] truncate"
                    title={col.label}
                  >
                    {col.label}
                  </h3>
                  <span
                    className={`rounded-full px-2 py-0.2 text-[11px] font-bold ${col.badgeBg} ${col.badgeText} shrink-0`}
                  >
                    {columnEpics.length}
                  </span>
                </div>

                {/* Add Epic in this status column */}
                <button
                  type="button"
                  onClick={() => onCreateEpicInStatus(col.id)}
                  title={`Add Epic to ${col.label}`}
                  className="rounded-lg p-1 text-[#706C7D] hover:text-[#80642F] hover:bg-[rgba(184,148,78,0.1)] transition-colors cursor-pointer"
                >
                  <Plus size={15} />
                </button>
              </div>

              {/* Column Subtitle / Scope Hint */}
              <p className="text-[10px] text-[#9994A5] mb-3 px-0.5 line-clamp-1">
                {col.description}
              </p>

              {/* Epic Cards Container */}
              <div className="space-y-3 flex-1 min-h-0 overflow-y-auto pr-1 pb-1 [scrollbar-width:thin] [scrollbar-color:rgba(74,61,100,0.2)_transparent]">
                {columnEpics.length > 0 ? (
                  columnEpics.map((epic) => (
                    <EpicKanbanCard
                      key={epic.id}
                      epic={epic}
                      stories={stories}
                      onEditEpic={onEditEpic}
                      onDeleteEpic={onDeleteEpic}
                      onAddStory={onAddStory}
                      onStatusChange={onStatusChange}
                      onPriorityChange={onPriorityChange}
                      onNavigateToEpic={onNavigateToEpic}
                    />
                  ))
                ) : (
                  <div
                    onClick={() => onCreateEpicInStatus(col.id)}
                    className="h-36 flex flex-col items-center justify-center text-center px-4 rounded-xl border border-dashed border-[rgba(74,61,100,0.1)] bg-white/40 hover:bg-white/70 hover:border-[#B8944E]/40 transition cursor-pointer group"
                  >
                    <p className="text-xs text-[#9994A5] font-medium group-hover:text-[#706C7D]">
                      No epics in {col.badgeLabel}
                    </p>
                    <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-[#80642F] group-hover:underline">
                      <Plus size={12} /> Add Epic
                    </span>
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

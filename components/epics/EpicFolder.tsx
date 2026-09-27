"use client";

import React from "react";
import { ChevronDown, ChevronRight, Layers, AlertCircle } from "lucide-react";

export interface EpicFolderProps {
  id: string;
  name: string;
  description?: string | null;
  creatorName?: string;
  storyCount: number;
  isExpanded: boolean;
  onToggle: () => void;
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
  creatorName,
  storyCount,
  isExpanded,
  onToggle,
  actions,
  headerExtra,
  emptyMessage = "No stories in this Epic yet.",
  emptyAction,
  children,
  isUncategorized = false,
  discussion,
}: EpicFolderProps) {
  const contentId = `epic-folder-content-${id}`;

  return (
    <div
      id={`epic-folder-${id}`}
      className={`relative rounded-[18px] border transition-all duration-200 focus-within:z-20 hover:z-10 w-full min-w-0 overflow-hidden ${
        isUncategorized
          ? "border-amber-200/90 bg-white/90 shadow-[0_8px_30px_rgba(180,120,40,0.06)] backdrop-blur-[16px]"
          : "border-[rgba(74,61,100,0.08)] bg-white/88 shadow-[0_8px_30px_rgba(70,55,95,0.055)] backdrop-blur-[16px]"
      }`}
    >
      {/* Epic Header / Accordion Button */}
      <div
        className={`border-b rounded-t-[18px] transition-colors ${
          isUncategorized
            ? "border-amber-200/70 bg-amber-50/40"
            : "border-[rgba(74,61,100,0.06)] bg-[#FAF9FC]/90"
        } p-3 sm:p-4`}
      >
        <div className="flex items-center justify-between gap-2 sm:gap-3 min-w-0">
          {/* Clickable Header Button */}
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isExpanded}
            aria-controls={contentId}
            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${name} folder`}
            className="flex items-center gap-2 sm:gap-3 text-left min-w-0 flex-1 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8944E] rounded-xl py-0.5 sm:py-1 px-1 -ml-1 transition cursor-pointer overflow-hidden"
          >
            {/* Expand / Collapse Chevron */}
            <span
              className={`grid h-6 w-6 sm:h-7 sm:w-7 shrink-0 place-items-center rounded-lg border transition ${
                isUncategorized
                  ? "border-amber-200 bg-amber-100/70 text-amber-800 group-hover:bg-amber-100"
                  : "border-[rgba(74,61,100,0.10)] bg-white text-[#706C7D] group-hover:text-[#252331] group-hover:border-[rgba(184,148,78,0.3)] shadow-2xs"
              }`}
            >
              {isExpanded ? (
                <ChevronDown size={15} className="transition-transform" />
              ) : (
                <ChevronRight size={15} className="transition-transform" />
              )}
            </span>

            {/* Folder Title + Count */}
            <span className="block min-w-0 flex-1 overflow-hidden">
              <span className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                {isUncategorized ? (
                  <span className="flex items-center gap-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
                    <AlertCircle size={10} />
                    Uncategorized
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-[#9994A5] shrink-0">
                    <Layers size={10} className="text-[#B8944E]" />
                    Epic
                  </span>
                )}

                <span
                  className="text-xs sm:text-base font-semibold text-[#252331] tracking-tight truncate max-w-[130px] xs:max-w-[180px] sm:max-w-none group-hover:text-[#80642F] transition-colors"
                  title={name}
                >
                  {name}
                </span>

                {/* Story Count Badge */}
                <span
                  className={`rounded-full px-1.5 sm:px-2 py-0.2 text-[10px] sm:text-xs font-semibold tabular-nums border shrink-0 ${
                    isUncategorized
                      ? "bg-amber-100 text-amber-900 border-amber-200"
                      : "bg-[rgba(184,148,78,0.10)] text-[#80642F] border-[rgba(184,148,78,0.16)]"
                  }`}
                  title={`${storyCount} ${storyCount === 1 ? "story" : "stories"}`}
                >
                  {storyCount}
                </span>

                {headerExtra}

                {creatorName && (
                  <>
                    <span className="text-[rgba(74,61,100,0.2)] text-xs hidden sm:inline">•</span>
                    <span className="text-[10px] sm:text-[11px] font-medium text-[#706C7D] hidden xs:inline">
                      Created by {creatorName}
                    </span>
                  </>
                )}
              </span>

              {description && (
                <span className="block mt-0.5 text-[11px] sm:text-xs text-[#706C7D] line-clamp-1 leading-relaxed">
                  {description}
                </span>
              )}
            </span>
          </button>

          {/* Action buttons (isolated from toggle click) */}
          {actions && (
            <div
              className="flex items-center gap-1 sm:gap-2 shrink-0 self-center"
              onClick={(e) => e.stopPropagation()}
            >
              {actions}
            </div>
          )}
        </div>
      </div>

      {isExpanded && (
        <div id={contentId} className="p-3 sm:p-4 bg-transparent animate-in fade-in-50 duration-150">
          {discussion && <div className="mb-4">{discussion}</div>}
          {storyCount === 0 ? (
            <div className="rounded-xl border border-dashed border-[rgba(74,61,100,0.12)] bg-[#FAF9FC]/60 py-7 px-4 text-center">
              <p className="text-xs text-[#706C7D]">{emptyMessage}</p>
              {emptyAction && <div className="mt-3 flex justify-center">{emptyAction}</div>}
            </div>
          ) : (
            <div className="space-y-3">{children}</div>
          )}
        </div>
      )}
    </div>
  );
}

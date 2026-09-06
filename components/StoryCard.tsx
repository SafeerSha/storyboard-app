import React from "react";
import { CheckCircle2, MessageSquare } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import type { Story } from "@/lib/types";

interface StoryCardProps {
  story: Story;
  isSelected?: boolean;
  openFeedbackCount?: number;
  onClick?: () => void;
}

export function StoryCard({
  story,
  isSelected = false,
  openFeedbackCount,
  onClick,
}: StoryCardProps) {
  const statusVariant = (story.status || "review") as BadgeVariant;
  const criteriaCount = story.acceptance_criteria?.length ?? 0;
  const assumptionsCount = story.assumptions?.length ?? 0;
  const clarificationsCount = story.clarifications?.length ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full text-left rounded-xl border p-4 transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 cursor-pointer ${
        isSelected
          ? "border-indigo-500 bg-indigo-50/20 shadow-xs ring-1 ring-indigo-500/20"
          : "border-zinc-200/80 bg-white hover:border-zinc-300 hover:shadow-card"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Metadata Row */}
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Story
            </span>
            <span className="text-zinc-300 text-xs">•</span>
            <span className="text-[11px] font-medium text-zinc-500">
              {criteriaCount} {criteriaCount === 1 ? "criterion" : "criteria"}
            </span>

            {story.team_review_status === "approved" && (
              <>
                <span className="text-zinc-300 text-xs">•</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/60">
                  <CheckCircle2 size={11} className="stroke-[2.5]" />
                  Team Approved
                </span>
              </>
            )}

            {openFeedbackCount !== undefined && openFeedbackCount > 0 && (
              <>
                <span className="text-zinc-300 text-xs">•</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200/80">
                  <MessageSquare size={11} />
                  {openFeedbackCount} open feedback
                </span>
              </>
            )}
          </div>

          {/* Title */}
          <h4 className="text-sm font-semibold text-slate-900 tracking-tight group-hover:text-indigo-600 transition truncate">
            {story.title}
          </h4>

          {/* Description */}
          {story.description && (
            <p className="mt-1 text-xs text-zinc-500 line-clamp-2 leading-relaxed">
              {story.description}
            </p>
          )}
        </div>

        {/* Status Badge */}
        <Badge variant={statusVariant} size="sm" className="shrink-0" />
      </div>

      {/* Subtle counts summary if assumptions or clarifications exist */}
      {(assumptionsCount > 0 || clarificationsCount > 0) && (
        <div className="mt-2.5 pt-2 border-t border-zinc-100 flex items-center gap-3 text-[11px] text-zinc-400">
          {assumptionsCount > 0 && (
            <span>
              • {assumptionsCount} {assumptionsCount === 1 ? "assumption" : "assumptions"}
            </span>
          )}
          {clarificationsCount > 0 && (
            <span>
              ? {clarificationsCount} {clarificationsCount === 1 ? "clarification" : "clarifications"}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

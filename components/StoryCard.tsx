"use client";

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
      className={`group w-full text-left rounded-xl border p-3.5 sm:p-4 transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B8944E] cursor-pointer ${
        isSelected
          ? "border-[#B8944E] bg-[rgba(184,148,78,0.06)] shadow-xs ring-1 ring-[#B8944E]/25"
          : "border-[rgba(74,61,100,0.08)] bg-white hover:border-[#B8944E]/30 hover:shadow-[0_4px_20px_rgba(70,55,95,0.05)]"
      }`}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="block min-w-0 flex-1">
          {/* Metadata Row */}
          <span className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#9994A5]">
              Story
            </span>
            <span className="text-[rgba(74,61,100,0.2)] text-xs">•</span>
            <span className="text-[11px] font-medium text-[#706C7D]">
              {criteriaCount} {criteriaCount === 1 ? "criterion" : "criteria"}
            </span>

            {story.team_review_status === "approved" && (
              <>
                <span className="text-[rgba(74,61,100,0.2)] text-xs">•</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#2E8B70] bg-[rgba(46,139,112,0.08)] px-1.5 py-0.2 rounded border border-[rgba(46,139,112,0.16)]">
                  <CheckCircle2 size={11} className="stroke-[2.5]" />
                  Team Approved
                </span>
              </>
            )}

            {story.reviewers && story.reviewers.length > 0 && (
              <>
                <span className="text-[rgba(74,61,100,0.2)] text-xs">•</span>
                <span
                  className="text-[11px] font-medium text-[#706C7D] bg-zinc-100 px-1.5 py-0.2 rounded border border-zinc-200"
                  title={`Reviewers: ${story.reviewers.map((r) => `${r.name || r.username}${r.role && r.role !== "member" ? ` (${r.role})` : ""}`).join(", ")}`}
                >
                  {story.reviewers.length} {story.reviewers.length === 1 ? "reviewer" : "reviewers"}
                </span>
              </>
            )}

            {openFeedbackCount !== undefined && openFeedbackCount > 0 && (
              <>
                <span className="text-[rgba(74,61,100,0.2)] text-xs">•</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#A87936] bg-[rgba(168,121,54,0.08)] px-1.5 py-0.2 rounded border border-[rgba(168,121,54,0.16)]">
                  <MessageSquare size={11} />
                  {openFeedbackCount} open feedback
                </span>
              </>
            )}
          </span>

          {/* Title */}
          <span className="block text-sm font-semibold text-[#252331] tracking-tight group-hover:text-[#80642F] transition truncate">
            {story.title}
          </span>

          {/* Description */}
          {story.description && (
            <span className="block mt-1 text-xs text-[#706C7D] leading-relaxed">
              {story.description}
            </span>
          )}
        </span>

        {/* Status Badge */}
        <Badge variant={statusVariant} size="sm" className="shrink-0" />
      </span>

      {/* Subtle counts summary if assumptions or clarifications exist */}
      {(assumptionsCount > 0 || clarificationsCount > 0) && (
        <span className="mt-2.5 pt-2 border-t border-[rgba(74,61,100,0.06)] flex items-center gap-3 text-[11px] text-[#9994A5]">
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
        </span>
      )}
    </button>
  );
}

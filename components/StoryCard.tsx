"use client";

import React from "react";
import {
  CheckCircle2,
  MessageSquare,
  CheckSquare,
  Plus,
  GitBranch,
  GitPullRequest,
} from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { normalizeStoryStatus, type Story } from "@/lib/types";
import type { StoryGitLinkField } from "@/components/stories/StoryGitLinksModal";

interface StoryCardProps {
  story: Story;
  isSelected?: boolean;
  openFeedbackCount?: number;
  creatorName?: string;
  tasksCount?: number;
  completedTasksCount?: number;
  onCreateTask?: (story: Story) => void;
  onEditGitLinks?: (story: Story, field: StoryGitLinkField) => void;
  onClick?: () => void;
}

export function StoryCard({
  story,
  isSelected = false,
  openFeedbackCount,
  creatorName,
  tasksCount,
  completedTasksCount,
  onCreateTask,
  onEditGitLinks,
  onClick,
}: StoryCardProps) {
  const statusVariant = normalizeStoryStatus(story.status);
  const criteriaCount = story.acceptance_criteria?.length ?? 0;
  const assumptionsCount = story.assumptions?.length ?? 0;
  const clarificationsCount = story.clarifications?.length ?? 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={`group w-full min-w-0 text-left rounded-xl border p-3.5 sm:p-4 transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CCA038] cursor-pointer select-none ${
        isSelected
          ? "border-[#CCA038] bg-gradient-to-b from-white via-white to-[#FDFBF7] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_4px_16px_rgba(15,23,42,0.07),0_1.5px_3px_rgba(180,130,30,0.18)] ring-1 ring-[#CCA038]/40"
          : "border-slate-200/90 bg-white hover:border-[#CCA038]/40 hover:shadow-[0_4px_16px_rgba(15,23,42,0.05)]"
      }`}
    >
      <div className="flex items-start justify-between gap-2.5 sm:gap-3 min-w-0 w-full">
        <div className="min-w-0 flex-1">
          {/* Metadata Row */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
              Story
            </span>
            <span className="text-[rgba(15,23,42,0.2)] text-xs">•</span>
            <span className="text-[11px] font-medium text-[#334155]">
              {criteriaCount} {criteriaCount === 1 ? "criterion" : "criteria"}
            </span>

            {story.team_review_status === "approved" && (
              <>
                <span className="text-[rgba(15,23,42,0.2)] text-xs">•</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#059669] bg-[rgba(5,150,105,0.08)] px-1.5 py-0.2 rounded border border-[rgba(5,150,105,0.16)]">
                  <CheckCircle2 size={11} className="stroke-[2.5]" />
                  Team Approved
                </span>
              </>
            )}

            {story.reviewers && story.reviewers.length > 0 && (
              <>
                <span className="text-[rgba(15,23,42,0.2)] text-xs">•</span>
                <span
                  className="text-[11px] font-medium text-[#334155] bg-zinc-100 px-1.5 py-0.2 rounded border border-zinc-200"
                  title={`Reviewers: ${story.reviewers.map((r) => `${r.name || r.username}${r.role && r.role !== "member" ? ` (${r.role})` : ""}`).join(", ")}`}
                >
                  {story.reviewers.length} {story.reviewers.length === 1 ? "reviewer" : "reviewers"}
                </span>
              </>
            )}

            {openFeedbackCount !== undefined && openFeedbackCount > 0 && (
              <>
                <span className="text-[rgba(15,23,42,0.2)] text-xs">•</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#D97706] bg-[rgba(217,119,6,0.08)] px-1.5 py-0.2 rounded border border-[rgba(217,119,6,0.16)]">
                  <MessageSquare size={11} />
                  {openFeedbackCount} open feedback
                </span>
              </>
            )}

            {tasksCount !== undefined && tasksCount > 0 && (
              <>
                <span className="text-[rgba(15,23,42,0.2)] text-xs">•</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#785312] bg-gradient-to-b from-[#FEF9EE] to-[#F5EAD4] px-1.5 py-0.2 rounded border border-[#CCA038]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_1px_2px_rgba(120,80,15,0.06)]">
                  <CheckSquare size={11} />
                  {completedTasksCount !== undefined ? `${completedTasksCount}/${tasksCount}` : tasksCount} {tasksCount === 1 ? "task" : "tasks"}
                </span>
              </>
            )}

            {story.feature_branch && (
              <>
                <span className="text-[rgba(15,23,42,0.2)] text-xs">•</span>
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#334155] bg-zinc-100 px-1.5 py-0.2 rounded border border-zinc-200 max-w-[200px]"
                  title={`Feature branch: ${story.feature_branch}`}
                >
                  <GitBranch size={11} className="shrink-0" />
                  <span className="font-mono truncate">{story.feature_branch}</span>
                </span>
              </>
            )}

            {story.pull_request_url && (
              <>
                <span className="text-[rgba(15,23,42,0.2)] text-xs">•</span>
                <a
                  href={story.pull_request_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6E5494] bg-[rgba(110,84,148,0.08)] px-1.5 py-0.2 rounded border border-[rgba(110,84,148,0.16)] hover:bg-[rgba(110,84,148,0.15)] transition"
                  title={`Pull request: ${story.pull_request_url}`}
                >
                  <GitPullRequest size={11} className="stroke-[2.5]" />
                  Pull Request
                </a>
              </>
            )}

            {creatorName && (
              <>
                <span className="text-[rgba(15,23,42,0.2)] text-xs">•</span>
                <span className="text-[11px] font-medium text-[#334155] truncate max-w-[140px]">
                  By {creatorName}
                </span>
              </>
            )}
          </div>

          {/* Title - line-clamp-2 ensures full titles display and wrap gracefully */}
          <div className="text-xs sm:text-sm font-semibold text-[#0F172A] tracking-tight group-hover:text-[#785312] transition line-clamp-2 leading-snug">
            {story.title}
          </div>

          {/* Description - clean line-clamped preview */}
          {story.description && (
            <p className="mt-1 text-xs text-[#334155] leading-relaxed line-clamp-2 sm:line-clamp-3">
              {story.description}
            </p>
          )}
        </div>

        {/* Actions & Status Badge - hover buttons hidden on mobile to free up entire card width */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {onCreateTask && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCreateTask(story);
              }}
              title="Create new task against this story"
              className="hidden sm:inline-flex opacity-0 group-hover:opacity-100 transition-opacity items-center gap-1 text-[11px] font-semibold text-[#785312] hover:bg-[rgba(204,160,56,0.15)] bg-[rgba(204,160,56,0.08)] px-2 py-0.5 rounded-lg border border-[rgba(204,160,56,0.2)] cursor-pointer"
            >
              <Plus size={11} className="stroke-[2.5]" />
              <span>Task</span>
            </button>
          )}
          {onEditGitLinks && !story.feature_branch && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEditGitLinks(story, "feature_branch");
              }}
              title="Add feature branch for this story"
              className="hidden sm:inline-flex opacity-0 group-hover:opacity-100 transition-opacity items-center gap-1 text-[11px] font-semibold text-[#4A5B8C] hover:bg-[rgba(74,91,140,0.15)] bg-[rgba(74,91,140,0.07)] px-2 py-0.5 rounded-lg border border-[rgba(74,91,140,0.2)] cursor-pointer"
            >
              <GitBranch size={11} className="stroke-[2.5]" />
              <span>Branch</span>
            </button>
          )}
          {onEditGitLinks && !story.pull_request_url && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEditGitLinks(story, "pull_request_url");
              }}
              title="Add pull request link for this story"
              className="hidden sm:inline-flex opacity-0 group-hover:opacity-100 transition-opacity items-center gap-1 text-[11px] font-semibold text-[#6E5494] hover:bg-[rgba(110,84,148,0.15)] bg-[rgba(110,84,148,0.07)] px-2 py-0.5 rounded-lg border border-[rgba(110,84,148,0.2)] cursor-pointer"
            >
              <GitPullRequest size={11} className="stroke-[2.5]" />
              <span>PR</span>
            </button>
          )}
          <Badge variant={statusVariant} size="sm" className="shrink-0" />
        </div>
      </div>

      {/* Subtle counts summary if assumptions or clarifications exist */}
      {(assumptionsCount > 0 || clarificationsCount > 0) && (
        <div className="mt-2 pt-1.5 border-t border-[rgba(15,23,42,0.06)] flex items-center gap-3 text-[11px] text-[#64748B]">
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
    </div>
  );
}

"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { ClientStoryReview } from "@/components/ClientStoryReview";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { Story } from "@/lib/types";
import { normalizeStoryStatus } from "@/lib/types";

export interface EnrichedClientStory extends Story {
  epic_name?: string;
  open_feedback_count?: number;
}

export function formatRelativeTime(isoString?: string): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function getClientStatusMeta(story: {
  status?: string;
  client_review_status?: string;
  team_review_status?: string;
  team_approved_by_name?: string | null;
  open_feedback_count?: number;
}) {
  if (story.client_review_status === "approved" || story.status === "approved") {
    return {
      label: "Approved",
      icon: CheckCircle2,
      colorClasses: "bg-emerald-50 text-emerald-800 border-emerald-200/80",
    };
  }
  if (story.client_review_status === "changes_requested" || story.status === "changes_requested") {
    if (story.team_review_status === "approved") {
      return {
        label: "Team Responded",
        icon: Sparkles,
        colorClasses: "bg-[rgba(184,148,78,0.14)] text-[#80642F] border-[rgba(184,148,78,0.24)]",
      };
    }
    return {
      label: "Changes Requested",
      icon: AlertCircle,
      colorClasses: "bg-rose-50 text-rose-800 border-rose-200/80",
    };
  }
  if (story.team_review_status === "approved") {
    return {
      label: "Ready for Your Review",
      icon: Sparkles,
      colorClasses: "bg-[rgba(184,148,78,0.12)] text-[#80642F] border-[rgba(184,148,78,0.22)]",
    };
  }
  return {
    label: "Needs Your Review",
    icon: Clock,
    colorClasses: "bg-zinc-100 text-zinc-700 border-zinc-200",
  };
}

interface ClientStoryCardProps {
  story: EnrichedClientStory;
  isOpen?: boolean;
  onToggle?: () => void;
  onStatusChange?: (newStatus: string) => void;
  compact?: boolean;
  viewerId?: string;
}

export function ClientStoryCard({
  story,
  isOpen: controlledIsOpen,
  onToggle,
  onStatusChange,
  compact = false,
  viewerId,
}: ClientStoryCardProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalOpen;

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalOpen((prev) => !prev);
    }
  };

  const statusMeta = getClientStatusMeta(story);
  const StatusIcon = statusMeta.icon;
  const isApproved =
    story.client_review_status === "approved" || story.status === "approved";
  const isChangesRequested =
    story.client_review_status === "changes_requested" ||
    story.status === "changes_requested";
  const openThreads = story.open_feedback_count || 0;

  return (
    <div
      id={`story-${story.id}`}
      className={`group rounded-[18px] border transition-all duration-200 overflow-hidden ${
        isApproved
          ? "bg-[rgba(46,139,112,0.04)] border-[rgba(46,139,112,0.20)] shadow-[0_4px_20px_rgba(46,139,112,0.04)]"
          : isChangesRequested
          ? "bg-[rgba(244,63,94,0.03)] border-rose-200/80 shadow-[0_4px_20px_rgba(244,63,94,0.04)]"
          : "bg-white/88 border-[rgba(74,61,100,0.08)] hover:border-[#B8944E]/30 shadow-[0_6px_24px_rgba(70,55,95,0.04)] backdrop-blur-[16px]"
      }`}
    >
      {/* Header / Summary row */}
      <div
        onClick={handleToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleToggle();
          }
        }}
        className="cursor-pointer p-4 sm:p-5 outline-none select-none transition-colors hover:bg-white/50"
      >
        <div className="flex flex-col gap-3.5">
          <div className="min-w-0">
            {/* Meta badges row */}
            <div className="flex flex-wrap items-center gap-2 text-xs mb-1.5 font-medium">
              {story.epic_name && (
                <span className="inline-flex items-center gap-1 rounded-md bg-[rgba(74,61,100,0.06)] px-2 py-0.5 text-[11px] font-semibold text-[#706C7D] border border-[rgba(74,61,100,0.08)]">
                  <Bookmark size={11} className="text-[#B8944E]" />
                  <span className="truncate max-w-[150px]">{story.epic_name}</span>
                </span>
              )}

              <span className="inline-flex items-center gap-1 text-[11px] text-[#706C7D]">
                <Check size={12} className="text-[#80642F]" />
                <span>{story.acceptance_criteria?.length ?? 0} criteria</span>
              </span>

              {openThreads > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 border border-rose-200">
                  <MessageSquare size={11} />
                  <span>
                    {openThreads} {openThreads === 1 ? "change request" : "change requests"}
                  </span>
                </span>
              )}

              {story.team_approved_by_name && (
                <span className="text-[11px] text-[#706C7D]/80">
                  • Team Signed Off
                </span>
              )}
            </div>

            {/* Story Title */}
            <h3
              className={`text-sm sm:text-base font-bold tracking-tight text-[#252331] transition-colors line-clamp-2 mb-1 ${
                isOpen ? "text-[#80642F]" : "group-hover:text-[#80642F]"
              }`}
            >
              {story.title}
            </h3>

            {!compact && story.description && !isOpen && (
              <p className="mt-1 text-xs text-[#706C7D] line-clamp-2 max-w-3xl">
                {story.description}
              </p>
            )}
          </div>

          {/* Bottom Action & Status Badge */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Development Status Badge (Read-only) */}
              <Badge variant={normalizeStoryStatus(story.status)} size="sm" />

              {/* Client Status Badge */}
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${statusMeta.colorClasses}`}
              >
                <StatusIcon size={12} className="shrink-0" />
                <span>{statusMeta.label}</span>
              </span>

              {/* Relative updated timestamp */}
              <span className="text-[11px] text-[#A09CAB]">
                {formatRelativeTime(story.updated_at)}
              </span>
            </div>

            {/* Expand / Review CTA */}
            <div className="flex items-center gap-2">
              <Button
                variant={isOpen ? "secondary" : "primary"}
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggle();
                }}
                className={
                  !isOpen
                    ? "bg-[#B8944E] hover:bg-[#9F7D3E] text-white border-none shadow-xs text-xs"
                    : "text-xs"
                }
              >
                {isOpen ? "Collapse" : "Review →"}
              </Button>

              <div className="grid h-7 w-7 place-items-center rounded-lg text-[#9994A5] group-hover:text-[#252331] transition bg-white/50 border border-transparent group-hover:border-[rgba(74,61,100,0.08)]">
                <ChevronDown
                  size={16}
                  className={`transition-transform duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Review Body */}
      {isOpen && (
        <div className="border-t border-[rgba(74,61,100,0.08)] bg-white/95 p-4 sm:p-6 backdrop-blur-[20px] space-y-5">
          {story.description && (
            <div className="rounded-xl border border-[rgba(74,61,100,0.06)] bg-[rgba(74,61,100,0.02)] p-4">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#80642F] mb-1">
                Story Requirement Summary
              </h4>
              <p className="text-xs sm:text-sm text-[#252331] leading-relaxed whitespace-pre-wrap">
                {story.description}
              </p>
            </div>
          )}

          {/* Reusable Client Review Experience */}
          <ClientStoryReview
            story={story}
            viewerId={viewerId}
            onStatusChange={(newStatus) => {
              if (onStatusChange) onStatusChange(newStatus);
            }}
          />
        </div>
      )}
    </div>
  );
}

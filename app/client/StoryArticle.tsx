"use client";

import { ChevronDown } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { ClientStoryReview } from "@/components/ClientStoryReview";
import { useStoryAccordion } from "./StoryAccordionContext";
import type { Story } from "@/lib/types";

export function StoryArticle({ story }: { story: Story }) {
  const { openStoryId, setOpenStoryId } = useStoryAccordion();
  const isOpen = openStoryId === story.id;
  const statusVariant = (story.status || "review") as BadgeVariant;

  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white shadow-xs overflow-hidden transition-all">
      <div
        className="flex cursor-pointer flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 outline-none hover:bg-zinc-50/50 transition-colors select-none"
        onClick={() => setOpenStoryId(isOpen ? null : story.id)}
        role="button"
        aria-expanded={isOpen}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Feature
            </span>
            <span className="text-zinc-300">•</span>
            <span className="text-xs text-zinc-500">
              {story.acceptance_criteria?.length ?? 0} criteria
            </span>
          </div>
          <h3
            className={`text-sm sm:text-base font-semibold text-slate-900 tracking-tight transition-colors truncate ${
              isOpen ? "text-indigo-600" : ""
            }`}
          >
            {story.title}
          </h3>
          {story.description && (
            <p className="mt-1 text-xs text-zinc-500 line-clamp-1">
              {story.description}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
          <Badge variant={statusVariant} size="sm" />
          <div className="grid h-7 w-7 place-items-center rounded text-zinc-400 transition">
            <ChevronDown
              className={`transition-transform duration-200 ${
                isOpen ? "rotate-180" : ""
              }`}
              size={16}
            />
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-zinc-100 p-4 sm:p-6 bg-white space-y-5">
          {story.description && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                Summary
              </h4>
              <p className="text-xs sm:text-sm leading-relaxed text-zinc-700 whitespace-pre-wrap">
                {story.description}
              </p>
            </div>
          )}

          <ClientStoryReview story={story} />
        </div>
      )}
    </div>
  );
}

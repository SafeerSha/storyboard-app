"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowRight,
  CheckCircle2,
  Clock,
  Compass,
  ExternalLink,
  FlaskConical,
  FolderKanban,
  Lightbulb,
  MoreHorizontal,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react";
import { DropdownMenu, type DropdownItem } from "@/components/ui/DropdownMenu";
import type { InboxItemPriority, InboxItemStatus, InboxItemType, ProjectInboxItem } from "@/lib/types";

interface InboxCardProps {
  item: ProjectInboxItem;
  onEdit?: (item: ProjectInboxItem) => void;
  onConvert?: (item: ProjectInboxItem) => void;
  onStatusChange?: (item: ProjectInboxItem, newStatus: InboxItemStatus) => void;
  onPriorityChange?: (item: ProjectInboxItem, newPriority: InboxItemPriority) => void;
  onArchiveToggle?: (item: ProjectInboxItem) => void;
  onDelete?: (item: ProjectInboxItem) => void;
}

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getTypeMeta(type: InboxItemType) {
  switch (type) {
    case "upcoming_project":
      return { label: "Upcoming Project", icon: "📱", color: "text-blue-700 bg-blue-50 border-blue-200/80" };
    case "research":
      return { label: "Research", icon: "🔬", color: "text-purple-700 bg-purple-50 border-purple-200/80" };
    case "opportunity":
      return { label: "Opportunity", icon: "⚡", color: "text-emerald-700 bg-emerald-50 border-emerald-200/80" };
    case "experiment":
      return { label: "Experiment", icon: "🧪", color: "text-cyan-700 bg-cyan-50 border-cyan-200/80" };
    case "feature":
      return { label: "Feature", icon: "🧩", color: "text-indigo-700 bg-indigo-50 border-indigo-200/80" };
    default:
      return { label: "Product Idea", icon: "🧠", color: "text-amber-700 bg-amber-50 border-amber-200/80" };
  }
}

function getStatusBadge(status: InboxItemStatus) {
  switch (status) {
    case "exploring":
      return { label: "Exploring", className: "bg-sky-50 text-sky-700 border-sky-200/80" };
    case "researching":
      return { label: "Researching", className: "bg-purple-50 text-purple-700 border-purple-200/80" };
    case "planned":
      return { label: "Planned", className: "bg-indigo-50 text-indigo-700 border-indigo-200/80" };
    case "ready":
      return { label: "Ready", className: "bg-emerald-50 text-emerald-700 border-emerald-200/80" };
    case "archived":
      return { label: "Archived", className: "bg-zinc-100 text-zinc-600 border-zinc-200" };
    default:
      return { label: "Inbox", className: "bg-slate-100 text-slate-700 border-slate-200" };
  }
}

function getPriorityIndicator(priority: InboxItemPriority) {
  switch (priority) {
    case "high":
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/80">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          High priority
        </span>
      );
    case "low":
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
          Low priority
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 bg-indigo-50/70 px-2 py-0.5 rounded-full border border-indigo-100">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
          Medium
        </span>
      );
  }
}

export function InboxCard({
  item,
  onEdit,
  onConvert,
  onStatusChange,
  onPriorityChange,
  onArchiveToggle,
  onDelete,
}: InboxCardProps) {
  const typeMeta = getTypeMeta(item.type);
  const statusMeta = getStatusBadge(item.status);
  const router = useRouter();

  const menuItems: DropdownItem[] = [
    {
      label: "Open Workspace",
      icon: <Compass size={14} className="text-slate-400" />,
      onClick: () => router.push(`/inbox/${item.id}`),
    },
    ...(onEdit
      ? [
          {
            label: "Edit Details",
            icon: <Pencil size={14} className="text-slate-400" />,
            onClick: () => onEdit(item),
          },
        ]
      : []),
    ...(onConvert && !item.converted_project_id
      ? [
          {
            label: "Convert to Project",
            icon: <FolderKanban size={14} className="text-[#4F46E5]" />,
            onClick: () => onConvert(item),
          },
        ]
      : []),
    ...(onArchiveToggle
      ? [
          {
            label: item.status === "archived" ? "Restore to Inbox" : "Archive Idea",
            icon: <Archive size={14} className="text-slate-400" />,
            onClick: () => onArchiveToggle(item),
          },
        ]
      : []),
    ...(onDelete
      ? [
          {
            label: "Delete Idea",
            icon: <Trash2 size={14} />,
            variant: "danger" as const,
            onClick: () => onDelete(item),
          },
        ]
      : []),
  ];

  return (
    <div className="group relative rounded-2xl border border-[#E2E6EF] bg-white p-5 transition-all duration-150 hover:border-slate-300 hover:shadow-card flex flex-col justify-between">
      <div>
        {/* Top Header Row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium border ${typeMeta.color}`}
            >
              <span>{typeMeta.icon}</span>
              <span>{typeMeta.label}</span>
            </span>

            <span
              className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium border ${statusMeta.className}`}
            >
              {statusMeta.label}
            </span>

            {getPriorityIndicator(item.priority)}
          </div>

          {/* Action Menu */}
          <div className="shrink-0 -mr-1.5 -mt-1" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu
              items={menuItems}
              align="right"
              ariaLabel="Idea options"
              trigger={
                <button
                  type="button"
                  className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                  aria-label="Idea options"
                >
                  <MoreHorizontal size={16} />
                </button>
              }
            />
          </div>
        </div>

        {/* Title */}
        <Link href={`/inbox/${item.id}`} className="block mt-3 group-hover:text-[#4F46E5] transition">
          <h3 className="text-base font-semibold tracking-tight text-[#111827] group-hover:text-[#4F46E5] transition line-clamp-1">
            {item.title}
          </h3>
        </Link>

        {/* Description / Content */}
        {item.description ? (
          <p className="mt-1.5 text-xs text-[#64748B] line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-slate-400 italic">No description recorded yet.</p>
        )}
      </div>

      {/* Footer / Converted Banner / Relative time */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3 text-xs">
        {item.converted_project_id ? (
          <Link
            href={`/project/${item.converted_project_id}`}
            className="inline-flex items-center gap-1.5 font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <CheckCircle2 size={13} className="text-emerald-600" />
            <span>Converted to project</span>
            <ArrowRight size={12} />
          </Link>
        ) : (
          <span className="text-[11px] text-slate-400">
            Updated {formatRelativeTime(item.updated_at)}
          </span>
        )}

        <Link
          href={`/inbox/${item.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#4F46E5] hover:text-[#4338CA] transition ml-auto"
        >
          <span>Explore</span>
          <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}

import React from "react";
import { FolderKanban } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ComponentType<{ size: number; className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon = FolderKanban,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300/90 bg-white/70 px-6 py-12 text-center ${className}`}
    >
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-zinc-100 text-zinc-500 mb-4">
        <Icon size={22} className="stroke-[1.75]" />
      </div>
      <h3 className="text-sm sm:text-base font-semibold text-zinc-900 tracking-tight">
        {title}
      </h3>
      <p className="mt-1.5 max-w-sm text-xs sm:text-sm text-zinc-500 leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

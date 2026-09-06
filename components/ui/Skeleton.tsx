import React from "react";

export function Skeleton({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-md bg-zinc-200/70 ${className}`}
      {...props}
    />
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2.5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-36 rounded-md" />
            <Skeleton className="h-4 w-14 rounded-full" />
          </div>
          <Skeleton className="h-4 w-3/4 rounded-md" />
          <div className="pt-2 flex items-center gap-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}

export function StoryRowSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-4.5 w-2/3" />
          <Skeleton className="h-3.5 w-5/6" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-zinc-100 py-3.5 px-4">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-4 ${i === 0 ? "w-40" : i === 1 ? "w-28" : "w-20"}`}
        />
      ))}
    </div>
  );
}

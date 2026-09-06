"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Menu } from "lucide-react";
import { useDashboard } from "./FreelancerLayout";

interface DashboardHeaderProps {
  category?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  backHref?: string;
  actions?: React.ReactNode;
}

export function DashboardHeader({
  category,
  eyebrow,
  title,
  description,
  backHref,
  actions,
}: DashboardHeaderProps) {
  const { toggleMobile } = useDashboard();
  const label = eyebrow || category;

  return (
    <header className="sticky top-0 z-20 flex min-h-15 flex-wrap sm:flex-nowrap items-center justify-between gap-y-2 gap-x-4 border-b border-line bg-paper/95 px-4 sm:px-6 lg:px-8 py-2.5 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3 flex-1">
        {/* Mobile menu trigger */}
        <button
          type="button"
          onClick={toggleMobile}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition lg:hidden"
          aria-label="Toggle navigation menu"
        >
          <Menu size={18} />
        </button>

        {backHref && (
          <Link
            href={backHref}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition"
            aria-label="Go back"
          >
            <ArrowLeft size={16} />
          </Link>
        )}

        <div className="min-w-0 flex-1">
          {label && (
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 truncate">
              {label}
            </p>
          )}
          <div className="flex items-baseline gap-2 truncate">
            <h1 className="text-base font-semibold tracking-tight text-slate-900 truncate">
              {title}
            </h1>
            {description && (
              <span className="hidden md:inline text-xs text-zinc-400 truncate font-normal">
                — {description}
              </span>
            )}
          </div>
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap max-sm:w-full max-sm:justify-end">
          {actions}
        </div>
      )}
    </header>
  );
}

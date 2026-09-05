"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Menu } from "lucide-react";
import { useDashboard } from "./FreelancerLayout";

interface DashboardHeaderProps {
  category?: string;
  title: string;
  backHref?: string;
  actions?: React.ReactNode;
}

export function DashboardHeader({
  category,
  title,
  backHref,
  actions,
}: DashboardHeaderProps) {
  const { toggleMobile } = useDashboard();

  return (
    <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-line bg-paper/90 px-6 backdrop-blur-xl lg:px-9">
      <div className="flex items-center gap-3">
        {/* Mobile menu trigger */}
        <button
          type="button"
          onClick={toggleMobile}
          className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 lg:hidden"
          aria-label="Toggle navigation menu"
        >
          <Menu size={20} />
        </button>

        {backHref && (
          <Link
            href={backHref}
            className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 transition"
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
          </Link>
        )}

        <div>
          {category && (
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              {category}
            </p>
          )}
          <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-neutral-900">
            {title}
          </h1>
        </div>
      </div>

      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

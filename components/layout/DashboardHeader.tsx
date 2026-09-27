"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Menu } from "lucide-react";
import { useDashboard } from "./FreelancerLayout";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";

interface DashboardHeaderProps {
  category?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  maxWidth?: string;
  hideNotifications?: boolean;
}

export function DashboardHeader({
  category,
  eyebrow,
  title,
  description,
  backHref,
  backLabel,
  badge,
  actions,
  maxWidth = "max-w-6xl",
  hideNotifications = false,
}: DashboardHeaderProps) {
  const { toggleMobile } = useDashboard();
  const label = eyebrow || category;

  return (
    <header className="w-full sticky top-0 z-20 border-b border-[rgba(74,61,100,0.08)] bg-white/68 backdrop-blur-[20px] transition-colors">
      <div
        className={`w-full mx-auto ${maxWidth} px-4 sm:px-8 py-3.5 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4`}
      >
        <div className="flex items-start justify-between gap-3 min-w-0 w-full sm:w-auto sm:flex-1">
          <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
            {/* Mobile navigation trigger */}
            <button
              type="button"
              onClick={toggleMobile}
              className="mt-0.5 grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-lg text-[#706C7D] hover:bg-[#E9E3F4]/30 hover:text-[#252331] transition-colors md:hidden"
              aria-label="Toggle navigation menu"
            >
              <Menu size={19} />
            </button>

            <div className="min-w-0 flex-1">
              {backHref && (
                <Link
                  href={backHref}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#706C7D] hover:text-[#252331] transition-colors mb-1 group"
                >
                  <ArrowLeft size={13} className="transition-transform group-hover:-translate-x-0.5" />
                  <span>{backLabel || (backHref === "/projects" ? "Projects" : "Back")}</span>
                </Link>
              )}

              {label && (
                <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[#9994A5] mb-0.5">
                  {label}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-2xl lg:text-[28px] font-semibold tracking-tight text-[#252331] leading-tight">
                  {title}
                </h1>
                {badge && <div className="shrink-0">{badge}</div>}
              </div>

              {description && (
                <p className="mt-0.5 text-xs sm:text-sm text-[#706C7D] font-normal leading-relaxed max-w-2xl line-clamp-1 sm:line-clamp-none">
                  {description}
                </p>
              )}
            </div>
          </div>

          {/* Mobile notification center at top right */}
          {!hideNotifications && (
            <div className="sm:hidden shrink-0 mt-0.5">
              <NotificationCenter />
            </div>
          )}
        </div>

        {/* Actions toolbar */}
        {actions && (
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-between sm:justify-start">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {actions}
            </div>
            {/* Desktop notification center */}
            {!hideNotifications && (
              <div className="hidden sm:block">
                <NotificationCenter />
              </div>
            )}
          </div>
        )}

        {/* If no actions but notifications enabled on desktop */}
        {!actions && !hideNotifications && (
          <div className="hidden sm:block shrink-0">
            <NotificationCenter />
          </div>
        )}
      </div>
    </header>
  );
}

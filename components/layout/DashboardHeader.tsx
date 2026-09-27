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
    <header className="sticky top-0 z-20 border-b border-[rgba(74,61,100,0.08)] bg-white/68 backdrop-blur-[20px] transition-colors">
      <div
        className={`mx-auto ${maxWidth} px-4 sm:px-8 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4`}
      >
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {/* Mobile navigation trigger */}
          <button
            type="button"
            onClick={toggleMobile}
            className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#706C7D] hover:bg-[#E9E3F4]/30 hover:text-[#252331] transition-colors md:hidden"
            aria-label="Toggle navigation menu"
          >
            <Menu size={20} />
          </button>

          <div className="min-w-0 flex-1">
            {backHref && (
              <Link
                href={backHref}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#706C7D] hover:text-[#252331] transition-colors mb-1.5 group"
              >
                <ArrowLeft size={13} className="transition-transform group-hover:-translate-x-0.5" />
                <span>{backLabel || (backHref === "/projects" ? "Projects" : "Back")}</span>
              </Link>
            )}

            {label && (
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9994A5] mb-1">
                {label}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl lg:text-[28px] font-semibold tracking-tight text-[#252331] leading-tight">
                {title}
              </h1>
              {badge && <div className="shrink-0">{badge}</div>}
            </div>

            {description && (
              <p className="mt-1 text-xs sm:text-sm text-[#706C7D] font-normal leading-relaxed max-w-2xl">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap pt-1 sm:pt-0 pl-12 sm:pl-0">
          {actions}
          {!hideNotifications && <NotificationCenter />}
        </div>
      </div>
    </header>
  );
}

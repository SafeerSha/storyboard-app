"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { ChevronRight, LogOut, X } from "lucide-react";
import { StoryBoardLogo } from "@/components/brand/StoryBoardLogo";

export interface NavSheetItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  isActive: boolean;
  badge?: React.ReactNode;
  description?: string;
  onClick?: () => void;
}

export interface NavSheetSection {
  id: string;
  title: string;
  items: NavSheetItem[];
}

export interface NavSheetUser {
  name: string;
  email?: string | null;
  roleDisplay?: string;
  initials: string;
  onSignOut: () => void;
}

export interface MobileNavigationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  brandBadge?: string;
  brandHref?: string;
  quickTiles?: NavSheetItem[];
  sections?: NavSheetSection[];
  user?: NavSheetUser | null;
  customContent?: React.ReactNode;
}

export function MobileNavigationSheet({
  isOpen,
  onClose,
  brandBadge = "Admin",
  brandHref = "/",
  quickTiles = [],
  sections = [],
  user = null,
  customContent,
}: MobileNavigationSheetProps) {
  // Lock body scroll and handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Mobile Navigation Menu"
    >
      {/* Dark Dimmed Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Solid High-Contrast Opaque Bottom Sheet */}
      <div className="relative z-10 w-full max-h-[90vh] flex flex-col rounded-t-[28px] border-t border-zinc-300 bg-white shadow-[0_-20px_60px_rgba(0,0,0,0.35)] overflow-hidden animate-in slide-in-from-bottom duration-200 ease-out pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {/* Pull Handle */}
        <div className="pt-3 pb-1.5 flex justify-center cursor-pointer" onClick={onClose}>
          <div className="h-1.5 w-12 rounded-full bg-zinc-300 hover:bg-zinc-400 transition-colors" />
        </div>

        {/* Sheet Top Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200 bg-white">
          <Link
            href={brandHref}
            onClick={onClose}
            className="flex items-center focus-visible:outline-none"
          >
            <StoryBoardLogo size="md" variant="full" badge={brandBadge} />
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8944E] cursor-pointer"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Sheet Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 overscroll-contain bg-white">
          {/* Quick Tiles Grid (Primary Workspaces) */}
          {quickTiles.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 px-1">
                Workspace
              </p>
              <div
                className={`grid gap-2.5 ${
                  quickTiles.length >= 3 ? "grid-cols-3" : "grid-cols-2"
                }`}
              >
                {quickTiles.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => {
                        item.onClick?.();
                        onClose();
                      }}
                      className={`relative flex flex-col items-center justify-center rounded-2xl p-3 text-center transition-all duration-150 active:scale-97 border ${
                        item.isActive
                          ? "bg-[#FAF5EC] border-2 border-[#B8944E] text-[#5C4112] shadow-sm"
                          : "bg-zinc-50 border-zinc-200 text-zinc-800 hover:bg-zinc-100 hover:border-zinc-300 hover:text-zinc-950 shadow-2xs"
                      }`}
                    >
                      <div
                        className={`grid h-11 w-11 place-items-center rounded-xl mb-2 transition-colors ${
                          item.isActive
                            ? "bg-[#B8944E] text-white shadow-xs"
                            : "bg-white border border-zinc-200 text-zinc-700 shadow-2xs"
                        }`}
                      >
                        <Icon size={20} />
                      </div>
                      <span className="text-xs font-bold tracking-tight truncate w-full">
                        {item.label}
                      </span>
                      {item.badge && (
                        <div className="mt-1.5 flex items-center justify-center">
                          {item.badge}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Categorized Nav Rows (Manage, Settings, Collaboration, etc.) */}
          {sections.map((section) => (
            <div key={section.id}>
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 px-1">
                {section.title}
              </p>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 divide-y divide-zinc-200 overflow-hidden shadow-2xs">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => {
                        item.onClick?.();
                        onClose();
                      }}
                      className={`flex items-center justify-between px-4 py-3.5 text-sm transition-colors active:bg-zinc-100 ${
                        item.isActive
                          ? "bg-[#FAF5EC] text-[#5C4112] font-bold"
                          : "text-zinc-900 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                            item.isActive
                              ? "bg-[#B8944E] text-white shadow-xs"
                              : "bg-white border border-zinc-200 text-zinc-700 shadow-2xs"
                          }`}
                        >
                          <Icon size={17} />
                        </div>
                        <div className="min-w-0 text-left">
                          <p className="font-bold text-zinc-900 leading-tight">
                            {item.label}
                          </p>
                          {item.description && (
                            <p className="text-xs text-zinc-500 mt-0.5 truncate font-normal">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.badge}
                        <ChevronRight
                          size={18}
                          className={item.isActive ? "text-[#B8944E]" : "text-zinc-400"}
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Custom Portal Content */}
          {customContent}

          {/* User Profile Card & Sign Out */}
          {user && (
            <div className="pt-1">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 shadow-2xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#B8944E] to-[#7A5B20] text-white font-bold text-sm shadow-xs">
                    {user.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-zinc-950 truncate">
                        {user.name}
                      </p>
                      {user.roleDisplay && (
                        <span className="rounded-md bg-[#FAF5EC] px-1.5 py-0.5 text-[10px] font-bold text-[#7A5B20] border border-[#E5D2A8] shrink-0">
                          {user.roleDisplay}
                        </span>
                      )}
                    </div>
                    {user.email && (
                      <p className="text-xs text-zinc-600 truncate mt-0.5 font-mono">
                        {user.email}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    user.onSignOut();
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 hover:border-rose-300 text-rose-700 px-3.5 py-2.5 text-xs font-bold transition-colors shrink-0 active:scale-95 cursor-pointer shadow-2xs"
                >
                  <LogOut size={14} />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

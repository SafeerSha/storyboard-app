"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { StoryBoardLogoMark } from "@/components/brand/StoryBoardLogo";

export interface DockItemConfig {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  isActive: boolean;
  badge?: number | string | null;
  onClick?: () => void;
}

export interface DockSectionConfig {
  id: string;
  title?: string;
  items: DockItemConfig[];
}

export interface DockUserConfig {
  name: string;
  email: string;
  role: string;
  initials: string;
  onSignOut: () => void;
}

export interface AppDockProps {
  brand?: {
    label: string;
    href: string;
    badge?: string;
  };
  sections: DockSectionConfig[];
  user?: DockUserConfig | null;
}

export function AppDock({ brand, sections, user }: AppDockProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  // Close account menu on click outside or Escape
  useEffect(() => {
    if (!showAccountMenu) return;

    function handleClickOutside(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setShowAccountMenu(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowAccountMenu(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showAccountMenu]);

  return (
    <div className="fixed bottom-4 sm:bottom-6 left-0 right-0 z-40 flex justify-center pointer-events-none px-3">
      <nav
        aria-label="Application Navigation"
        className="pointer-events-auto flex items-center h-[52px] sm:h-[64px] rounded-full border border-[rgba(74,61,100,0.12)] bg-gradient-to-b from-white/95 via-white/88 to-[#FAF9FC]/82 backdrop-blur-2xl px-2 sm:px-3 py-1.5 shadow-[0_20px_50px_-10px_rgba(70,55,95,0.20),0_0_0_1px_rgba(255,255,255,0.9)_inset,0_2px_6px_rgba(70,55,95,0.06)] select-none transition-all duration-200"
      >
        {/* Brand Icon */}
        {brand && (
          <div
            className="relative flex items-center justify-center shrink-0 mr-1 sm:mr-2"
            onMouseEnter={() => setHoveredId("brand")}
            onMouseLeave={() => setHoveredId((prev) => (prev === "brand" ? null : prev))}
          >
            <Link
              href={brand.href}
              className="flex shrink-0 aspect-square items-center justify-center transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-110 active:scale-95 focus-visible:outline-none"
              aria-label={brand.label}
            >
              <StoryBoardLogoMark size={36} />
            </Link>

            {/* Hover Tooltip (Above) */}
            {hoveredId === "brand" && (
              <div
                role="tooltip"
                className="absolute bottom-full mb-3.5 left-1/2 -translate-x-1/2 z-50 pointer-events-none hidden sm:flex flex-col items-center"
              >
                <div className="rounded-xl bg-[#191522] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_12px_28px_rgba(15,10,25,0.45),0_0_0_1px_rgba(255,255,255,0.12)] whitespace-nowrap animate-in fade-in zoom-in-95 duration-150">
                  {brand.label}
                  {brand.badge && (
                    <span className="ml-1.5 rounded-md bg-[rgba(184,148,78,0.30)] px-1.5 py-0.5 text-[10px] font-bold text-[#F3E8D7]">
                      {brand.badge}
                    </span>
                  )}
                </div>
                <div className="w-2 h-1 border-x-4 border-x-transparent border-t-4 border-t-[#191522]" />
              </div>
            )}
          </div>
        )}

        {/* Navigation Sections & Items */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {sections.map((section, sIdx) => (
            <React.Fragment key={section.id}>
              {/* Section Divider */}
              {(sIdx > 0 || brand) && (
                <div className="w-[1px] h-5 sm:h-6 bg-gradient-to-b from-transparent via-[rgba(74,61,100,0.16)] to-transparent mx-0.5 sm:mx-1 shrink-0" />
              )}

              {section.items.map((item) => {
                const Icon = item.icon;
                const isHovered = hoveredId === item.id;

                return (
                  <div
                    key={item.id}
                    className="relative flex items-center justify-center shrink-0"
                    onMouseEnter={() => setHoveredId(item.id)}
                    onMouseLeave={() => setHoveredId((prev) => (prev === item.id ? null : prev))}
                  >
                    <Link
                      href={item.href}
                      onClick={item.onClick}
                      aria-label={item.label}
                      aria-current={item.isActive ? "page" : undefined}
                      className={`relative grid h-9 w-9 sm:h-11 sm:w-11 shrink-0 aspect-square place-items-center rounded-full sm:rounded-2xl transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8944E] cursor-pointer ${
                        item.isActive
                          ? "bg-gradient-to-b from-[#B8944E]/18 to-[#B8944E]/08 border border-[#B8944E]/30 text-[#80642F] shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),0_2px_8px_rgba(184,148,78,0.12)]"
                          : "text-[#706C7D] hover:bg-black/[0.04] hover:text-[#252331] border border-transparent"
                      }`}
                    >
                      {/* Active Indicator Dot */}
                      {item.isActive && (
                        <span
                          className="absolute bottom-1 sm:bottom-1.5 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-[#B8944E] shadow-[0_0_6px_#B8944E]"
                          aria-hidden="true"
                        />
                      )}

                      <Icon
                        size={19}
                        className={`transition-colors duration-150 ${
                          item.isActive ? "text-[#80642F]" : "text-[#706C7D] group-hover:text-[#252331]"
                        }`}
                      />

                      {/* Real notification count badge */}
                      {item.badge !== undefined && item.badge !== null && (
                        <span
                          className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-gradient-to-r from-[#C25D72] to-[#B8944E] text-white text-[9.5px] font-extrabold flex items-center justify-center shadow-[0_2px_6px_rgba(194,93,114,0.4)] border-2 border-white pointer-events-none"
                          aria-label={`${item.badge} notifications`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>

                    {/* Tooltip Above */}
                    {isHovered && (
                      <div
                        role="tooltip"
                        className="absolute bottom-full mb-3.5 left-1/2 -translate-x-1/2 z-50 pointer-events-none hidden sm:flex flex-col items-center"
                      >
                        <div className="rounded-xl bg-[#191522] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_12px_28px_rgba(15,10,25,0.45),0_0_0_1px_rgba(255,255,255,0.12)] whitespace-nowrap animate-in fade-in zoom-in-95 duration-150">
                          {item.label}
                        </div>
                        <div className="w-2 h-1 border-x-4 border-x-transparent border-t-4 border-t-[#191522]" />
                      </div>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>

        {/* User Account Avatar & Popover */}
        {user && (
          <>
            <div className="w-[1px] h-5 sm:h-6 bg-gradient-to-b from-transparent via-[rgba(74,61,100,0.16)] to-transparent mx-1 sm:mx-1.5 shrink-0" />

            <div
              ref={accountRef}
              className="relative flex items-center justify-center shrink-0"
              onMouseEnter={() => setHoveredId("user")}
              onMouseLeave={() => setHoveredId((prev) => (prev === "user" ? null : prev))}
            >
              <button
                type="button"
                onClick={() => setShowAccountMenu((prev) => !prev)}
                aria-expanded={showAccountMenu}
                aria-haspopup="menu"
                aria-label={`Account menu for ${user.name}`}
                className="grid h-9 w-9 sm:h-11 sm:w-11 shrink-0 aspect-square place-items-center rounded-full sm:rounded-2xl bg-gradient-to-br from-[#B8944E] to-[#7A5B20] text-white font-bold text-xs tracking-wider border border-white/50 shadow-[0_2px_8px_rgba(184,148,78,0.25)] transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8944E] cursor-pointer"
              >
                {user.initials}
              </button>

              {/* User Hover Tooltip Above */}
              {hoveredId === "user" && !showAccountMenu && (
                <div
                  role="tooltip"
                  className="absolute bottom-full mb-3.5 left-1/2 -translate-x-1/2 z-50 pointer-events-none hidden sm:flex flex-col items-center"
                >
                  <div className="rounded-xl bg-[#191522] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_12px_28px_rgba(15,10,25,0.45),0_0_0_1px_rgba(255,255,255,0.12)] whitespace-nowrap animate-in fade-in zoom-in-95 duration-150">
                    <span>{user.name}</span>
                    <span className="text-zinc-400 mx-1.5">•</span>
                    <span className="text-[#F3E8D7]">
                      {user.role === "super_admin" ? "Super Admin" : "Freelancer"}
                    </span>
                  </div>
                  <div className="w-2 h-1 border-x-4 border-x-transparent border-t-4 border-t-[#191522]" />
                </div>
              )}

              {/* Account Popover Menu Above */}
              {showAccountMenu && (
                <div
                  role="menu"
                  aria-label="Account options"
                  className="absolute bottom-full mb-4 right-0 sm:left-1/2 sm:-translate-x-1/2 w-64 rounded-2xl border border-[rgba(74,61,100,0.10)] bg-white/96 backdrop-blur-[24px] p-2 shadow-[0_24px_50px_-10px_rgba(70,55,95,0.24),0_0_0_1px_rgba(255,255,255,0.8)_inset] animate-in fade-in zoom-in-95 duration-150 z-50"
                >
                  <div className="px-3.5 py-2.5 border-b border-[rgba(74,61,100,0.06)]">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-[#252331] truncate">{user.name}</p>
                      <span className="rounded-md bg-[rgba(184,148,78,0.12)] px-1.5 py-0.5 text-[10px] font-bold text-[#80642F] border border-[rgba(184,148,78,0.18)] shrink-0">
                        {user.role === "super_admin" ? "Super Admin" : "Freelancer"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[#706C7D] truncate font-mono">{user.email}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAccountMenu(false);
                      user.onSignOut();
                    }}
                    className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-[#C25D72] hover:bg-rose-50/80 transition cursor-pointer"
                  >
                    <LogOut size={14} />
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </nav>
    </div>
  );
}

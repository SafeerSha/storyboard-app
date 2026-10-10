"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { LogOut, PanelLeft } from "lucide-react";
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
  email?: string | null;
  role?: string;
  roleDisplay?: string;
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
  onToggleLayout?: () => void;
  layoutMode?: "dock" | "sidebar";
  className?: string;
}

export function AppDock({
  brand,
  sections,
  user,
  onToggleLayout,
  layoutMode = "dock",
  className = "hidden md:flex",
}: AppDockProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuCoords, setMenuCoords] = useState<{ bottom: number; right: number } | null>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateMenuPosition = useCallback(() => {
    if (!accountRef.current) return;
    const rect = accountRef.current.getBoundingClientRect();
    setMenuCoords({
      bottom: Math.max(12, window.innerHeight - rect.top + 14),
      right: Math.max(16, window.innerWidth - rect.right),
    });
  }, []);

  // Close account menu on click outside or Escape
  useEffect(() => {
    if (!showAccountMenu) return;

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        accountRef.current &&
        !accountRef.current.contains(target) &&
        menuPortalRef.current &&
        !menuPortalRef.current.contains(target)
      ) {
        setShowAccountMenu(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowAccountMenu(false);
      }
    }

    // Small delay to ensure event that triggered open is completed
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 10);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [showAccountMenu, updateMenuPosition]);

  const toggleAccountMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (showAccountMenu) {
      setShowAccountMenu(false);
    } else {
      updateMenuPosition();
      setShowAccountMenu(true);
    }
  };

  return (
    <div
      className={`fixed bottom-5 left-0 right-0 z-[45] flex justify-center pointer-events-none px-4 select-none animate-in slide-in-from-bottom-5 duration-300 ${className}`}
    >
      <nav
        aria-label="macOS Desktop Dock Navigation"
        className="pointer-events-auto flex items-center h-[62px] sm:h-[68px] rounded-2xl sm:rounded-full border border-white/20 bg-white/10 backdrop-blur-3xl px-3.5 sm:px-6 py-2 shadow-[0_30px_60px_rgba(0,0,0,0.12),0_10px_25px_rgba(0,0,0,0.05),inset_0_2px_4px_rgba(255,255,255,0.4),inset_0_0_10px_rgba(255,255,255,0.1),inset_0_-2px_6px_rgba(0,0,0,0.05)] gap-1 sm:gap-2 transition-all duration-200 max-w-[calc(100vw-2rem)] overflow-visible"
        style={{
          WebkitBackdropFilter: "blur(32px) saturate(190%)",
          backdropFilter: "blur(32px) saturate(190%)",
        }}
      >
        {/* Brand Icon */}
        {brand && (
          <div
            className="relative flex items-center justify-center shrink-0 ml-0.5 mr-1 sm:mr-1.5"
            onMouseEnter={() => setHoveredId("brand")}
            onMouseLeave={() => setHoveredId((prev) => (prev === "brand" ? null : prev))}
          >
            <Link
              href={brand.href}
              className="flex shrink-0 aspect-square items-center justify-center transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-115 active:scale-95 focus-visible:outline-none"
              aria-label={brand.label}
            >
              <StoryBoardLogoMark size={36} />
            </Link>

            {/* Hover Tooltip (Above) */}
            {hoveredId === "brand" && (
              <div
                role="tooltip"
                className="absolute bottom-full mb-3.5 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex flex-col items-center"
              >
                <div className="rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white shadow-2xl whitespace-nowrap animate-in fade-in zoom-in-95 duration-150">
                  {brand.label}
                  {brand.badge && (
                    <span className="ml-1.5 rounded-md bg-[#B8944E]/30 px-1.5 py-0.5 text-[10px] font-extrabold text-[#F3E8D7] border border-[#B8944E]/40">
                      {brand.badge}
                    </span>
                  )}
                </div>
                <div className="w-2 h-1 border-x-4 border-x-transparent border-t-4 border-t-zinc-900" />
              </div>
            )}
          </div>
        )}

        {/* Navigation Sections & Items */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {sections.map((section, sIdx) => (
            <React.Fragment key={section.id}>
              {/* Section Divider with etched glass bevel */}
              {(sIdx > 0 || brand) && (
                <div className="w-[1px] h-6 bg-zinc-400/20 shadow-[1px_0_0_0_rgba(255,255,255,0.5)] mx-1 sm:mx-1.5 shrink-0" />
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
                      onClick={(e) => {
                        if (item.href === "#" || item.href.startsWith("#")) {
                          e.preventDefault();
                        }
                        item.onClick?.();
                      }}
                      aria-label={item.label}
                      aria-current={item.isActive ? "page" : undefined}
                      className={`relative grid h-10 w-10 sm:h-11 sm:w-11 shrink-0 aspect-square place-items-center rounded-xl sm:rounded-2xl transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-115 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8944E] cursor-pointer ${
                        item.isActive
                          ? "bg-[rgba(184,148,78,0.14)] border border-[rgba(184,148,78,0.28)] text-[#664914] shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.75),0_2px_8px_rgba(184,148,78,0.10)] backdrop-blur-md"
                          : "text-zinc-700 hover:bg-white/30 hover:text-zinc-950 hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] border border-transparent"
                      }`}
                    >
                      {/* Active Indicator Dot Underneath */}
                      {item.isActive && (
                        <span
                          className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-[#B8944E] shadow-[0_0_6px_#B8944E]"
                          aria-hidden="true"
                        />
                      )}

                      <Icon
                        size={20}
                        className={`transition-colors duration-150 ${
                          item.isActive ? "text-[#80642F]" : "text-zinc-700 hover:text-zinc-950"
                        }`}
                      />

                      {/* Notification count badge */}
                      {item.badge !== undefined && item.badge !== null && (
                        <span
                          className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#B8944E] text-white text-[10px] font-extrabold flex items-center justify-center shadow-sm border-2 border-white pointer-events-none"
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
                        className="absolute bottom-full mb-3.5 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex flex-col items-center"
                      >
                        <div className="rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white shadow-2xl whitespace-nowrap animate-in fade-in zoom-in-95 duration-150">
                          {item.label}
                        </div>
                        <div className="w-2 h-1 border-x-4 border-x-transparent border-t-4 border-t-zinc-900" />
                      </div>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>

        {/* Layout Variety Switcher (Sidebar ⇄ Dock) */}
        {onToggleLayout && (
          <>
            <div className="w-[1px] h-6 bg-zinc-400/20 shadow-[1px_0_0_0_rgba(255,255,255,0.5)] mx-1 sm:mx-1.5 shrink-0" />
            <div
              className="relative flex items-center justify-center shrink-0"
              onMouseEnter={() => setHoveredId("layout-switcher")}
              onMouseLeave={() => setHoveredId((prev) => (prev === "layout-switcher" ? null : prev))}
            >
              <button
                type="button"
                onClick={onToggleLayout}
                aria-label="Switch to Sidebar Navigation"
                className="grid h-10 w-10 sm:h-11 sm:w-11 shrink-0 aspect-square place-items-center rounded-xl sm:rounded-2xl text-zinc-700 hover:bg-white/30 hover:text-zinc-950 hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-115 active:scale-95 focus-visible:outline-none cursor-pointer border border-transparent"
              >
                <PanelLeft size={19} />
              </button>

              {/* Tooltip Above */}
              {hoveredId === "layout-switcher" && (
                <div
                  role="tooltip"
                  className="absolute bottom-full mb-3.5 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex flex-col items-center"
                >
                  <div className="rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white shadow-2xl whitespace-nowrap animate-in fade-in zoom-in-95 duration-150">
                    Switch to Sidebar Layout
                  </div>
                  <div className="w-2 h-1 border-x-4 border-x-transparent border-t-4 border-t-zinc-900" />
                </div>
              )}
            </div>
          </>
        )}

        {/* User Account Avatar & Popover */}
        {user && (
          <>
            <div className="w-[1px] h-6 bg-zinc-400/20 shadow-[1px_0_0_0_rgba(255,255,255,0.7)] mx-1 sm:mx-1.5 shrink-0" />

            <div
              ref={accountRef}
              className="relative flex items-center justify-center shrink-0"
              onMouseEnter={() => setHoveredId("user")}
              onMouseLeave={() => setHoveredId((prev) => (prev === "user" ? null : prev))}
            >
              <button
                type="button"
                onClick={toggleAccountMenu}
                aria-expanded={showAccountMenu}
                aria-haspopup="menu"
                aria-label={`Account menu for ${user.name}`}
                className="grid h-10 w-10 sm:h-11 sm:w-11 shrink-0 aspect-square place-items-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#B8944E] to-[#7A5B20] text-white font-bold text-xs tracking-wider border border-white/80 shadow-[0_3px_10px_rgba(184,148,78,0.30),inset_0_1px_1.5px_rgba(255,255,255,0.6)] transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-115 active:scale-95 focus-visible:outline-none cursor-pointer"
              >
                {user.initials}
              </button>

              {/* User Hover Tooltip Above */}
              {hoveredId === "user" && !showAccountMenu && (
                <div
                  role="tooltip"
                  className="absolute bottom-full mb-3.5 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex flex-col items-center"
                >
                  <div className="rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white shadow-2xl whitespace-nowrap animate-in fade-in zoom-in-95 duration-150">
                    <span>{user.name}</span>
                    <span className="text-zinc-400 mx-1.5">•</span>
                    <span className="text-[#F3E8D7]">{user.roleDisplay || user.role || "User"}</span>
                  </div>
                  <div className="w-2 h-1 border-x-4 border-x-transparent border-t-4 border-t-zinc-900" />
                </div>
              )}

              {/* Account Popover Menu Rendered in Body Portal */}
              {mounted && showAccountMenu && menuCoords && typeof document !== "undefined" && createPortal(
                <div
                  ref={menuPortalRef}
                  role="menu"
                  aria-label="Account options"
                  style={{
                    position: "fixed",
                    bottom: `${menuCoords.bottom}px`,
                    right: `${menuCoords.right}px`,
                    zIndex: 99999,
                  }}
                  className="w-64 rounded-2xl border border-zinc-200/90 bg-white/98 backdrop-blur-2xl p-2.5 shadow-[0_24px_50px_rgba(0,0,0,0.25),0_4px_16px_rgba(0,0,0,0.12)] animate-in fade-in zoom-in-95 duration-150 pointer-events-auto text-left select-none"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-3 py-2 border-b border-zinc-100">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-zinc-900 truncate">{user.name}</p>
                      <span className="rounded-md bg-[#FAF5EC] px-1.5 py-0.5 text-[10px] font-bold text-[#7A5B20] border border-[#E5D2A8] shrink-0">
                        {user.roleDisplay || user.role || "User"}
                      </span>
                    </div>
                    {user.email && (
                      <p className="mt-0.5 text-[11px] text-zinc-500 truncate font-mono">
                        {user.email}
                      </p>
                    )}
                  </div>

                  {onToggleLayout && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAccountMenu(false);
                        onToggleLayout();
                      }}
                      className="mt-1.5 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 transition cursor-pointer"
                    >
                      <PanelLeft size={14} className="text-zinc-500" />
                      <span>Switch to Sidebar</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setShowAccountMenu(false);
                      user.onSignOut();
                    }}
                    className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50/70 hover:bg-rose-100 transition cursor-pointer"
                  >
                    <LogOut size={14} />
                    <span>Sign out</span>
                  </button>
                </div>,
                document.body
              )}
            </div>
          </>
        )}
      </nav>
    </div>
  );
}

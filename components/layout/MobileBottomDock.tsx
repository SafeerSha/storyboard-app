"use client";

import React from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";

export interface MobileDockItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  isActive: boolean;
  badge?: React.ReactNode;
  onClick?: () => void;
}

export interface MobileBottomDockProps {
  items: MobileDockItem[];
  onOpenMenu: () => void;
  isMenuOpen: boolean;
  isMoreActive?: boolean;
}

export function MobileBottomDock({
  items,
  onOpenMenu,
  isMenuOpen,
  isMoreActive = false,
}: MobileBottomDockProps) {
  return (
    <div className="fixed bottom-4 inset-x-0 z-40 flex justify-center pointer-events-none px-3 sm:px-4 lg:hidden pb-[env(safe-area-inset-bottom)] animate-in slide-in-from-bottom-3 duration-250">
      <nav
        aria-label="Quick mobile navigation"
        className="pointer-events-auto flex items-center justify-center h-[52px] sm:h-[54px] w-fit max-w-full sm:max-w-md mx-auto rounded-full border border-white/45 bg-white/35 backdrop-blur-2xl px-2.5 sm:px-4 py-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.03),inset_0_1.5px_2px_0_rgba(255,255,255,0.90),inset_0_0_0_1px_rgba(255,255,255,0.25),inset_0_-2px_4px_0_rgba(0,0,0,0.03)] gap-1 sm:gap-1.5 transition-all duration-200 overflow-x-auto"
        style={{
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
          backdropFilter: "blur(28px) saturate(180%)",
        }}
      >
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={item.onClick}
              aria-label={item.label}
              aria-current={item.isActive ? "page" : undefined}
              className={`relative flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all duration-150 active:scale-95 cursor-pointer whitespace-nowrap ${
                item.isActive
                  ? "bg-[rgba(184,148,78,0.14)] border border-[rgba(184,148,78,0.28)] text-[#664914] shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.75),0_2px_8px_rgba(184,148,78,0.10)] backdrop-blur-md"
                  : "text-zinc-700 hover:bg-white/30 hover:text-zinc-950 hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] border border-transparent"
              }`}
            >
              <div className="relative">
                <Icon
                  size={15}
                  className={item.isActive ? "text-[#80642F]" : "text-zinc-600"}
                />
                {item.badge && (
                  <span className="absolute -top-1.5 -right-2 flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="truncate max-w-[50px] sm:max-w-[70px]">
                {item.label}
              </span>
              {item.isActive && (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[#B8944E]"
                  aria-hidden="true"
                />
              )}
            </Link>
          );
        })}

        {/* Divider */}
        <div className="w-[1px] h-5 bg-zinc-400/20 shadow-[1px_0_0_0_rgba(255,255,255,0.5)] mx-0.5 sm:mx-1 shrink-0" />

        {/* Menu / More Button */}
        <button
          type="button"
          onClick={onOpenMenu}
          aria-expanded={isMenuOpen}
          aria-label="Open full menu"
          className={`relative flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all duration-150 active:scale-95 cursor-pointer whitespace-nowrap ${
            isMenuOpen || isMoreActive
              ? "bg-[rgba(184,148,78,0.14)] border border-[rgba(184,148,78,0.28)] text-[#664914] shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.75),0_2px_8px_rgba(184,148,78,0.10)] backdrop-blur-md"
              : "text-zinc-700 hover:bg-white/30 hover:text-zinc-950 hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] border border-transparent"
          }`}
        >
          <MoreHorizontal
            size={17}
            className={
              isMenuOpen || isMoreActive ? "text-[#80642F]" : "text-zinc-600"
            }
          />
          <span className="sm:hidden">Menu</span>
          <span className="hidden sm:inline">Menu</span>
          {(isMoreActive || isMenuOpen) && (
            <span
              className="h-1.5 w-1.5 rounded-full bg-[#B8944E]"
              aria-hidden="true"
            />
          )}
        </button>
      </nav>
    </div>
  );
}

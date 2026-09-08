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
    <div className="fixed bottom-3 inset-x-0 z-40 flex justify-center pointer-events-none px-3 lg:hidden pb-[env(safe-area-inset-bottom)] animate-in slide-in-from-bottom-3 duration-250">
      <nav
        aria-label="Quick mobile navigation"
        className="pointer-events-auto flex items-center h-[54px] max-w-md w-auto rounded-full border border-zinc-200/90 bg-white px-2 py-1 shadow-[0_12px_36px_rgba(0,0,0,0.18),0_1px_3px_rgba(0,0,0,0.06)] gap-1"
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
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 active:scale-95 cursor-pointer ${
                item.isActive
                  ? "bg-[#FAF5EC] border border-[#B8944E]/40 text-[#5C4112] shadow-xs"
                  : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 border border-transparent"
              }`}
            >
              <div className="relative">
                <Icon
                  size={17}
                  className={item.isActive ? "text-[#80642F]" : "text-zinc-600"}
                />
                {item.badge && (
                  <span className="absolute -top-1.5 -right-2 flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="truncate max-w-[80px] sm:max-w-[100px]">
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
        <div className="w-[1px] h-5 bg-zinc-200 mx-0.5 shrink-0" />

        {/* Menu / More Button */}
        <button
          type="button"
          onClick={onOpenMenu}
          aria-expanded={isMenuOpen}
          aria-label="Open full menu"
          className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 active:scale-95 cursor-pointer ${
            isMenuOpen || isMoreActive
              ? "bg-[#FAF5EC] border border-[#B8944E]/40 text-[#5C4112] shadow-xs"
              : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 border border-transparent"
          }`}
        >
          <MoreHorizontal
            size={17}
            className={
              isMenuOpen || isMoreActive ? "text-[#80642F]" : "text-zinc-600"
            }
          />
          <span>Menu</span>
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

"use client";

import React, { useState, useRef, useEffect } from "react";
import { MoreHorizontal } from "lucide-react";

export interface DropdownItem {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  variant?: "default" | "danger";
  disabled?: boolean;
}

interface DropdownMenuProps {
  items: DropdownItem[];
  trigger?: React.ReactNode;
  align?: "left" | "right";
  ariaLabel?: string;
}

export function DropdownMenu({
  items,
  trigger,
  align = "right",
  ariaLabel = "More actions",
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      {trigger ? (
        <div onClick={() => setOpen((prev) => !prev)} className="cursor-pointer">
          {trigger}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-label={ariaLabel}
          aria-expanded={open}
          className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition"
        >
          <MoreHorizontal size={16} />
        </button>
      )}

      {open && (
        <div
          className={`absolute ${
            align === "right" ? "right-0" : "left-0"
          } z-30 mt-1 min-w-[160px] origin-top-right rounded-xl border border-zinc-200/90 bg-white p-1 shadow-dropdown animate-in fade-in zoom-in-95 duration-100`}
        >
          <div className="space-y-0.5" role="menu">
            {items.map((item, idx) => (
              <button
                key={idx}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm font-medium transition text-left disabled:opacity-40 disabled:cursor-not-allowed ${
                  item.variant === "danger"
                    ? "text-rose-600 hover:bg-rose-50"
                    : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                {item.icon && <span className="shrink-0 text-zinc-400">{item.icon}</span>}
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

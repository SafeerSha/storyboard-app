"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
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
  const [openUpward, setOpenUpward] = useState(false);
  const [horizontalAlign, setHorizontalAlign] = useState<"left" | "right">(align);

  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([]);

  // Calculate dynamic collision bounds relative to viewport
  const updatePosition = useCallback(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();

    // Check vertical space (estimated menu height is ~42px per item + padding)
    const estimatedHeight = Math.max(items.length * 42 + 20, 160);
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Flip upwards if cramped below but room above
    if (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
      setOpenUpward(true);
    } else {
      setOpenUpward(false);
    }

    // Check horizontal space
    const estimatedWidth = 175;
    if (align === "right") {
      // Right-aligned opens towards the left: needs `estimatedWidth` space left of rect.right
      if (rect.right < estimatedWidth && window.innerWidth - rect.left > estimatedWidth) {
        setHorizontalAlign("left");
      } else {
        setHorizontalAlign("right");
      }
    } else {
      // Left-aligned opens towards the right: needs `estimatedWidth` space right of rect.left
      if (window.innerWidth - rect.left < estimatedWidth && rect.right > estimatedWidth) {
        setHorizontalAlign("right");
      } else {
        setHorizontalAlign("left");
      }
    }
  }, [align, items.length]);

  useEffect(() => {
    if (!open) return;

    updatePosition();

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const activeElements = itemsRef.current.filter((el): el is HTMLButtonElement => el !== null && !el.disabled);
        if (activeElements.length === 0) return;
        const currentIndex = activeElements.indexOf(document.activeElement as HTMLButtonElement);
        const nextIndex = currentIndex < activeElements.length - 1 ? currentIndex + 1 : 0;
        activeElements[nextIndex]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const activeElements = itemsRef.current.filter((el): el is HTMLButtonElement => el !== null && !el.disabled);
        if (activeElements.length === 0) return;
        const currentIndex = activeElements.indexOf(document.activeElement as HTMLButtonElement);
        const nextIndex = currentIndex > 0 ? currentIndex - 1 : activeElements.length - 1;
        activeElements[nextIndex]?.focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        const activeElements = itemsRef.current.filter((el): el is HTMLButtonElement => el !== null && !el.disabled);
        activeElements[0]?.focus();
      } else if (e.key === "End") {
        e.preventDefault();
        const activeElements = itemsRef.current.filter((el): el is HTMLButtonElement => el !== null && !el.disabled);
        activeElements[activeElements.length - 1]?.focus();
      }
    }

    function handleScrollOrResize() {
      updatePosition();
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open, updatePosition]);

  return (
    <div
      className={`relative inline-block text-left ${open ? "z-40" : "z-auto"}`}
      ref={menuRef}
    >
      {trigger ? (
        <div
          onClick={() => setOpen((prev) => !prev)}
          className="cursor-pointer"
          aria-haspopup="true"
          aria-expanded={open}
        >
          {trigger}
        </div>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-label={ariaLabel}
          aria-haspopup="true"
          aria-expanded={open}
          className={`grid h-8 w-8 place-items-center rounded-lg transition ${
            open
              ? "bg-zinc-100 text-zinc-900 ring-1 ring-zinc-300"
              : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          }`}
        >
          <MoreHorizontal size={16} />
        </button>
      )}

      {open && (
        <div
          role="menu"
          aria-orientation="vertical"
          aria-label={ariaLabel}
          className={`absolute ${
            horizontalAlign === "right" ? "right-0" : "left-0"
          } ${
            openUpward
              ? "bottom-full mb-1.5 origin-bottom-right"
              : "top-full mt-1.5 origin-top-right"
          } z-50 min-w-[165px] max-w-[calc(100vw-2rem)] rounded-xl border border-zinc-200/90 bg-white p-1 shadow-dropdown animate-in fade-in zoom-in-95 duration-100`}
        >
          <div className="space-y-0.5">
            {items.map((item, idx) => (
              <button
                key={idx}
                ref={(el) => {
                  itemsRef.current[idx] = el;
                }}
                type="button"
                role="menuitem"
                tabIndex={open ? 0 : -1}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs sm:text-sm font-medium transition text-left disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none ${
                  item.variant === "danger"
                    ? "text-rose-600 hover:bg-rose-50 focus:bg-rose-50 focus:text-rose-700"
                    : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 focus:bg-zinc-100 focus:text-zinc-900"
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

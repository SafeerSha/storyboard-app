"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Search, ChevronDown, Check, X } from "lucide-react";

export interface SearchableSelectOption {
  value: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
  badge?: string;
  description?: string;
}

export interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  searchable?: boolean;
  icon?: React.ReactNode;
  className?: string;
  triggerClassName?: string;
  menuWidthClass?: string;
  align?: "left" | "right";
  disabled?: boolean;
  ariaLabel?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select an option...",
  searchPlaceholder = "Search projects...",
  searchable,
  icon,
  className = "",
  triggerClassName,
  menuWidthClass = "w-64 sm:w-72",
  align = "left",
  disabled = false,
  ariaLabel = "Select option",
}: SearchableSelectProps) {
  const isSearchable = searchable !== undefined ? searchable : options.length > 5;
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openUpward, setOpenUpward] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Find currently selected option
  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase().trim();
    return options.filter((opt) => {
      const labelMatch = opt.label.toLowerCase().includes(query);
      const descMatch = opt.description?.toLowerCase().includes(query);
      return labelMatch || descMatch;
    });
  }, [options, searchQuery]);

  // Dynamic collision detection to flip dropdown above if cramped below
  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const estimatedHeight = 320;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    if (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
      setOpenUpward(true);
    } else {
      setOpenUpward(false);
    }
  }, []);

  // Handle open state changes
  useEffect(() => {
    if (isOpen) {
      updatePosition();
      setSearchQuery("");
      setHighlightedIndex(-1);
      if (isSearchable) {
        // Auto-focus search input with micro-delay for smooth rendering
        const timer = setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, updatePosition, isSearchable]);

  // Click outside & scroll listeners
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleScrollOrResize() {
      updatePosition();
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          handleSelect(filteredOptions[highlightedIndex].value);
        }
        break;
    }
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-block text-left ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* Modern Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        className={
          triggerClassName ||
          `group flex items-center justify-between gap-2 rounded-xl border border-[rgba(15,23,42,0.12)] bg-[#F8F9FB] hover:bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0F172A] transition-all hover:border-[rgba(204,160,56,0.35)] hover:shadow-2xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[#CCA038] cursor-pointer disabled:opacity-50 disabled:pointer-events-none ${
            isOpen ? "bg-white border-[#CCA038] ring-2 ring-[#CCA038]/15 shadow-2xs" : ""
          }`
        }
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {icon ? (
            <span className="shrink-0 text-[#64748B] group-hover:text-[#785312] transition-colors">
              {icon}
            </span>
          ) : selectedOption?.icon ? (
            <span className="shrink-0">{selectedOption.icon}</span>
          ) : null}

          <span className="truncate max-w-[150px] sm:max-w-[190px]">
            {selectedOption ? selectedOption.label : placeholder}
          </span>

          {typeof selectedOption?.count === "number" && (
            <span className="rounded-full bg-[rgba(204,160,56,0.14)] px-1.5 py-0.2 text-[9px] font-bold text-[#785312] tabular-nums shrink-0">
              {selectedOption.count}
            </span>
          )}
        </div>

        <ChevronDown
          size={12}
          className={`shrink-0 text-[#64748B] transition-transform duration-200 group-hover:text-[#0F172A] ${
            isOpen ? "rotate-180 text-[#CCA038]" : ""
          }`}
        />
      </button>

      {/* Modern Searchable Popover Menu */}
      {isOpen && (
        <div
          className={`absolute ${
            align === "right" ? "right-0" : "left-0"
          } ${
            openUpward ? "bottom-full mb-1.5" : "top-full mt-1.5"
          } ${menuWidthClass} z-50 rounded-2xl border border-[rgba(15,23,42,0.10)] bg-white/98 backdrop-blur-xl shadow-[0_12px_36px_rgba(15,23,42,0.14)] p-1.5 animate-in fade-in-50 zoom-in-95 duration-150`}
        >
          {/* Integrated Search Bar (only when searchable) */}
          {isSearchable && (
            <div className="relative mb-1">
              <div className="flex items-center gap-1.5 rounded-xl border border-[rgba(15,23,42,0.08)] bg-[#F8F9FB] px-2.5 py-1.5 transition-all focus-within:border-[#CCA038] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#CCA038]/20">
                <Search size={12} className="text-[#94A3B8] shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full bg-transparent text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="rounded-md p-0.5 text-[#94A3B8] hover:text-[#0F172A] hover:bg-slate-200/60 transition cursor-pointer"
                    title="Clear search"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options List */}
          <div
            ref={listRef}
            role="listbox"
            aria-label={ariaLabel}
            className="max-h-60 overflow-y-auto space-y-0.5 pr-0.5"
          >
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center">
                <Search size={16} className="mx-auto text-slate-300 mb-1.5" />
                <p className="text-xs font-medium text-slate-500">No matching options</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Try a different search term</p>
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt.value)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs text-left transition cursor-pointer ${
                      isSelected
                        ? "bg-gradient-to-r from-[#FEF9EE] to-[#FBF5E6] text-[#785312] font-semibold shadow-2xs border border-[#CCA038]/30"
                        : isHighlighted
                        ? "bg-slate-100/70 text-[#0F172A]"
                        : "text-[#334155] hover:bg-slate-50 hover:text-[#0F172A]"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate">{opt.label}</span>
                          {typeof opt.count === "number" && (
                            <span
                              className={`rounded-full px-1.5 py-0.2 text-[9px] font-bold tabular-nums shrink-0 ${
                                isSelected
                                  ? "bg-[rgba(204,160,56,0.22)] text-[#785312]"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {opt.count}
                            </span>
                          )}
                          {opt.badge && (
                            <span className="rounded bg-slate-100 px-1 py-0.2 text-[8.5px] font-semibold text-slate-600 uppercase tracking-wider shrink-0">
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        {opt.description && (
                          <p className="text-[10px] text-slate-500 truncate mt-0.5">
                            {opt.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Check size={13} className="text-[#CCA038] shrink-0 ml-1 stroke-[2.5]" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

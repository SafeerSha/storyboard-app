"use client";

import React from "react";
import { PRODUCT_NAME } from "@/lib/brand";

export interface ReqlyLogoProps {
  /** Size preset or custom pixel number */
  size?: "sm" | "md" | "lg" | "xl" | number;
  /** Presentation variant */
  variant?: "icon" | "full" | "stacked";
  /** Optional role/portal badge (e.g. "Admin", "Team", "Client Portal") */
  badge?: string;
  /** Inverted theme for dark backgrounds */
  inverted?: boolean;
  /** Background tile style: 'none' (transparent, default) or 'white' (porcelain pearl) */
  bg?: "none" | "white";
  /** Custom outer wrapper className */
  className?: string;
  /** Custom icon wrapper className */
  iconClassName?: string;
}

// Legacy alias — keep old name importable so no import sites break immediately
/** @deprecated Use ReqlyLogoProps */
export type StoryBoardLogoProps = ReqlyLogoProps;

const SIZE_MAP = {
  sm: { icon: 28, text: "text-sm", badge: "text-[9px]" },
  md: { icon: 32, text: "text-base", badge: "text-[10px]" },
  lg: { icon: 44, text: "text-xl", badge: "text-xs" },
  xl: { icon: 56, text: "text-2xl", badge: "text-xs" },
};

/**
 * Reqly Signature Vector Logo Mark — Concept B: 3D Stepped Hierarchy Cubes
 * Architectural 3D isometric ingots representing Requirements -> Breakdown -> Delivery.
 * Free-standing on transparent background (or optional clean white porcelain badge).
 * Pure geometric architectural symbol — non-lettermark.
 */
export function ReqlyLogoMark({
  size = 32,
  className = "",
  bg = "none",
}: {
  size?: number;
  className?: string;
  bg?: "none" | "white";
}) {
  const rawId = React.useId();
  const id = rawId.replace(/[^a-zA-Z0-9-_]/g, "");

  return (
    <div
      style={{ width: size, height: size }}
      className={`relative shrink-0 select-none transition-transform duration-200 group-hover:scale-[1.03] ${className}`}
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full drop-shadow-xs"
        aria-hidden="true"
      >
        <defs>
          {/* Optional Porcelain Pearl Squircle Gradient */}
          <linearGradient
            id={`cube-white-bg-${id}`}
            x1="0"
            y1="0"
            x2="32"
            y2="32"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#F8F9FA" />
          </linearGradient>

          {/* Champagne Gold Perimeter Hairline Rim */}
          <linearGradient
            id={`cube-rim-${id}`}
            x1="0"
            y1="0"
            x2="32"
            y2="32"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#FCE5A4" stopOpacity="0.85" />
            <stop offset="35%" stopColor="#D4A73B" stopOpacity="0.5" />
            <stop offset="70%" stopColor="#8A6014" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.1" />
          </linearGradient>

          {/* Top Face (Specular Champagne Light) */}
          <linearGradient id={`cube-top-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFFDF7" />
            <stop offset="35%" stopColor="#FCEAB8" />
            <stop offset="100%" stopColor="#E2B74B" />
          </linearGradient>

          {/* Left Face (Warm Satin Metallic Midtone) */}
          <linearGradient id={`cube-left-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ECC670" />
            <stop offset="55%" stopColor="#CCA038" />
            <stop offset="100%" stopColor="#A1741D" />
          </linearGradient>

          {/* Right Face (Deep Honey-Bronze Shadow) */}
          <linearGradient id={`cube-right-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#996D14" />
            <stop offset="60%" stopColor="#734F0C" />
            <stop offset="100%" stopColor="#473005" />
          </linearGradient>

          {/* Edge Specular Glint */}
          <linearGradient id={`cube-glint-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="60%" stopColor="#FCE5A4" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#CCA038" stopOpacity="0.1" />
          </linearGradient>

          {/* Warm Amber-Bronze Ambient Drop Shadow (No harsh black) */}
          <filter
            id={`cube-drop-${id}`}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feDropShadow
              dx="0"
              dy="1.5"
              stdDeviation="1.2"
              floodColor="#785312"
              floodOpacity="0.28"
            />
            <feDropShadow
              dx="0"
              dy="0.5"
              stdDeviation="0.4"
              floodColor="#2A1B05"
              floodOpacity="0.20"
            />
          </filter>
        </defs>

        {/* 1. Optional White Porcelain Badge (Only rendered if bg === "white") */}
        {bg === "white" && (
          <>
            <rect width="32" height="32" rx="8" fill={`url(#cube-white-bg-${id})`} />
            <rect
              x="0.5"
              y="0.5"
              width="31"
              height="31"
              rx="7.5"
              stroke={`url(#cube-rim-${id})`}
              strokeWidth="1"
            />
          </>
        )}

        {/* 2. 3D Stepped Hierarchy Cubes (Free-standing, no 'R' letter, no dark box) */}
        <g filter={`url(#cube-drop-${id})`}>
          {/* ================= 1. TOP CUBE (Peak / Verified Delivery) ================= */}
          <path d="M16.5 8.5L16.5 15L21 17.5L21 11Z" fill={`url(#cube-left-${id})`} />
          <path d="M21 11L21 17.5L25.5 15L25.5 8.5Z" fill={`url(#cube-right-${id})`} />
          <path d="M21 6L25.5 8.5L21 11L16.5 8.5Z" fill={`url(#cube-top-${id})`} />
          <path d="M21 6L16.5 8.5L21 11" stroke={`url(#cube-glint-${id})`} strokeWidth="0.6" strokeLinecap="round" />

          {/* ================= 2. CENTER CUBE (Story Breakdown Tier) ================= */}
          <path d="M11 13.5L11 20L15.5 22.5L15.5 16Z" fill={`url(#cube-left-${id})`} />
          <path d="M15.5 16L15.5 22.5L17.5 21.4L17.5 14.9Z" fill={`url(#cube-right-${id})`} />
          <path d="M15.5 11L20 13.5L15.5 16L11 13.5Z" fill={`url(#cube-top-${id})`} />
          <path d="M15.5 11L11 13.5L15.5 16" stroke={`url(#cube-glint-${id})`} strokeWidth="0.6" strokeLinecap="round" />

          {/* ================= 3. BOTTOM-LEFT CUBE (Requirements Base Tier) ================= */}
          <path d="M6 18.5L6 25L10.5 27.5L10.5 21Z" fill={`url(#cube-left-${id})`} />
          <path d="M10.5 21L10.5 27.5L15 25L15 18.5Z" fill={`url(#cube-right-${id})`} />
          <path d="M10.5 16L15 18.5L10.5 21L6 18.5Z" fill={`url(#cube-top-${id})`} />
          <path d="M10.5 16L6 18.5L10.5 21" stroke={`url(#cube-glint-${id})`} strokeWidth="0.6" strokeLinecap="round" />

          {/* ================= 4. BOTTOM-RIGHT CUBE (Verified Output Tier) ================= */}
          <path d="M16.5 18.5L16.5 25L21 27.5L21 21Z" fill={`url(#cube-left-${id})`} />
          <path d="M21 21L21 27.5L25.5 25L25.5 18.5Z" fill={`url(#cube-right-${id})`} />
          <path d="M21 16L25.5 18.5L21 21L16.5 18.5Z" fill={`url(#cube-top-${id})`} />
          <path d="M21 16L16.5 18.5L21 21" stroke={`url(#cube-glint-${id})`} strokeWidth="0.6" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}

/** @deprecated Use ReqlyLogoMark */
export const StoryBoardLogoMark = ReqlyLogoMark;

/**
 * Reqly Complete Logo Component
 * Renders the vector mark with typography and optional badges.
 */
export function ReqlyLogo({
  size = "md",
  variant = "full",
  badge,
  inverted = false,
  bg = "none",
  className = "",
  iconClassName = "",
}: ReqlyLogoProps) {
  const pixelSize = typeof size === "number" ? size : SIZE_MAP[size].icon;
  const sizeConfig = typeof size === "string" ? SIZE_MAP[size] : SIZE_MAP.md;

  if (variant === "icon") {
    return <ReqlyLogoMark size={pixelSize} className={iconClassName || className} bg={bg} />;
  }

  if (variant === "stacked") {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        <ReqlyLogoMark size={pixelSize} className={`mb-3 ${iconClassName}`} bg={bg} />
        <div className="flex items-center justify-center gap-2">
          <span
            className={`font-bold tracking-tight ${sizeConfig.text} ${
              inverted ? "text-white" : "text-[#0F172A]"
            }`}
          >
            REQ<span className="text-[#CCA038]">ly</span>
          </span>
          {badge && (
            <span
              className={`rounded-md px-1.5 py-0.5 font-semibold uppercase tracking-wider border ${
                sizeConfig.badge
              } ${
                inverted
                  ? "bg-white/15 text-white border-white/20"
                  : "bg-[rgba(204,160,56,0.12)] text-[#785312] border-[rgba(204,160,56,0.16)]"
              }`}
            >
              {badge}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Variant === "full" (Horizontal lockup)
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <ReqlyLogoMark size={pixelSize} className={iconClassName} bg={bg} />
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={`font-bold tracking-tight leading-none truncate ${sizeConfig.text} ${
            inverted ? "text-white" : "text-[#0F172A]"
          }`}
        >
          REQ<span className="text-[#CCA038]">ly</span>
        </span>
        {badge && (
          <span
            className={`rounded-md px-1.5 py-0.5 font-semibold uppercase tracking-wider border shrink-0 ${
              sizeConfig.badge
            } ${
              inverted
                ? "bg-white/15 text-white border-white/20"
                : "bg-[rgba(204,160,56,0.10)] text-[#785312] border-[rgba(204,160,56,0.14)]"
            }`}
          >
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

/** @deprecated Use ReqlyLogo */
export const StoryBoardLogo = ReqlyLogo;

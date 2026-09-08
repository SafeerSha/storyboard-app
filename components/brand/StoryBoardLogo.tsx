"use client";

import React from "react";

export interface StoryBoardLogoProps {
  /** Size preset or custom pixel number */
  size?: "sm" | "md" | "lg" | "xl" | number;
  /** Presentation variant */
  variant?: "icon" | "full" | "stacked";
  /** Optional role/portal badge (e.g. "Admin", "Team", "Client Portal") */
  badge?: string;
  /** Inverted theme for dark backgrounds */
  inverted?: boolean;
  /** Custom outer wrapper className */
  className?: string;
  /** Custom icon wrapper className */
  iconClassName?: string;
}

const SIZE_MAP = {
  sm: { icon: 28, text: "text-sm", badge: "text-[9px]" },
  md: { icon: 32, text: "text-base", badge: "text-[10px]" },
  lg: { icon: 44, text: "text-xl", badge: "text-xs" },
  xl: { icon: 56, text: "text-2xl", badge: "text-xs" },
};

/**
 * StoryBoard Signature Vector Logo Mark
 * Metaphor: The StoryBoard Hierarchy — Epic Column (Left), In-Progress Story (Top Right),
 * and Approved Signed-Off Story (Bottom Right) inside a premium champagne-gold jewel squircle.
 */
export function StoryBoardLogoMark({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const gradientId = React.useId();

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
          {/* Champagne gold metallic squircle gradient */}
          <linearGradient
            id={`sb-bg-${gradientId}`}
            x1="2"
            y1="2"
            x2="30"
            y2="30"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#E2C17C" />
            <stop offset="35%" stopColor="#C89F52" />
            <stop offset="70%" stopColor="#B8944E" />
            <stop offset="100%" stopColor="#87621E" />
          </linearGradient>

          {/* Frosted glass inner border reflection */}
          <linearGradient
            id={`sb-glass-${gradientId}`}
            x1="0"
            y1="0"
            x2="32"
            y2="32"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.5" />
            <stop offset="40%" stopColor="#FFFFFF" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.04" />
          </linearGradient>

          {/* Soft depth shadow for internal cards */}
          <filter
            id={`sb-card-shadow-${gradientId}`}
            x="-15%"
            y="-15%"
            width="130%"
            height="130%"
          >
            <feDropShadow
              dx="0"
              dy="1"
              stdDeviation="0.8"
              floodColor="#2E2008"
              floodOpacity="0.28"
            />
          </filter>
        </defs>

        {/* Squircle Background */}
        <rect width="32" height="32" rx="8.5" fill={`url(#sb-bg-${gradientId})`} />
        <rect
          x="0.5"
          y="0.5"
          width="31"
          height="31"
          rx="8"
          stroke={`url(#sb-glass-${gradientId})`}
          strokeWidth="1"
        />

        {/* 1. Left Column: Epic/Hierarchy Stream */}
        <g filter={`url(#sb-card-shadow-${gradientId})`}>
          <rect
            x="6.5"
            y="6.5"
            width="7.5"
            height="19"
            rx="2"
            fill="white"
            fillOpacity="0.96"
          />
          {/* Header pill on Epic card */}
          <rect
            x="8"
            y="8.5"
            width="4.5"
            height="2"
            rx="0.8"
            fill="#B8944E"
            fillOpacity="0.9"
          />
          {/* Stream slot 1 */}
          <rect
            x="8"
            y="12"
            width="4.5"
            height="1.5"
            rx="0.6"
            fill="#87621E"
            fillOpacity="0.32"
          />
          {/* Stream slot 2 */}
          <rect
            x="8"
            y="15"
            width="4.5"
            height="1.5"
            rx="0.6"
            fill="#87621E"
            fillOpacity="0.32"
          />
          {/* Stream slot 3 */}
          <rect
            x="8"
            y="18"
            width="3"
            height="1.5"
            rx="0.6"
            fill="#87621E"
            fillOpacity="0.25"
          />
        </g>

        {/* 2. Top Right: Active Feature Story Card */}
        <g filter={`url(#sb-card-shadow-${gradientId})`}>
          <rect
            x="16"
            y="6.5"
            width="9.5"
            height="8.5"
            rx="2"
            fill="white"
            fillOpacity="0.93"
          />
          {/* Title line */}
          <rect
            x="17.8"
            y="8.5"
            width="6"
            height="1.6"
            rx="0.7"
            fill="#B8944E"
            fillOpacity="0.9"
          />
          {/* Sub-criterion line */}
          <rect
            x="17.8"
            y="11.5"
            width="4.2"
            height="1.3"
            rx="0.6"
            fill="#87621E"
            fillOpacity="0.3"
          />
        </g>

        {/* 3. Bottom Right: Approved Sign-Off Story Card with Signature Checkmark */}
        <g filter={`url(#sb-card-shadow-${gradientId})`}>
          <rect
            x="16"
            y="17"
            width="9.5"
            height="8.5"
            rx="2"
            fill="white"
            fillOpacity="0.97"
          />
          {/* Checkmark indicator */}
          <path
            d="M18.2 21.3 L19.8 23 L23.5 19"
            stroke="#2E8B70"
            strokeWidth="1.65"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </div>
  );
}

/**
 * StoryBoard Complete Logo Component
 * Renders the vector mark with typography and optional badges.
 */
export function StoryBoardLogo({
  size = "md",
  variant = "full",
  badge,
  inverted = false,
  className = "",
  iconClassName = "",
}: StoryBoardLogoProps) {
  const pixelSize = typeof size === "number" ? size : SIZE_MAP[size].icon;
  const sizeConfig = typeof size === "string" ? SIZE_MAP[size] : SIZE_MAP.md;

  if (variant === "icon") {
    return <StoryBoardLogoMark size={pixelSize} className={iconClassName || className} />;
  }

  if (variant === "stacked") {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        <StoryBoardLogoMark size={pixelSize} className={`mb-3 ${iconClassName}`} />
        <div className="flex items-center justify-center gap-2">
          <span
            className={`font-bold tracking-tight ${sizeConfig.text} ${
              inverted ? "text-white" : "text-[#252331]"
            }`}
          >
            Story<span className="text-[#B8944E]">Board</span>
          </span>
          {badge && (
            <span
              className={`rounded-md px-1.5 py-0.5 font-semibold uppercase tracking-wider border ${
                sizeConfig.badge
              } ${
                inverted
                  ? "bg-white/15 text-white border-white/20"
                  : "bg-[rgba(184,148,78,0.12)] text-[#80642F] border-[rgba(184,148,78,0.16)]"
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
      <StoryBoardLogoMark size={pixelSize} className={iconClassName} />
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={`font-bold tracking-tight leading-none truncate ${sizeConfig.text} ${
            inverted ? "text-white" : "text-[#252331]"
          }`}
        >
          Story<span className="text-[#B8944E]">Board</span>
        </span>
        {badge && (
          <span
            className={`rounded-md px-1.5 py-0.5 font-semibold uppercase tracking-wider border shrink-0 ${
              sizeConfig.badge
            } ${
              inverted
                ? "bg-white/15 text-white border-white/20"
                : "bg-[rgba(184,148,78,0.10)] text-[#80642F] border-[rgba(184,148,78,0.14)]"
            }`}
          >
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

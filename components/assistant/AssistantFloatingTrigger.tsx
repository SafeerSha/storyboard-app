"use client";

import React, { useState, useEffect, useRef } from "react";
import { Bot } from "lucide-react";
import { useAssistant } from "@/hooks/useAssistant";

const IDLE_TIMEOUT_MS = 20000; // 20 seconds idle duration

export function AssistantFloatingTrigger() {
  const { isOpen, toggleOpen, isEnabled, activityLogs, isFloatingBarVisible, isStandby } = useAssistant();
  const [isIdle, setIsIdle] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isEnabled || isOpen || isFloatingBarVisible) return;

    const resetTimer = () => {
      setIsIdle(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setIsIdle(true);
      }, IDLE_TIMEOUT_MS);
    };

    // Initial 20-second timer
    timerRef.current = setTimeout(() => {
      setIsIdle(true);
    }, IDLE_TIMEOUT_MS);

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    const handleActivity = () => resetTimer();

    events.forEach((ev) => window.addEventListener(ev, handleActivity, { passive: true }));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((ev) => window.removeEventListener(ev, handleActivity));
    };
  }, [isEnabled, isOpen, isFloatingBarVisible]);

  if (!isEnabled || isOpen || isFloatingBarVisible) return null;

  const collapsed = isIdle && !isHovered;

  return (
    <button
      type="button"
      onClick={toggleOpen}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label="Open AI Assistant"
      className={`fixed bottom-[75px] sm:bottom-[93px] z-50 inline-flex items-center h-8 sm:h-8.5 bg-transparent hover:bg-white/85 border border-[rgba(74,61,100,0.18)] hover:border-[#B8944E] text-[#252331] hover:text-[#80642F] text-xs font-semibold backdrop-blur-xs transition-all duration-300 ease-in-out cursor-pointer shadow-2xs group ${collapsed
          ? "right-0 translate-x-0 rounded-l-xl rounded-r-none border-r-0 pl-2.5 pr-2"
          : "right-4 sm:right-6 translate-x-0 rounded-xl px-2.5 sm:px-3"
        }`}
      title={
        isStandby
          ? "Say 'Reqly' anytime to wake · Click to open"
          : collapsed
          ? "AI Assistant (Super Admin) - Hover to expand"
          : "Open AI Central Assistant (Super Admin)"
      }
    >
      <div className="relative flex items-center justify-center shrink-0 text-[#80642F] group-hover:scale-110 transition-transform">
        <Bot size={15} />
        {isStandby ? (
          <span className="absolute -top-1 -right-1 h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        ) : activityLogs.length > 0 ? (
          <span className="absolute -top-1 -right-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
        ) : null}
      </div>

      <span
        className={`overflow-hidden transition-all duration-300 whitespace-nowrap ${collapsed
            ? "max-w-0 opacity-0 -ml-0"
            : "max-w-[80px] opacity-100 ml-1.5"
          }`}
      >
        REQly
      </span>
    </button>
  );
}


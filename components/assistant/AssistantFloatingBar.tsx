"use client";

import React, { useState } from "react";
import {
  Bot,
  Mic,
  Maximize2,
  X,
  Volume2,
  Loader2,
} from "lucide-react";
import { useAssistant } from "@/hooks/useAssistant";

export function AssistantFloatingBar() {
  const {
    isFloatingBarVisible,
    closeFloatingBar,
    expandToDrawer,
    floatingText,
    floatingStatus,
    isProcessing,
    isSpeaking,
    executeCommand,
    speakResponse,
    voiceFeedbackEnabled,
    setVoiceFeedbackEnabled,
    isOpen,
    isEnabled,
    voiceSupported,
    isListening,
    isStandby,
    standbyHeard,
    interimTranscript,
    startListening,
    stopListening,
    toggleListening,
  } = useAssistant();

  const [isHovered, setIsHovered] = useState(false);

  if (!isEnabled || !isFloatingBarVisible || isOpen) return null;

  const handleToggleMic = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleReplayVoice = () => {
    if (floatingText && !isSpeaking) {
      speakResponse(floatingText);
    }
  };

  // Determine what text to display in the single highlighted row
  let rowContent: React.ReactNode = null;

  if (isListening) {
    rowContent = (
      <div className="flex items-center gap-2 overflow-hidden">
        {/* Dynamic audio waveform animation with StoryBoard palette */}
        <div className="flex items-center gap-0.5 shrink-0 px-1 py-0.5 bg-[rgba(184,148,78,0.14)] border border-[rgba(184,148,78,0.25)] rounded-full">
          <span className="w-1 h-3 bg-[#B8944E] rounded-full animate-pulse" />
          <span className="w-1 h-4.5 bg-[#C25D72] rounded-full animate-pulse [animation-delay:120ms]" />
          <span className="w-1 h-2 bg-[#5B507A] rounded-full animate-pulse [animation-delay:240ms]" />
          <span className="w-1 h-3.5 bg-[#80642F] rounded-full animate-pulse [animation-delay:80ms]" />
        </div>
        <span className="text-xs sm:text-sm font-semibold text-[#664914] truncate">
          {interimTranscript || "Listening... speak now"}
        </span>
      </div>
    );
  } else if (isProcessing || floatingStatus === "processing") {
    rowContent = (
      <div className="flex items-center gap-2 overflow-hidden">
        <Loader2 size={14} className="animate-spin text-[#80642F] shrink-0" />
        <span className="text-xs sm:text-sm font-medium text-[#706C7D] truncate animate-pulse">
          {floatingText || "Reqly is processing..."}
        </span>
      </div>
    );
  } else if (isSpeaking || floatingStatus === "speaking") {
    rowContent = (
      <div className="flex items-center gap-2 overflow-hidden">
        {/* Active speaker wave */}
        <div className="flex items-center gap-0.5 shrink-0 text-[#80642F]">
          <span className="w-0.5 h-2 bg-[#80642F] rounded-full animate-pulse" />
          <span className="w-0.5 h-3.5 bg-[#80642F] rounded-full animate-pulse [animation-delay:150ms]" />
          <span className="w-0.5 h-2 bg-[#80642F] rounded-full animate-pulse [animation-delay:300ms]" />
        </div>
        <span className="text-xs sm:text-sm font-medium text-[#252331] truncate">
          {floatingText}
        </span>
      </div>
    );
  } else {
    rowContent = (
      <div className="flex items-center gap-2 overflow-hidden">
        <span className="text-xs sm:text-sm font-medium text-[#252331] truncate">
          {standbyHeard
            ? `Heard "${standbyHeard}" · Say 'Reqly'`
            : floatingText || "Reqly ready. Tap mic or say 'Reqly'."}
        </span>
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="region"
      aria-label="Executive AI Assistant Floating Mode"
      className="fixed bottom-[78px] sm:bottom-[96px] left-1/2 -translate-x-1/2 z-50 w-[94vw] max-w-xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 pointer-events-auto select-none"
    >
      {/* Outer Frosted Glass Shell */}
      <div
        className="relative flex items-center justify-between gap-2.5 sm:gap-3 px-3.5 sm:px-4 py-2 rounded-full border border-white/60 bg-white/55 backdrop-blur-2xl shadow-[0_20px_45px_rgba(70,55,95,0.10),0_4px_14px_rgba(184,148,78,0.10),inset_0_1.5px_2px_0_rgba(255,255,255,0.95),inset_0_0_0_1px_rgba(255,255,255,0.40),inset_0_-1.5px_3px_0_rgba(74,61,100,0.03)] transition-all duration-200 hover:border-[#B8944E]/40"
        style={{
          WebkitBackdropFilter: "blur(28px) saturate(190%)",
          backdropFilter: "blur(28px) saturate(190%)",
        }}
      >
        {/* Left: Reqly Brand Badge & Status */}
        <div
          onClick={expandToDrawer}
          className="flex items-center gap-1.5 sm:gap-2 shrink-0 cursor-pointer group"
          title={isStandby ? "Reqly standby: Say 'Reqly' to wake" : "Click to view full Activity Log"}
        >
          <div className="relative flex items-center justify-center w-7 h-7 rounded-full bg-white/85 border border-white/90 text-[#80642F] shadow-[0_2px_8px_rgba(184,148,78,0.12),inset_0_1px_1.5px_rgba(255,255,255,0.95)] group-hover:scale-105 transition-transform">
            <Bot size={15} />
            <span
              className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${
                isListening
                  ? "bg-rose-500 animate-ping"
                  : isSpeaking
                  ? "bg-amber-500 animate-pulse"
                  : isStandby
                  ? "bg-emerald-500 animate-pulse"
                  : "bg-emerald-500"
              }`}
            />
          </div>
          <span className="hidden sm:inline text-xs font-bold tracking-tight text-[#80642F]">
            Reqly
          </span>
        </div>

        {/* Center: Single Highlighted Frosted Glass Row */}
        <div className="flex-1 min-w-0 px-3 py-1.5 rounded-full bg-white/70 border border-[rgba(74,61,100,0.08)] shadow-[inset_0_1px_2px_rgba(255,255,255,0.90),0_1px_4px_rgba(70,55,95,0.03)] backdrop-blur-md overflow-hidden">
          {rowContent}
        </div>

        {/* Right: Floating Glass Actions */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Voice Input Toggle Button */}
          {voiceSupported && (
            <button
              type="button"
              onClick={handleToggleMic}
              title={isListening ? "Stop listening" : "Tap to speak command"}
              className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 cursor-pointer ${
                isListening
                  ? "bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-[0_4px_12px_rgba(225,29,72,0.35)] animate-pulse ring-2 ring-rose-200"
                  : "bg-[rgba(184,148,78,0.12)] hover:bg-[rgba(184,148,78,0.22)] text-[#80642F] border border-[rgba(184,148,78,0.30)] shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.85),0_1px_3px_rgba(184,148,78,0.08)]"
              }`}
            >
              <Mic size={14} />
            </button>
          )}

          {/* Replay Spoken Audio Button */}
          {floatingText && (
            <button
              type="button"
              onClick={handleReplayVoice}
              disabled={isSpeaking}
              title="Replay spoken response"
              className="flex items-center justify-center w-7 h-7 rounded-full bg-white/60 hover:bg-white/95 border border-white/70 text-[#706C7D] hover:text-[#252331] shadow-[0_1px_3px_rgba(70,55,95,0.04),inset_0_1px_1px_rgba(255,255,255,0.9)] transition-colors cursor-pointer disabled:opacity-40"
            >
              <Volume2 size={13} />
            </button>
          )}

          {/* Expand to Full Side Drawer */}
          <button
            type="button"
            onClick={expandToDrawer}
            title="Expand to Full Activity Log & Chat Drawer"
            className="flex items-center justify-center w-7 h-7 rounded-full bg-white/60 hover:bg-white/95 border border-white/70 text-[#706C7D] hover:text-[#80642F] shadow-[0_1px_3px_rgba(70,55,95,0.04),inset_0_1px_1px_rgba(255,255,255,0.9)] transition-colors cursor-pointer"
          >
            <Maximize2 size={13} />
          </button>

          {/* Close Floating Bar */}
          <button
            type="button"
            onClick={closeFloatingBar}
            title="Close floating mode (returns to idle trigger)"
            className="flex items-center justify-center w-7 h-7 rounded-full bg-white/60 hover:bg-rose-50 border border-white/70 text-[#9994A5] hover:text-rose-600 shadow-[0_1px_3px_rgba(70,55,95,0.04),inset_0_1px_1px_rgba(255,255,255,0.9)] transition-colors cursor-pointer"
          >
            <X size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

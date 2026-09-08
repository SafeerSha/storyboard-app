"use client";

import React, { forwardRef, useRef, useImperativeHandle, useState, useEffect } from "react";
import { Mic, MicOff, Radio } from "lucide-react";
import { useVoiceInput } from "@/hooks/useVoiceInput";

export interface VoiceTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value?: string;
  onValueChange?: (value: string) => void;
  containerClassName?: string;
  micPosition?: "bottom-right" | "top-right";
  hideMicIfUnsupported?: boolean;
  autoGrow?: boolean;
  actionSlot?: React.ReactNode;
  actionSize?: "sm" | "md";
}

export const VoiceTextarea = forwardRef<HTMLTextAreaElement, VoiceTextareaProps>(
  function VoiceTextarea(
    {
      value = "",
      onChange,
      onValueChange,
      containerClassName = "",
      className = "",
      micPosition = "bottom-right",
      hideMicIfUnsupported = false,
      autoGrow = true,
      disabled = false,
      rows = 3,
      placeholder,
      actionSlot,
      actionSize = "md",
      ...props
    },
    ref
  ) {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);
    useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);

    const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
    const currentValueRef = useRef(value);
    currentValueRef.current = value;

    // Auto-adjust height to fit full content without height limit or vertical scrollbars
    const adjustHeight = React.useCallback(() => {
      if (!autoGrow) return;
      const textarea = innerRef.current;
      if (!textarea) return;
      textarea.style.height = "auto";
      textarea.style.overflow = "hidden";
      textarea.style.maxHeight = "none";
      const minHeight = (rows || 1) * 24;
      const targetHeight = Math.max(Math.ceil(textarea.scrollHeight), minHeight);
      textarea.style.height = `${targetHeight}px`;
    }, [autoGrow, rows]);

    useEffect(() => {
      adjustHeight();
      const raf = requestAnimationFrame(() => adjustHeight());
      const timer = setTimeout(() => adjustHeight(), 50);
      if (typeof document !== "undefined" && (document as any).fonts?.ready) {
        (document as any).fonts.ready.then(() => adjustHeight());
      }
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
      };
    }, [value, adjustHeight]);

    // Track element resize (e.g. responsive viewport or container changes)
    useEffect(() => {
      if (!autoGrow || !innerRef.current) return;
      const textarea = innerRef.current;
      const handleResize = () => adjustHeight();
      window.addEventListener("resize", handleResize);

      let resizeObserver: ResizeObserver | null = null;
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => adjustHeight());
        resizeObserver.observe(textarea);
      }

      return () => {
        window.removeEventListener("resize", handleResize);
        if (resizeObserver) resizeObserver.disconnect();
      };
    }, [autoGrow, adjustHeight]);

    // Helper to commit new text into the textarea with cursor preservation
    const applyTranscript = (transcriptText: string) => {
      const current = currentValueRef.current || "";
      const textarea = innerRef.current;

      const selStart =
        selectionRange?.start ??
        (typeof textarea?.selectionStart === "number" ? textarea.selectionStart : current.length);
      const selEnd =
        selectionRange?.end ??
        (typeof textarea?.selectionEnd === "number" ? textarea.selectionEnd : current.length);

      const before = current.slice(0, selStart);
      const after = current.slice(selEnd);

      // Intelligent spacing around insertion
      const needsLeadingSpace =
        before.length > 0 &&
        !/\s$/.test(before) &&
        !/^[\s.,!?:;]/.test(transcriptText);

      const needsTrailingSpace =
        after.length > 0 &&
        !/^\s/.test(after) &&
        !/[\s]$/.test(transcriptText);

      const inserted =
        (needsLeadingSpace ? " " : "") +
        transcriptText +
        (needsTrailingSpace ? " " : "");

      const nextValue = before + inserted + after;
      const newCursorPos = selStart + inserted.length;

      // Notify parent listeners
      onValueChange?.(nextValue);

      if (onChange) {
        const syntheticEvent = {
          target: { value: nextValue, name: props.name },
          currentTarget: { value: nextValue, name: props.name },
          bubbles: true,
          cancelable: true,
          type: "change",
        } as unknown as React.ChangeEvent<HTMLTextAreaElement>;
        onChange(syntheticEvent);
      }

      // Update cursor position and height
      setSelectionRange({ start: newCursorPos, end: newCursorPos });
      if (textarea) {
        requestAnimationFrame(() => {
          adjustHeight();
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        });
      }
    };

    const {
      isSupported,
      isListening,
      interimTranscript,
      toggleListening,
      stopListening,
    } = useVoiceInput({
      onTranscript: (transcriptChunk, isFinal) => {
        if (isFinal && transcriptChunk.trim()) {
          applyTranscript(transcriptChunk.trim());
        }
      },
    });

    // Capture selection on focus/click/keyup
    const updateSelection = () => {
      if (innerRef.current) {
        const start = innerRef.current.selectionStart ?? innerRef.current.value.length;
        const end = innerRef.current.selectionEnd ?? start;
        setSelectionRange({
          start,
          end,
        });
      }
    };

    // Stop listening if disabled changes to true
    useEffect(() => {
      if (disabled && isListening) {
        stopListening();
      }
    }, [disabled, isListening, stopListening]);

    const isFlex =
      containerClassName.includes("flex-1") ||
      className.includes("flex-1") ||
      containerClassName.includes("flex");

    const cleanClassName = className.replace(/\bflex-1\b/g, "").trim();

    if (!isSupported && hideMicIfUnsupported) {
      return (
        <div className={`relative ${isFlex ? "flex-1 min-w-0" : "w-full"} ${containerClassName}`}>
          <textarea
            ref={innerRef}
            rows={rows}
            value={value}
            disabled={disabled}
            placeholder={placeholder}
            onChange={(e) => {
              adjustHeight();
              onChange?.(e);
              onValueChange?.(e.target.value);
            }}
            onInput={adjustHeight}
            style={{
              ...(autoGrow
                ? {
                    fieldSizing: "content" as any,
                    overflow: "hidden",
                    resize: "none",
                    maxHeight: "none",
                  }
                : {}),
              ...props.style,
            }}
            className={`w-full block auto-grow-field ${cleanClassName} ${autoGrow ? "overflow-hidden resize-none" : ""}`}
            {...props}
          />
        </div>
      );
    }

    const renderMicButton = (btnSize: "sm" | "md" = "md") => {
      const isSm = btnSize === "sm";
      const iconSize = isSm ? 12 : 13;
      return (
        <button
          type="button"
          disabled={disabled || !isSupported}
          onMouseDown={(e) => {
            e.preventDefault();
            updateSelection();
          }}
          onClick={() => {
            updateSelection();
            toggleListening();
          }}
          aria-label={
            !isSupported
              ? "Voice input not supported"
              : isListening
              ? "Stop voice input"
              : "Start voice input"
          }
          title={
            !isSupported
              ? "Voice input is not supported in this browser (Use Chrome, Edge, or Safari)"
              : isListening
              ? "Stop listening (Click or speak)"
              : "Speak to dictate text"
          }
          className={`inline-flex items-center justify-center ${
            isSm ? "h-6 w-6 rounded" : "h-7 w-7 rounded-lg"
          } transition-all focus:outline-none focus-visible:ring-1 focus-visible:ring-[#B8944E] cursor-pointer ${
            !isSupported
              ? "text-zinc-300 cursor-not-allowed"
              : isListening
              ? "bg-rose-50 text-[#C25D72] border border-rose-200/80 shadow-xs scale-105 active:scale-95"
              : "text-[#9994A5] hover:text-[#80642F] hover:bg-[rgba(184,148,78,0.08)] active:scale-95"
          }`}
        >
          {isListening ? (
            <Radio size={iconSize} className="animate-spin text-[#C25D72]" />
          ) : !isSupported ? (
            <MicOff size={iconSize} />
          ) : (
            <Mic size={iconSize} />
          )}
        </button>
      );
    };

    if (actionSlot) {
      return (
        <div className={`flex items-start gap-2 w-full ${isFlex ? "flex-1 min-w-0" : ""} ${containerClassName}`}>
          <div className="relative flex-1 min-w-0">
            <textarea
              ref={innerRef}
              rows={rows}
              value={value}
              disabled={disabled}
              placeholder={placeholder}
              onChange={(e) => {
                updateSelection();
                adjustHeight();
                onChange?.(e);
                onValueChange?.(e.target.value);
              }}
              onInput={adjustHeight}
              onSelect={updateSelection}
              onClick={updateSelection}
              onKeyUp={updateSelection}
              style={{
                ...(autoGrow
                  ? {
                      fieldSizing: "content" as any,
                      overflow: "hidden",
                      resize: "none",
                      maxHeight: "none",
                    }
                  : {}),
                ...props.style,
              }}
              className={`w-full block auto-grow-field ${cleanClassName} ${
                autoGrow ? "overflow-hidden resize-none" : ""
              } ${
                isListening
                  ? "ring-1 ring-[#C25D72]/50 border-[#C25D72]/60"
                  : ""
              }`}
              {...props}
            />

            {/* Live speech transcription pill */}
            {isListening && (
              <div className="absolute left-1 bottom-1 max-w-[calc(100%-20px)] flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/95 border border-[#C25D72]/30 shadow-xs pointer-events-none backdrop-blur-xs z-10 transition-all">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C25D72] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#C25D72]"></span>
                </span>
                <span className="text-[11px] font-medium text-[#C25D72] truncate">
                  {interimTranscript ? `"${interimTranscript}"` : "Listening... speak now"}
                </span>
              </div>
            )}
          </div>

          {/* Action Column: Top is Remove Button, Under is Microphone */}
          <div className="flex flex-col items-center gap-1 shrink-0 mt-0.5">
            {actionSlot}
            {renderMicButton(actionSize)}
          </div>
        </div>
      );
    }

    return (
      <div className={`relative ${isFlex ? "flex-1 min-w-0" : "w-full"} group ${containerClassName}`}>
        <textarea
          ref={innerRef}
          rows={rows}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => {
            updateSelection();
            adjustHeight();
            onChange?.(e);
            onValueChange?.(e.target.value);
          }}
          onInput={adjustHeight}
          onSelect={updateSelection}
          onClick={updateSelection}
          onKeyUp={updateSelection}
          style={{
            ...(autoGrow
              ? {
                  fieldSizing: "content" as any,
                  overflow: "hidden",
                  resize: "none",
                  maxHeight: "none",
                }
              : {}),
            ...props.style,
          }}
          className={`w-full block auto-grow-field ${isSupported ? "pr-9" : ""} ${cleanClassName} ${
            autoGrow ? "overflow-hidden resize-none" : ""
          } ${
            isListening
              ? "ring-1 ring-[#C25D72]/50 border-[#C25D72]/60"
              : ""
          }`}
          {...props}
        />

        {/* Live speech transcription pill */}
        {isListening && (
          <div className="absolute left-3 bottom-2.5 max-w-[calc(100%-60px)] flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/95 border border-[#C25D72]/30 shadow-xs pointer-events-none backdrop-blur-xs z-10 transition-all">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C25D72] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#C25D72]"></span>
            </span>
            <span className="text-[11px] font-medium text-[#C25D72] truncate">
              {interimTranscript ? `"${interimTranscript}"` : "Listening... speak now"}
            </span>
          </div>
        )}

        {/* Microphone Button */}
        <div
          className={`absolute ${
            micPosition === "top-right"
              ? "top-1.5 right-2"
              : "bottom-2.5 right-2.5"
          } z-10 flex items-center gap-1`}
        >
          {renderMicButton("md")}
        </div>
      </div>
    );
  }
);

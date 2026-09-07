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
      disabled = false,
      rows = 3,
      placeholder,
      ...props
    },
    ref
  ) {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);
    useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);

    const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
    const currentValueRef = useRef(value);
    currentValueRef.current = value;

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

      // Update cursor position
      setSelectionRange({ start: newCursorPos, end: newCursorPos });
      if (textarea) {
        requestAnimationFrame(() => {
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

    if (!isSupported && hideMicIfUnsupported) {
      return (
        <div className={`relative w-full ${containerClassName}`}>
          <textarea
            ref={innerRef}
            rows={rows}
            value={value}
            disabled={disabled}
            placeholder={placeholder}
            onChange={onChange}
            className={className}
            {...props}
          />
        </div>
      );
    }

    return (
      <div className={`relative w-full group ${containerClassName}`}>
        <textarea
          ref={innerRef}
          rows={rows}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => {
            updateSelection();
            onChange?.(e);
            onValueChange?.(e.target.value);
          }}
          onSelect={updateSelection}
          onClick={updateSelection}
          onKeyUp={updateSelection}
          className={`${className} ${
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
            micPosition === "bottom-right"
              ? "bottom-2.5 right-2.5"
              : "top-2.5 right-2.5"
          } z-10 flex items-center gap-1`}
        >
          <button
            type="button"
            disabled={disabled || !isSupported}
            onMouseDown={(e) => {
              // Prevent textarea from losing cursor focus
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
            className={`inline-flex items-center justify-center h-7 w-7 rounded-lg transition-all focus:outline-none focus-visible:ring-1 focus-visible:ring-[#B8944E] ${
              !isSupported
                ? "text-zinc-300 cursor-not-allowed"
                : isListening
                ? "bg-rose-50 text-[#C25D72] border border-rose-200/80 shadow-xs scale-105 active:scale-95"
                : "text-[#9994A5] hover:text-[#80642F] hover:bg-[rgba(184,148,78,0.08)] active:scale-95"
            }`}
          >
            {isListening ? (
              <Radio size={14} className="animate-spin text-[#C25D72]" />
            ) : !isSupported ? (
              <MicOff size={14} />
            ) : (
              <Mic size={14} />
            )}
          </button>
        </div>
      </div>
    );
  }
);

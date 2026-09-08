"use client";

import React, { forwardRef, useRef, useImperativeHandle, useState, useEffect } from "react";
import { Mic, MicOff, Radio } from "lucide-react";
import { useVoiceInput } from "@/hooks/useVoiceInput";

export interface VoiceInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  value?: string;
  onValueChange?: (value: string) => void;
  containerClassName?: string;
  hideMicIfUnsupported?: boolean;
}

export const VoiceInput = forwardRef<HTMLInputElement, VoiceInputProps>(
  function VoiceInput(
    {
      value = "",
      onChange,
      onValueChange,
      containerClassName = "",
      className = "",
      hideMicIfUnsupported = false,
      disabled = false,
      placeholder,
      type = "text",
      ...props
    },
    ref
  ) {
    const innerRef = useRef<HTMLInputElement | null>(null);
    useImperativeHandle(ref, () => innerRef.current as HTMLInputElement);

    const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
    const currentValueRef = useRef(value);
    currentValueRef.current = value;

    // Helper to commit new text into the input with cursor preservation
    const applyTranscript = (transcriptText: string) => {
      const current = currentValueRef.current || "";
      const input = innerRef.current;

      const selStart =
        selectionRange?.start ??
        (typeof input?.selectionStart === "number" ? input.selectionStart : current.length);
      const selEnd =
        selectionRange?.end ??
        (typeof input?.selectionEnd === "number" ? input.selectionEnd : current.length);

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

      onValueChange?.(nextValue);

      if (onChange) {
        const syntheticEvent = {
          target: { value: nextValue, name: props.name },
          currentTarget: { value: nextValue, name: props.name },
          bubbles: true,
          cancelable: true,
          type: "change",
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      }

      setSelectionRange({ start: newCursorPos, end: newCursorPos });
      if (input) {
        requestAnimationFrame(() => {
          input.setSelectionRange(newCursorPos, newCursorPos);
        });
      }
    };

    const {
      isSupported,
      isListening,
      toggleListening,
      stopListening,
    } = useVoiceInput({
      onTranscript: (transcriptChunk, isFinal) => {
        if (isFinal && transcriptChunk.trim()) {
          applyTranscript(transcriptChunk.trim());
        }
      },
    });

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
        <div className={`relative w-full ${isFlex ? "flex-1 min-w-0" : ""} ${containerClassName}`}>
          <input
            ref={innerRef}
            type={type}
            value={value}
            disabled={disabled}
            placeholder={placeholder}
            onChange={onChange}
            className={`w-full block ${cleanClassName}`}
            {...props}
          />
        </div>
      );
    }

    return (
      <div className={`relative flex items-center w-full ${isFlex ? "flex-1 min-w-0" : ""} group ${containerClassName}`}>
        <input
          ref={innerRef}
          type={type}
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
          className={`w-full block ${cleanClassName} ${
            isListening
              ? "ring-1 ring-[#C25D72]/50 border-[#C25D72]/60 pr-9"
              : isSupported
              ? "pr-8"
              : ""
          }`}
          {...props}
        />

        {/* Embedded Microphone Button on Trailing Side */}
        <div className="absolute right-1.5 z-10 flex items-center">
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
            className={`inline-flex items-center justify-center h-6 w-6 rounded-md transition-all focus:outline-none focus-visible:ring-1 focus-visible:ring-[#B8944E] ${
              !isSupported
                ? "text-zinc-300 cursor-not-allowed"
                : isListening
                ? "bg-rose-50 text-[#C25D72] border border-rose-200/80 shadow-xs scale-105 active:scale-95"
                : "text-[#9994A5] hover:text-[#80642F] hover:bg-[rgba(184,148,78,0.08)] active:scale-95"
            }`}
          >
            {isListening ? (
              <Radio size={13} className="animate-spin text-[#C25D72]" />
            ) : !isSupported ? (
              <MicOff size={13} />
            ) : (
              <Mic size={13} />
            )}
          </button>
        </div>
      </div>
    );
  }
);

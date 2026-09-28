"use client";

import React, { forwardRef, useRef, useImperativeHandle, useEffect } from "react";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value?: string;
  onValueChange?: (value: string) => void;
  containerClassName?: string;
  autoGrow?: boolean;
  actionSlot?: React.ReactNode;
  actionSize?: "sm" | "md";
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    {
      value = "",
      onChange,
      onValueChange,
      containerClassName = "",
      className = "",
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

    const isFlex =
      containerClassName.includes("flex-1") ||
      className.includes("flex-1") ||
      containerClassName.includes("flex");

    const cleanClassName = className.replace(/\bflex-1\b/g, "").trim();

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
              className={`w-full block auto-grow-field ${cleanClassName} ${
                autoGrow ? "overflow-hidden resize-none" : ""
              }`}
              {...props}
            />
          </div>

          <div className="flex flex-col items-center gap-1 shrink-0 mt-0.5">
            {actionSlot}
          </div>
        </div>
      );
    }

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
          className={`w-full block auto-grow-field ${cleanClassName} ${
            autoGrow ? "overflow-hidden resize-none" : ""
          }`}
          {...props}
        />
      </div>
    );
  }
);

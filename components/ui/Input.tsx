"use client";

import React, { forwardRef, useRef, useImperativeHandle } from "react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  value?: string;
  onValueChange?: (value: string) => void;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input(
    {
      value = "",
      onChange,
      onValueChange,
      containerClassName = "",
      className = "",
      disabled = false,
      placeholder,
      type = "text",
      ...props
    },
    ref
  ) {
    const innerRef = useRef<HTMLInputElement | null>(null);
    useImperativeHandle(ref, () => innerRef.current as HTMLInputElement);

    const isFlex =
      containerClassName.includes("flex-1") ||
      className.includes("flex-1") ||
      containerClassName.includes("flex");

    const cleanClassName = className.replace(/\bflex-1\b/g, "").trim();

    return (
      <div className={`relative flex items-center w-full ${isFlex ? "flex-1 min-w-0" : ""} ${containerClassName}`}>
        <input
          ref={innerRef}
          type={type}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => {
            onChange?.(e);
            onValueChange?.(e.target.value);
          }}
          className={`w-full block ${cleanClassName}`}
          {...props}
        />
      </div>
    );
  }
);

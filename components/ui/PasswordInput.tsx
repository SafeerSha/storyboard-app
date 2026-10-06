"use client";

import React, { useState, useEffect, forwardRef } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  value: string;
  onValueChange?: (value: string) => void;
  showLeftIcon?: boolean;
  leftIcon?: React.ReactNode;
  containerClassName?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    {
      value,
      onChange,
      onValueChange,
      showLeftIcon = true,
      leftIcon,
      containerClassName = "",
      className = "",
      disabled = false,
      placeholder = "••••••••",
      autoComplete,
      id,
      name,
      required,
      minLength,
      ...props
    },
    ref
  ) {
    const [showPassword, setShowPassword] = useState(false);

    // AC-2.4: The toggle state resets securely whenever the input field is cleared
    useEffect(() => {
      if (!value) {
        setShowPassword(false);
      }
    }, [value]);

    function handleToggle(e: React.MouseEvent<HTMLButtonElement>) {
      e.preventDefault();
      setShowPassword((prev) => !prev);
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const newVal = e.target.value;
      if (!newVal) {
        // Securely reset toggle immediately when cleared
        setShowPassword(false);
      }
      onChange?.(e);
      onValueChange?.(newVal);
    }

    return (
      <div className={`relative flex items-center w-full ${containerClassName}`}>
        {showLeftIcon && (
          <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9994A5]">
            {leftIcon || <Lock size={15} />}
          </div>
        )}

        <input
          ref={ref}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete={autoComplete}
          id={id}
          name={name}
          required={required}
          minLength={minLength}
          className={`h-10 w-full rounded-xl border border-[rgba(74,61,100,0.11)] bg-white/85 text-sm text-[#252331] placeholder-[#9994A5] outline-none transition focus:border-[#B8944E] focus:ring-1 focus:ring-[rgba(184,148,78,0.14)] disabled:opacity-60 disabled:cursor-not-allowed ${
            showLeftIcon ? "pl-10" : "pl-3.5"
          } pr-10 ${className}`}
          {...props}
        />

        <button
          type="button"
          tabIndex={-1}
          onClick={handleToggle}
          disabled={disabled}
          aria-label={showPassword ? "Hide password" : "Show password"}
          title={showPassword ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#9994A5] hover:text-[#252331] transition rounded-md focus:outline-none focus:ring-1 focus:ring-[#B8944E] disabled:opacity-40"
        >
          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    );
  }
);

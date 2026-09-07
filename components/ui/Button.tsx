import React, { forwardRef } from "react";
import { Loader2 } from "lucide-react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "danger-solid"
  | "brand";

export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "secondary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      className = "",
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-all select-none disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 shrink-0 cursor-pointer";

    const variantStyles: Record<ButtonVariant, string> = {
      primary:
        "bg-[#4F46E5] text-white hover:bg-[#4338CA] active:scale-[0.99] shadow-xs focus-visible:outline-[#4F46E5]",
      secondary:
        "bg-white text-zinc-800 border border-zinc-200/90 hover:bg-zinc-50/80 active:scale-[0.99] shadow-xs focus-visible:outline-zinc-500",
      outline:
        "bg-transparent text-zinc-700 border border-zinc-200 hover:bg-zinc-50 focus-visible:outline-zinc-500",
      ghost:
        "bg-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-zinc-500",
      danger:
        "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100/80 focus-visible:outline-rose-500",
      "danger-solid":
        "bg-rose-600 text-white hover:bg-rose-700 focus-visible:outline-rose-600 shadow-xs",
      brand:
        "bg-[#4F46E5] text-white hover:bg-[#4338CA] focus-visible:outline-[#4F46E5] shadow-xs active:scale-[0.99]",
    };

    const sizeStyles: Record<ButtonSize, string> = {
      sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
      md: "h-10 px-4 py-2.5 text-xs sm:text-sm rounded-lg gap-2",
      lg: "h-11 px-5 text-sm rounded-lg gap-2",
      icon: "h-10 w-10 rounded-lg p-0",
      "icon-sm": "h-8 w-8 rounded-lg p-0",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 size={size === "sm" || size === "icon-sm" ? 13 : 15} className="animate-spin shrink-0" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        {children}
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";

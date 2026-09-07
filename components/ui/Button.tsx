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
        "bg-[#B8944E] text-white hover:bg-[#9F7D3E] active:scale-[0.99] shadow-xs focus-visible:outline-[#B8944E]",
      secondary:
        "bg-white/85 text-[#353140] border border-[rgba(74,61,100,0.10)] hover:bg-white active:scale-[0.99] shadow-xs focus-visible:outline-[#B8944E]",
      outline:
        "bg-transparent text-[#706C7D] border border-[rgba(74,61,100,0.12)] hover:bg-white/60 hover:text-[#252331] focus-visible:outline-[#B8944E]",
      ghost:
        "bg-transparent text-[#706C7D] hover:bg-[rgba(184,148,78,0.06)] hover:text-[#252331] focus-visible:outline-[#B8944E]",
      danger:
        "bg-rose-50/80 text-[#C25D72] border border-rose-200/70 hover:bg-rose-100/70 focus-visible:outline-[#C25D72]",
      "danger-solid":
        "bg-[#C25D72] text-white hover:bg-[#B14E63] focus-visible:outline-[#C25D72] shadow-xs",
      brand:
        "bg-[#B8944E] text-white hover:bg-[#9F7D3E] active:scale-[0.99] shadow-xs focus-visible:outline-[#B8944E]",
    };

    const sizeStyles: Record<ButtonSize, string> = {
      sm: "h-8 px-3 text-xs rounded-xl gap-1.5",
      md: "h-10 px-4 py-2 text-xs sm:text-sm rounded-xl gap-2",
      lg: "h-11 px-5 text-sm rounded-xl gap-2",
      icon: "h-10 w-10 rounded-xl p-0",
      "icon-sm": "h-8 w-8 rounded-xl p-0",
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

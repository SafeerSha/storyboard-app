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
        "bg-gradient-to-b from-[#D4A73B] via-[#C2932E] to-[#AB7E20] text-white hover:from-[#DBB046] hover:to-[#B58726] active:translate-y-[0.5px] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1.5px_0_rgba(70,45,10,0.25),0_2px_4px_rgba(120,80,15,0.18)] border border-[#B0801E] font-semibold focus-visible:outline-[#CCA038]",
      secondary:
        "bg-gradient-to-b from-white to-[#F9FAFB] text-[#0F172A] border border-slate-200/90 hover:bg-white hover:border-slate-300 active:scale-[0.99] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.05)] focus-visible:outline-[#CCA038]",
      outline:
        "bg-transparent text-[#334155] border border-slate-200/90 hover:bg-white hover:text-[#0F172A] shadow-2xs focus-visible:outline-[#CCA038]",
      ghost:
        "bg-transparent text-[#334155] hover:bg-slate-100/70 hover:text-[#0F172A] focus-visible:outline-[#CCA038]",
      danger:
        "bg-rose-50/80 text-[#E11D48] border border-rose-200/70 hover:bg-rose-100/70 focus-visible:outline-[#E11D48]",
      "danger-solid":
        "bg-gradient-to-b from-[#E83B61] to-[#D01944] text-white hover:brightness-105 active:translate-y-[0.5px] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_1.5px_3px_rgba(200,20,50,0.25)] border border-[#BE123C] focus-visible:outline-[#E11D48]",
      brand:
        "bg-gradient-to-b from-[#D4A73B] via-[#C2932E] to-[#AB7E20] text-white hover:from-[#DBB046] hover:to-[#B58726] active:translate-y-[0.5px] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1.5px_0_rgba(70,45,10,0.25),0_2px_4px_rgba(120,80,15,0.18)] border border-[#B0801E] font-semibold focus-visible:outline-[#CCA038]",
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

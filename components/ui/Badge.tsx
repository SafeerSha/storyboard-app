import React from "react";
import { Check, AlertCircle, Clock, CheckCircle2, Circle } from "lucide-react";

export type BadgeVariant =
  | "draft"
  | "review"
  | "changes_requested"
  | "approved"
  | "in_development"
  | "completed"
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: "sm" | "md";
  showIcon?: boolean;
  children?: React.ReactNode;
}

const variantStyles: Record<
  BadgeVariant,
  { bg: string; text: string; border: string; icon: React.ComponentType<{ size: number; className?: string }> | null; label: string }
> = {
  draft: {
    bg: "bg-zinc-100",
    text: "text-zinc-600",
    border: "border-zinc-200/80",
    icon: Circle,
    label: "Draft",
  },
  review: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-200/80",
    icon: Clock,
    label: "Review",
  },
  changes_requested: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200/80",
    icon: AlertCircle,
    label: "Changes requested",
  },
  approved: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200/80",
    icon: Check,
    label: "Approved",
  },
  in_development: {
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-200/80",
    icon: Clock,
    label: "In development",
  },
  completed: {
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200/80",
    icon: CheckCircle2,
    label: "Completed",
  },
  neutral: {
    bg: "bg-zinc-100",
    text: "text-zinc-700",
    border: "border-zinc-200/80",
    icon: null,
    label: "",
  },
  brand: {
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-200/80",
    icon: null,
    label: "",
  },
  success: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200/80",
    icon: Check,
    label: "",
  },
  warning: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-200/80",
    icon: Clock,
    label: "",
  },
  danger: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200/80",
    icon: AlertCircle,
    label: "",
  },
};

export function Badge({
  variant = "neutral",
  size = "sm",
  showIcon = true,
  children,
  className = "",
  ...props
}: BadgeProps) {
  const conf = variantStyles[variant] || variantStyles.neutral;
  const Icon = conf.icon;
  const content = children ?? conf.label;

  const sizeClasses =
    size === "sm"
      ? "px-2 py-0.5 text-[11px] font-medium tracking-tight gap-1"
      : "px-2.5 py-1 text-xs font-medium tracking-tight gap-1.5";

  return (
    <span
      className={`inline-flex items-center rounded-full border shrink-0 ${conf.bg} ${conf.text} ${conf.border} ${sizeClasses} ${className}`}
      {...props}
    >
      {showIcon && Icon && <Icon size={size === "sm" ? 11 : 13} className="shrink-0 stroke-[2.5]" />}
      <span>{content}</span>
    </span>
  );
}

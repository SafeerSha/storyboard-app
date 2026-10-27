import React from "react";
import { Check, AlertCircle, Clock, CheckCircle2, Circle, Sparkles } from "lucide-react";

export type BadgeVariant =
  | "new"
  | "active"
  | "done"
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
  new: {
    bg: "bg-sky-50",
    text: "text-sky-800",
    border: "border-sky-300/80",
    icon: Sparkles,
    label: "New",
  },
  active: {
    bg: "bg-gradient-to-b from-[#FEF9EE] to-[#F5EAD4] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(120,80,15,0.06)]",
    text: "text-[#785312]",
    border: "border-[#CCA038]/45",
    icon: Clock,
    label: "Active",
  },
  done: {
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    border: "border-emerald-300/80",
    icon: CheckCircle2,
    label: "Done",
  },
  draft: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-200",
    icon: Circle,
    label: "Draft",
  },
  review: {
    bg: "bg-amber-50",
    text: "text-amber-900",
    border: "border-amber-300/80",
    icon: Clock,
    label: "Review",
  },
  changes_requested: {
    bg: "bg-rose-50",
    text: "text-rose-800",
    border: "border-rose-300/80",
    icon: AlertCircle,
    label: "Changes requested",
  },
  approved: {
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    border: "border-emerald-300/80",
    icon: Check,
    label: "Approved",
  },
  in_development: {
    bg: "bg-blue-50",
    text: "text-blue-800",
    border: "border-blue-300/80",
    icon: Clock,
    label: "In development",
  },
  completed: {
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    border: "border-emerald-300/80",
    icon: CheckCircle2,
    label: "Completed",
  },
  neutral: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-200",
    icon: null,
    label: "",
  },
  brand: {
    bg: "bg-gradient-to-b from-[#FEF9EE] to-[#F5EAD4] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(120,80,15,0.06)]",
    text: "text-[#785312]",
    border: "border-[#CCA038]/45",
    icon: null,
    label: "",
  },
  success: {
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    border: "border-emerald-300/80",
    icon: Check,
    label: "",
  },
  warning: {
    bg: "bg-amber-50",
    text: "text-amber-900",
    border: "border-amber-300/80",
    icon: Clock,
    label: "",
  },
  danger: {
    bg: "bg-rose-50",
    text: "text-rose-800",
    border: "border-rose-300/80",
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

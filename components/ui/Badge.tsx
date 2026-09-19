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
    text: "text-sky-700",
    border: "border-sky-200/80",
    icon: Sparkles,
    label: "New",
  },
  active: {
    bg: "bg-[rgba(184,148,78,0.10)]",
    text: "text-[#80642F]",
    border: "border-[rgba(184,148,78,0.22)]",
    icon: Clock,
    label: "Active",
  },
  done: {
    bg: "bg-[rgba(46,139,112,0.08)]",
    text: "text-[#2E8B70]",
    border: "border-[rgba(46,139,112,0.16)]",
    icon: CheckCircle2,
    label: "Done",
  },
  draft: {
    bg: "bg-[#FAF9FC]",
    text: "text-[#706C7D]",
    border: "border-[rgba(74,61,100,0.10)]",
    icon: Circle,
    label: "Draft",
  },
  review: {
    bg: "bg-[rgba(168,121,54,0.08)]",
    text: "text-[#A87936]",
    border: "border-[rgba(168,121,54,0.16)]",
    icon: Clock,
    label: "Review",
  },
  changes_requested: {
    bg: "bg-[rgba(194,93,114,0.08)]",
    text: "text-[#C25D72]",
    border: "border-[rgba(194,93,114,0.16)]",
    icon: AlertCircle,
    label: "Changes requested",
  },
  approved: {
    bg: "bg-[rgba(46,139,112,0.08)]",
    text: "text-[#2E8B70]",
    border: "border-[rgba(46,139,112,0.16)]",
    icon: Check,
    label: "Approved",
  },
  in_development: {
    bg: "bg-[rgba(85,124,180,0.08)]",
    text: "text-[#557CB4]",
    border: "border-[rgba(85,124,180,0.16)]",
    icon: Clock,
    label: "In development",
  },
  completed: {
    bg: "bg-[rgba(46,139,112,0.08)]",
    text: "text-[#2E8B70]",
    border: "border-[rgba(46,139,112,0.16)]",
    icon: CheckCircle2,
    label: "Completed",
  },
  neutral: {
    bg: "bg-[rgba(74,61,100,0.05)]",
    text: "text-[#706C7D]",
    border: "border-[rgba(74,61,100,0.10)]",
    icon: null,
    label: "",
  },
  brand: {
    bg: "bg-[rgba(184,148,78,0.10)]",
    text: "text-[#80642F]",
    border: "border-[rgba(184,148,78,0.14)]",
    icon: null,
    label: "",
  },
  success: {
    bg: "bg-[rgba(46,139,112,0.08)]",
    text: "text-[#2E8B70]",
    border: "border-[rgba(46,139,112,0.16)]",
    icon: Check,
    label: "",
  },
  warning: {
    bg: "bg-[rgba(168,121,54,0.08)]",
    text: "text-[#A87936]",
    border: "border-[rgba(168,121,54,0.16)]",
    icon: Clock,
    label: "",
  },
  danger: {
    bg: "bg-[rgba(194,93,114,0.08)]",
    text: "text-[#C25D72]",
    border: "border-[rgba(194,93,114,0.16)]",
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

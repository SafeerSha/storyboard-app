"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import { usePathname } from "next/navigation";
import {
  Check,
  AlertCircle,
  AlertTriangle,
  Info,
  Loader2,
  X,
} from "lucide-react";
import { toast, type ToastItem, type ToastType } from "@/lib/toast";

/**
 * RouteChangeObserver triggers flash toast consumption on page navigation.
 */
function RouteChangeObserver() {
  const pathname = usePathname();

  useEffect(() => {
    toast.consumeFlash();
  }, [pathname]);

  return null;
}

interface ToastItemProps {
  item: ToastItem;
  onDismiss: (id: string) => void;
}

function ToastElement({ item, onDismiss }: ToastItemProps) {
  useEffect(() => {
    if (item.duration && item.duration > 0) {
      const timer = setTimeout(() => {
        onDismiss(item.id);
      }, item.duration);
      return () => clearTimeout(timer);
    }
  }, [item.id, item.duration, onDismiss]);

  const isAlert = item.type === "error" || item.type === "warning";

  const renderIcon = () => {
    switch (item.type) {
      case "success":
        return (
          <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-status-success/15 text-status-success border border-status-success/20">
            <Check size={13} strokeWidth={2.5} />
          </div>
        );
      case "error":
        return (
          <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-status-error/15 text-status-error border border-status-error/20">
            <AlertCircle size={13} strokeWidth={2.5} />
          </div>
        );
      case "warning":
        return (
          <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-status-warning/15 text-status-warning border border-status-warning/20">
            <AlertTriangle size={13} strokeWidth={2.5} />
          </div>
        );
      case "info":
        return (
          <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-status-info/15 text-status-info border border-status-info/20">
            <Info size={13} strokeWidth={2.5} />
          </div>
        );
      case "loading":
        return (
          <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-status-info/15 text-status-info border border-status-info/20">
            <Loader2 size={13} className="animate-spin" />
          </div>
        );
    }
  };

  return (
    <div
      role={isAlert ? "alert" : "status"}
      aria-live={isAlert ? "assertive" : "polite"}
      className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-white/90 bg-white/92 p-3.5 sm:px-4 sm:py-3.5 shadow-[0_12px_35px_rgba(70,55,95,0.12)] backdrop-blur-[20px] transition-all animate-in fade-in slide-in-from-bottom-3 duration-200 motion-reduce:transition-none motion-reduce:animate-none w-full select-none"
    >
      <div className="mt-0.5">{renderIcon()}</div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-xs sm:text-sm font-semibold tracking-tight text-[#252331] leading-snug break-words">
          {item.message}
        </p>
        {item.description && (
          <p className="mt-0.5 text-xs text-[#706C7D] leading-relaxed break-words">
            {item.description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label="Dismiss notification"
        className="ml-1 -mr-1 -mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[#9994A5] hover:bg-[#E9E3F4]/30 hover:text-[#252331] transition"
      >
        <X size={14} />
      </button>
    </div>
  );
}

/**
 * Global Toast Provider mounted in app/layout.tsx
 */
export function ToastProvider() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    // Subscribe to toast manager updates
    const unsubscribe = toast.subscribe((updated) => {
      setToasts(updated);
    });

    // Check for any pending flash message on initial load
    toast.consumeFlash();

    return () => {
      unsubscribe();
    };
  }, []);

  const handleDismiss = useCallback((id: string) => {
    toast.dismiss(id);
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <RouteChangeObserver />
      </Suspense>

      {/* Toast viewport container: bottom-right on desktop, bottom-center on mobile */}
      <div
        aria-label="Notifications"
        className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-[9999] pointer-events-none flex flex-col-reverse gap-2.5 sm:w-auto sm:max-w-sm max-w-[calc(100vw-32px)] mx-auto sm:mx-0 pb-[env(safe-area-inset-bottom)]"
      >
        {toasts.map((t) => (
          <ToastElement key={t.id} item={t} onDismiss={handleDismiss} />
        ))}
      </div>
    </>
  );
}

/**
 * Hook for component-level toast interactions
 */
export function useToast() {
  return {
    toast,
    dismiss: (id?: string) => toast.dismiss(id),
  };
}

/**
 * Backward-compatible single toast component if needed
 */
export function Toast({
  message,
  onDismiss,
  duration = 2500,
}: {
  message: string | null;
  onDismiss: () => void;
  duration?: number;
}) {
  useEffect(() => {
    if (message) {
      toast.success(message, undefined, duration);
      onDismiss();
    }
  }, [message, duration, onDismiss]);

  return null;
}

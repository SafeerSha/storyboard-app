"use client";

import { useState, useEffect, useCallback } from "react";
import { RotateCw } from "lucide-react";

/**
 * A minimal, non-intrusive reload button that only appears
 * when the app is running as a standalone PWA (no browser chrome).
 * Positioned at the top-right corner so it doesn't overlap
 * the bottom dock/sidebar navigation or main page content.
 */
export function PWAReloadButton() {
  const [isStandalone, setIsStandalone] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);

  useEffect(() => {
    // Detect if running as installed PWA (standalone mode)
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);
  }, []);

  const handleReload = useCallback(() => {
    setIsSpinning(true);
    // Small delay so the user sees the spin animation before the page reloads
    setTimeout(() => {
      window.location.reload();
    }, 300);
  }, []);

  // Only render in standalone PWA mode
  if (!isStandalone) return null;

  return (
    <button
      type="button"
      onClick={handleReload}
      aria-label="Reload page"
      title="Reload page"
      className="
        fixed top-3 right-3 z-[60]
        grid place-items-center
        h-8 w-8
        rounded-full
        bg-white/70 backdrop-blur-md
        border border-[rgba(74,61,100,0.10)]
        shadow-[0_2px_8px_rgba(70,55,95,0.08)]
        text-[#9994A5]
        hover:text-[#B8944E] hover:bg-white/90 hover:border-[rgba(184,148,78,0.25)]
        hover:shadow-[0_4px_14px_rgba(184,148,78,0.12)]
        active:scale-90
        transition-all duration-200 ease-out
        cursor-pointer
      "
    >
      <RotateCw
        size={14}
        strokeWidth={2.5}
        className={`transition-transform duration-500 ease-in-out ${
          isSpinning ? "animate-spin" : ""
        }`}
      />
    </button>
  );
}

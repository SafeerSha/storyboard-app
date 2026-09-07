"use client";

import React, { createContext, useContext, useEffect, useState, useRef, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

interface LoadingContextType {
  isLoading: boolean;
  startLoading: () => void;
  stopLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType>({
  isLoading: false,
  startLoading: () => {},
  stopLoading: () => {},
});

export const useGlobalLoading = () => useContext(LoadingContext);

function RouteChangeTracker({ onRouteFinished }: { onRouteFinished: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    onRouteFinished();
  }, [pathname, searchParams, onRouteFinished]);

  return null;
}

export function GlobalLoader() {
  const [activeRequests, setActiveRequests] = useState(0);
  const [manualLoading, setManualLoading] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const trickleInterval = useRef<NodeJS.Timeout | null>(null);
  const safetyTimeout = useRef<NodeJS.Timeout | null>(null);

  const isLoading = activeRequests > 0 || manualLoading > 0 || isNavigating;

  // Intercept window.fetch to automatically catch all client requests
  useEffect(() => {
    if (typeof window === "undefined") return;

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      setActiveRequests(prev => prev + 1);
      try {
        return await originalFetch(...args);
      } finally {
        setActiveRequests(prev => Math.max(0, prev - 1));
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  // Listen for clicks on internal navigation links
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target || !target.href) return;
      
      // Ignore new tabs, external links, hashes or modified clicks
      if (
        target.target === "_blank" ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.altKey ||
        target.getAttribute("download") !== null
      ) {
        return;
      }

      try {
        const url = new URL(target.href, window.location.href);
        const isSameOrigin = url.origin === window.location.origin;
        const isSamePathAndQuery = url.pathname === window.location.pathname && url.search === window.location.search;

        if (isSameOrigin && !isSamePathAndQuery && !url.hash.startsWith("#")) {
          setIsNavigating(true);
        }
      } catch {
        // Ignore invalid URLs
      }
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const handleRouteFinished = React.useCallback(() => {
    setIsNavigating(false);
  }, []);

  // Animate progress bar based on isLoading
  useEffect(() => {
    if (isLoading) {
      setVisible(true);
      setProgress(prev => (prev === 0 ? 20 : prev));

      if (trickleInterval.current) clearInterval(trickleInterval.current);
      trickleInterval.current = setInterval(() => {
        setProgress(prev => {
          if (prev < 60) return prev + Math.random() * 15;
          if (prev < 85) return prev + Math.random() * 5;
          if (prev < 95) return prev + 0.5;
          return prev;
        });
      }, 250);

      // Safety timer to clear stuck loaders after 12 seconds
      if (safetyTimeout.current) clearTimeout(safetyTimeout.current);
      safetyTimeout.current = setTimeout(() => {
        setActiveRequests(0);
        setManualLoading(0);
        setIsNavigating(false);
      }, 12000);
    } else {
      if (trickleInterval.current) clearInterval(trickleInterval.current);
      if (safetyTimeout.current) clearTimeout(safetyTimeout.current);

      setProgress(100);
      const timer = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300);

      return () => clearTimeout(timer);
    }

    return () => {
      if (trickleInterval.current) clearInterval(trickleInterval.current);
      if (safetyTimeout.current) clearTimeout(safetyTimeout.current);
    };
  }, [isLoading]);

  const startLoading = () => setManualLoading(prev => prev + 1);
  const stopLoading = () => setManualLoading(prev => Math.max(0, prev - 1));

  return (
    <LoadingContext.Provider value={{ isLoading, startLoading, stopLoading }}>
      <Suspense fallback={null}>
        <RouteChangeTracker onRouteFinished={handleRouteFinished} />
      </Suspense>

      {/* Top Slim Progress Bar */}
      <div
        className="fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <div
          className="h-full bg-[#B8944E] shadow-[0_0_8px_rgba(184,148,78,0.35)] transition-all duration-200 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Subtle Dynamic Status Pill (Top-Center) */}
      <div
        className={`fixed top-3 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none transition-all duration-300 ease-in-out ${
          visible ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"
        }`}
      >
        <div className="flex items-center gap-2.5 rounded-full border border-[rgba(184,148,78,0.2)] bg-white/95 px-4 py-1.5 shadow-soft backdrop-blur-md">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#B8944E]" />
          <span className="text-xs font-medium text-neutral-700">
            {isNavigating ? "Navigating..." : "Updating..."}
          </span>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#D6BD88] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#B8944E]" />
          </span>
        </div>
      </div>
    </LoadingContext.Provider>
  );
}

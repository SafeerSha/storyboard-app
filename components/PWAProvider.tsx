"use client";

import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [isOffline, setIsOffline] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Service Worker Registration
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("Service Worker registered with scope:", registration.scope);

            // Listen for waiting service worker (update available)
            registration.addEventListener("updatefound", () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener("statechange", () => {
                  if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                    toast.info("New version available. Refresh to update.", {
                      id: "pwa-update",
                      duration: 10000,
                    });
                  }
                });
              }
            });
          })
          .catch((error) => {
            console.error("Service Worker registration failed:", error);
          });
      });
      
      // Handle controller change (when new worker takes over)
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
      });
    }

    // Offline / Online Handlers
    const handleOnline = () => {
      setIsOffline(false);
      toast.success("You're back online.", { id: "pwa-online" });
      toast.dismiss("pwa-offline");
    };

    const handleOffline = () => {
      setIsOffline(true);
      toast.warning("You're offline. Some actions may be unavailable.", {
        id: "pwa-offline",
        duration: 0, // Keep until back online
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check
    if (!navigator.onLine) {
      handleOffline();
    }

    // Install Prompt Handler
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // We could store it in context, but for simplicity we'll dispatch a custom event
      // so the InstallPrompt component can react to it.
      window.dispatchEvent(new CustomEvent("pwa-install-prompt", { detail: e }));
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  return <>{children}</>;
}

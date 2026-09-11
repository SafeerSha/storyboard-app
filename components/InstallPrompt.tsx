"use client";

import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show if not previously dismissed
    if (localStorage.getItem("pwa-install-dismissed") === "true") {
      return;
    }

    const handleInstallPrompt = (e: any) => {
      // The event is a custom event containing the actual prompt in e.detail
      const promptEvent = e.detail;
      setDeferredPrompt(promptEvent);
      setIsVisible(true);
    };

    window.addEventListener("pwa-install-prompt", handleInstallPrompt);

    return () => {
      window.removeEventListener("pwa-install-prompt", handleInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      console.log("User accepted the install prompt");
    } else {
      console.log("User dismissed the install prompt");
    }
    
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const handleDismiss = () => {
    localStorage.setItem("pwa-install-dismissed", "true");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+24px)] right-4 sm:right-6 z-[9998] w-[calc(100vw-32px)] sm:w-[340px] pointer-events-auto">
      <div className="flex items-start gap-3 rounded-2xl border border-[#4A3D64]/10 bg-white/95 p-4 shadow-[0_12px_35px_rgba(70,55,95,0.12)] backdrop-blur-[20px] animate-in slide-in-from-bottom-4 fade-in duration-300">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#DFE9F5]/50 text-[#4A3D64]">
          <Download size={20} strokeWidth={2} />
        </div>
        
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-sm font-semibold tracking-tight text-[#252331]">
            Install Reqly
          </p>
          <p className="mt-1 text-xs text-[#706C7D] leading-relaxed pr-2">
            Install Reqly for a faster, app-like experience.
          </p>
          
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={handleInstall}
              className="text-xs font-semibold text-white bg-[#B8944E] hover:bg-[#9F7D3E] px-3.5 py-1.5 rounded-lg transition-colors"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="text-xs font-medium text-[#706C7D] hover:text-[#252331] px-2 py-1.5 transition-colors"
            >
              Not now
            </button>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="absolute right-3 top-3 text-[#9994A5] hover:text-[#252331] transition-colors"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

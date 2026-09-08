"use client";

import React, { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import { ClientSidebar } from "./ClientSidebar";

interface ClientLayoutClientProps {
  clientName: string;
  projectName: string;
  children: React.ReactNode;
}

export function ClientLayoutClient({
  clientName,
  projectName,
  children,
}: ClientLayoutClientProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopNavMode, setDesktopNavMode] = useState<"dock" | "sidebar">("dock");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("storyboard:desktop-nav-mode");
      if (saved === "sidebar" || saved === "dock") {
        setDesktopNavMode(saved);
      }
    } catch {}
  }, []);

  const toggleDesktopNavMode = () => {
    setDesktopNavMode((prev) => {
      const next = prev === "dock" ? "sidebar" : "dock";
      try {
        localStorage.setItem("storyboard:desktop-nav-mode", next);
      } catch {}
      return next;
    });
  };

  return (
    <div className="flex min-h-screen bg-transparent">
      {/* Sidebar / macOS Dock */}
      <ClientSidebar
        clientName={clientName}
        projectName={projectName}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        desktopNavMode={desktopNavMode}
        onToggleLayout={toggleDesktopNavMode}
      />

      {/* Main Container */}
      <div
        className={`flex flex-1 flex-col min-w-0 transition-all duration-200 ${
          desktopNavMode === "dock" ? "md:pl-0 pb-28" : "md:pl-60 pb-20 md:pb-0"
        }`}
      >
        {/* Mobile Sticky Header */}
        <header className="sticky top-0 z-20 flex h-[64px] sm:h-[72px] items-center justify-between border-b border-[rgba(74,61,100,0.08)] bg-white/68 backdrop-blur-[20px] px-4 md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-xl text-[#706C7D] hover:bg-[#E9E3F4]/30 hover:text-[#252331] transition"
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold tracking-tight text-[#252331] truncate">
              {projectName}
            </span>
            <span className="rounded-full bg-[rgba(184,148,78,0.10)] px-2 py-0.5 text-[10px] font-semibold text-[#80642F] border border-[rgba(184,148,78,0.18)] shrink-0">
              Client
            </span>
          </div>

          <div className="w-10" />
        </header>

        {/* Page Content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}

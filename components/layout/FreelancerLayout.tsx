"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { FreelancerSidebar } from "./FreelancerSidebar";
import { AssistantProvider } from "@/hooks/useAssistant";
import { CentralizedAssistantPanel } from "@/components/assistant/CentralizedAssistantPanel";
import { AssistantFloatingTrigger } from "@/components/assistant/AssistantFloatingTrigger";
import { AssistantFloatingBar } from "@/components/assistant/AssistantFloatingBar";

export interface DashboardUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface DashboardContextType {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  toggleMobile: () => void;
  user: DashboardUser | null;
  desktopNavMode: "dock" | "sidebar";
  toggleDesktopNavMode: () => void;
}

const DashboardContext = createContext<DashboardContextType>({
  mobileOpen: false,
  setMobileOpen: () => {},
  toggleMobile: () => {},
  user: null,
  desktopNavMode: "dock",
  toggleDesktopNavMode: () => {},
});

export const useDashboard = () => useContext(DashboardContext);

export function FreelancerLayout({
  children,
  initialUser = null,
}: {
  children: React.ReactNode;
  initialUser?: DashboardUser | null;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopNavMode, setDesktopNavMode] = useState<"dock" | "sidebar">("dock");

  // Load layout preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("storyboard:desktop-nav-mode");
      if (saved === "sidebar" || saved === "dock") {
        setDesktopNavMode(saved);
      }
    } catch {}
  }, []);

  const toggleMobile = () => setMobileOpen((prev) => !prev);

  const toggleDesktopNavMode = () => {
    setDesktopNavMode((prev) => {
      const next = prev === "dock" ? "sidebar" : "dock";
      try {
        localStorage.setItem("storyboard:desktop-nav-mode", next);
      } catch {}
      return next;
    });
  };

  const isSuperAdmin = initialUser?.role === "super_admin";

  return (
    <AssistantProvider isSuperAdmin={isSuperAdmin}>
      <DashboardContext.Provider
        value={{
          mobileOpen,
          setMobileOpen,
          toggleMobile,
          user: initialUser,
          desktopNavMode,
          toggleDesktopNavMode,
        }}
      >
        <div className="min-h-screen bg-transparent">
          {/* Navigation (macOS Dock or Persistent Sidebar based on desktopNavMode) */}
          <FreelancerSidebar
            mobileOpen={mobileOpen}
            setMobileOpen={setMobileOpen}
            initialUser={initialUser}
          />

          {/* Global Main Content: Full-width in dock mode (lg:pl-0 pb-28), or offset for left sidebar (lg:pl-56) */}
          <div
            className={`min-h-screen transition-all duration-200 ${
              desktopNavMode === "dock"
                ? "lg:pl-0 pb-28"
                : "lg:pl-56 pb-20 lg:pb-0"
            }`}
          >
            {children}
          </div>

          {/* Super Admin Centralized Assistant */}
          {isSuperAdmin && (
            <>
              <AssistantFloatingTrigger />
              <AssistantFloatingBar />
              <CentralizedAssistantPanel />
            </>
          )}
        </div>
      </DashboardContext.Provider>
    </AssistantProvider>
  );
}

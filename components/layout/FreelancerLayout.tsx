"use client";

import React, { createContext, useContext, useState } from "react";
import { FreelancerSidebar } from "./FreelancerSidebar";

interface DashboardContextType {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  toggleMobile: () => void;
}

const DashboardContext = createContext<DashboardContextType>({
  mobileOpen: false,
  setMobileOpen: () => {},
  toggleMobile: () => {},
});

export const useDashboard = () => useContext(DashboardContext);

export function FreelancerLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleMobile = () => setMobileOpen(prev => !prev);

  return (
    <DashboardContext.Provider value={{ mobileOpen, setMobileOpen, toggleMobile }}>
      <div className="min-h-screen bg-paper">
        {/* Canonical Persistent Freelancer Sidebar */}
        <FreelancerSidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

        {/* Global Main Content Offset for the 248px Left Sidebar */}
        <div className="min-h-screen lg:pl-[248px]">
          {children}
        </div>
      </div>
    </DashboardContext.Provider>
  );
}

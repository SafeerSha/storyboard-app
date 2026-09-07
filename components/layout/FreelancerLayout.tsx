"use client";

import React, { createContext, useContext, useState } from "react";
import { FreelancerSidebar } from "./FreelancerSidebar";

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
}

const DashboardContext = createContext<DashboardContextType>({
  mobileOpen: false,
  setMobileOpen: () => {},
  toggleMobile: () => {},
  user: null,
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
  const toggleMobile = () => setMobileOpen((prev) => !prev);

  return (
    <DashboardContext.Provider
      value={{ mobileOpen, setMobileOpen, toggleMobile, user: initialUser }}
    >
      <div className="min-h-screen bg-transparent">
        {/* Canonical Persistent Freelancer / Super Admin Sidebar */}
        <FreelancerSidebar
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
          initialUser={initialUser}
        />

        {/* Global Main Content Offset for the 224px (w-56) Left Sidebar */}
        <div className="min-h-screen lg:pl-56">{children}</div>
      </div>
    </DashboardContext.Provider>
  );
}

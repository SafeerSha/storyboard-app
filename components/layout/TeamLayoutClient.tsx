"use client";

import React, { useState } from "react";
import { Menu } from "lucide-react";
import { TeamSidebar } from "./TeamSidebar";

interface TeamLayoutClientProps {
  userName: string;
  projectName: string;
  children: React.ReactNode;
}

export function TeamLayoutClient({
  userName,
  projectName,
  children,
}: TeamLayoutClientProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-transparent">
      {/* Sidebar */}
      <TeamSidebar
        userName={userName}
        projectName={projectName}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main Container */}
      <div className="flex flex-1 flex-col md:pl-56 min-w-0">
        {/* Mobile Top Header */}
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
            <span className="rounded-full bg-[rgba(184,148,78,0.10)] px-2 py-0.5 text-[10px] font-medium text-[#80642F] border border-[rgba(184,148,78,0.14)] shrink-0">
              Team
            </span>
          </div>

          <div className="w-10" />
        </header>

        {/* Content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}

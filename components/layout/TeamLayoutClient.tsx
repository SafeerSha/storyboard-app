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
    <div className="flex min-h-screen bg-paper">
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
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-white/90 backdrop-blur-md px-4 md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-xl text-neutral-600 hover:bg-neutral-100 transition"
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold tracking-tight text-neutral-900 truncate">
              {projectName}
            </span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200 shrink-0">
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

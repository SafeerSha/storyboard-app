"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Menu, ChevronDown, Check, FolderKanban } from "lucide-react";
import { TeamSidebar } from "./TeamSidebar";

export interface AssignedProjectItem {
  id: string;
  name: string;
  description?: string | null;
  status?: string;
}

interface TeamLayoutClientProps {
  userName: string;
  projectName: string;
  assignedProjects?: AssignedProjectItem[];
  children: React.ReactNode;
}

export function TeamLayoutClient({
  userName,
  projectName,
  assignedProjects = [],
  children,
}: TeamLayoutClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopNavMode, setDesktopNavMode] = useState<"dock" | "sidebar">("dock");
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false);
  const mobileDropdownRef = useRef<HTMLDivElement>(null);

  // Derive active project
  const requestedProjectId = searchParams.get("projectId");
  const activeProject =
    (requestedProjectId && assignedProjects.find((p) => p.id === requestedProjectId)) ||
    assignedProjects[0] ||
    (projectName ? { id: "", name: projectName } : null);

  const activeProjectId = activeProject?.id || "";
  const displayProjectName = activeProject?.name || projectName || "Assigned Project";

  useEffect(() => {
    try {
      const saved = localStorage.getItem("storyboard:desktop-nav-mode");
      if (saved === "sidebar" || saved === "dock") {
        setDesktopNavMode(saved);
      }
    } catch {}
  }, []);

  // Close mobile dropdown when clicking outside
  useEffect(() => {
    if (!mobileDropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (mobileDropdownRef.current && !mobileDropdownRef.current.contains(e.target as Node)) {
        setMobileDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mobileDropdownOpen]);

  const toggleDesktopNavMode = () => {
    setDesktopNavMode((prev) => {
      const next = prev === "dock" ? "sidebar" : "dock";
      try {
        localStorage.setItem("storyboard:desktop-nav-mode", next);
      } catch {}
      return next;
    });
  };

  const handleSwitchProject = (pid: string) => {
    setMobileDropdownOpen(false);
    router.push(`/team?projectId=${pid}`);
  };

  return (
    <div className="flex min-h-screen bg-transparent">
      {/* Sidebar / macOS Dock */}
      <TeamSidebar
        userName={userName}
        projectName={displayProjectName}
        assignedProjects={assignedProjects}
        activeProjectId={activeProjectId}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        desktopNavMode={desktopNavMode}
        onToggleLayout={toggleDesktopNavMode}
      />

      {/* Main Container */}
      <div
        className={`flex flex-1 flex-col min-w-0 transition-all duration-200 ${
          desktopNavMode === "dock" ? "md:pl-0 pb-28" : "md:pl-56 pb-20 md:pb-0"
        }`}
      >
        {/* Mobile Top Header */}
        <header className="sticky top-0 z-20 flex h-[64px] sm:h-[72px] items-center justify-between border-b border-[rgba(74,61,100,0.08)] bg-white/68 backdrop-blur-[20px] px-4 md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-xl text-[#706C7D] hover:bg-[#E9E3F4]/30 hover:text-[#252331] transition cursor-pointer"
            aria-label="Open navigation menu"
          >
            <Menu size={20} />
          </button>

          {/* Project Switcher or Project Title on Mobile */}
          <div className="relative min-w-0 max-w-[220px]" ref={mobileDropdownRef}>
            {assignedProjects.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => setMobileDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-white/80 transition cursor-pointer border border-transparent hover:border-[rgba(74,61,100,0.12)]"
                  title="Switch mapped project"
                >
                  <span className="text-sm font-semibold tracking-tight text-[#252331] truncate">
                    {displayProjectName}
                  </span>
                  <span className="rounded-full bg-[rgba(184,148,78,0.12)] px-1.5 py-0.2 text-[9px] font-bold text-[#80642F]">
                    {assignedProjects.length}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`text-[#706C7D] transition-transform ${mobileDropdownOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {mobileDropdownOpen && (
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-56 rounded-xl border border-[rgba(74,61,100,0.12)] bg-white/95 backdrop-blur-xl p-1.5 shadow-xl z-50 divide-y divide-zinc-100">
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Assigned Projects
                    </div>
                    <div className="max-h-56 overflow-y-auto py-1 space-y-0.5">
                      {assignedProjects.map((p) => {
                        const isCurrent = p.id === activeProjectId;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleSwitchProject(p.id)}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition cursor-pointer ${
                              isCurrent
                                ? "bg-[rgba(184,148,78,0.12)] text-[#80642F] font-semibold"
                                : "text-zinc-700 hover:bg-zinc-100"
                            }`}
                          >
                            <span className="truncate">{p.name}</span>
                            {isCurrent && <Check size={12} className="text-[#80642F] shrink-0 ml-1" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-semibold tracking-tight text-[#252331] truncate">
                  {displayProjectName}
                </span>
                <span className="rounded-full bg-[rgba(184,148,78,0.10)] px-2 py-0.5 text-[10px] font-medium text-[#80642F] border border-[rgba(184,148,78,0.14)] shrink-0">
                  Team
                </span>
              </div>
            )}
          </div>

          <div className="w-10" />
        </header>

        {/* Content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}

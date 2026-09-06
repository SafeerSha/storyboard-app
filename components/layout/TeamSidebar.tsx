"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderKanban,
  Layers,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  X,
} from "lucide-react";

interface TeamSidebarProps {
  userName: string;
  projectName: string;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export function TeamSidebar({
  userName,
  projectName,
  mobileOpen,
  setMobileOpen,
}: TeamSidebarProps) {
  const pathname = usePathname();

  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [mobileOpen, setMobileOpen]);

  async function handleSignOut() {
    try {
      await fetch("/api/team/logout", { method: "POST" });
    } catch {
      // Proceed with redirect regardless
    }
    window.location.href = "/team/login";
  }

  const closeMobile = () => setMobileOpen(false);
  const initials = userName ? userName.slice(0, 2).toUpperCase() : "TU";

  const renderNavContent = (isMobile = false) => (
    <div className="flex h-full flex-col bg-white">
      {/* Brand Header */}
      <div className="flex h-15 items-center justify-between border-b border-line px-4">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-white shadow-xs">
            <span className="text-xs font-semibold tracking-tighter">◆</span>
          </div>
          <span className="text-sm font-semibold tracking-tight text-slate-900">
            StoryBoard
          </span>
          <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200/70">
            Team
          </span>
        </div>
        {isMobile && (
          <button
            type="button"
            onClick={closeMobile}
            className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 transition"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Assigned Project Scope Indicator */}
      <div className="px-3 pt-4 pb-2">
        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-100 text-[11px] font-bold text-emerald-800">
              {projectName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Assigned Project
              </p>
              <p className="truncate text-xs sm:text-sm font-semibold text-slate-900">
                {projectName}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Nav Content */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
        {/* TEAM group */}
        <div>
          <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            TEAM
          </p>
          <nav className="space-y-0.5">
            <Link
              href="/team"
              onClick={closeMobile}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm transition-colors ${
                pathname === "/team"
                  ? "bg-zinc-100 font-medium text-slate-900"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-slate-900"
              }`}
            >
              <LayoutDashboard
                size={16}
                className={pathname === "/team" ? "text-slate-900" : "text-zinc-400"}
              />
              <span>Overview</span>
            </Link>
            <a
              href="#project-details"
              onClick={closeMobile}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm text-zinc-600 hover:bg-zinc-50 hover:text-slate-900 transition-colors"
            >
              <FolderKanban size={16} className="text-zinc-400" />
              <span>Project</span>
            </a>
          </nav>
        </div>

        {/* DISCUSSION group */}
        <div>
          <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            DISCUSSION
          </p>
          <nav className="space-y-0.5">
            <a
              href="#feedback-section"
              onClick={closeMobile}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm text-zinc-600 hover:bg-zinc-50 hover:text-slate-900 transition-colors"
            >
              <MessageSquare size={16} className="text-zinc-400" />
              <span>Feedback</span>
            </a>
          </nav>
        </div>
      </div>

      {/* User Footer */}
      <div className="mt-auto border-t border-line p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-900">{userName}</p>
              <p className="text-[10px] text-emerald-700 font-medium">Team Member</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            title="Sign out"
            aria-label="Sign out"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-zinc-400 hover:bg-rose-50 hover:text-rose-600 transition"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-56 md:flex-col fixed inset-y-0 left-0 z-30 border-r border-line bg-white">
        {renderNavContent(false)}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={closeMobile}
          />
          <div className="fixed inset-y-0 left-0 w-64 max-w-[80vw] bg-white shadow-2xl animate-in slide-in-from-left duration-200">
            {renderNavContent(true)}
          </div>
        </div>
      )}
    </>
  );
}

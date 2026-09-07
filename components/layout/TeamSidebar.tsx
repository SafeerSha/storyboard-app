"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardCheck,
  FolderKanban,
  Layers,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  X,
} from "lucide-react";
import { toast } from "@/lib/toast";

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
  const [pendingReviewsCount, setPendingReviewsCount] = React.useState<number>(0);
  const [epics, setEpics] = React.useState<Array<{ id: string; name: string; storyCount: number }>>([]);

  const fetchCount = React.useCallback(() => {
    fetch("/api/team/reviews/count")
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((d) => {
        if (typeof d.count === "number") {
          setPendingReviewsCount(d.count);
        }
      })
      .catch(() => {});
  }, []);

  const fetchEpics = React.useCallback(() => {
    fetch("/api/team/epics")
      .then((r) => (r.ok ? r.json() : { epics: [] }))
      .then((d) => {
        if (Array.isArray(d.epics)) {
          setEpics(d.epics);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchCount();
    fetchEpics();
    const handleUpdate = () => {
      fetchCount();
      fetchEpics();
    };
    window.addEventListener("storyboard:review-updated", handleUpdate);
    return () => {
      window.removeEventListener("storyboard:review-updated", handleUpdate);
    };
  }, [fetchCount, fetchEpics]);

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
    toast.flash("success", "Signed out successfully");
    window.location.href = "/team/login";
  }

  const closeMobile = () => setMobileOpen(false);
  const initials = userName ? userName.slice(0, 2).toUpperCase() : "TU";

  const renderNavContent = (isMobile = false) => (
    <div className="flex h-full flex-col bg-transparent">
      {/* Brand Header */}
      <div className="flex h-[76px] items-center justify-between border-b border-[rgba(74,61,100,0.08)] px-5 bg-transparent">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#B8944E] text-white shadow-xs">
            <span className="text-xs font-semibold tracking-tighter">◆</span>
          </div>
          <span className="text-sm font-semibold tracking-tight text-[#252331]">
            StoryBoard
          </span>
          <span className="rounded-md bg-[rgba(184,148,78,0.10)] px-1.5 py-0.5 text-[10px] font-medium text-[#80642F] border border-[rgba(184,148,78,0.14)]">
            Team
          </span>
        </div>
        {isMobile && (
          <button
            type="button"
            onClick={closeMobile}
            className="grid h-8 w-8 place-items-center rounded-lg text-[#9994A5] hover:bg-[rgba(184,148,78,0.08)] hover:text-[#252331] transition"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Assigned Project Scope Indicator */}
      <div className="px-3 pt-4 pb-2">
        <div className="rounded-xl border border-[rgba(74,61,100,0.08)] bg-white/80 p-3 shadow-glass backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[rgba(46,139,112,0.12)] text-[11px] font-bold text-[#2E8B70]">
              {projectName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9994A5]">
                Assigned Project
              </p>
              <p className="truncate text-xs sm:text-sm font-semibold text-[#252331]">
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
          <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#9994A5]">
            TEAM
          </p>
          <nav className="space-y-0.5">
            <Link
              href="/team"
              onClick={closeMobile}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm transition-colors ${
                pathname === "/team"
                  ? "bg-[rgba(184,148,78,0.09)] text-[#80642F] font-medium border border-[rgba(184,148,78,0.12)]"
                  : "text-[#706C7D] font-medium hover:bg-[rgba(184,148,78,0.04)] hover:text-[#80642F] border border-transparent"
              }`}
            >
              <LayoutDashboard
                size={16}
                className={pathname === "/team" ? "text-[#B8944E]" : "text-[#9994A5]"}
              />
              <span>Overview</span>
            </Link>
            <a
              href="/team#project-details"
              onClick={closeMobile}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm text-[#706C7D] font-medium hover:bg-[rgba(184,148,78,0.04)] hover:text-[#80642F] border border-transparent transition-colors"
            >
              <FolderKanban size={16} className="text-[#9994A5]" />
              <span>Project</span>
            </a>
            <Link
              href="/team/reviews"
              onClick={closeMobile}
              className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs sm:text-sm transition-colors ${
                pathname === "/team/reviews"
                  ? "bg-[rgba(184,148,78,0.09)] text-[#80642F] font-medium border border-[rgba(184,148,78,0.12)]"
                  : "text-[#706C7D] font-medium hover:bg-[rgba(184,148,78,0.04)] hover:text-[#80642F] border border-transparent"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <ClipboardCheck
                  size={16}
                  className={pathname === "/team/reviews" ? "text-[#B8944E]" : "text-[#9994A5]"}
                />
                <span className="truncate">My Reviews</span>
              </div>
              {pendingReviewsCount > 0 && (
                <span className="rounded-full bg-[#80642F] px-1.5 py-0.2 text-[10px] font-bold text-white shadow-2xs">
                  {pendingReviewsCount}
                </span>
              )}
            </Link>
            <Link
              href="/inbox"
              onClick={closeMobile}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm transition-colors ${
                pathname.startsWith("/inbox")
                  ? "bg-[rgba(184,148,78,0.09)] text-[#80642F] font-medium border border-[rgba(184,148,78,0.12)]"
                  : "text-[#706C7D] font-medium hover:bg-[rgba(184,148,78,0.04)] hover:text-[#80642F] border border-transparent"
              }`}
            >
              <Layers
                size={16}
                className={pathname.startsWith("/inbox") ? "text-[#B8944E]" : "text-[#9994A5]"}
              />
              <span className="truncate">Idea Inbox</span>
            </Link>
          </nav>
        </div>

        {/* EPICS group */}
        {epics.length > 0 && (
          <div>
            <div className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#9994A5] flex items-center justify-between">
              <span>EPICS</span>
              <span className="text-[10px] text-zinc-400 font-normal">{epics.length}</span>
            </div>
            <nav className="space-y-0.5">
              {epics.map((epic) => (
                <a
                  key={epic.id}
                  href={`/team#epic-folder-${epic.id}`}
                  onClick={closeMobile}
                  className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-[#706C7D] font-medium hover:bg-[rgba(184,148,78,0.04)] hover:text-[#80642F] border border-transparent transition-colors group"
                  title={epic.name}
                >
                  <span className="truncate">{epic.name}</span>
                  <span className="rounded-full bg-zinc-100 px-1.5 py-0.2 text-[10px] font-semibold text-zinc-500 group-hover:bg-[rgba(184,148,78,0.12)] group-hover:text-[#80642F]">
                    {epic.storyCount}
                  </span>
                </a>
              ))}
            </nav>
          </div>
        )}


        {/* DISCUSSION group */}
        <div>
          <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#9994A5]">
            DISCUSSION
          </p>
          <nav className="space-y-0.5">
            <a
              href="#feedback-section"
              onClick={closeMobile}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm text-[#706C7D] font-medium hover:bg-[rgba(184,148,78,0.04)] hover:text-[#80642F] border border-transparent transition-colors"
            >
              <MessageSquare size={16} className="text-[#9994A5]" />
              <span>Feedback</span>
            </a>
          </nav>
        </div>
      </div>

      {/* User Footer */}
      <div className="mt-auto border-t border-[rgba(74,61,100,0.08)] p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#B8944E] text-[11px] font-semibold text-white">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-[#252331]">{userName}</p>
              <p className="text-[10px] text-[#2E8B70] font-medium bg-[rgba(46,139,112,0.08)] px-1.5 py-0.2 rounded border border-[rgba(46,139,112,0.14)] inline-block">Team Member</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            title="Sign out"
            aria-label="Sign out"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[#9994A5] hover:bg-rose-50/80 hover:text-[#C25D72] transition"
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
      <aside className="hidden md:flex md:w-56 md:flex-col fixed inset-y-0 left-0 z-30 border-r border-[rgba(74,61,100,0.08)] bg-[rgba(250,249,252,0.80)] backdrop-blur-[20px]">
        {renderNavContent(false)}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-[rgba(40,32,55,0.25)] backdrop-blur-xs transition-opacity"
            onClick={closeMobile}
          />
          <div className="fixed inset-y-0 left-0 w-64 max-w-[80vw] bg-[rgba(250,249,252,0.94)] backdrop-blur-[20px] border-r border-[rgba(74,61,100,0.08)] shadow-modal animate-in slide-in-from-left duration-200">
            {renderNavContent(true)}
          </div>
        </div>
      )}
    </>
  );
}

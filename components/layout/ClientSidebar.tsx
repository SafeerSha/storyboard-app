"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertCircle,
  Bookmark,
  CheckCircle2,
  Clock,
  FolderKanban,
  Layers,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "@/lib/toast";

interface EpicItem {
  id: string;
  name: string;
  storyCount: number;
}

interface ClientCountsResponse {
  counts: {
    allStories: number;
    approved: number;
    changesRequested: number;
    needsAction: number;
    feedback: number;
  };
  epics: EpicItem[];
}

interface ClientSidebarProps {
  clientName: string;
  projectName: string;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export function ClientSidebar({
  clientName,
  projectName,
  mobileOpen,
  setMobileOpen,
}: ClientSidebarProps) {
  const pathname = usePathname();
  const [counts, setCounts] = useState<{
    allStories: number;
    approved: number;
    changesRequested: number;
    needsAction: number;
    feedback: number;
  }>({
    allStories: 0,
    approved: 0,
    changesRequested: 0,
    needsAction: 0,
    feedback: 0,
  });
  const [epics, setEpics] = useState<EpicItem[]>([]);

  const fetchCounts = useCallback(() => {
    fetch("/api/client/counts")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ClientCountsResponse | null) => {
        if (data) {
          setCounts(data.counts);
          setEpics(data.epics || []);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchCounts();
    const handleUpdate = () => fetchCounts();
    window.addEventListener("storyboard:client-review-updated", handleUpdate);
    return () => {
      window.removeEventListener("storyboard:client-review-updated", handleUpdate);
    };
  }, [fetchCounts]);

  // Mobile drawer keyboard dismiss
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
      await fetch("/api/client/logout", { method: "POST" });
    } catch {
      // Proceed with redirect regardless
    }
    toast.flash("success", "Signed out successfully");
    window.location.href = "/client/login";
  }

  const closeMobile = () => setMobileOpen(false);
  const initials = clientName ? clientName.slice(0, 2).toUpperCase() : "CL";

  const renderNavContent = (isMobile = false) => (
    <div className="flex h-full flex-col bg-transparent">
      {/* Brand Header */}
      <div className="flex h-[76px] items-center justify-between border-b border-[rgba(74,61,100,0.08)] px-5 bg-transparent">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#B8944E] text-white shadow-xs">
            <span className="text-xs font-semibold tracking-tighter">◆</span>
          </div>
          <div className="min-w-0">
            <span className="text-sm font-semibold tracking-tight text-[#252331] block">
              StoryBoard
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#80642F] block">
              Client Portal
            </span>
          </div>
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

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* Project Section */}
        <div>
          <div className="px-3 text-[11px] font-semibold uppercase tracking-wider text-[#80642F]/90 mb-1 flex items-center gap-1.5">
            <FolderKanban size={13} className="text-[#B8944E]" />
            <span className="truncate">{projectName}</span>
          </div>
          <div className="space-y-0.5 mt-2">
            <Link
              href="/client"
              onClick={closeMobile}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
                pathname === "/client"
                  ? "bg-[rgba(184,148,78,0.12)] text-[#80642F] font-semibold shadow-xs"
                  : "text-[#706C7D] hover:bg-white/60 hover:text-[#252331]"
              }`}
            >
              <LayoutDashboard
                size={16}
                className={pathname === "/client" ? "text-[#B8944E]" : "text-[#9994A5]"}
              />
              <span>Overview</span>
            </Link>
          </div>
        </div>

        {/* Review Section */}
        <div>
          <div className="px-3 text-[10px] font-semibold uppercase tracking-wider text-[#9994A5] mb-2">
            Review
          </div>
          <div className="space-y-0.5">
            {/* Needs Your Action */}
            <Link
              href="/client/reviews"
              onClick={closeMobile}
              className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition ${
                pathname === "/client/reviews"
                  ? "bg-[rgba(184,148,78,0.12)] text-[#80642F] font-semibold shadow-xs"
                  : "text-[#706C7D] hover:bg-white/60 hover:text-[#252331]"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Clock
                  size={16}
                  className={pathname === "/client/reviews" ? "text-[#B8944E]" : "text-[#9994A5]"}
                />
                <span className="truncate">Needs Your Action</span>
              </div>
              {counts.needsAction > 0 && (
                <span className="rounded-full bg-[#B8944E] px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                  {counts.needsAction}
                </span>
              )}
            </Link>

            {/* Changes Requested */}
            <Link
              href="/client/changes"
              onClick={closeMobile}
              className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition ${
                pathname === "/client/changes"
                  ? "bg-[rgba(184,148,78,0.12)] text-[#80642F] font-semibold shadow-xs"
                  : "text-[#706C7D] hover:bg-white/60 hover:text-[#252331]"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertCircle
                  size={16}
                  className={pathname === "/client/changes" ? "text-[#B8944E]" : "text-[#9994A5]"}
                />
                <span className="truncate">Changes Requested</span>
              </div>
              {counts.changesRequested > 0 && (
                <span className="rounded-full bg-rose-500/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                  {counts.changesRequested}
                </span>
              )}
            </Link>

            {/* Approved */}
            <Link
              href="/client/approved"
              onClick={closeMobile}
              className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition ${
                pathname === "/client/approved"
                  ? "bg-[rgba(184,148,78,0.12)] text-[#80642F] font-semibold shadow-xs"
                  : "text-[#706C7D] hover:bg-white/60 hover:text-[#252331]"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <CheckCircle2
                  size={16}
                  className={pathname === "/client/approved" ? "text-emerald-600" : "text-[#9994A5]"}
                />
                <span className="truncate">Approved</span>
              </div>
              {counts.approved > 0 && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                  {counts.approved}
                </span>
              )}
            </Link>

            {/* All Stories */}
            <Link
              href="/client/stories"
              onClick={closeMobile}
              className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition ${
                pathname === "/client/stories"
                  ? "bg-[rgba(184,148,78,0.12)] text-[#80642F] font-semibold shadow-xs"
                  : "text-[#706C7D] hover:bg-white/60 hover:text-[#252331]"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Layers
                  size={16}
                  className={pathname === "/client/stories" ? "text-[#B8944E]" : "text-[#9994A5]"}
                />
                <span className="truncate">All Stories</span>
              </div>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
                {counts.allStories}
              </span>
            </Link>
          </div>
        </div>

        {/* Epics Navigation */}
        {epics.length > 0 && (
          <div>
            <div className="px-3 text-[10px] font-semibold uppercase tracking-wider text-[#9994A5] mb-2 flex items-center justify-between">
              <span>Epics</span>
              <span className="text-[10px] text-zinc-400 font-normal">{epics.length}</span>
            </div>
            <div className="space-y-0.5">
              {epics.map((epic) => (
                <Link
                  key={epic.id}
                  href={`/client/stories?epicId=${epic.id}`}
                  onClick={closeMobile}
                  className="group flex items-center justify-between rounded-xl px-3 py-1.5 text-xs font-medium text-[#706C7D] hover:bg-white/60 hover:text-[#252331] transition"
                  title={epic.name}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Bookmark size={13} className="text-[#9994A5] group-hover:text-[#B8944E] shrink-0" />
                    <span className="truncate">{epic.name}</span>
                  </div>
                  <span className="rounded-full bg-zinc-100 px-1.5 py-0.2 text-[10px] font-semibold text-zinc-500 group-hover:bg-zinc-200">
                    {epic.storyCount}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Discussion Section */}
        <div>
          <div className="px-3 text-[10px] font-semibold uppercase tracking-wider text-[#9994A5] mb-2">
            Discussion
          </div>
          <div className="space-y-0.5">
            <Link
              href="/client/feedback"
              onClick={closeMobile}
              className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition ${
                pathname === "/client/feedback"
                  ? "bg-[rgba(184,148,78,0.12)] text-[#80642F] font-semibold shadow-xs"
                  : "text-[#706C7D] hover:bg-white/60 hover:text-[#252331]"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <MessageSquare
                  size={16}
                  className={pathname === "/client/feedback" ? "text-[#B8944E]" : "text-[#9994A5]"}
                />
                <span className="truncate">Feedback</span>
              </div>
              {counts.feedback > 0 && (
                <span className="rounded-full bg-[#B8944E] px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                  {counts.feedback}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      {/* User Profile & Sign Out Footer */}
      <div className="border-t border-[rgba(74,61,100,0.08)] p-3 bg-white/40">
        <div className="flex items-center justify-between gap-2 rounded-xl p-2 bg-white/70 border border-[rgba(74,61,100,0.06)] shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[rgba(184,148,78,0.14)] text-xs font-bold text-[#80642F] border border-[rgba(184,148,78,0.22)]">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-[#252331]">
                {clientName}
              </p>
              <p className="text-[10px] text-[#80642F] font-medium">Client Reviewer</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#9994A5] hover:bg-rose-50 hover:text-rose-600 transition"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-[rgba(74,61,100,0.08)] bg-white/68 backdrop-blur-[20px] md:block">
        {renderNavContent(false)}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#252331]/30 backdrop-blur-xs md:hidden"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r border-[rgba(74,61,100,0.08)] bg-white/95 backdrop-blur-[24px] shadow-2xl transition-transform duration-300 ease-in-out md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {renderNavContent(true)}
      </aside>
    </>
  );
}

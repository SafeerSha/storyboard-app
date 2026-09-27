"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertCircle,
  Bookmark,
  CheckCircle2,
  Clock,
  Coins,
  FolderKanban,
  Layers,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  PanelBottom,
  Sparkles,
  FileText,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { StoryBoardLogo } from "@/components/brand/StoryBoardLogo";
import { MobileNavigationSheet, NavSheetItem, NavSheetSection } from "./MobileNavigationSheet";
import { MobileBottomDock, MobileDockItem } from "./MobileBottomDock";
import { AppDock, DockSectionConfig } from "./AppDock";

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
  desktopNavMode?: "dock" | "sidebar";
  onToggleLayout?: () => void;
}

export function ClientSidebar({
  clientName,
  projectName,
  mobileOpen,
  setMobileOpen,
  desktopNavMode = "dock",
  onToggleLayout,
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

  async function handleSignOut() {
    try {
      await fetch("/api/client/logout", { method: "POST" });
    } catch {
      // Proceed with redirect regardless
    }
    toast.flash("success", "Signed out successfully");
    window.location.href = "/login";
  }

  const closeMobile = () => setMobileOpen(false);
  const initials = clientName ? clientName.slice(0, 2).toUpperCase() : "CL";

  // Mobile Bottom Dock shortcuts
  const mobileDockItems: MobileDockItem[] = [
    {
      id: "dock-client-stories",
      label: "Overview",
      href: "/client",
      icon: LayoutDashboard,
      isActive: pathname === "/client",
      onClick: closeMobile,
    },
    {
      id: "dock-client-action",
      label: "To Review",
      href: "/client/reviews",
      icon: Clock,
      isActive: pathname === "/client/reviews",
      onClick: closeMobile,
      badge:
        counts.needsAction > 0 ? (
          <span className="rounded-full bg-[#B8944E] px-1.5 py-0.2 text-[9px] font-bold text-white shadow-2xs">
            {counts.needsAction}
          </span>
        ) : undefined,
    },
    {
      id: "dock-client-feedback",
      label: "Feedback",
      href: "/client/feedback",
      icon: MessageSquare,
      isActive: pathname === "/client/feedback",
      onClick: closeMobile,
      badge:
        counts.feedback > 0 ? (
          <span className="rounded-full bg-[#B8944E] px-1.5 py-0.2 text-[9px] font-bold text-white shadow-2xs">
            {counts.feedback}
          </span>
        ) : undefined,
    },
    {
      id: "dock-client-estimate",
      label: "Quotation",
      href: "/client/estimate",
      icon: Coins,
      isActive: pathname === "/client/estimate",
      onClick: closeMobile,
    },
  ];

  // Mobile Sheet quick tiles
  const sheetQuickTiles: NavSheetItem[] = [
    {
      id: "sheet-client-stories",
      label: "Overview",
      href: "/client",
      icon: LayoutDashboard,
      isActive: pathname === "/client",
    },
    {
      id: "sheet-client-estimate",
      label: "Quotation",
      href: "/client/estimate",
      icon: Coins,
      isActive: pathname === "/client/estimate",
    },
    {
      id: "sheet-client-action",
      label: "Needs Action",
      href: "/client/reviews",
      icon: Clock,
      isActive: pathname === "/client/reviews",
      badge:
        counts.needsAction > 0 ? (
          <span className="rounded-full bg-[#B8944E] px-1.5 py-0.2 text-[10px] font-bold text-white shadow-2xs">
            {counts.needsAction}
          </span>
        ) : undefined,
    },
    {
      id: "sheet-client-feedback",
      label: "Feedback",
      href: "/client/feedback",
      icon: MessageSquare,
      isActive: pathname === "/client/feedback",
      badge:
        counts.feedback > 0 ? (
          <span className="rounded-full bg-[#B8944E] px-1.5 py-0.2 text-[10px] font-bold text-white shadow-2xs">
            {counts.feedback}
          </span>
        ) : undefined,
    },
    {
      id: "sheet-client-notes",
      label: "Meeting Notes",
      href: "/client/notes",
      icon: FileText,
      isActive: pathname === "/client/notes",
    },
  ];

  const sheetSections: NavSheetSection[] = [
    {
      id: "status-filters",
      title: "Filter Stories",
      items: [
        {
          id: "sheet-changes",
          label: "Changes Requested",
          href: "/client/changes",
          icon: AlertCircle,
          isActive: pathname === "/client/changes",
          badge:
            counts.changesRequested > 0 ? (
              <span className="rounded-full bg-rose-500/90 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                {counts.changesRequested}
              </span>
            ) : undefined,
        },
        {
          id: "sheet-approved",
          label: "Approved Stories",
          href: "/client/approved",
          icon: CheckCircle2,
          isActive: pathname === "/client/approved",
          badge:
            counts.approved > 0 ? (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                {counts.approved}
              </span>
            ) : undefined,
        },
        {
          id: "sheet-all",
          label: "All Stories Archive",
          href: "/client/stories",
          icon: Layers,
          isActive: pathname === "/client/stories",
          badge: (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
              {counts.allStories}
            </span>
          ),
        },
      ],
    },
  ];

  const customSheetContent = (
    <div className="space-y-4">
      {/* Scope Indicator */}
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3.5 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#FAF5EC] text-xs font-bold text-[#7A5B20] border border-[#E5D2A8]">
            <FolderKanban size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              Active Project
            </p>
            <p className="truncate text-sm font-bold text-zinc-900">
              {projectName}
            </p>
          </div>
        </div>
      </div>

    </div>
  );

  // Desktop macOS Dock Configuration
  const desktopDockSections: DockSectionConfig[] = [
    {
      id: "dock-client-main",
      items: [
        {
          id: "dock-client-overview",
          label: "Overview",
          href: "/client",
          icon: LayoutDashboard,
          isActive: pathname === "/client",
        },
        {
          id: "dock-client-estimate",
          label: "Quotation",
          href: "/client/estimate",
          icon: Coins,
          isActive: pathname === "/client/estimate",
        },
        {
          id: "dock-client-notes",
          label: "Meeting Notes",
          href: "/client/notes",
          icon: FileText,
          isActive: pathname === "/client/notes",
        },
        {
          id: "dock-client-action",
          label: "Needs Action",
          href: "/client/reviews",
          icon: Clock,
          isActive: pathname === "/client/reviews",
          badge: counts.needsAction > 0 ? counts.needsAction : undefined,
        },
        {
          id: "dock-client-changes",
          label: "Changes Requested",
          href: "/client/changes",
          icon: AlertCircle,
          isActive: pathname === "/client/changes",
          badge: counts.changesRequested > 0 ? counts.changesRequested : undefined,
        },
        {
          id: "dock-client-approved",
          label: "Approved",
          href: "/client/approved",
          icon: CheckCircle2,
          isActive: pathname === "/client/approved",
          badge: counts.approved > 0 ? counts.approved : undefined,
        },
        {
          id: "dock-client-archive",
          label: "All Stories",
          href: "/client/stories",
          icon: Layers,
          isActive: pathname === "/client/stories",
          badge: counts.allStories > 0 ? counts.allStories : undefined,
        },
      ],
    },
    {
      id: "dock-client-collab",
      items: [
        {
          id: "dock-client-feedback",
          label: "Feedback",
          href: "/client/feedback",
          icon: MessageSquare,
          isActive: pathname === "/client/feedback",
          badge: counts.feedback > 0 ? counts.feedback : undefined,
        },
      ],
    },
  ];

  const renderNavContent = () => (
    <div className="flex h-full flex-col bg-transparent">
      {/* Brand Header */}
      <div className="flex h-[76px] items-center border-b border-[rgba(74,61,100,0.08)] px-5 bg-transparent">
        <StoryBoardLogo size="md" variant="full" badge="Client Portal" />
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

            <Link
              href="/client/estimate"
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
                pathname === "/client/estimate"
                  ? "bg-[rgba(184,148,78,0.12)] text-[#80642F] font-semibold shadow-xs"
                  : "text-[#706C7D] hover:bg-white/60 hover:text-[#252331]"
              }`}
            >
              <Coins
                size={16}
                className={pathname === "/client/estimate" ? "text-[#B8944E]" : "text-[#9994A5]"}
              />
              <span>Quotation & Scope</span>
            </Link>

            <Link
              href="/client/notes"
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
                pathname === "/client/notes"
                  ? "bg-[rgba(184,148,78,0.12)] text-[#80642F] font-semibold shadow-xs"
                  : "text-[#706C7D] hover:bg-white/60 hover:text-[#252331]"
              }`}
            >
              <FileText
                size={16}
                className={pathname === "/client/notes" ? "text-[#B8944E]" : "text-[#9994A5]"}
              />
              <span>Meeting Notes</span>
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
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">
                {counts.allStories}
              </span>
            </Link>
          </div>
        </div>

        {/* Epics Navigation Section */}
        {epics.length > 0 && (
          <div>
            <div className="px-3 text-[10px] font-semibold uppercase tracking-wider text-[#9994A5] mb-2 flex items-center justify-between">
              <span>Epics</span>
              <span className="text-[10px] font-normal text-zinc-400">{epics.length}</span>
            </div>
            <div className="space-y-0.5">
              {epics.map((epic) => (
                <a
                  key={epic.id}
                  href={`/client#epic-folder-${epic.id}`}
                  className="flex items-center justify-between rounded-xl px-3 py-2 text-xs text-[#706C7D] hover:bg-white/60 hover:text-[#252331] transition group"
                  title={epic.name}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Bookmark size={13} className="text-[#9994A5] group-hover:text-[#B8944E] shrink-0" />
                    <span className="truncate">{epic.name}</span>
                  </div>
                  <span className="rounded-full bg-zinc-100 px-1.5 py-0.2 text-[10px] font-medium text-zinc-500 group-hover:bg-[#B8944E]/10 group-hover:text-[#80642F]">
                    {epic.storyCount}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Discussion / Feedback */}
        <div>
          <div className="px-3 text-[10px] font-semibold uppercase tracking-wider text-[#9994A5] mb-2">
            Collaboration
          </div>
          <div className="space-y-0.5">
            <Link
              href="/client/feedback"
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
      <div className="border-t border-[rgba(74,61,100,0.08)] p-3 bg-white/40 space-y-2">
        {onToggleLayout && (
          <button
            type="button"
            onClick={onToggleLayout}
            title="Switch to macOS Bottom Dock"
            aria-label="Switch to macOS Bottom Dock"
            className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-950 bg-white/70 hover:bg-[rgba(184,148,78,0.08)] border border-zinc-200/80 hover:border-[#B8944E]/40 transition-all cursor-pointer group shadow-2xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <PanelBottom size={15} className="text-zinc-500 group-hover:text-[#B8944E] transition-colors shrink-0" />
              <span className="truncate">Dock Layout</span>
            </div>
            <span className="text-[10px] font-bold text-zinc-400 group-hover:text-[#80642F] uppercase tracking-wider shrink-0">Switch</span>
          </button>
        )}

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
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#9994A5] hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
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
      {/* Desktop macOS Dock Mode */}
      {desktopNavMode === "dock" && (
        <AppDock
          className="hidden md:flex"
          sections={desktopDockSections}
          user={{
            name: clientName,
            roleDisplay: "Client Reviewer",
            initials,
            onSignOut: handleSignOut,
          }}
          onToggleLayout={onToggleLayout}
          layoutMode={desktopNavMode}
        />
      )}

      {/* Desktop Persistent Sidebar */}
      {desktopNavMode === "sidebar" && (
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-[rgba(74,61,100,0.08)] bg-white/68 backdrop-blur-[20px] md:block">
          {renderNavContent()}
        </aside>
      )}

      {/* Mobile Floating Bottom Dock */}
      <MobileBottomDock
        items={mobileDockItems}
        onOpenMenu={() => setMobileOpen(true)}
        isMenuOpen={mobileOpen}
      />

      {/* Mobile Bottom Navigation Sheet */}
      <MobileNavigationSheet
        isOpen={mobileOpen}
        onClose={closeMobile}
        brandBadge="Client Portal"
        brandHref="/client"
        quickTiles={sheetQuickTiles}
        sections={sheetSections}
        customContent={customSheetContent}
        user={{
          name: clientName,
          roleDisplay: "Client Reviewer",
          initials,
          onSignOut: handleSignOut,
        }}
      />
    </>
  );
}

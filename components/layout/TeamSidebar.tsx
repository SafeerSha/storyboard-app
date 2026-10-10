"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Calendar,
  Receipt,
  Check,
  ChevronDown,
  ChevronsUpDown,
  ClipboardCheck,
  FolderKanban,
  Layers,
  LogOut,
  MessageSquare,
  PanelBottom,
  Search,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { StoryBoardLogo } from "@/components/brand/StoryBoardLogo";
import { MobileNavigationSheet, NavSheetItem, NavSheetSection } from "./MobileNavigationSheet";
import { MobileBottomDock, MobileDockItem } from "./MobileBottomDock";
import { AppDock, DockSectionConfig } from "./AppDock";

export interface AssignedProjectItem {
  id: string;
  name: string;
  description?: string | null;
  status?: string;
}

interface TeamSidebarProps {
  userName: string;
  projectName: string;
  assignedProjects?: AssignedProjectItem[];
  activeProjectId?: string;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  desktopNavMode?: "dock" | "sidebar";
  onToggleLayout?: () => void;
}

export function TeamSidebar({
  userName,
  projectName,
  assignedProjects = [],
  activeProjectId,
  mobileOpen,
  setMobileOpen,
  desktopNavMode = "dock",
  onToggleLayout,
}: TeamSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTabParam = searchParams.get("tab");
  const [pendingReviewsCount, setPendingReviewsCount] = React.useState<number>(0);
  const [epics, setEpics] = React.useState<Array<{ id: string; name: string; storyCount: number }>>([]);
  const [hasInboxAccess, setHasInboxAccess] = React.useState<boolean>(false);

  // Project Switcher popover state
  const [projectSwitcherOpen, setProjectSwitcherOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const switcherRef = useRef<HTMLDivElement>(null);

  const filteredProjects = useMemo(() => {
    if (!projectSearch.trim()) return assignedProjects;
    const query = projectSearch.toLowerCase();
    return assignedProjects.filter((p) => p.name.toLowerCase().includes(query));
  }, [assignedProjects, projectSearch]);

  // Click outside to close project switcher
  useEffect(() => {
    if (!projectSwitcherOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setProjectSwitcherOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [projectSwitcherOpen]);

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
    const qs = activeProjectId ? `?projectId=${activeProjectId}` : "";
    fetch(`/api/team/epics${qs}`)
      .then((r) => (r.ok ? r.json() : { epics: [] }))
      .then((d) => {
        if (Array.isArray(d.epics)) {
          setEpics(d.epics);
        }
      })
      .catch(() => {});
  }, [activeProjectId]);

  const fetchInboxAccess = React.useCallback(() => {
    fetch("/api/inbox?status=all")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => {
        if (Array.isArray(d.items) && d.items.length > 0) {
          setHasInboxAccess(true);
        } else {
          setHasInboxAccess(false);
        }
      })
      .catch(() => {
        setHasInboxAccess(false);
      });
  }, []);

  useEffect(() => {
    fetchCount();
    fetchEpics();
    fetchInboxAccess();
    const handleUpdate = () => {
      fetchCount();
      fetchEpics();
      fetchInboxAccess();
    };
    window.addEventListener("storyboard:review-updated", handleUpdate);
    return () => {
      window.removeEventListener("storyboard:review-updated", handleUpdate);
    };
  }, [fetchCount, fetchEpics, fetchInboxAccess]);

  async function handleSignOut() {
    try {
      await fetch("/api/team/logout", { method: "POST" });
    } catch {
      // Proceed with redirect regardless
    }
    toast.flash("success", "Signed out successfully");
    window.location.href = "/login";
  }

  const closeMobile = () => setMobileOpen(false);
  const initials = userName ? userName.slice(0, 2).toUpperCase() : "TU";

  const workspaceHref = activeProjectId ? `/team?projectId=${activeProjectId}` : "/team";
  const meetingsHref = activeProjectId ? `/team?projectId=${activeProjectId}&tab=meetings` : "/team?tab=meetings";
  const remunerationHref = activeProjectId ? `/team?projectId=${activeProjectId}&tab=remuneration` : "/team?tab=remuneration";

  // Mobile Bottom Dock shortcuts
  const mobileDockItems: MobileDockItem[] = [
    {
      id: "dock-team-projects",
      label: "Projects",
      href: "/team/projects",
      icon: FolderKanban,
      isActive: pathname === "/team/projects",
      onClick: closeMobile,
      badge:
        assignedProjects.length > 1 ? (
          <span className="rounded-full bg-[rgba(184,148,78,0.2)] px-1.5 py-0.2 text-[9px] font-bold text-[#80642F]">
            {assignedProjects.length}
          </span>
        ) : undefined,
    },
    {
      id: "dock-team-workspace",
      label: "Workspace",
      href: workspaceHref,
      icon: Layers,
      isActive: pathname === "/team",
      onClick: closeMobile,
    },
    {
      id: "dock-team-reviews",
      label: "Reviews",
      href: "/team/reviews",
      icon: ClipboardCheck,
      isActive: pathname === "/team/reviews",
      onClick: closeMobile,
      badge:
        pendingReviewsCount > 0 ? (
          <span className="rounded-full bg-[#80642F] px-1.5 py-0.2 text-[9px] font-bold text-white shadow-2xs">
            {pendingReviewsCount}
          </span>
        ) : undefined,
    },
    ...(hasInboxAccess
      ? [
          {
            id: "dock-team-inbox",
            label: "Inbox",
            href: "/inbox",
            icon: Layers,
            isActive: pathname.startsWith("/inbox"),
            onClick: closeMobile,
          },
        ]
      : []),
  ];

  // Mobile Sheet quick tiles
  const sheetQuickTiles: NavSheetItem[] = [
    {
      id: "sheet-team-projects",
      label: "All Projects",
      href: "/team/projects",
      icon: FolderKanban,
      isActive: pathname === "/team/projects",
      badge:
        assignedProjects.length > 0 ? (
          <span className="rounded-full bg-[rgba(184,148,78,0.12)] px-1.5 py-0.2 text-[10px] font-bold text-[#80642F]">
            {assignedProjects.length}
          </span>
        ) : undefined,
    },
    {
      id: "sheet-team-workspace",
      label: "Workspace",
      href: workspaceHref,
      icon: Layers,
      isActive: pathname === "/team",
    },
    {
      id: "sheet-team-reviews",
      label: "My Reviews",
      href: "/team/reviews",
      icon: ClipboardCheck,
      isActive: pathname === "/team/reviews",
      badge:
        pendingReviewsCount > 0 ? (
          <span className="rounded-full bg-[#80642F] px-1.5 py-0.2 text-[10px] font-bold text-white shadow-2xs">
            {pendingReviewsCount}
          </span>
        ) : undefined,
    },
    ...(hasInboxAccess
      ? [
          {
            id: "sheet-team-inbox",
            label: "Idea Inbox",
            href: "/inbox",
            icon: Layers,
            isActive: pathname.startsWith("/inbox"),
          },
        ]
      : []),
  ];

  const sheetSections: NavSheetSection[] = [
    {
      id: "project-work",
      title: "Project Work",
      items: [
        {
          id: "sheet-meetings",
          label: "Meetings & Calls",
          href: meetingsHref,
          icon: Calendar,
          isActive: pathname === "/team" && activeTabParam === "meetings",
          description: "Schedule, join, and share meetings",
        },
        {
          id: "sheet-remuneration",
          label: "My Remuneration & Payouts",
          href: remunerationHref,
          icon: Receipt,
          isActive: pathname === "/team" && activeTabParam === "remuneration",
          description: "Agreed fee, disbursements, and pending balance",
        },
      ],
    },
    {
      id: "discussion",
      title: "Collaboration",
      items: [
        {
          id: "sheet-feedback",
          label: "Feedback",
          href: "#feedback-section",
          icon: MessageSquare,
          isActive: false,
          description: "Review comments & feedback thread",
        },
      ],
    },
  ];

  const customSheetContent = (
    <div className="space-y-4">
      {/* Scope Indicator & Multi-Project Switcher on Mobile */}
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3.5 shadow-2xs">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            {assignedProjects.length > 1
              ? `Assigned Projects (${assignedProjects.length})`
              : "Assigned Project"}
          </p>
          {assignedProjects.length > 1 && (
            <Link
              href="/team/projects"
              onClick={closeMobile}
              className="text-[11px] font-semibold text-[#80642F] hover:underline"
            >
              View All →
            </Link>
          )}
        </div>

        {assignedProjects.length > 1 ? (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {assignedProjects.map((p) => {
              const isCurrent = p.id === activeProjectId;
              return (
                <Link
                  key={p.id}
                  href={`/team?projectId=${p.id}`}
                  onClick={closeMobile}
                  className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition ${
                    isCurrent
                      ? "bg-[#80642F] text-white shadow-2xs"
                      : "text-zinc-800 hover:bg-zinc-100"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${
                        isCurrent ? "bg-emerald-400" : "bg-zinc-400"
                      }`}
                    />
                    <span className="truncate">{p.name}</span>
                  </div>
                  {isCurrent && <Check size={13} className="shrink-0 ml-1 text-white" />}
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-50 text-xs font-bold text-emerald-700 border border-emerald-200">
              {projectName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-zinc-900">{projectName}</p>
            </div>
          </div>
        )}
      </div>

      {/* Epics List for Active Project */}
      {epics.length > 0 && (
        <div>
          <div className="px-1 pb-2 text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center justify-between">
            <span>EPICS</span>
            <span className="text-xs text-zinc-500 font-bold">{epics.length}</span>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 divide-y divide-zinc-200 overflow-hidden shadow-2xs">
            {epics.map((epic) => (
              <a
                key={epic.id}
                href={`/team#epic-folder-${epic.id}`}
                onClick={closeMobile}
                className="flex items-center justify-between px-3.5 py-2.5 text-xs text-zinc-800 font-bold hover:bg-white hover:text-zinc-950 transition-colors"
              >
                <span className="truncate">{epic.name}</span>
                <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-bold text-zinc-800">
                  {epic.storyCount}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Desktop macOS Dock Configuration
  const desktopDockSections: DockSectionConfig[] = [
    {
      id: "dock-team-main",
      items: [
        {
          id: "dock-team-projects",
          label: "All Projects",
          href: "/team/projects",
          icon: FolderKanban,
          isActive: pathname === "/team/projects",
          badge: assignedProjects.length > 0 ? assignedProjects.length : undefined,
        },
        {
          id: "dock-team-workspace",
          label: "Workspace",
          href: workspaceHref,
          icon: Layers,
          isActive: pathname === "/team",
        },
        {
          id: "dock-team-reviews",
          label: "My Reviews",
          href: "/team/reviews",
          icon: ClipboardCheck,
          isActive: pathname === "/team/reviews",
          badge: pendingReviewsCount > 0 ? pendingReviewsCount : undefined,
        },
        ...(hasInboxAccess
          ? [
              {
                id: "dock-team-inbox",
                label: "Idea Inbox",
                href: "/inbox",
                icon: Layers,
                isActive: pathname.startsWith("/inbox"),
              },
            ]
          : []),
      ],
    },
    {
      id: "dock-team-collab",
      items: [
        {
          id: "dock-team-meetings",
          label: "Meetings",
          href: meetingsHref,
          icon: Calendar,
          isActive: pathname === "/team" && activeTabParam === "meetings",
        },
        {
          id: "dock-team-remuneration",
          label: "Remuneration",
          href: remunerationHref,
          icon: Receipt,
          isActive: pathname === "/team" && activeTabParam === "remuneration",
        },
        {
          id: "dock-team-feedback",
          label: "Feedback",
          href: "#feedback-section",
          icon: MessageSquare,
          isActive: false,
        },
      ],
    },
  ];

  const handleSelectProject = (pid: string) => {
    setProjectSwitcherOpen(false);
    setProjectSearch("");
    router.push(`/team?projectId=${pid}`);
  };

  const renderNavContent = () => (
    <div className="flex h-full flex-col bg-transparent">
      {/* Brand Header */}
      <div className="flex h-[76px] items-center border-b border-[rgba(74,61,100,0.08)] px-5 bg-transparent">
        <StoryBoardLogo size="md" variant="full" badge="Team" />
      </div>

      {/* Assigned Project Scope Indicator & Switcher */}
      <div className="px-3 pt-4 pb-2 relative" ref={switcherRef}>
        {assignedProjects.length > 1 ? (
          <div className="rounded-xl border border-[rgba(74,61,100,0.08)] bg-white/80 p-2.5 shadow-glass backdrop-blur-md transition-all hover:border-[#B8944E]/40">
            <button
              type="button"
              onClick={() => setProjectSwitcherOpen((prev) => !prev)}
              className="w-full flex items-center justify-between text-left group cursor-pointer"
              title="Click to switch project"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[rgba(184,148,78,0.12)] text-[11px] font-bold text-[#80642F]">
                  {projectName.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9994A5]">
                      Project ({assignedProjects.length})
                    </p>
                  </div>
                  <p className="truncate text-xs font-semibold text-[#252331] group-hover:text-[#80642F] transition-colors">
                    {projectName}
                  </p>
                </div>
              </div>
              <ChevronsUpDown size={14} className="text-[#9994A5] group-hover:text-[#80642F] shrink-0 ml-1" />
            </button>

            {/* Switcher Dropdown Popover */}
            {projectSwitcherOpen && (
              <div className="absolute left-3 right-3 top-full mt-1.5 rounded-xl border border-[rgba(74,61,100,0.12)] bg-white/95 backdrop-blur-xl p-2 shadow-xl z-50 divide-y divide-zinc-100">
                {assignedProjects.length > 4 && (
                  <div className="pb-1.5">
                    <div className="relative">
                      <Search size={12} className="absolute left-2 top-2 text-zinc-400" />
                      <input
                        type="text"
                        placeholder="Search projects..."
                        value={projectSearch}
                        onChange={(e) => setProjectSearch(e.target.value)}
                        className="w-full pl-6 pr-2 py-1 text-xs rounded-md bg-zinc-100 border-none focus:outline-none focus:ring-1 focus:ring-[#B8944E]"
                      />
                    </div>
                  </div>
                )}

                <div className="py-1 max-h-48 overflow-y-auto space-y-0.5">
                  <p className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                    All Mapped Projects
                  </p>
                  {filteredProjects.map((p) => {
                    const isCurrent = p.id === activeProjectId;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectProject(p.id)}
                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-medium text-left transition cursor-pointer ${
                          isCurrent
                            ? "bg-[rgba(184,148,78,0.12)] text-[#80642F] font-semibold"
                            : "text-[#252331] hover:bg-zinc-100"
                        }`}
                      >
                        <span className="truncate">{p.name}</span>
                        {isCurrent && <Check size={12} className="text-[#80642F] shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                  {filteredProjects.length === 0 && (
                    <p className="text-[11px] text-zinc-400 p-2 text-center">No projects match</p>
                  )}
                </div>

                <div className="pt-1.5">
                  <Link
                    href="/team/projects"
                    onClick={() => setProjectSwitcherOpen(false)}
                    className="flex items-center justify-between px-2 py-1 rounded-md text-[11px] font-semibold text-[#80642F] hover:bg-[rgba(184,148,78,0.08)] transition"
                  >
                    <span>View all projects cards</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        ) : (
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
        )}
      </div>

      {/* Nav Content */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
        {/* TEAM group */}
        <div>
          <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#9994A5]">
            NAVIGATION
          </p>
          <nav className="space-y-0.5">
            {/* All Projects link */}
            <Link
              href="/team/projects"
              className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs sm:text-sm transition-colors ${
                pathname === "/team/projects"
                  ? "bg-[rgba(184,148,78,0.09)] text-[#80642F] font-medium border border-[rgba(184,148,78,0.12)]"
                  : "text-[#706C7D] font-medium hover:bg-[rgba(184,148,78,0.04)] hover:text-[#80642F] border border-transparent"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <FolderKanban
                  size={16}
                  className={pathname === "/team/projects" ? "text-[#B8944E]" : "text-[#9994A5]"}
                />
                <span className="truncate">All Projects</span>
              </div>
              {assignedProjects.length > 0 && (
                <span className="rounded-full bg-[rgba(184,148,78,0.12)] px-1.5 py-0.2 text-[10px] font-bold text-[#80642F]">
                  {assignedProjects.length}
                </span>
              )}
            </Link>

            {/* Current Project Workspace */}
            <Link
              href={workspaceHref}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm transition-colors ${
                pathname === "/team" && (!activeTabParam || activeTabParam === "hierarchy")
                  ? "bg-[rgba(184,148,78,0.09)] text-[#80642F] font-medium border border-[rgba(184,148,78,0.12)]"
                  : "text-[#706C7D] font-medium hover:bg-[rgba(184,148,78,0.04)] hover:text-[#80642F] border border-transparent"
              }`}
            >
              <Layers
                size={16}
                className={pathname === "/team" && (!activeTabParam || activeTabParam === "hierarchy") ? "text-[#B8944E]" : "text-[#9994A5]"}
              />
              <span className="truncate">Workspace</span>
            </Link>

            {/* Meetings & Calls */}
            <Link
              href={meetingsHref}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm transition-colors ${
                pathname === "/team" && activeTabParam === "meetings"
                  ? "bg-[rgba(184,148,78,0.09)] text-[#80642F] font-medium border border-[rgba(184,148,78,0.12)]"
                  : "text-[#706C7D] font-medium hover:bg-[rgba(184,148,78,0.04)] hover:text-[#80642F] border border-transparent"
              }`}
            >
              <Calendar
                size={16}
                className={pathname === "/team" && activeTabParam === "meetings" ? "text-[#B8944E]" : "text-[#9994A5]"}
              />
              <span className="truncate">Meetings & Calls</span>
            </Link>

            {/* My Remuneration & Payouts */}
            <Link
              href={remunerationHref}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm transition-colors ${
                pathname === "/team" && activeTabParam === "remuneration"
                  ? "bg-[rgba(184,148,78,0.09)] text-[#80642F] font-medium border border-[rgba(184,148,78,0.12)]"
                  : "text-[#706C7D] font-medium hover:bg-[rgba(184,148,78,0.04)] hover:text-[#80642F] border border-transparent"
              }`}
            >
              <Receipt
                size={16}
                className={pathname === "/team" && activeTabParam === "remuneration" ? "text-[#B8944E]" : "text-[#9994A5]"}
              />
              <span className="truncate">My Remuneration</span>
            </Link>

            {/* My Reviews */}
            <Link
              href="/team/reviews"
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

            {hasInboxAccess && (
              <Link
                href="/inbox"
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
            )}
          </nav>
        </div>

        {/* EPICS group for Active Project */}
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
                  href={`/team?projectId=${activeProjectId}#epic-folder-${epic.id}`}
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
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm text-[#706C7D] font-medium hover:bg-[rgba(184,148,78,0.04)] hover:text-[#80642F] border border-transparent transition-colors"
            >
              <MessageSquare size={16} className="text-[#9994A5]" />
              <span>Feedback</span>
            </a>
          </nav>
        </div>
      </div>

      {/* User Footer */}
      <div className="mt-auto border-t border-[rgba(74,61,100,0.08)] p-3 space-y-2">
        {onToggleLayout && (
          <button
            type="button"
            onClick={onToggleLayout}
            title="Switch to macOS Bottom Dock"
            aria-label="Switch to macOS Bottom Dock"
            className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-950 bg-white/60 hover:bg-[rgba(184,148,78,0.08)] border border-zinc-200/80 hover:border-[#B8944E]/40 transition-all cursor-pointer group shadow-2xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <PanelBottom size={15} className="text-zinc-500 group-hover:text-[#B8944E] transition-colors shrink-0" />
              <span className="truncate">Dock Layout</span>
            </div>
            <span className="text-[10px] font-bold text-zinc-400 group-hover:text-[#80642F] uppercase tracking-wider shrink-0">Switch</span>
          </button>
        )}

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
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[#9994A5] hover:bg-rose-50/80 hover:text-[#C25D72] transition cursor-pointer"
          >
            <LogOut size={14} />
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
            name: userName,
            roleDisplay: "Team Member",
            initials,
            onSignOut: handleSignOut,
          }}
          onToggleLayout={onToggleLayout}
          layoutMode={desktopNavMode}
        />
      )}

      {/* Desktop Classic Sidebar Mode */}
      {desktopNavMode === "sidebar" && (
        <aside className="hidden md:flex md:w-56 md:flex-col fixed inset-y-0 left-0 z-30 border-r border-[rgba(74,61,100,0.08)] bg-[rgba(250,249,252,0.80)] backdrop-blur-[20px]">
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
        brandBadge="Team"
        brandHref="/team"
        quickTiles={sheetQuickTiles}
        sections={sheetSections}
        customContent={customSheetContent}
        user={{
          name: userName,
          roleDisplay: "Team Member",
          initials,
          onSignOut: handleSignOut,
        }}
      />
    </>
  );
}

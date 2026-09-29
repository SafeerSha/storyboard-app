"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  FolderKanban,
  CheckSquare,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  PanelBottom,
  Receipt,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { DashboardUser, useDashboard } from "./FreelancerLayout";
import { StoryBoardLogo } from "@/components/brand/StoryBoardLogo";
import { MobileNavigationSheet, NavSheetItem, NavSheetSection } from "./MobileNavigationSheet";
import { MobileBottomDock, MobileDockItem } from "./MobileBottomDock";
import { AppDock, DockSectionConfig } from "./AppDock";

interface FreelancerSidebarProps {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  initialUser?: DashboardUser | null;
}

export function FreelancerSidebar({
  mobileOpen,
  setMobileOpen,
  initialUser = null,
}: FreelancerSidebarProps) {
  const pathname = usePathname();
  const { desktopNavMode, toggleDesktopNavMode } = useDashboard();
  const [userEmail, setUserEmail] = useState<string | null>(initialUser?.email || null);
  const [userRole, setUserRole] = useState<string>(initialUser?.role || "freelancer");
  const [userNameState, setUserNameState] = useState<string>(initialUser?.name || "");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // If initialUser wasn't provided, fetch it
    if (!initialUser) {
      fetch("/api/auth/me")
        .then((r) => r.json())
        .then((data) => {
          if (data?.authenticated && data?.user) {
            setUserEmail(data.user.email);
            setUserRole(data.user.role);
            setUserNameState(data.user.name);
          }
        })
        .catch(() => {
          // Fallback to client-side supabase fetch
          const supabase = createClient();
          supabase.auth.getUser().then(({ data }) => {
            if (data?.user?.email) {
              setUserEmail(data.user.email);
              supabase
                .from("freelancer_profiles")
                .select("name, role")
                .eq("id", data.user.id)
                .single()
                .then((res) => {
                  if (res.data?.role) setUserRole(res.data.role);
                  if (res.data?.name) setUserNameState(res.data.name);
                });
            }
          });
        });
    }
  }, [initialUser]);

  // Click away for desktop user profile menu
  useEffect(() => {
    if (!showUserMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showUserMenu]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.flash("success", "Signed out successfully");
    window.location.href = "/login";
  }

  const isOverviewActive = pathname === "/";
  const isProjectsActive = pathname.startsWith("/project") || pathname.startsWith("/projects");
  const isTasksActive = pathname.startsWith("/tasks");
  const isInboxActive = pathname.startsWith("/inbox");
  const isClientsActive = pathname.startsWith("/clients");
  const isSettingsActive = pathname.startsWith("/settings") || pathname === "/remuneration" || pathname.startsWith("/remuneration/");
  const isUsersActive = pathname.startsWith("/users");
  const isRemunerationsActive = pathname.startsWith("/remunerations");

  const closeMobile = () => setMobileOpen(false);

  const userName =
    userNameState ||
    (userEmail
      ? userEmail.split("@")[0]
      : userRole === "super_admin"
      ? "Super Admin"
      : "Freelancer");
  const roleDisplay = userRole === "super_admin" ? "Super Admin" : "Freelancer";
  const userInitials = userName
    ? userName.slice(0, 2).toUpperCase()
    : userEmail
    ? userEmail.slice(0, 2).toUpperCase()
    : "SB";

  // Mobile Bottom Dock shortcuts (1-tap access in thumb zone)
  const mobileDockItems: MobileDockItem[] = [
    {
      id: "dock-overview",
      label: "Overview",
      href: "/",
      icon: LayoutDashboard,
      isActive: isOverviewActive,
      onClick: closeMobile,
    },
    {
      id: "dock-projects",
      label: "Projects",
      href: "/projects",
      icon: FolderKanban,
      isActive: isProjectsActive,
      onClick: closeMobile,
    },
    {
      id: "dock-inbox",
      label: "Ideas",
      href: "/inbox",
      icon: Lightbulb,
      isActive: isInboxActive,
      onClick: closeMobile,
    },
    {
      id: "dock-remunerations",
      label: "Payments",
      href: "/remunerations",
      icon: Receipt,
      isActive: isRemunerationsActive,
      onClick: closeMobile,
    },
    {
      id: "dock-settings",
      label: "Settings",
      href: "/settings",
      icon: Settings,
      isActive: isSettingsActive,
      onClick: closeMobile,
    },
  ];

  // Mobile Action Sheet Config (Full feature sheet sliding from bottom)
  const sheetQuickTiles: NavSheetItem[] = [
    {
      id: "sheet-overview",
      label: "Overview",
      href: "/",
      icon: LayoutDashboard,
      isActive: isOverviewActive,
    },
    {
      id: "sheet-projects",
      label: "Projects",
      href: "/projects",
      icon: FolderKanban,
      isActive: isProjectsActive,
    },
    {
      id: "sheet-inbox",
      label: "Ideas Inbox",
      href: "/inbox",
      icon: Lightbulb,
      isActive: isInboxActive,
    },
    {
      id: "sheet-settings",
      label: "Settings",
      href: "/settings",
      icon: Settings,
      isActive: isSettingsActive,
    },
  ];

  const sheetSections: NavSheetSection[] = [
    {
      id: "manage",
      title: "Manage & Administration",
      items: [
        {
          id: "sheet-remunerations",
          label: "Remunerations",
          href: "/remunerations",
          icon: Receipt,
          isActive: isRemunerationsActive,
          description: "Track client payments, installments & proofs",
        },
        {
          id: "sheet-clients",
          label: "Clients",
          href: "/clients",
          icon: Users,
          isActive: isClientsActive,
          description: "Manage client organizations & projects",
        },
        {
          id: "sheet-users",
          label: "Users",
          href: "/users",
          icon: ShieldCheck,
          isActive: isUsersActive,
          description: "Manage platform users, freelancers & project access",
        },
        {
          id: "sheet-settings-item",
          label: "Preferences",
          href: "/settings",
          icon: Settings,
          isActive: isSettingsActive && !isUsersActive,
          description: "Workspace preferences, AI engine & remuneration",
        },
      ],
    },
  ];

  const desktopDockSections: DockSectionConfig[] = [
    {
      id: "dock-workspace",
      items: [
        {
          id: "dock-overview",
          label: "Overview",
          href: "/",
          icon: LayoutDashboard,
          isActive: isOverviewActive,
        },
        {
          id: "dock-projects",
          label: "Projects",
          href: "/projects",
          icon: FolderKanban,
          isActive: isProjectsActive,
        },
        {
          id: "dock-tasks",
          label: "Tasks",
          href: "/tasks",
          icon: CheckSquare,
          isActive: isTasksActive,
        },
        {
          id: "dock-inbox",
          label: "Ideas",
          href: "/inbox",
          icon: Lightbulb,
          isActive: isInboxActive,
        },
      ],
    },
    {
      id: "dock-manage",
      items: [
        {
          id: "dock-remunerations",
          label: "Payments",
          href: "/remunerations",
          icon: Receipt,
          isActive: isRemunerationsActive,
        },
        {
          id: "dock-clients",
          label: "Clients",
          href: "/clients",
          icon: Users,
          isActive: isClientsActive,
        },
        {
          id: "dock-users",
          label: "Users",
          href: "/users",
          icon: ShieldCheck,
          isActive: isUsersActive,
        },
        {
          id: "dock-settings",
          label: "Settings",
          href: "/settings",
          icon: Settings,
          isActive: isSettingsActive && !isUsersActive,
        },
      ],
    },
  ];

  const renderDesktopNav = () => (
    <div className="flex h-full flex-col bg-transparent">
      {/* Brand Header */}
      <div className="flex h-[76px] items-center border-b border-[rgba(74,61,100,0.08)] px-5 bg-transparent">
        <Link
          href="/"
          className="flex items-center group focus-visible:outline-none"
        >
          <StoryBoardLogo
            size="md"
            variant="full"
            badge={userRole === "super_admin" ? "Admin" : undefined}
          />
        </Link>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto px-2.5 py-4 space-y-5">
        {/* Workspace group */}
        <div>
          <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#9994A5]">
            Workspace
          </p>
          <nav className="space-y-0.5">
            <Link
              href="/"
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm transition-colors ${
                isOverviewActive
                  ? "bg-[rgba(184,148,78,0.09)] border border-[rgba(184,148,78,0.12)] text-[#80642F] font-medium"
                  : "text-[#706C7D] hover:bg-[rgba(184,148,78,0.04)] hover:text-[#80642F] border border-transparent font-medium"
              }`}
            >
              <LayoutDashboard
                size={16}
                className={isOverviewActive ? "text-[#B8944E]" : "text-[#9994A5]"}
              />
              <span>Overview</span>
            </Link>
            <Link
              href="/projects"
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm transition-colors ${
                isProjectsActive
                  ? "bg-[rgba(184,148,78,0.09)] border border-[rgba(184,148,78,0.12)] text-[#80642F] font-medium"
                  : "text-[#706C7D] hover:bg-[rgba(184,148,78,0.04)] hover:text-[#80642F] border border-transparent font-medium"
              }`}
            >
              <FolderKanban
                size={16}
                className={isProjectsActive ? "text-[#B8944E]" : "text-[#9994A5]"}
              />
              <span>Projects</span>
            </Link>

            <Link
              href="/tasks"
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm transition-colors ${
                isTasksActive
                  ? "bg-[rgba(184,148,78,0.09)] border border-[rgba(184,148,78,0.12)] text-[#80642F] font-medium"
                  : "text-[#706C7D] hover:bg-[rgba(184,148,78,0.04)] hover:text-[#80642F] border border-transparent font-medium"
              }`}
            >
              <CheckSquare
                size={16}
                className={isTasksActive ? "text-[#B8944E]" : "text-[#9994A5]"}
              />
              <span>Tasks</span>
            </Link>

            <Link
              href="/inbox"
              className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs sm:text-sm transition-colors group ${
                isInboxActive
                  ? "bg-[rgba(184,148,78,0.09)] border border-[rgba(184,148,78,0.12)] text-[#80642F] font-medium"
                  : "text-[#706C7D] hover:bg-[rgba(184,148,78,0.04)] hover:text-[#80642F] border border-transparent font-medium"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Lightbulb
                  size={16}
                  className={
                    isInboxActive
                      ? "text-[#B8944E]"
                      : "text-[#9994A5] group-hover:text-[#B8944E]"
                  }
                />
                <span className="truncate">Project Inbox</span>
              </div>
              <span className="rounded bg-[rgba(184,148,78,0.10)] px-1.5 py-0.5 text-[10px] font-semibold text-[#80642F] border border-[rgba(184,148,78,0.14)]">
                Ideas
              </span>
            </Link>
          </nav>
        </div>

        {/* Manage group */}
        <div>
          <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#9994A5]">
            Manage
          </p>
          <nav className="space-y-0.5">
            <Link
              href="/remunerations"
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm transition-colors ${
                isRemunerationsActive
                  ? "bg-[rgba(184,148,78,0.09)] border border-[rgba(184,148,78,0.12)] text-[#80642F] font-medium"
                  : "text-[#706C7D] hover:bg-[rgba(184,148,78,0.04)] hover:text-[#80642F] border border-transparent font-medium"
              }`}
            >
              <Receipt
                size={16}
                className={isRemunerationsActive ? "text-[#B8944E]" : "text-[#9994A5]"}
              />
              <span>Remunerations</span>
            </Link>
            <Link
              href="/clients"
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm transition-colors ${
                isClientsActive
                  ? "bg-[rgba(184,148,78,0.09)] border border-[rgba(184,148,78,0.12)] text-[#80642F] font-medium"
                  : "text-[#706C7D] hover:bg-[rgba(184,148,78,0.04)] hover:text-[#80642F] border border-transparent font-medium"
              }`}
            >
              <Users
                size={16}
                className={isClientsActive ? "text-[#B8944E]" : "text-[#9994A5]"}
              />
              <span>Clients</span>
            </Link>
            <Link
              href="/users"
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm transition-colors ${
                isUsersActive
                  ? "bg-[rgba(184,148,78,0.09)] border border-[rgba(184,148,78,0.12)] text-[#80642F] font-medium"
                  : "text-[#706C7D] hover:bg-[rgba(184,148,78,0.04)] hover:text-[#80642F] border border-transparent font-medium"
              }`}
            >
              <ShieldCheck
                size={16}
                className={isUsersActive ? "text-[#B8944E]" : "text-[#9994A5]"}
              />
              <span>Users</span>
            </Link>
            <Link
              href="/settings"
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm transition-colors ${
                isSettingsActive && !isUsersActive
                  ? "bg-[rgba(184,148,78,0.09)] border border-[rgba(184,148,78,0.12)] text-[#80642F] font-medium"
                  : "text-[#706C7D] hover:bg-[rgba(184,148,78,0.04)] hover:text-[#80642F] border border-transparent font-medium"
              }`}
            >
              <Settings
                size={16}
                className={
                  isSettingsActive && !isUsersActive ? "text-[#B8944E]" : "text-[#9994A5]"
                }
              />
              <span>Settings</span>
            </Link>
          </nav>
        </div>
      </div>

      {/* User Profile Pill & Popover Menu */}
      <div className="relative border-t border-[rgba(74,61,100,0.08)] p-3 space-y-2" ref={menuRef}>
        {/* Switch to Bottom Dock Button */}
        <button
          type="button"
          onClick={toggleDesktopNavMode}
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

        {showUserMenu && (
          <div className="absolute bottom-full left-3 right-3 mb-2 overflow-hidden rounded-xl border border-[rgba(74,61,100,0.10)] bg-white/94 backdrop-blur-[20px] p-1 shadow-[0_15px_40px_rgba(70,55,95,0.12)] animate-in fade-in zoom-in-95 duration-100">
            <div className="border-b border-[rgba(74,61,100,0.08)] px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9994A5]">
                Signed in as
              </p>
              <p className="truncate text-xs font-medium text-[#252331]">
                {userEmail || "freelancer@reqly.io"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[#C25D72] hover:bg-rose-50/80 transition cursor-pointer"
            >
              <LogOut size={14} />
              <span>Sign out</span>
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowUserMenu((prev) => !prev)}
          className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition hover:bg-[rgba(184,148,78,0.05)] cursor-pointer"
        >
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#B8944E] text-[11px] font-semibold text-white">
            {userInitials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-[#252331]">{userName}</p>
            <p className="truncate text-[11px] text-[#706C7D] font-medium">{roleDisplay}</p>
          </div>
          <ChevronDown
            size={14}
            className={`text-[#9994A5] transition-transform duration-150 ${
              showUserMenu ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop macOS Bottom Center Dock (Default & Preferred Layout) */}
      {desktopNavMode === "dock" && (
        <AppDock
          className="hidden lg:flex"
          brand={{
            label: "Reqly",
            href: "/",
            badge: userRole === "super_admin" ? "Admin" : undefined,
          }}
          sections={desktopDockSections}
          user={{
            name: userName,
            email: userEmail,
            role: roleDisplay,
            initials: userInitials,
            onSignOut: handleSignOut,
          }}
          onToggleLayout={toggleDesktopNavMode}
          layoutMode="dock"
        />
      )}

      {/* Desktop Persistent Sidebar (when sidebar mode selected) */}
      {desktopNavMode === "sidebar" && (
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 border-r border-[rgba(74,61,100,0.08)] bg-[rgba(250,249,252,0.80)] backdrop-blur-[20px] md:flex md:flex-col">
          {renderDesktopNav()}
        </aside>
      )}

      {/* Mobile Floating Bottom Dock (Fast 1-Tap Navigation) */}
      <MobileBottomDock
        items={mobileDockItems}
        onOpenMenu={() => setMobileOpen(true)}
        isMenuOpen={mobileOpen}
        isMoreActive={isClientsActive || isSettingsActive || isUsersActive}
      />

      {/* Mobile Sliding Bottom Sheet (Full Action & Workspace Hub) */}
      <MobileNavigationSheet
        isOpen={mobileOpen}
        onClose={closeMobile}
        brandBadge={userRole === "super_admin" ? "Admin" : undefined}
        brandHref="/"
        quickTiles={sheetQuickTiles}
        sections={sheetSections}
        user={{
          name: userName,
          email: userEmail,
          roleDisplay,
          initials: userInitials,
          onSignOut: handleSignOut,
        }}
      />
    </>
  );
}

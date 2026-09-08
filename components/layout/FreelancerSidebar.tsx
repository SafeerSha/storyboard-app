"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  FolderKanban,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import type { DashboardUser } from "./FreelancerLayout";
import { StoryBoardLogo } from "@/components/brand/StoryBoardLogo";

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

  // Lock body scroll and listen for Escape when mobile drawer is open
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

  // Click away for user profile menu
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
  const isInboxActive = pathname.startsWith("/inbox");
  const isClientsActive = pathname.startsWith("/clients");
  const isSettingsActive = pathname.startsWith("/settings");
  const isUsersActive = pathname.startsWith("/users");

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

  const renderNav = (isMobile = false) => (
    <div className="flex h-full flex-col bg-transparent">
      {/* Brand Header */}
      <div className="flex h-[76px] items-center justify-between border-b border-[rgba(74,61,100,0.08)] px-5 bg-transparent">
        <Link
          href="/"
          onClick={closeMobile}
          className="flex items-center group focus-visible:outline-none"
        >
          <StoryBoardLogo
            size="md"
            variant="full"
            badge={userRole === "super_admin" ? "Admin" : undefined}
          />
        </Link>
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
      <div className="flex-1 overflow-y-auto px-2.5 py-4 space-y-5">
        {/* Workspace group */}
        <div>
          <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#9994A5]">
            Workspace
          </p>
          <nav className="space-y-0.5">
            <Link
              href="/"
              onClick={closeMobile}
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
              onClick={closeMobile}
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

            {userRole === "super_admin" && (
              <Link
                href="/inbox"
                onClick={closeMobile}
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
            )}
          </nav>
        </div>

        {/* Manage group */}
        <div>
          <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#9994A5]">
            Manage
          </p>
          <nav className="space-y-0.5">
            <Link
              href="/clients"
              onClick={closeMobile}
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
            {userRole === "super_admin" && (
              <Link
                href="/users"
                onClick={closeMobile}
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
            )}
            <Link
              href="/settings"
              onClick={closeMobile}
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
      <div className="relative border-t border-[rgba(74,61,100,0.08)] p-3" ref={menuRef}>
        {showUserMenu && (
          <div className="absolute bottom-full left-3 right-3 mb-2 overflow-hidden rounded-xl border border-[rgba(74,61,100,0.10)] bg-white/94 backdrop-blur-[20px] p-1 shadow-[0_15px_40px_rgba(70,55,95,0.12)] animate-in fade-in zoom-in-95 duration-100">
            <div className="border-b border-[rgba(74,61,100,0.08)] px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9994A5]">
                Signed in as
              </p>
              <p className="truncate text-xs font-medium text-[#252331]">
                {userEmail || "freelancer@storyboard"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[#C25D72] hover:bg-rose-50/80 transition"
            >
              <LogOut size={14} />
              <span>Sign out</span>
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowUserMenu((prev) => !prev)}
          className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition hover:bg-[rgba(184,148,78,0.05)]"
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
      {/* Desktop Persistent Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 border-r border-[rgba(74,61,100,0.08)] bg-[rgba(250,249,252,0.80)] backdrop-blur-[20px] lg:flex lg:flex-col">
        {renderNav(false)}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-[rgba(40,32,55,0.25)] backdrop-blur-xs transition-opacity lg:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Mobile Drawer Slide-Out Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Navigation Menu"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 max-w-[calc(100vw-3rem)] flex-col border-r border-[rgba(74,61,100,0.08)] bg-[rgba(250,249,252,0.94)] backdrop-blur-[20px] shadow-2xl transition-transform duration-200 ease-in-out lg:hidden pb-[env(safe-area-inset-bottom)] ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {renderNav(true)}
      </aside>
    </>
  );
}

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
    <div className="flex h-full flex-col bg-[#F8F9FC]">
      {/* Brand Header */}
      <div className="flex h-[72px] sm:h-[80px] items-center justify-between border-b border-[#E2E6EF] px-5 bg-[#F8F9FC]">
        <Link
          href="/"
          onClick={closeMobile}
          className="flex items-center gap-2.5 group focus-visible:outline-none"
        >
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-white shadow-xs">
            <span className="text-xs font-semibold tracking-tighter">◆</span>
          </div>
          <span className="text-sm font-semibold tracking-tight text-slate-900 group-hover:text-indigo-600 transition">
            StoryBoard
          </span>
          {userRole === "super_admin" && (
            <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
              Admin
            </span>
          )}
        </Link>
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

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto px-2.5 py-4 space-y-5">
        {/* Workspace group */}
        <div>
          <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Workspace
          </p>
          <nav className="space-y-0.5">
            <Link
              href="/"
              onClick={closeMobile}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm transition-colors ${
                isOverviewActive
                  ? "bg-zinc-100 font-medium text-slate-900"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-slate-900"
              }`}
            >
              <LayoutDashboard
                size={16}
                className={isOverviewActive ? "text-slate-900" : "text-zinc-400"}
              />
              <span>Overview</span>
            </Link>
            <Link
              href="/projects"
              onClick={closeMobile}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm transition-colors ${
                isProjectsActive
                  ? "bg-zinc-100 font-medium text-slate-900"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-slate-900"
              }`}
            >
              <FolderKanban
                size={16}
                className={isProjectsActive ? "text-slate-900" : "text-zinc-400"}
              />
              <span>Projects</span>
            </Link>

            {userRole === "super_admin" && (
              <Link
                href="/inbox"
                onClick={closeMobile}
                className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs sm:text-sm transition-colors group ${
                  isInboxActive
                    ? "bg-[#EEF2FF] font-semibold text-[#4F46E5]"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Lightbulb
                    size={16}
                    className={
                      isInboxActive
                        ? "text-[#4F46E5]"
                        : "text-amber-500 group-hover:text-amber-600"
                    }
                  />
                  <span className="truncate">Project Inbox</span>
                </div>
                <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 border border-indigo-200/70">
                  Ideas
                </span>
              </Link>
            )}
          </nav>
        </div>

        {/* Manage group */}
        <div>
          <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Manage
          </p>
          <nav className="space-y-0.5">
            <Link
              href="/clients"
              onClick={closeMobile}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm transition-colors ${
                isClientsActive
                  ? "bg-zinc-100 font-medium text-slate-900"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-slate-900"
              }`}
            >
              <Users
                size={16}
                className={isClientsActive ? "text-slate-900" : "text-zinc-400"}
              />
              <span>Clients</span>
            </Link>
            {userRole === "super_admin" && (
              <Link
                href="/users"
                onClick={closeMobile}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm transition-colors ${
                  isUsersActive
                    ? "bg-zinc-100 font-medium text-slate-900"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-slate-900"
                }`}
              >
                <ShieldCheck
                  size={16}
                  className={isUsersActive ? "text-slate-900" : "text-zinc-400"}
                />
                <span>Users</span>
              </Link>
            )}
            <Link
              href="/settings"
              onClick={closeMobile}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm transition-colors ${
                isSettingsActive && !isUsersActive
                  ? "bg-zinc-100 font-medium text-slate-900"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-slate-900"
              }`}
            >
              <Settings
                size={16}
                className={
                  isSettingsActive && !isUsersActive ? "text-slate-900" : "text-zinc-400"
                }
              />
              <span>Settings</span>
            </Link>
          </nav>
        </div>
      </div>

      {/* User Profile Pill & Popover Menu */}
      <div className="relative border-t border-[#E2E6EF] p-3" ref={menuRef}>
        {showUserMenu && (
          <div className="absolute bottom-full left-3 right-3 mb-2 overflow-hidden rounded-xl border border-zinc-200/90 bg-white p-1 shadow-dropdown animate-in fade-in zoom-in-95 duration-100">
            <div className="border-b border-zinc-100 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Signed in as
              </p>
              <p className="truncate text-xs font-medium text-zinc-900">
                {userEmail || "freelancer@storyboard"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition"
            >
              <LogOut size={14} />
              <span>Sign out</span>
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowUserMenu((prev) => !prev)}
          className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition hover:bg-zinc-50"
        >
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
            {userInitials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-slate-900">{userName}</p>
            <p className="truncate text-[11px] text-zinc-400 font-medium">{roleDisplay}</p>
          </div>
          <ChevronDown
            size={14}
            className={`text-zinc-400 transition-transform duration-150 ${
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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 border-r border-[#E2E6EF] bg-[#F8F9FC] lg:flex lg:flex-col">
        {renderNav(false)}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs transition-opacity lg:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Mobile Drawer Slide-Out Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Navigation Menu"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 max-w-[calc(100vw-3rem)] flex-col border-r border-[#E2E6EF] bg-[#F8F9FC] shadow-2xl transition-transform duration-200 ease-in-out lg:hidden pb-[env(safe-area-inset-bottom)] ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {renderNav(true)}
      </aside>
    </>
  );
}

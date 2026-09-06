"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface FreelancerSidebarProps {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export function FreelancerSidebar({ mobileOpen, setMobileOpen }: FreelancerSidebarProps) {
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("freelancer");
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) {
        setUserEmail(data.user.email);
        supabase.from("freelancer_profiles").select("role").eq("id", data.user.id).single().then((res) => {
          if (res.data) setUserRole(res.data.role);
        });
      }
    });
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const isOverviewActive = pathname === "/";
  const isProjectsActive = pathname.startsWith("/project") || pathname.startsWith("/projects");
  const isClientsActive = pathname.startsWith("/clients");
  const isSettingsActive = pathname.startsWith("/settings");
  const isUsersActive = pathname.startsWith("/users");

  const closeMobile = () => setMobileOpen(false);

  const userName = userEmail ? userEmail.split("@")[0] : "Freelancer";
  const userInitials = userEmail
    ? userEmail.slice(0, 2).toUpperCase()
    : "SP";

  const renderSidebarContent = (isMobile = false) => (
    <div className="flex h-full flex-col">
      {/* Header / Logo */}
      <div className="flex h-[72px] items-center justify-between border-b border-line px-5">
        <div className="flex items-center">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-white shadow-sm">
            <span className="text-sm font-bold">◆</span>
          </div>
          <span className="ml-3 text-[17px] font-semibold tracking-tight text-neutral-950">
            StoryBoard
          </span>
        </div>
        {isMobile && (
          <button
            type="button"
            onClick={closeMobile}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav Content */}
      <div className="flex-1 overflow-y-auto px-3 py-5">
        {/* Workspace Selector */}
        <button
          type="button"
          className="mb-5 flex w-full items-center justify-between rounded-xl border border-line bg-paper px-3 py-2.5 text-left transition hover:border-neutral-300"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-indigo-100 text-xs font-semibold text-indigo-700">
              S
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-neutral-900">Workspace</p>
              <p className="text-[11px] text-neutral-400">Personal</p>
            </div>
          </div>
          <ChevronDown size={15} className="text-neutral-400" />
        </button>

        {/* Workspace Group */}
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
          Workspace
        </p>
        <nav className="space-y-1">
          <Link
            href="/"
            onClick={closeMobile}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
              isOverviewActive
                ? "bg-neutral-100 font-medium text-neutral-900"
                : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
            }`}
          >
            <LayoutDashboard size={17} strokeWidth={isOverviewActive ? 2.2 : 1.8} />
            Overview
          </Link>
          <Link
            href="/projects"
            onClick={closeMobile}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
              isProjectsActive
                ? "bg-neutral-100 font-medium text-neutral-900"
                : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
            }`}
          >
            <FolderKanban size={17} strokeWidth={isProjectsActive ? 2.2 : 1.8} />
            Projects
          </Link>
        </nav>

        {/* Manage Group */}
        <p className="mt-7 px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
          Manage
        </p>
        <nav className="space-y-1">
          <Link
            href="/clients"
            onClick={closeMobile}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
              isClientsActive
                ? "bg-neutral-100 font-medium text-neutral-900"
                : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
            }`}
          >
            <Users size={17} strokeWidth={isClientsActive ? 2.2 : 1.8} />
            Clients
          </Link>
          <Link
            href="/settings"
            onClick={closeMobile}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
              isSettingsActive && !isUsersActive
                ? "bg-neutral-100 font-medium text-neutral-900"
                : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
            }`}
          >
            <Settings size={17} strokeWidth={isSettingsActive && !isUsersActive ? 2.2 : 1.8} />
            Settings
          </Link>
          {userRole === "super_admin" && (
            <Link
              href="/users"
              onClick={closeMobile}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                isUsersActive
                  ? "bg-neutral-100 font-medium text-neutral-900"
                  : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
              }`}
            >
              <Users size={17} strokeWidth={isUsersActive ? 2.2 : 1.8} />
              Users / Freelancers
            </Link>
          )}
        </nav>
      </div>

      {/* Footer / User Profile */}
      <div className="relative mt-auto border-t border-line p-4">
        {showUserMenu && (
          <div className="absolute bottom-full left-4 right-4 mb-2 overflow-hidden rounded-2xl border border-line bg-white p-2 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="border-b border-line px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Signed in as</p>
              <p className="truncate text-xs font-medium text-neutral-900">{userEmail || "freelancer@storyboard"}</p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50 mt-1"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowUserMenu(prev => !prev)}
          className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-neutral-50"
        >
          <div className="grid h-8 w-8 place-items-center rounded-full bg-neutral-900 text-xs font-semibold text-white">
            {userInitials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-neutral-900">{userName}</p>
            <p className="truncate text-xs text-neutral-400">Workspace</p>
          </div>
          <ChevronDown
            size={14}
            className={`text-neutral-400 transition-transform duration-200 ${showUserMenu ? "rotate-180" : ""}`}
          />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-line bg-white lg:flex lg:flex-col">
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={closeMobile}
        />
      )}

      {/* Mobile Drawer Slide-Out Panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-line bg-white shadow-2xl transition-transform duration-200 ease-in-out lg:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {renderSidebarContent(true)}
      </aside>
    </>
  );
}

"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Bell, Check, ExternalLink } from "lucide-react";
import { InAppNotification } from "@/lib/types/remuneration";

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // Ignore polling errors
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 45_000);
    return () => clearInterval(interval);
  }, []);

  // Handle outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const markAllAsRead = async () => {
    setLoading(true);
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // Ignore
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className="relative grid h-9 w-9 place-items-center rounded-lg border border-[rgba(15,23,42,0.12)] bg-white/70 text-[#334155] hover:bg-[#F1F5F9]/20 hover:text-[#0F172A] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CCA038]"
        aria-label="View notifications"
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#CCA038] px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white animate-in zoom-in-50">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-[360px] sm:w-96 sm:max-w-none rounded-xl border border-[rgba(15,23,42,0.12)] bg-white/95 backdrop-blur-xl shadow-xl z-50 overflow-hidden animate-in fade-in-50 zoom-in-95">
          <div className="flex items-center justify-between border-b border-[rgba(15,23,42,0.08)] px-4 py-3 bg-[#F8F9FB]/70">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[#0F172A]">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[rgba(204,160,56,0.14)] px-2 py-0.5 text-[11px] font-bold text-[#785312]">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                disabled={loading}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#785312] hover:text-[#5f4921] transition-colors"
              >
                <Check size={13} />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-[rgba(15,23,42,0.06)]">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#64748B]">
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3.5 transition-colors hover:bg-[rgba(204,160,56,0.03)] ${
                    !n.is_read ? "bg-[rgba(204,160,56,0.04)]" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-[#0F172A]">
                          {n.title}
                        </span>
                        {!n.is_read && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[#CCA038]" />
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-[#334155] leading-relaxed">
                        {n.message}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-[#64748B]">
                        <span>{formatTimeAgo(n.created_at)}</span>
                        {n.link_url && (
                          <Link
                            href={n.link_url}
                            onClick={() => {
                              markAsRead(n.id);
                              setIsOpen(false);
                            }}
                            className="inline-flex items-center gap-1 font-medium text-[#785312] hover:underline"
                          >
                            <span>View</span>
                            <ExternalLink size={11} />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

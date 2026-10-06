"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bookmark,
  CheckCircle2,
  Clock,
  Layers,
  MessageSquare,
  RotateCcw,
  Sparkles,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatRelativeTime } from "@/components/clients/ClientStoryCard";

interface FeedbackThreadItem {
  id: string;
  story_id: string;
  story_title: string;
  epic_name: string;
  section_type: string;
  item_id: string | null;
  item_text: string | null;
  status: "open" | "resolved";
  created_by_type: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message: {
    body: string;
    author_name: string;
    author_type: string;
    created_at: string;
  } | null;
  requires_client_action: boolean;
}

export default function ClientFeedbackInboxPage() {
  const router = useRouter();
  const [threads, setThreads] = useState<FeedbackThreadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<"all" | "action" | "open" | "resolved">("all");

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/client/feedback/inbox?limit=50");
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Failed to load feedback inbox");
      }
      const data = await res.json();
      setThreads(data.threads || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load feedback");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  useEffect(() => {
    const handleUpdate = () => fetchThreads();
    window.addEventListener("storyboard:client-review-updated", handleUpdate);
    return () => {
      window.removeEventListener("storyboard:client-review-updated", handleUpdate);
    };
  }, [fetchThreads]);

  const filteredThreads = threads.filter((t) => {
    if (filterTab === "action") return t.requires_client_action;
    if (filterTab === "open") return t.status === "open";
    if (filterTab === "resolved") return t.status === "resolved";
    return true;
  });

  const actionCount = threads.filter((t) => t.requires_client_action).length;
  const openCount = threads.filter((t) => t.status === "open").length;

  const getSectionLabel = (type: string) => {
    switch (type) {
      case "acceptance_criteria":
        return "Acceptance Criterion";
      case "assumption":
        return "Assumption";
      case "clarification":
        return "Clarification";
      default:
        return "General Feedback";
    }
  };

  return (
    <div className="min-h-screen pb-16">
      {/* Header */}
      <div className="border-b border-[rgba(74,61,100,0.08)] bg-white/60 backdrop-blur-[20px] px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-[1720px]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(184,148,78,0.10)] px-2.5 py-0.5 text-[11px] font-semibold text-[#80642F] border border-[rgba(184,148,78,0.18)] mb-2 uppercase tracking-wider">
                <MessageSquare size={12} className="text-[#B8944E]" />
                <span>Discussion Inbox</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#252331]">
                Feedback & Discussions
              </h1>
              <p className="mt-1 text-sm text-[#706C7D]">
                Centralized activity stream for requirements questions, discussion notes, and change requests.
              </p>
            </div>

            {/* Total Metric */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5 rounded-2xl border border-[rgba(184,148,78,0.22)] bg-gradient-to-br from-white/90 to-[#FDFBF7] px-4 py-2.5 shadow-xs">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-[rgba(184,148,78,0.14)] text-[#80642F]">
                  <MessageSquare size={18} />
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#80642F]/80">
                    Open Threads
                  </div>
                  <div className="text-lg font-bold text-[#252331]">
                    {openCount} {openCount === 1 ? "thread" : "threads"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="mt-8 flex flex-wrap gap-2 border-b border-[rgba(74,61,100,0.08)] pb-px">
            <button
              onClick={() => setFilterTab("all")}
              className={`flex items-center gap-2 rounded-t-xl px-4 py-2.5 text-xs font-semibold transition ${
                filterTab === "all"
                  ? "bg-[rgba(184,148,78,0.10)] text-[#80642F] border-b-2 border-[#B8944E]"
                  : "text-[#706C7D] hover:text-[#252331] hover:bg-white/50"
              }`}
            >
              <span>All Threads</span>
              <span className="rounded-full bg-zinc-100 px-1.5 py-0.2 text-[10px] text-zinc-600">
                {threads.length}
              </span>
            </button>

            <button
              onClick={() => setFilterTab("action")}
              className={`flex items-center gap-2 rounded-t-xl px-4 py-2.5 text-xs font-semibold transition ${
                filterTab === "action"
                  ? "bg-[rgba(184,148,78,0.10)] text-[#80642F] border-b-2 border-[#B8944E]"
                  : "text-[#706C7D] hover:text-[#252331] hover:bg-white/50"
              }`}
            >
              <span>Awaiting Your Reply</span>
              {actionCount > 0 && (
                <span className="rounded-full bg-[#B8944E] px-1.5 py-0.2 text-[10px] font-bold text-white">
                  {actionCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setFilterTab("open")}
              className={`flex items-center gap-2 rounded-t-xl px-4 py-2.5 text-xs font-semibold transition ${
                filterTab === "open"
                  ? "bg-[rgba(184,148,78,0.10)] text-[#80642F] border-b-2 border-[#B8944E]"
                  : "text-[#706C7D] hover:text-[#252331] hover:bg-white/50"
              }`}
            >
              <span>Active Discussions</span>
              <span className="rounded-full bg-zinc-100 px-1.5 py-0.2 text-[10px] text-zinc-600">
                {openCount}
              </span>
            </button>

            <button
              onClick={() => setFilterTab("resolved")}
              className={`flex items-center gap-2 rounded-t-xl px-4 py-2.5 text-xs font-semibold transition ${
                filterTab === "resolved"
                  ? "bg-[rgba(184,148,78,0.10)] text-[#80642F] border-b-2 border-[#B8944E]"
                  : "text-[#706C7D] hover:text-[#252331] hover:bg-white/50"
              }`}
            >
              <span>Resolved</span>
              <span className="rounded-full bg-zinc-100 px-1.5 py-0.2 text-[10px] text-zinc-600">
                {threads.filter((t) => t.status === "resolved").length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="mx-auto max-w-[1720px] px-4 py-6 sm:px-8">
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => fetchThreads()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[rgba(74,61,100,0.12)] bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#706C7D] hover:text-[#252331] hover:bg-white transition"
          >
            <RotateCcw size={13} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Loading Skeletons */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-[18px] border border-[rgba(74,61,100,0.08)] bg-white/70 p-5 shadow-xs"
              >
                <div className="h-4 w-1/4 rounded bg-zinc-200 mb-3" />
                <div className="h-5 w-3/4 rounded bg-zinc-200 mb-2" />
                <div className="h-4 w-1/2 rounded bg-zinc-100" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredThreads.length === 0 && (
          <div className="mt-8 rounded-3xl border border-[rgba(74,61,100,0.12)] bg-white/80 p-10 sm:p-16 text-center shadow-xs backdrop-blur-[16px]">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-[rgba(184,148,78,0.12)] text-[#B8944E] shadow-xs">
              <MessageSquare size={32} />
            </div>
            <h3 className="text-xl font-bold text-[#252331]">
              No new feedback
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#706C7D]">
              There are no active feedback threads or change requests in this view.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/client/reviews">
                <Button variant="secondary">Go to Review Queue</Button>
              </Link>
            </div>
          </div>
        )}

        {/* Threads List */}
        {!loading && filteredThreads.length > 0 && (
          <div className="space-y-4">
            {filteredThreads.map((thread) => {
              const isOpen = thread.status === "open";

              return (
                <div
                  key={thread.id}
                  className={`group rounded-2xl border transition-all duration-200 p-5 shadow-xs backdrop-blur-md ${
                    thread.requires_client_action
                      ? "bg-gradient-to-br from-white/95 to-[#FDFBF7] border-[#B8944E]/40 hover:border-[#B8944E] shadow-md"
                      : "bg-white/88 border-[rgba(74,61,100,0.08)] hover:border-[#B8944E]/30"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {/* Meta Tags */}
                      <div className="flex flex-wrap items-center gap-2 mb-2 text-xs">
                        {/* Epic */}
                        <span className="inline-flex items-center gap-1 rounded-md bg-[rgba(74,61,100,0.06)] px-2 py-0.5 text-[11px] font-semibold text-[#706C7D] border border-[rgba(74,61,100,0.08)]">
                          <Bookmark size={11} className="text-[#B8944E]" />
                          <span className="truncate max-w-[140px]">
                            {thread.epic_name}
                          </span>
                        </span>

                        {/* Section Type */}
                        <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                          {getSectionLabel(thread.section_type)}
                        </span>

                        {/* Requires Action Badge */}
                        {thread.requires_client_action && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(184,148,78,0.14)] px-2.5 py-0.5 text-[11px] font-bold text-[#80642F] border border-[rgba(184,148,78,0.24)] animate-pulse">
                            <Sparkles size={11} />
                            <span>Action Required: Team Responded</span>
                          </span>
                        )}

                        {/* Status Badge */}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            isOpen
                              ? "bg-amber-50 text-amber-800 border border-amber-200"
                              : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          }`}
                        >
                          {isOpen ? "Active" : "Resolved"}
                        </span>
                      </div>

                      {/* Story Title */}
                      <h3 className="text-base font-bold text-[#252331] group-hover:text-[#80642F] transition-colors">
                        {thread.story_title}
                      </h3>

                      {/* Item Text / Criterion Excerpt */}
                      {thread.item_text && (
                        <p className="mt-1 text-xs text-[#706C7D] italic border-l-2 border-zinc-200 pl-2 line-clamp-2">
                          &ldquo;{thread.item_text}&rdquo;
                        </p>
                      )}

                      {/* Latest Message Preview */}
                      {thread.last_message && (
                        <div className="mt-3 rounded-xl border border-[rgba(74,61,100,0.06)] bg-[rgba(74,61,100,0.02)] p-3 text-xs">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-[#80642F] mb-1">
                            <div className="flex items-center gap-1.5">
                              <User size={12} />
                              <span>{thread.last_message.author_name}</span>
                              <span className="rounded-md bg-zinc-200/70 px-1 py-0.2 text-[9px] uppercase font-bold text-zinc-600">
                                {thread.last_message.author_type === "client"
                                  ? "Client"
                                  : "Team"}
                              </span>
                            </div>
                            <span className="text-[10px] text-zinc-400 font-normal">
                              {formatRelativeTime(thread.last_message.created_at)}
                            </span>
                          </div>
                          <p className="text-[#252331] line-clamp-2">
                            {thread.last_message.body}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Action CTA Button */}
                    <div className="shrink-0 self-end sm:self-center pt-2 sm:pt-0">
                      <Link href={`/client/reviews?storyId=${thread.story_id}`}>
                        <Button
                          variant="primary"
                          size="sm"
                          className="bg-[#B8944E] hover:bg-[#9F7D3E] text-white border-none shadow-xs text-xs"
                          rightIcon={<ArrowRight size={13} />}
                        >
                          View in Story →
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

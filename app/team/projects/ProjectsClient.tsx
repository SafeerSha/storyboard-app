"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  FolderKanban,
  Search,
  ArrowRight,
  ClipboardCheck,
  Layers,
  Sparkles,
  CheckCircle2,
  Clock,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { TeamAssignedProject } from "@/lib/team-projects";

export interface ProjectWithStats extends TeamAssignedProject {
  totalStories: number;
  approvedStories: number;
  epicsCount: number;
  pendingReviewCount: number;
}

interface ProjectsClientProps {
  projects: ProjectWithStats[];
  userName: string;
}

export function ProjectsClient({ projects, userName }: ProjectsClientProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
    );
  }, [projects, searchQuery]);

  return (
    <div className="pb-24">
      {/* Top Header */}
      <header className="border-b border-[rgba(74,61,100,0.08)] bg-white/68 backdrop-blur-[20px]">
        <div className="mx-auto max-w-[1720px] px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#B8944E] mb-1">
                <span>Team Portal</span>
                <span className="text-[rgba(74,61,100,0.25)]">•</span>
                <span className="text-[#706C7D] font-normal lowercase tracking-normal">
                  @{userName}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#252331]">
                  My Assigned Projects
                </h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[rgba(184,148,78,0.12)] text-[#80642F] border border-[rgba(184,148,78,0.20)]">
                  {projects.length} {projects.length === 1 ? "Project" : "Projects"}
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-[#706C7D] max-w-2xl font-normal leading-relaxed">
                All projects currently mapped to your team account. Select any project to view its
                requirements hierarchy, open stories, or conduct reviews.
              </p>
            </div>

            {/* Quick Search */}
            <div className="w-full sm:w-72">
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9994A5]" />
                <input
                  type="text"
                  placeholder="Search mapped projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm rounded-xl border border-[rgba(74,61,100,0.14)] bg-white/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#B8944E]/30 focus:border-[#B8944E] transition-all shadow-2xs placeholder:text-[#9994A5]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#9994A5] hover:text-[#252331]"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-[1720px] px-4 py-6 sm:px-6 lg:px-8">
        {filteredProjects.length === 0 ? (
          <div className="rounded-2xl border border-[rgba(74,61,100,0.08)] bg-white/70 backdrop-blur-md p-12 text-center shadow-card">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[rgba(184,148,78,0.12)] text-[#80642F] mx-auto mb-4 border border-[rgba(184,148,78,0.20)]">
              <FolderKanban size={28} />
            </div>
            <h3 className="text-base font-bold text-[#252331]">
              {searchQuery ? "No matching projects found" : "No projects assigned yet"}
            </h3>
            <p className="mt-1.5 text-xs sm:text-sm text-[#706C7D] max-w-md mx-auto">
              {searchQuery
                ? `No project names match "${searchQuery}". Try a different keyword.`
                : "Your administrator has not mapped any projects to your account yet. Please contact your workspace admin."}
            </p>
            {searchQuery && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="mt-4"
              >
                Reset Search
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredProjects.map((p) => {
              const initials = p.name ? p.name.slice(0, 2).toUpperCase() : "PR";
              const progressPct =
                p.totalStories > 0 ? Math.round((p.approvedStories / p.totalStories) * 100) : 0;

              return (
                <div
                  key={p.id}
                  className="group relative flex flex-col rounded-2xl border border-[rgba(74,61,100,0.08)] bg-white/80 hover:bg-white backdrop-blur-xl p-5 shadow-card hover:shadow-xl hover:border-[#B8944E]/30 transition-all duration-200"
                >
                  {/* Top Bar: Icon, Name, Status */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[rgba(184,148,78,0.12)] text-[#80642F] font-bold text-sm border border-[rgba(184,148,78,0.18)] shadow-2xs group-hover:scale-105 transition-transform">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-base font-bold text-[#252331] truncate group-hover:text-[#80642F] transition-colors">
                          {p.name}
                        </h2>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Active Project
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-[#706C7D] line-clamp-2 min-h-[32px] mb-4 leading-relaxed font-normal">
                    {p.description || "No description provided for this project."}
                  </p>

                  {/* Metrics Badges */}
                  <div className="grid grid-cols-3 gap-2 py-3 border-y border-[rgba(74,61,100,0.06)] mb-4">
                    <div className="text-center px-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9994A5]">
                        Epics
                      </p>
                      <p className="text-sm font-bold text-[#252331] mt-0.5">{p.epicsCount}</p>
                    </div>
                    <div className="text-center px-1 border-x border-[rgba(74,61,100,0.06)]">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9994A5]">
                        Stories
                      </p>
                      <p className="text-sm font-bold text-[#252331] mt-0.5">{p.totalStories}</p>
                    </div>
                    <div className="text-center px-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9994A5]">
                        Approved
                      </p>
                      <p className="text-sm font-bold text-[#2E8B70] mt-0.5">{p.approvedStories}</p>
                    </div>
                  </div>

                  {/* Progress bar if stories exist */}
                  {p.totalStories > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-[#706C7D] font-medium">Story Signoff Progress</span>
                        <span className="font-semibold text-[#80642F]">{progressPct}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#B8944E] to-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Pending Reviews Notice */}
                  {p.pendingReviewCount > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[rgba(184,148,78,0.09)] border border-[rgba(184,148,78,0.18)] text-[11px] font-medium text-[#80642F] mb-4">
                      <Clock size={13} className="shrink-0" />
                      <span>
                        {p.pendingReviewCount} story {p.pendingReviewCount === 1 ? "review" : "reviews"} pending your signoff
                      </span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-auto flex items-center gap-2 pt-2">
                    <Link
                      href={`/team?projectId=${p.id}`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[rgba(184,148,78,0.10)] hover:bg-[#80642F] text-[#80642F] hover:text-white font-semibold text-xs transition-all duration-150 border border-[rgba(184,148,78,0.22)] shadow-2xs group-hover:shadow"
                    >
                      <Layers size={13} />
                      <span>Open Workspace</span>
                      <ArrowRight size={13} />
                    </Link>

                    <Link
                      href={`/team/reviews?projectId=${p.id}`}
                      className="inline-flex items-center justify-center p-2 rounded-xl text-[#706C7D] hover:text-[#252331] hover:bg-zinc-100 border border-[rgba(74,61,100,0.12)] transition"
                      title="View Reviews for this project"
                    >
                      <ClipboardCheck size={15} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

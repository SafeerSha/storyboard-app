"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  FolderKanban,
  Layers,
  Plus,
  Sparkles,
} from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StoryRowSkeleton } from "@/components/ui/Skeleton";

type Project = {
  id: string;
  name: string;
  description?: string;
  status?: string;
  total: number;
  approved: number;
  created_at?: string;
  epics?: number;
};

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          if (d.error) setError(d.error);
          else setProjects(d.projects ?? []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Failed to load projects");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const totalProjects = projects.length;
  const totalEpics = projects.reduce((sum, p) => sum + (p.epics || 0), 0);
  const totalStories = projects.reduce((sum, p) => sum + (p.total || 0), 0);
  const totalApproved = projects.reduce((sum, p) => sum + (p.approved || 0), 0);
  const awaitingReview = projects.reduce(
    (sum, p) => sum + Math.max((p.total || 0) - (p.approved || 0), 0),
    0
  );

  return (
    <div>
      <DashboardHeader
        eyebrow="WORKSPACE"
        title="Overview"
        description="Requirements at a glance"
        actions={
          <Link href="/projects">
            <Button variant="primary" size="md" leftIcon={<Plus size={14} />}>
              New project
            </Button>
          </Link>
        }
      />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-6">
        {/* Metric Summary Grid */}
        <section className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {[
            { label: "Active Projects", value: totalProjects, note: "Across workspace", icon: FolderKanban },
            { label: "Total Epics", value: totalEpics, note: "Product areas", icon: Layers },
            { label: "Feature Stories", value: totalStories, note: "Defined requirements", icon: Sparkles },
            {
              label: "Approved",
              value: totalApproved,
              note: `${totalStories ? Math.round((totalApproved / totalStories) * 100) : 0}% of all stories`,
              icon: CheckCircle2,
            },
            { label: "In Review", value: awaitingReview, note: "Awaiting client sign-off", icon: Clock },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div
                key={i}
                className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-card flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    {stat.label}
                  </span>
                  <Icon size={15} className="text-zinc-400" />
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold tracking-tight text-slate-900 truncate">
                    {stat.value}
                  </p>
                  <p className="text-[11px] text-zinc-400 truncate mt-0.5">{stat.note}</p>
                </div>
              </div>
            );
          })}
        </section>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs sm:text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Workspace Split Layout: Recent Projects on Left, AI Helper on Right */}
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] items-start">
          {/* Recent Projects Card */}
          <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-slate-900 tracking-tight">
                  Recent Projects
                </h3>
                <p className="text-xs text-zinc-500">Your active requirements workspaces</p>
              </div>
              <Link
                href="/projects"
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition"
              >
                View all
              </Link>
            </div>

            {loading ? (
              <div className="p-4 space-y-3">
                <StoryRowSkeleton />
                <StoryRowSkeleton />
                <StoryRowSkeleton />
              </div>
            ) : projects.length === 0 ? (
              <EmptyState
                icon={FolderKanban}
                title="Your workspace is empty"
                description="Create your first project to start turning client requirements into feature stories."
                action={
                  <Link href="/projects">
                    <Button variant="primary" size="sm" leftIcon={<Plus size={14} />}>
                      Create project
                    </Button>
                  </Link>
                }
                className="border-none rounded-none py-10"
              />
            ) : (
              <div className="divide-y divide-zinc-100">
                {projects.slice(0, 5).map((project) => {
                  const progress = project.total
                    ? Math.round((project.approved / project.total) * 100)
                    : 0;

                  return (
                    <Link
                      href={`/project/${project.id}`}
                      key={project.id}
                      className="group flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-zinc-50/70"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-900 text-xs font-semibold text-white">
                          {project.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition truncate">
                            {project.name}
                          </h4>
                          <p className="text-xs text-zinc-400 truncate mt-0.5">
                            {project.total || 0} stories · {project.approved || 0} approved
                          </p>
                        </div>
                      </div>

                      <div className="hidden sm:flex items-center gap-3 shrink-0">
                        <div className="w-24 text-right">
                          <div className="text-[11px] font-medium text-zinc-400 mb-1">
                            {progress}%
                          </div>
                          <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-slate-900 rounded-full transition-all duration-300"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                        <ArrowRight
                          size={15}
                          className="text-zinc-300 transition group-hover:text-slate-900 group-hover:translate-x-0.5"
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* AI Story Generation Highlight */}
          <div className="rounded-2xl border border-zinc-200/80 bg-slate-900 p-6 text-white shadow-card space-y-4">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-indigo-300">
                <Sparkles size={16} />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-200">
                AI Requirements Breakdown
              </span>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base sm:text-lg font-semibold tracking-tight text-white">
                Turn rough requirements into structured stories.
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Gemini GenAI breaks client scope into atomic user stories with acceptance criteria, technical assumptions, and open clarification questions.
              </p>
            </div>

            <div className="pt-2">
              <Link href="/projects">
                <Button
                  variant="secondary"
                  size="md"
                  className="w-full sm:w-auto"
                  rightIcon={<ArrowUpRight size={14} />}
                >
                  Explore projects
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

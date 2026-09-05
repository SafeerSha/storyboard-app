"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  FolderKanban,
  LayoutDashboard,
  Plus,
  Sparkles,
  CheckCircle2,
  Clock3,
  ArrowUpRight,
} from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

type Project = {
  id: string;
  name: string;
  description?: string;
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
      .then(r => r.json())
      .then(d => {
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
        category="Workspace"
        title="Overview"
        actions={
          <>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-white text-neutral-500 hover:text-neutral-900 transition"
              aria-label="Notifications"
            >
              <Bell size={17} />
            </button>
            <Link
              href="/projects"
              className="inline-flex items-center gap-2 rounded-xl bg-ink px-3.5 py-2 text-sm font-medium text-white hover:bg-neutral-800 transition shadow-sm"
            >
              <Plus size={16} /> New project
            </Link>
          </>
        }
      />

      <main className="mx-auto max-w-[1320px] px-6 py-8 lg:px-9">
        <section className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700">
              <Sparkles size={13} /> Requirements at a glance
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-neutral-950">Good morning.</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-500">Keep client requirements clear, reviewed, and approved.</p>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Active projects", String(totalProjects), "Across your workspace", FolderKanban],
            ["Total epics", String(totalEpics), "Grouped feature areas", LayoutDashboard],
            ["Total stories", String(totalStories), "Across all projects", Sparkles],
            ["Approved", String(totalApproved), `${totalStories ? Math.round((totalApproved / totalStories) * 100) : 0}% of all stories`, CheckCircle2],
            ["Awaiting review", String(awaitingReview), "Need client attention", Clock3],
          ].map(([label, value, note, Icon]) => (
            <div key={String(label)} className="rounded-2xl border border-line bg-white p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <p className="text-sm text-neutral-500">{String(label)}</p>
                <Icon size={17} className="text-neutral-300" />
              </div>
              <p className="mt-4 text-3xl font-semibold tracking-tight">{String(value)}</p>
              <p className="mt-1 text-xs text-neutral-400">{String(note)}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="rounded-2xl border border-line bg-white shadow-soft">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <h3 className="font-semibold">Recent projects</h3>
                <p className="mt-0.5 text-xs text-neutral-400">Your latest requirement boards</p>
              </div>
              <Link href="/projects" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">View all</Link>
            </div>
            {loading ? (
              <div className="p-12 text-center text-sm text-neutral-400">Loading projects...</div>
            ) : error ? (
              <div className="p-12 text-center text-sm text-rose-600">{error}</div>
            ) : projects.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-sm font-medium text-neutral-900">Your workspace is empty</p>
                <p className="mt-1 text-sm text-neutral-500">Create your first project to start turning client requirements into feature stories.</p>
                <Link href="/projects" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800">
                  <Plus size={16} /> Create project
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-line">
                {projects.map((project) => (
                  <Link href={`/project/${project.id}`} key={project.id} className="group flex items-center gap-4 px-5 py-5 transition hover:bg-neutral-50">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-neutral-100 text-sm font-semibold text-neutral-600">
                      {project.name.slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="truncate text-sm font-medium">{project.name}</h4>
                      </div>
                      <p className="mt-1 text-xs text-neutral-400">{project.total || 0} stories · {project.approved || 0} approved</p>
                    </div>
                    <div className="hidden w-28 sm:block">
                      <div className="mb-1 flex justify-between text-[10px] text-neutral-400"><span>Progress</span><span>{project.total ? Math.round((project.approved / project.total) * 100) : 0}%</span></div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full bg-indigo-500" style={{width:`${project.total ? (project.approved / project.total) * 100 : 0}%`}} /></div>
                    </div>
                    <ArrowUpRight size={16} className="text-neutral-300 transition group-hover:text-neutral-700" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-neutral-950 p-6 text-white shadow-soft">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-indigo-300"><Sparkles size={17}/></div>
            <h3 className="mt-6 text-xl font-semibold tracking-tight">Start with one sentence.</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-400">Gemini turns a rough client request into a structured feature story with acceptance criteria and questions.</p>
            <Link href="/projects" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-neutral-950 hover:bg-neutral-100">
              Open StoryBoard <ArrowUpRight size={15}/>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

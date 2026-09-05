"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  ChevronDown,
  FolderKanban,
  LayoutDashboard,
  Plus,
  Settings,
  Sparkles,
  Users,
  CheckCircle2,
  Clock3,
  ArrowUpRight,
} from "lucide-react";

type Project = { id: string; name: string; description?: string; total: number; approved: number; created_at?: string };

function Sidebar() {
  const pathname = usePathname();
  const links = [
    { href: "/", label: "Overview", icon: LayoutDashboard },
    { href: "/projects", label: "Projects", icon: FolderKanban },
  ];
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-line bg-white lg:flex lg:flex-col">
      <div className="flex h-[72px] items-center border-b border-line px-5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-white shadow-sm">
          <span className="text-sm">◆</span>
        </div>
        <span className="ml-3 text-[17px] font-semibold tracking-tight">StoryBoard</span>
      </div>
      <div className="px-3 py-5">
        <button className="mb-5 flex w-full items-center justify-between rounded-xl border border-line bg-paper px-3 py-2.5 text-left transition hover:border-neutral-300">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-indigo-100 text-xs font-semibold text-indigo-700">S</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">Workspace</p>
              <p className="text-[11px] text-neutral-400">Personal</p>
            </div>
          </div>
          <ChevronDown size={15} className="text-neutral-400" />
        </button>
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Workspace</p>
        <nav className="space-y-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${active ? "bg-neutral-100 font-medium text-neutral-900" : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"}`}>
                <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
                {label}
              </Link>
            );
          })}
        </nav>
        <p className="mt-7 px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Manage</p>
        <nav className="space-y-1">
          <Link href="/clients" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900">
            <Users size={17} /> Clients
          </Link>
          <Link href="#" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900">
            <Settings size={17} /> Settings
          </Link>
        </nav>
      </div>
      <div className="mt-auto border-t border-line p-4">
        <div className="flex items-center gap-3 rounded-xl p-2">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-neutral-900 text-xs font-semibold text-white">SP</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">Freelancer</p>
            <p className="truncate text-xs text-neutral-400">Workspace</p>
          </div>
          <ChevronDown size={14} className="text-neutral-400" />
        </div>
      </div>
    </aside>
  );
}

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
        if (!cancelled) { setError("Failed to load projects"); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, []);

  const totalProjects = projects.length;
  const totalEpics = projects.reduce((sum, p) => sum + ((p as any).epics || 0), 0);
  const totalStories = projects.reduce((sum, p) => sum + (p.total || 0), 0);
  const totalApproved = projects.reduce((sum, p) => sum + (p.approved || 0), 0);
  const awaitingReview = projects.reduce((sum, p) => sum + Math.max((p.total || 0) - (p.approved || 0), 0), 0);

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-line bg-paper/90 px-6 backdrop-blur-xl lg:px-9">
          <div>
            <p className="text-xs text-neutral-400">Workspace</p>
            <h1 className="mt-0.5 text-lg font-semibold tracking-tight">Overview</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-white text-neutral-500 hover:text-neutral-900">
              <Bell size={17} />
            </button>
            <Link href="/projects" className="inline-flex items-center gap-2 rounded-xl bg-ink px-3.5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800">
              <Plus size={16} /> New project
            </Link>
          </div>
        </header>

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
    </div>
  );
}

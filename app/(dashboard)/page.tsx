import Link from "next/link";
import { redirect } from "next/navigation";
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
import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 1. Fetch user's projects
  const { data: projectsData, error } = await supabase
    .from("projects")
    .select("id,name,description,status,created_at,updated_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  const rawProjects = projectsData ?? [];
  const projectIds = rawProjects.map((p) => p.id);

  // 2. Fetch stories and epics in parallel
  const [{ data: storiesData }, { data: epicsData }] = await Promise.all([
    projectIds.length > 0
      ? supabase.from("stories").select("project_id,status").in("project_id", projectIds)
      : Promise.resolve({ data: [] as { project_id: string; status: string }[] }),
    projectIds.length > 0
      ? supabase.from("epics").select("project_id").in("project_id", projectIds)
      : Promise.resolve({ data: [] as { project_id: string }[] }),
  ]);

  // Aggregate project statistics
  const counts: Record<string, { total: number; approved: number; review: number; epics: number }> = {};
  for (const s of storiesData ?? []) {
    const c = counts[s.project_id] ?? { total: 0, approved: 0, review: 0, epics: 0 };
    c.total += 1;
    if (s.status === "approved") c.approved += 1;
    if (s.status === "review") c.review += 1;
    counts[s.project_id] = c;
  }
  for (const e of epicsData ?? []) {
    const c = counts[e.project_id] ?? { total: 0, approved: 0, review: 0, epics: 0 };
    c.epics += 1;
    counts[e.project_id] = c;
  }

  const projects = rawProjects.map((p) => ({
    ...p,
    ...(counts[p.id] ?? { total: 0, approved: 0, review: 0, epics: 0 }),
  }));

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

      <main className="mx-auto max-w-[1720px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-6">
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
                className="rounded-[18px] border border-[rgba(74,61,100,0.08)] bg-white/82 p-4 sm:p-5 shadow-[0_8px_30px_rgba(70,55,95,0.055)] backdrop-blur-[16px] flex flex-col justify-between transition hover:border-[rgba(74,61,100,0.15)]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9994A5]">
                    {stat.label}
                  </span>
                  <div className="grid h-7 w-7 place-items-center rounded-lg bg-[rgba(184,148,78,0.10)] text-[#B8944E]">
                    <Icon size={14} />
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold tracking-tight text-[#252331] truncate">
                    {stat.value}
                  </p>
                  <p className="text-[11px] text-[#706C7D] truncate mt-0.5">{stat.note}</p>
                </div>
              </div>
            );
          })}
        </section>

        {error && (
          <div className="rounded-xl border border-rose-200/80 bg-rose-50/80 p-4 text-xs sm:text-sm text-[#C25D72]">
            {error.message}
          </div>
        )}

        {/* Workspace Split Layout: Recent Projects on Left, AI Helper on Right */}
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] items-start">
          {/* Recent Projects Card */}
          <div className="rounded-[18px] border border-[rgba(74,61,100,0.08)] bg-white/82 shadow-[0_8px_30px_rgba(70,55,95,0.055)] backdrop-blur-[16px] overflow-hidden">
            <div className="flex items-center justify-between border-b border-[rgba(74,61,100,0.06)] px-5 py-4">
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-[#252331] tracking-tight">
                  Recent Projects
                </h3>
                <p className="text-xs text-[#706C7D]">Your active requirements workspaces</p>
              </div>
              <Link
                href="/projects"
                className="text-xs font-medium text-[#80642F] hover:text-[#9F7D3E] transition"
              >
                View all
              </Link>
            </div>

            {projects.length === 0 ? (
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
              <div className="divide-y divide-[rgba(74,61,100,0.06)]">
                {projects.slice(0, 5).map((project) => {
                  const progress = project.total
                    ? Math.round((project.approved / project.total) * 100)
                    : 0;

                  return (
                    <Link
                      href={`/project/${project.id}`}
                      key={project.id}
                      className="group flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-[#FAF9FC]/80"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#B8944E] text-xs font-semibold text-white">
                          {project.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-semibold text-[#252331] group-hover:text-[#80642F] transition truncate">
                            {project.name}
                          </h4>
                          <p className="text-xs text-[#706C7D] truncate mt-0.5">
                            {project.total || 0} stories · {project.approved || 0} approved
                          </p>
                        </div>
                      </div>

                      <div className="hidden sm:flex items-center gap-3 shrink-0">
                        <div className="w-24 text-right">
                          <div className="text-[11px] font-medium text-[#706C7D] mb-1">
                            {progress}%
                          </div>
                          <div className="h-1.5 w-full bg-[rgba(74,61,100,0.06)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#B8944E] rounded-full transition-all duration-300"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                        <ArrowRight
                          size={15}
                          className="text-[#9994A5] transition group-hover:text-[#80642F] group-hover:translate-x-0.5"
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* AI Story Generation Highlight */}
          <div 
            className="rounded-[18px] border border-[rgba(74,61,100,0.08)] p-6 shadow-[0_8px_30px_rgba(70,55,95,0.055)] backdrop-blur-[16px] space-y-4"
            style={{ background: "linear-gradient(135deg, rgba(233, 227, 244, 0.90), rgba(241, 221, 232, 0.78))" }}
          >
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/80 text-[#B8944E] shadow-xs">
                <Sparkles size={16} />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#80642F]">
                AI Requirements Breakdown
              </span>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base sm:text-lg font-semibold tracking-tight text-[#252331]">
                Turn rough requirements into structured stories.
              </h3>
              <p className="text-xs text-[#706C7D] leading-relaxed">
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

import { redirect } from "next/navigation";
import { CheckCircle2, CircleAlert, Clock3, ChevronDown } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedClient } from "@/lib/client-session";
import { ClientActions } from "@/components/ClientActions";
import { ClientSignOut } from "@/components/ClientSignOut";
import type { Story, Epic } from "@/lib/types";

export default async function ClientPortal() {
  const client = await getAuthenticatedClient(); 
  if (!client) redirect("/login");
  
  const db = createAdminClient();
  const { data: project } = await db.from("projects").select("name").eq("id", client.project_id).single();
  const { data: stories } = await db.from("stories").select("id,epic_id,title,description,acceptance_criteria,assumptions,clarifications,status,updated_at").eq("project_id", client.project_id).order("created_at");
  const { data: epicsData } = await db.from("epics").select("*").eq("project_id", client.project_id).order("sort_order", { ascending: true }).order("created_at", { ascending: true });
  
  const all = (stories ?? []) as Story[];
  const epics = (epicsData ?? []) as Epic[];
  const approved = all.filter(s => s.status === "approved").length;
  const clientWithProject = { ...client, projects: project };

  return (
    <main className="min-h-screen bg-paper pb-20">
      <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-5xl items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-white">◆</div>
            <div>
              <p className="text-xs text-neutral-400">CLIENT PORTAL</p>
              <p className="font-semibold">{clientWithProject.name}</p>
            </div>
          </div>
          <ClientSignOut />
        </div>
      </header>
      
      <div className="mx-auto max-w-5xl px-5 py-9 lg:px-8">
        <div className="mb-10">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">PROJECT</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{(clientWithProject.projects as { name?: string } | null)?.name ?? "Project"}</h1>
          <p className="mt-2 text-sm text-neutral-500">Requirements Review</p>
          
          <div className="mt-5 max-w-xl">
            <div className="mb-2 flex justify-between text-xs font-medium text-neutral-500">
              <span>{approved} / {all.length} stories approved</span>
              <span>{all.length ? Math.round((approved / all.length) * 100) : 0}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-neutral-200">
              <div className="h-full rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${all.length ? (approved / all.length) * 100 : 0}%` }} />
            </div>
          </div>
        </div>

        {epics.length === 0 && all.filter(s => s.epic_id === null).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 p-12 text-center bg-white">
            <p className="text-sm font-medium text-neutral-900">No requirements available</p>
            <p className="mt-1 text-sm text-neutral-500">The developer has not shared any feature stories yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {epics.map(epic => {
              const epicStories = all.filter(s => s.epic_id === epic.id);
              return <EpicBlock key={epic.id} epic={epic} stories={epicStories} />;
            })}

            {/* Uncategorized stories */}
            {all.filter(s => s.epic_id === null).length > 0 && (
               <EpicBlock 
                 key="uncategorized" 
                 epic={{ id: "uncategorized", name: "Uncategorized", project_id: client.project_id } as Epic} 
                 stories={all.filter(s => s.epic_id === null)} 
               />
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function EpicBlock({ epic, stories }: { epic: Epic, stories: Story[] }) {
  const approvedCount = stories.filter(s => s.status === "approved").length;
  const progressPercent = stories.length ? Math.round((approvedCount / stories.length) * 100) : 0;

  return (
    <details className="group rounded-2xl border border-line bg-white shadow-sm overflow-hidden" open>
      <summary className="flex cursor-pointer items-center justify-between bg-neutral-50/50 p-5 outline-none [&::-webkit-details-marker]:hidden select-none hover:bg-neutral-50 transition-colors">
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-neutral-900">{epic.name}</h2>
          <div className="mt-2 flex items-center gap-4">
            <p className="text-sm text-neutral-500">{stories.length} stories · {approvedCount} approved</p>
            {stories.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-neutral-200 hidden sm:block">
                  <div className="h-full rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                </div>
                <span className="text-xs font-medium text-neutral-500 hidden sm:inline-block">{progressPercent}%</span>
              </div>
            )}
          </div>
        </div>
        <ChevronDown className="text-neutral-400 transition-transform group-open:rotate-180 flex-shrink-0 ml-4" />
      </summary>
      <div className="border-t border-line p-5 flex flex-col gap-4 bg-neutral-50/30">
        {stories.length === 0 ? (
          <p className="text-sm text-neutral-500 py-2">No stories in this Epic yet.</p>
        ) : (
          stories.map(story => (
            <StoryArticle key={story.id} story={story} />
          ))
        )}
      </div>
    </details>
  );
}

function StoryArticle({ story }: { story: Story }) {
  return (
    <details className="group/story rounded-xl border border-line bg-white shadow-sm overflow-hidden transition-all">
      <summary className="flex cursor-pointer items-center justify-between p-5 outline-none [&::-webkit-details-marker]:hidden hover:bg-neutral-50 transition-colors select-none">
        <div className="flex-1 pr-4">
          <h3 className="text-base font-medium text-neutral-900 group-open/story:text-indigo-600 transition-colors">{story.title}</h3>
          <div className="mt-2 text-xs text-neutral-500">
            {story.acceptance_criteria?.length ?? 0} acceptance criteria
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Status status={story.status} />
          <ChevronDown className="text-neutral-400 transition-transform group-open/story:rotate-180" size={18} />
        </div>
      </summary>
      <div className="border-t border-line p-5 bg-white">
        {story.description && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-neutral-900 mb-2">Description</h4>
            <p className="text-sm leading-6 text-neutral-600 whitespace-pre-wrap">{story.description}</p>
          </div>
        )}
        
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-neutral-900 mb-2">Acceptance Criteria</h4>
          {story.acceptance_criteria && story.acceptance_criteria.length > 0 ? (
            <ul className="space-y-1 text-sm text-neutral-600">
              {story.acceptance_criteria.map((c, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-indigo-500 shrink-0 mt-0.5">✓</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500 italic">None specified</p>
          )}
        </div>

        {story.assumptions && story.assumptions.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-neutral-900 mb-2">Assumptions</h4>
            <ul className="list-disc pl-5 space-y-1 text-sm text-neutral-600">
              {story.assumptions.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </div>
        )}

        {story.clarifications && story.clarifications.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-neutral-900 mb-2">Clarifications</h4>
            <ul className="list-disc pl-5 space-y-1 text-sm text-neutral-600">
              {story.clarifications.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        )}

        <div className="pt-2">
          <ClientActions storyId={story.id} status={story.status} />
        </div>
      </div>
    </details>
  );
}

function Status({ status }: { status: string }) {
  if (status === "approved") return <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 whitespace-nowrap"><CheckCircle2 size={12} /> Approved</span>;
  if (status === "changes_requested") return <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700 whitespace-nowrap"><CircleAlert size={12} /> Changes requested</span>;
  if (status === "draft") return <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-700 whitespace-nowrap">Draft</span>;
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 whitespace-nowrap"><Clock3 size={12} /> Awaiting review</span>;
}

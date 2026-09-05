import { redirect } from "next/navigation";
import { CheckCircle2, CircleAlert, Clock3, ChevronDown } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedClient } from "@/lib/client-session";
import { ClientActions } from "@/components/ClientActions";
import { ClientSignOut } from "@/components/ClientSignOut";
import type { Story, Epic } from "@/lib/types";

export default async function ClientPortal() {
  const client = await getAuthenticatedClient(); 
  if (!client) redirect("/client/login");
  
  const db = createAdminClient();
  const { data: project } = await db.from("projects").select("name").eq("id", client.project_id).single();
  const { data: stories } = await db.from("stories").select("id,epic_id,title,description,acceptance_criteria,assumptions,clarifications,status,updated_at").eq("project_id", client.project_id).order("created_at");
  const { data: epicsData } = await db.from("epics").select("*").eq("project_id", client.project_id).order("sort_order", { ascending: true }).order("created_at", { ascending: true });
  
  const all = (stories ?? []) as Story[];
  const epics = (epicsData ?? []) as Epic[];
  const approved = all.filter(s => s.status === "approved").length;
  const clientWithProject = { ...client, projects: project };

  return (
    <main className="min-h-screen bg-paper">
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
              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${all.length ? (approved / all.length) * 100 : 0}%` }} />
            </div>
          </div>
        </div>

        {epics.length === 0 && all.length === 0 && (
          <div className="rounded-2xl border border-dashed border-neutral-300 p-12 text-center bg-white">
            <p className="text-sm font-medium text-neutral-900">No stories available</p>
            <p className="mt-1 text-sm text-neutral-500">The developer has not shared any feature stories yet.</p>
          </div>
        )}

        <div className="space-y-6">
          {epics.map(epic => {
            const epicStories = all.filter(s => s.epic_id === epic.id);
            if (epicStories.length === 0) return null;
            
            return (
              <details key={epic.id} className="group rounded-2xl border border-line bg-white shadow-sm overflow-hidden" open>
                <summary className="flex cursor-pointer items-center justify-between bg-neutral-50/50 p-5 outline-none [&::-webkit-details-marker]:hidden">
                  <div>
                    <h2 className="text-xl font-semibold text-neutral-900">{epic.name}</h2>
                    <p className="text-sm text-neutral-500 mt-1">{epicStories.length} stories</p>
                  </div>
                  <ChevronDown className="text-neutral-400 transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t border-line p-5 flex flex-col gap-5 bg-neutral-50/30">
                  {epicStories.map(story => (
                    <StoryArticle key={story.id} story={story} />
                  ))}
                </div>
              </details>
            );
          })}

          {/* Uncategorized stories */}
          {all.filter(s => s.epic_id === null).length > 0 && (
             <details className="group rounded-2xl border border-line bg-white shadow-sm overflow-hidden" open>
               <summary className="flex cursor-pointer items-center justify-between bg-neutral-50/50 p-5 outline-none [&::-webkit-details-marker]:hidden">
                 <div>
                   <h2 className="text-xl font-semibold text-neutral-900">Uncategorized</h2>
                   <p className="text-sm text-neutral-500 mt-1">{all.filter(s => s.epic_id === null).length} stories</p>
                 </div>
                 <ChevronDown className="text-neutral-400 transition-transform group-open:rotate-180" />
               </summary>
               <div className="border-t border-line p-5 flex flex-col gap-5 bg-neutral-50/30">
                 {all.filter(s => s.epic_id === null).map(story => (
                   <StoryArticle key={story.id} story={story} />
                 ))}
               </div>
             </details>
          )}
        </div>
      </div>
    </main>
  );
}

function StoryArticle({ story }: { story: Story }) {
  return (
    <article className="rounded-xl border border-line bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs text-neutral-400">
            <span>FEATURE</span><span>•</span><span>{story.acceptance_criteria?.length ?? 0} criteria</span>
          </div>
          <h3 className="text-lg font-semibold">{story.title}</h3>
        </div>
        <Status status={story.status} />
      </div>
      <p className="mt-4 text-sm leading-7 text-neutral-600">{story.description}</p>
      <div className="mt-6">
        <h4 className="text-sm font-semibold">Acceptance criteria</h4>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-600">
          {(story.acceptance_criteria ?? []).map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      </div>
      <div className="mt-6 border-t border-line pt-6">
        <ClientActions storyId={story.id} status={story.status} />
      </div>
    </article>
  );
}

function Status({ status }: { status: string }) {
  if (status === "approved") return <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700"><CheckCircle2 size={14} /> Approved</span>;
  if (status === "changes_requested") return <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700"><CircleAlert size={14} /> Changes requested</span>;
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700"><Clock3 size={14} /> Review</span>;
}

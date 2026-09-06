import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({ name: z.string().min(1).max(200), description: z.string().max(5000).optional().default("") });

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id,name,description,status,created_at,updated_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: stories } = await supabase.from("stories").select("project_id,status").in("project_id", (projects ?? []).map(p => p.id));
  const { data: epics } = await supabase.from("epics").select("project_id").in("project_id", (projects ?? []).map(p => p.id));

  const counts: Record<string, { total: number; approved: number; review: number; epics: number }> = {};
  for (const s of stories ?? []) {
    const c = counts[s.project_id] ?? { total: 0, approved: 0, review: 0, epics: 0 };
    c.total += 1;
    if (s.status === "approved") c.approved += 1;
    if (s.status === "review") c.review += 1;
    counts[s.project_id] = c;
  }
  for (const e of epics ?? []) {
    const c = counts[e.project_id] ?? { total: 0, approved: 0, review: 0, epics: 0 };
    c.epics += 1;
    counts[e.project_id] = c;
  }

  return NextResponse.json({ projects: (projects ?? []).map(p => ({ ...p, ...(counts[p.id] ?? { total: 0, approved: 0, review: 0, epics: 0 }) })) });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = schema.parse(await req.json());
  const { data: project, error } = await supabase.from("projects").insert({ owner_id: user.id, name: body.name, description: body.description }).select("id,name,description,status,created_at,updated_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ project: { ...project, total: 0, approved: 0, review: 0 } }, { status: 201 });
}

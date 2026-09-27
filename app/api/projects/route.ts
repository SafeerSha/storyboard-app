import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional().default(""),
  owner_id: z.string().uuid().optional(),
});

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("freelancer_profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();

  const isSuperAdmin = profile?.role === "super_admin";

  let query = adminClient
    .from("projects")
    .select("id,name,description,status,created_at,updated_at,owner_id")
    .order("created_at", { ascending: false });

  if (!isSuperAdmin) {
    query = query.eq("owner_id", user.id);
  }

  const { data: projects, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const projectList = projects ?? [];
  const projectIds = projectList.map((p) => p.id);

  // Fetch freelancers for owner reference
  const { data: freelancersData } = await adminClient
    .from("freelancer_profiles")
    .select("id, name, email, role")
    .eq("status", "active")
    .order("name", { ascending: true });

  const freelancerMap = new Map((freelancersData || []).map((f) => [f.id, f]));

  const [{ data: stories }, { data: epics }] = await Promise.all([
    projectIds.length > 0
      ? adminClient.from("stories").select("project_id,status").in("project_id", projectIds)
      : Promise.resolve({ data: [] }),
    projectIds.length > 0
      ? adminClient.from("epics").select("project_id").in("project_id", projectIds)
      : Promise.resolve({ data: [] }),
  ]);

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

  return NextResponse.json({
    projects: (projects ?? []).map((p) => ({
      ...p,
      ...(counts[p.id] ?? { total: 0, approved: 0, review: 0, epics: 0 }),
      owner: freelancerMap.get(p.owner_id) || null,
    })),
    isSuperAdmin,
    freelancers: freelancersData || [],
  });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("freelancer_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isSuperAdmin = profile?.role === "super_admin";
  const body = schema.parse(await req.json());

  const targetOwnerId = (isSuperAdmin && body.owner_id) ? body.owner_id : user.id;

  const { data: project, error } = await adminClient
    .from("projects")
    .insert({ owner_id: targetOwnerId, name: body.name, description: body.description })
    .select("id,name,description,status,created_at,updated_at,owner_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ project: { ...project, total: 0, approved: 0, review: 0 } }, { status: 201 });
}

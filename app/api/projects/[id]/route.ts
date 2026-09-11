import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const patchSchema = z.object({ name: z.string().min(1).max(200).optional(), description: z.string().max(5000).optional(), status: z.enum(["active", "completed", "archived"]).optional() });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project, error } = await supabase.from("projects").select("id,name,description,status,created_at,updated_at").eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (error || !project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const { data: stories } = await supabase.from("stories").select("status").eq("project_id", project.id);
  const total = (stories ?? []).length;
  const approved = (stories ?? []).filter(s => s.status === "approved").length;

  return NextResponse.json({ project: { ...project, total, approved } });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = patchSchema.parse(await req.json());
  const { data: project, error } = await supabase.from("projects").update(body).eq("id", id).eq("owner_id", user.id).select("id,name,description,status,created_at,updated_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  return NextResponse.json({ project });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify ownership
  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  // Pre-flight checks — give friendly errors before hitting FK constraints
  const [{ count: epicCount }, { count: storyCount }, { count: clientCount }, { count: teamCount }] =
    await Promise.all([
      supabase.from("epics").select("id", { count: "exact", head: true }).eq("project_id", id),
      supabase.from("stories").select("id", { count: "exact", head: true }).eq("project_id", id),
      supabase.from("clients").select("id", { count: "exact", head: true }).eq("project_id", id),
      supabase.from("project_team_members").select("id", { count: "exact", head: true }).eq("project_id", id),
    ]);

  if ((epicCount ?? 0) > 0) {
    return NextResponse.json(
      { error: "Please remove all epics from this project before deleting it." },
      { status: 409 }
    );
  }
  if ((storyCount ?? 0) > 0) {
    return NextResponse.json(
      { error: "Please remove all stories from this project before deleting it." },
      { status: 409 }
    );
  }
  if ((clientCount ?? 0) > 0) {
    return NextResponse.json(
      { error: "Please remove all clients from this project before deleting it." },
      { status: 409 }
    );
  }
  if ((teamCount ?? 0) > 0) {
    return NextResponse.json(
      { error: "Please unassign all team members from this project before deleting it." },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("projects").delete().eq("id", id).eq("owner_id", user.id);
  if (error) return NextResponse.json({ error: "Failed to delete project. Make sure it has no linked data." }, { status: 400 });

  return NextResponse.json({ ok: true });
}

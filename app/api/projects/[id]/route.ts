import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const patchSchema = z.object({ name: z.string().min(1).max(200).optional(), description: z.string().max(5000).optional() });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project, error } = await supabase.from("projects").select("id,name,description,created_at,updated_at").eq("id", id).eq("owner_id", user.id).maybeSingle();
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
  const { data: project, error } = await supabase.from("projects").update(body).eq("id", id).eq("owner_id", user.id).select("id,name,description,created_at,updated_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  return NextResponse.json({ project });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase.from("projects").delete().eq("id", id).eq("owner_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

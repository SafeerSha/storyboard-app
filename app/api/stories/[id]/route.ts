import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const patchSchema = z.object({
  epic_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  acceptance_criteria: z.array(z.string()).optional(),
  assumptions: z.array(z.string()).optional(),
  clarifications: z.array(z.string()).optional(),
  raw_requirement: z.string().max(10000).optional(),
  status: z.enum(["draft", "review", "changes_requested", "approved", "in_development", "completed"]).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = patchSchema.parse(await req.json());
  const { data: story } = await supabase.from("stories").select("project_id").eq("id", id).maybeSingle();
  if (!story) return NextResponse.json({ error: "Story not found." }, { status: 404 });

  const { data: project } = await supabase.from("projects").select("id").eq("id", story.project_id).eq("owner_id", user.id).maybeSingle();
  if (!project) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  if (body.epic_id) {
    const { data: epic } = await supabase.from("epics").select("project_id").eq("id", body.epic_id).maybeSingle();
    if (!epic || epic.project_id !== story.project_id) {
      return NextResponse.json({ error: "Epic does not belong to this project." }, { status: 400 });
    }
  }

  const { data: updated, error } = await supabase.from("stories").update(body).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ story: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: story } = await supabase.from("stories").select("project_id").eq("id", id).maybeSingle();
  if (!story) return NextResponse.json({ error: "Story not found." }, { status: 404 });

  const { data: project } = await supabase.from("projects").select("id").eq("id", story.project_id).eq("owner_id", user.id).maybeSingle();
  if (!project) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const { error } = await supabase.from("stories").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

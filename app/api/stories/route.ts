import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({
  project_id: z.string().uuid(),
  epic_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(500),
  description: z.string().max(10000).default(""),
  acceptance_criteria: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  clarifications: z.array(z.string()).default([]),
  raw_requirement: z.string().max(10000).optional().default(""),
  status: z.enum(["draft", "review", "changes_requested", "approved", "in_development", "completed"]).default("draft"),
});

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId is required." }, { status: 400 });

  const { data: project, error: projectError } = await supabase.from("projects").select("id").eq("id", projectId).eq("owner_id", user.id).maybeSingle();
  if (projectError || !project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const { data: stories, error } = await supabase.from("stories").select("*").eq("project_id", projectId).order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ stories: stories ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = schema.parse(await req.json());
  const { data: project, error: projectError } = await supabase.from("projects").select("id").eq("id", body.project_id).eq("owner_id", user.id).maybeSingle();
  if (projectError || !project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  if (body.epic_id) {
    const { data: epic } = await supabase.from("epics").select("project_id").eq("id", body.epic_id).maybeSingle();
    if (!epic || epic.project_id !== body.project_id) {
      return NextResponse.json({ error: "Epic does not belong to this project." }, { status: 400 });
    }
  }

  const { data: story, error } = await supabase.from("stories").insert({
    project_id: body.project_id,
    epic_id: body.epic_id || null,
    title: body.title,
    description: body.description,
    acceptance_criteria: body.acceptance_criteria,
    assumptions: body.assumptions,
    clarifications: body.clarifications,
    raw_requirement: body.raw_requirement,
    status: body.status,
  }).select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ story }, { status: 201 });
}

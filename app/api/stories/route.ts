import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedTeamUser } from "@/lib/team-session";
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
  status: z
    .enum(["draft", "review", "changes_requested", "approved", "in_development", "completed"])
    .default("draft"),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const requestedProjectId = url.searchParams.get("projectId");
  if (!requestedProjectId) return NextResponse.json({ error: "projectId is required." }, { status: 400 });

  const admin = createAdminClient();
  let isAuthorized = false;

  // 1. Team User authorization
  const teamUser = await getAuthenticatedTeamUser();
  if (teamUser) {
    if (teamUser.project_id === requestedProjectId) {
      isAuthorized = true;
    } else {
      return NextResponse.json({ error: "Forbidden. Access to this project is not allowed." }, { status: 403 });
    }
  }

  // 2. Freelancer / Super Admin authorization
  if (!isAuthorized) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await admin
        .from("freelancer_profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.role === "super_admin") {
        isAuthorized = true;
      } else {
        const { data: project } = await admin
          .from("projects")
          .select("id")
          .eq("id", requestedProjectId)
          .eq("owner_id", user.id)
          .maybeSingle();

        if (project) isAuthorized = true;
      }
    }
  }

  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: stories, error } = await admin
    .from("stories")
    .select("*")
    .eq("project_id", requestedProjectId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ stories: stories ?? [] });
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.json();
    const body = schema.parse(rawBody);
    const admin = createAdminClient();
    let isAuthorized = false;

    // 1. Team User authorization
    const teamUser = await getAuthenticatedTeamUser();
    if (teamUser) {
      // Force project_id to assigned project
      body.project_id = teamUser.project_id;
      isAuthorized = true;
    }

    // 2. Freelancer / Super Admin authorization
    if (!isAuthorized) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await admin
          .from("freelancer_profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.role === "super_admin") {
          isAuthorized = true;
        } else {
          const { data: project } = await admin
            .from("projects")
            .select("id")
            .eq("id", body.project_id)
            .eq("owner_id", user.id)
            .maybeSingle();

          if (project) isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized or access denied." }, { status: 403 });
    }

    if (body.epic_id) {
      const { data: epic } = await admin
        .from("epics")
        .select("project_id")
        .eq("id", body.epic_id)
        .maybeSingle();
      if (!epic || epic.project_id !== body.project_id) {
        return NextResponse.json({ error: "Epic does not belong to this project." }, { status: 400 });
      }
    }

    const { data: story, error } = await admin
      .from("stories")
      .insert({
        project_id: body.project_id,
        epic_id: body.epic_id || null,
        title: body.title,
        description: body.description,
        acceptance_criteria: body.acceptance_criteria,
        assumptions: body.assumptions,
        clarifications: body.clarifications,
        raw_requirement: body.raw_requirement,
        status: body.status,
      })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ story }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create story." }, { status: 400 });
  }
}

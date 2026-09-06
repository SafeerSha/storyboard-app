import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedTeamUser } from "@/lib/team-session";

const patchSchema = z.object({
  epic_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  acceptance_criteria: z.array(z.string()).optional(),
  assumptions: z.array(z.string()).optional(),
  clarifications: z.array(z.string()).optional(),
  raw_requirement: z.string().max(10000).optional(),
  status: z
    .enum(["draft", "review", "changes_requested", "approved", "in_development", "completed"])
    .optional(),
  team_review_status: z.enum(["pending", "approved", "changes_requested"]).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = patchSchema.parse(await req.json());
    const admin = createAdminClient();

    const { data: story } = await admin
      .from("stories")
      .select("*, project_id")
      .eq("id", id)
      .maybeSingle();

    if (!story) return NextResponse.json({ error: "Story not found." }, { status: 404 });

    let isAuthorized = false;
    let actorId = "system";

    // 1. Team User check
    const teamUser = await getAuthenticatedTeamUser();
    if (teamUser) {
      if (teamUser.project_id === story.project_id) {
        isAuthorized = true;
        actorId = teamUser.id;
      } else {
        return NextResponse.json({ error: "Forbidden. Access to this story is denied." }, { status: 403 });
      }
    }

    // 2. Freelancer / Super Admin check
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
          actorId = user.id;
        } else {
          const { data: project } = await admin
            .from("projects")
            .select("id")
            .eq("id", story.project_id)
            .eq("owner_id", user.id)
            .maybeSingle();

          if (project) {
            isAuthorized = true;
            actorId = user.id;
          }
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    // If changing epic, verify epic belongs to this story's project
    if (body.epic_id) {
      const { data: epic } = await admin
        .from("epics")
        .select("project_id")
        .eq("id", body.epic_id)
        .maybeSingle();
      if (!epic || epic.project_id !== story.project_id) {
        return NextResponse.json({ error: "Epic does not belong to this project." }, { status: 400 });
      }
    }

    // Check if content is materially changed
    const materialFields = ["title", "description", "acceptance_criteria", "assumptions", "clarifications"];
    let isMaterialChange = false;
    for (const field of materialFields) {
      if (body[field as keyof typeof body] !== undefined) {
        const oldVal = JSON.stringify(story[field as keyof typeof story]);
        const newVal = JSON.stringify(body[field as keyof typeof body]);
        if (oldVal !== newVal) {
          isMaterialChange = true;
          break;
        }
      }
    }

    const updateData: any = { ...body, updated_at: new Date().toISOString() };

    // If approved and materially changed, reset status to review
    if (story.status === "approved" && isMaterialChange && !body.status) {
      updateData.status = "review";
    }

    // Record revision
    if (isMaterialChange) {
      const { count } = await admin
        .from("story_revisions")
        .select("id", { count: "exact", head: true })
        .eq("story_id", id);
      const revision_number = (count || 0) + 1;

      await admin.from("story_revisions").insert({
        story_id: id,
        revision_number,
        title: story.title,
        description: story.description,
        epic_id: story.epic_id,
        acceptance_criteria: story.acceptance_criteria,
        assumptions: story.assumptions,
        clarifications: story.clarifications,
        status: story.status,
        created_by: actorId.includes("-") ? actorId : null,
      });
    }

    const { data: updated, error } = await admin
      .from("stories")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ story: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update story." }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: story } = await admin.from("stories").select("project_id").eq("id", id).maybeSingle();
  if (!story) return NextResponse.json({ error: "Story not found." }, { status: 404 });

  const { data: profile } = await admin
    .from("freelancer_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isSuperAdmin = profile?.role === "super_admin";
  if (!isSuperAdmin) {
    const { data: project } = await admin
      .from("projects")
      .select("id, owner_id")
      .eq("id", story.project_id)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!project) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { error } = await admin.from("stories").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

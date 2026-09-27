import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAnyFreelancer } from "@/lib/super-admin";
import { z } from "zod";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  status: z.enum(["active", "completed", "archived"]).optional(),
  owner_id: z.string().uuid().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await verifyAnyFreelancer();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminClient = createAdminClient();
  let query = adminClient
    .from("projects")
    .select("id,name,description,status,created_at,updated_at,owner_id")
    .eq("id", id);

  if (!actor.isSuperAdmin) {
    query = query.eq("owner_id", actor.id);
  }

  const { data: project, error } = await query.maybeSingle();
  if (error || !project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const { data: stories } = await adminClient.from("stories").select("status").eq("project_id", project.id);
  const total = (stories ?? []).length;
  const approved = (stories ?? []).filter((s) => s.status === "approved").length;

  return NextResponse.json({ project: { ...project, total, approved } });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await verifyAnyFreelancer();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = patchSchema.parse(await req.json());
  const adminClient = createAdminClient();

  // Verify access
  let checkQuery = adminClient.from("projects").select("id, owner_id").eq("id", id);
  if (!actor.isSuperAdmin) {
    checkQuery = checkQuery.eq("owner_id", actor.id);
  }
  const { data: existing } = await checkQuery.maybeSingle();
  if (!existing) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  // Only super admin can reassign owner_id
  const updatePayload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };
  if (body.name !== undefined) updatePayload.name = body.name;
  if (body.description !== undefined) updatePayload.description = body.description;
  if (body.status !== undefined) updatePayload.status = body.status;
  if (actor.isSuperAdmin && body.owner_id !== undefined) {
    updatePayload.owner_id = body.owner_id;
  }

  const { data: project, error } = await adminClient
    .from("projects")
    .update(updatePayload)
    .eq("id", id)
    .select("id,name,description,status,created_at,updated_at,owner_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ project });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await verifyAnyFreelancer();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminClient = createAdminClient();

  // Verify ownership or super admin
  let checkQuery = adminClient.from("projects").select("id, name").eq("id", id);
  if (!actor.isSuperAdmin) {
    checkQuery = checkQuery.eq("owner_id", actor.id);
  }
  const { data: project } = await checkQuery.maybeSingle();
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  // Pre-flight checks — give friendly errors before hitting FK constraints
  const [{ count: epicCount }, { count: storyCount }, { count: clientCount }, { count: teamCount }] =
    await Promise.all([
      adminClient.from("epics").select("id", { count: "exact", head: true }).eq("project_id", id),
      adminClient.from("stories").select("id", { count: "exact", head: true }).eq("project_id", id),
      adminClient.from("clients").select("id", { count: "exact", head: true }).eq("project_id", id),
      adminClient.from("project_team_members").select("id", { count: "exact", head: true }).eq("project_id", id),
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

  const { error } = await adminClient.from("projects").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Failed to delete project. Make sure it has no linked data." }, { status: 400 });

  return NextResponse.json({ ok: true });
}

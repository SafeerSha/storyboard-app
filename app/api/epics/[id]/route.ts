import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id: epicId } = await params;
    const body = await req.json();
    
    const admin = createAdminClient();
    
    // Validate ownership
    const { data: epic } = await admin.from("epics").select("project_id, projects(owner_id)").eq("id", epicId).single();
    if (!epic || Array.isArray(epic.projects) ? epic.projects[0].owner_id !== user.id : (epic.projects as any)?.owner_id !== user.id) {
      return NextResponse.json({ error: "Epic not found or access denied." }, { status: 404 });
    }

    const updateData: any = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) updateData.name = String(body.name).trim();
    if (body.description !== undefined) updateData.description = String(body.description).trim();
    if (body.status !== undefined) updateData.status = String(body.status).trim();
    if (body.sortOrder !== undefined) updateData.sort_order = Number(body.sortOrder);

    const { data: updatedEpic, error } = await admin.from("epics").update(updateData).eq("id", epicId).select().single();
    if (error) throw error;

    return NextResponse.json(updatedEpic);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update Epic." }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id: epicId } = await params;
    const admin = createAdminClient();
    
    // Validate ownership
    const { data: epic } = await admin.from("epics").select("project_id, projects(owner_id)").eq("id", epicId).single();
    if (!epic || Array.isArray(epic.projects) ? epic.projects[0].owner_id !== user.id : (epic.projects as any)?.owner_id !== user.id) {
      return NextResponse.json({ error: "Epic not found or access denied." }, { status: 404 });
    }

    // Deletion safeguard is primarily handled on the client UI, but we can also enforce it here
    const { count } = await admin.from("stories").select("id", { count: "exact", head: true }).eq("epic_id", epicId);
    if (count && count > 0) {
      return NextResponse.json({ error: "Cannot delete an Epic that contains stories. Move or remove its stories first." }, { status: 400 });
    }

    const { error } = await admin.from("epics").delete().eq("id", epicId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete Epic." }, { status: 500 });
  }
}

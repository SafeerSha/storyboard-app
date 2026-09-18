import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeProjectMember } from "@/lib/project-auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const { id: projectId, noteId } = await params;
    const auth = await authorizeProjectMember(projectId);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data: note, error } = await admin
      .from("project_notes")
      .select("*")
      .eq("id", noteId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });

    return NextResponse.json({ note });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch note" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const { id: projectId, noteId } = await params;
    const auth = await authorizeProjectMember(projectId);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (body.title !== undefined) updates.title = String(body.title).trim() || "Untitled Note";
    if (body.content !== undefined) updates.content = String(body.content);
    if (body.tags !== undefined && Array.isArray(body.tags)) updates.tags = body.tags;
    if (body.status !== undefined && ["active", "converted", "archived"].includes(body.status)) {
      updates.status = body.status;
    }

    const admin = createAdminClient();
    const { data: note, error } = await admin
      .from("project_notes")
      .update(updates)
      .eq("id", noteId)
      .eq("project_id", projectId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ note });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update note" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const { id: projectId, noteId } = await params;
    const auth = await authorizeProjectMember(projectId);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 403 });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("project_notes")
      .delete()
      .eq("id", noteId)
      .eq("project_id", projectId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete note" }, { status: 500 });
  }
}

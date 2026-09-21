import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeProjectMember } from "@/lib/project-auth";
import { isR2Configured, deleteFolderFromR2 } from "@/lib/r2";
import fs from "fs/promises";
import path from "path";

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
    if (body.images !== undefined && Array.isArray(body.images)) updates.images = body.images;
    if (body.status !== undefined && ["active", "converted", "archived"].includes(body.status)) {
      updates.status = body.status;
    }

    const admin = createAdminClient();
    let { data: note, error } = await admin
      .from("project_notes")
      .update(updates)
      .eq("id", noteId)
      .eq("project_id", projectId)
      .select()
      .single();

    // If images column does not exist yet in Supabase schema, retry without it
    if (error && error.message?.includes("images")) {
      const fallbackUpdates = { ...updates };
      delete fallbackUpdates.images;
      const retryResult = await admin
        .from("project_notes")
        .update(fallbackUpdates)
        .eq("id", noteId)
        .eq("project_id", projectId)
        .select()
        .single();
      note = retryResult.data;
      error = retryResult.error;
      if (note) {
        note.images = body.images;
      }
    }

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

    // 1. Purge all images from Cloudflare R2 under this note's folder
    if (isR2Configured()) {
      try {
        const noteFolderPrefix = `Project-Notes/${projectId}/${noteId}/`;
        await deleteFolderFromR2(noteFolderPrefix);
      } catch (r2Err: any) {
        console.warn("Failed to purge note images from Cloudflare R2:", r2Err?.message);
      }
    }

    // 2. Clean up any local fallback files
    try {
      const localDir = path.join(process.cwd(), "public", "uploads", "notes", projectId, noteId);
      await fs.rm(localDir, { recursive: true, force: true });
    } catch {
      // Ignore if not present
    }

    // 3. Delete the note from the database
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

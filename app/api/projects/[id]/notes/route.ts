import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeProjectMember } from "@/lib/project-auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const auth = await authorizeProjectMember(projectId);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 403 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("search");
    const epicId = url.searchParams.get("epic_id");

    const admin = createAdminClient();
    let query = admin
      .from("project_notes")
      .select("*")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (epicId) {
      if (epicId === "null" || epicId === "none") {
        query = query.is("epic_id", null);
      } else {
        query = query.eq("epic_id", epicId);
      }
    }

    if (search && search.trim()) {
      const s = search.trim();
      query = query.or(`title.ilike.%${s}%,content.ilike.%${s}%`);
    }

    const { data: notes, error } = await query;
    if (error) {
      // If table does not exist or schema issue, return empty array gracefully
      console.warn("Error fetching project_notes:", error.message);
      return NextResponse.json({ notes: [] });
    }

    return NextResponse.json({ notes: notes || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch notes" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const auth = await authorizeProjectMember(projectId);
    if (!auth.authorized || !auth.actor) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 403 });
    }
    const actor = auth.actor;

    const body = await req.json();
    const title = String(body.title || "Untitled Discussion Note").trim();
    const content = String(body.content || "");
    const tags = Array.isArray(body.tags) ? body.tags.map(String) : [];

    const admin = createAdminClient();
    const insertPayload: Record<string, any> = {
      project_id: projectId,
      epic_id: body.epic_id || null,
      title: title || "Untitled Discussion Note",
      content,
      tags,
      images: Array.isArray(body.images) ? body.images : [],
      status: "active",
      is_client_visible: Boolean(body.is_client_visible),
      created_by_id: actor.id,
      created_by_name: actor.name,
    };

    let { data: note, error } = await admin
      .from("project_notes")
      .insert(insertPayload)
      .select()
      .single();

    if (error && (error.message?.includes("images") || error.message?.includes("is_client_visible") || error.message?.includes("epic_id"))) {
      if (error.message?.includes("images")) delete insertPayload.images;
      if (error.message?.includes("is_client_visible")) delete insertPayload.is_client_visible;
      if (error.message?.includes("epic_id")) delete insertPayload.epic_id;
      const retry = await admin
        .from("project_notes")
        .insert(insertPayload)
        .select()
        .single();
      note = retry.data;
      error = retry.error;
      if (note) {
        if (!note.images) note.images = [];
        if (note.is_client_visible === undefined) note.is_client_visible = Boolean(body.is_client_visible);
        if (note.epic_id === undefined) note.epic_id = body.epic_id || null;
      }
    }

    if (error) {
      console.error("Error creating note:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ note }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create note" }, { status: 500 });
  }
}

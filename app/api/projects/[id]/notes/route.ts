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

    const admin = createAdminClient();
    let query = admin
      .from("project_notes")
      .select("*")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
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
    const { data: note, error } = await admin
      .from("project_notes")
      .insert({
        project_id: projectId,
        title: title || "Untitled Discussion Note",
        content,
        tags,
        status: "active",
        created_by_id: actor.id,
        created_by_name: actor.name,
      })

      .select()
      .single();

    if (error) {
      console.error("Error creating note:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ note }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create note" }, { status: 500 });
  }
}

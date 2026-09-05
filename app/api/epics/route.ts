import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const projectId = String(body.projectId || "").trim();
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    const status = String(body.status || "active").trim();
    const sortOrder = Number(body.sortOrder || 0);

    if (!projectId || !name) {
      return NextResponse.json({ error: "Project ID and Epic name are required." }, { status: 400 });
    }

    const admin = createAdminClient();
    
    // Validate that the freelancer owns the project
    const { data: project } = await admin.from("projects").select("id").eq("id", projectId).eq("owner_id", user.id).maybeSingle();
    if (!project) return NextResponse.json({ error: "Project not found or access denied." }, { status: 404 });

    const { data: epic, error } = await admin.from("epics").insert({
      project_id: projectId,
      name,
      description,
      status,
      sort_order: sortOrder
    }).select().single();

    if (error) throw error;

    return NextResponse.json(epic, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create Epic." }, { status: 500 });
  }
}

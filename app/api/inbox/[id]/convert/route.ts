import { NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/super-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifySuperAdmin();
  if (!admin) {
    return new NextResponse("Unauthorized. Super Admin access required.", { status: 403 });
  }

  const { id } = await params;
  const db = createAdminClient();

  try {
    const { data: item, error: itemError } = await db
      .from("project_inbox_items")
      .select("*")
      .eq("id", id)
      .eq("owner_id", admin.id)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: "Inbox item not found." }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const projectName = (body.name || item.title || "New Project").trim();
    const projectDescription = (body.description || item.description || "").trim();

    // 1. Create real project in projects table
    const { data: newProject, error: projErr } = await db
      .from("projects")
      .insert({
        owner_id: admin.id,
        name: projectName,
        description: projectDescription,
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (projErr || !newProject) {
      return NextResponse.json({ error: projErr?.message || "Failed to create project." }, { status: 500 });
    }

    // 2. Mark inbox item as converted
    const { data: updatedItem, error: updateErr } = await db
      .from("project_inbox_items")
      .update({
        converted_project_id: newProject.id,
        converted_at: new Date().toISOString(),
        status: "ready",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("owner_id", admin.id)
      .select("*, converted_project:projects(id, name)")
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      project: newProject,
      item: updatedItem,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Conversion failed." }, { status: 500 });
  }
}

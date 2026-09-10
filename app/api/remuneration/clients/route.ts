import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Check project ownership or super admin
    const { data: project } = await admin
      .from("projects")
      .select("id, owner_id")
      .eq("id", projectId)
      .maybeSingle();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.owner_id !== user.id) {
      const { data: profile } = await admin
        .from("freelancer_profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.role !== "super_admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Fetch clients for this project (attempting with email column, falling back if not yet added)
    let clientsResult: any = await admin
      .from("clients")
      .select("id, name, login_id, email, status, created_at")
      .eq("project_id", projectId)
      .eq("status", "active")
      .order("name", { ascending: true });

    if (clientsResult.error && (clientsResult.error.message?.includes("email") || clientsResult.error.code === "PGRST204")) {
      clientsResult = await admin
        .from("clients")
        .select("id, name, login_id, status, created_at")
        .eq("project_id", projectId)
        .eq("status", "active")
        .order("name", { ascending: true });
    }

    if (clientsResult.error) {
      return NextResponse.json({ error: clientsResult.error.message }, { status: 500 });
    }

    return NextResponse.json({ clients: clientsResult.data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

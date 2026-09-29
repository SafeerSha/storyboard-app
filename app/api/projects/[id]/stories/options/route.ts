import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const admin = createAdminClient();

    const { data: stories, error } = await admin
      .from("stories")
      .select("id, title, status, epic_id")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ stories: stories || [] });
  } catch (err: any) {
    console.error("GET /api/projects/[id]/stories/options error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch stories" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing estimate ID" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Fetch estimate
    const { data: estimate, error: estError } = await admin
      .from("remuneration_estimates")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (estError || !estimate) {
      return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
    }

    // Verify ownership or super admin
    const { data: project } = await admin
      .from("projects")
      .select("id, owner_id")
      .eq("id", estimate.project_id)
      .maybeSingle();

    if (project?.owner_id !== user.id) {
      const { data: profile } = await admin
        .from("freelancer_profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.role !== "super_admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Fetch stories
    const { data: stories, error: storyError } = await admin
      .from("remuneration_story_estimates")
      .select("*")
      .eq("remuneration_estimate_id", id)
      .order("created_at", { ascending: true });

    if (storyError) {
      console.error("Failed to load story estimates:", storyError);
    }

    return NextResponse.json({
      estimate,
      stories: stories || [],
    });
  } catch (err: any) {
    console.error("Get estimate by id error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

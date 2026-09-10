import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await req.json();
    const { project_id, estimateData, storyEstimates } = payload;

    if (!project_id || !estimateData || !storyEstimates) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Check project authorization
    const { data: project } = await admin
      .from("projects")
      .select("id, owner_id")
      .eq("id", project_id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!project) {
      // Check if super admin
      const { data: profile } = await admin
        .from("freelancer_profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
        
      if (profile?.role !== "super_admin") {
         return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Insert Remuneration Estimate
    const { data: newEstimate, error: estimateError } = await admin
      .from("remuneration_estimates")
      .insert({
        project_id,
        created_by: user.id,
        hourly_rate: estimateData.hourly_rate,
        currency: estimateData.currency,
        contingency_percentage: estimateData.contingency_percentage,
        ai_total_hours: estimateData.ai_total_hours,
        final_total_hours: estimateData.final_total_hours,
        base_amount: estimateData.base_amount,
        contingency_amount: estimateData.contingency_amount,
        final_amount: estimateData.final_amount,
        project_summary: estimateData.project_summary,
      })
      .select()
      .single();

    if (estimateError || !newEstimate) {
      console.error("Failed to insert estimate:", estimateError);
      return NextResponse.json({ error: "Failed to save estimate" }, { status: 500 });
    }

    // Prepare story estimates
    const storyInserts = storyEstimates.map((s: any) => ({
      remuneration_estimate_id: newEstimate.id,
      epic_id: s.epic_id || null,
      story_id: s.story_id || null,
      story_title: s.story_title,
      epic_name: s.epic_name,
      complexity: s.complexity,
      ai_estimated_hours: s.ai_estimated_hours,
      final_hours: s.final_hours,
      frontend_hours: s.frontend_hours,
      backend_hours: s.backend_hours,
      database_hours: s.database_hours,
      integration_hours: s.integration_hours,
      testing_hours: s.testing_hours,
      confidence: s.confidence,
      reasoning: s.reasoning,
      assumptions: s.assumptions,
      risks: s.risks,
    }));

    const { error: storyError } = await admin
      .from("remuneration_story_estimates")
      .insert(storyInserts);

    if (storyError) {
      console.error("Failed to insert story estimates:", storyError);
      // Optional: rollback the parent estimate or let it sit empty
      return NextResponse.json({ error: "Failed to save story details" }, { status: 500 });
    }

    return NextResponse.json({ success: true, estimateId: newEstimate.id });
  } catch (err: any) {
    console.error("Save error:", err);
    return NextResponse.json({ error: "Unable to save estimate. Please try again." }, { status: 500 });
  }
}

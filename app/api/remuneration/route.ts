import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Get user profile / role
    const { data: profile } = await admin
      .from("freelancer_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    let projectsData: Array<{ id: string; name: string; status?: string; created_at?: string }> = [];

    if (profile?.role === "super_admin") {
      const { data: allProjects } = await admin
        .from("projects")
        .select("id, name, status, created_at")
        .order("created_at", { ascending: false });
      projectsData = allProjects || [];
    } else {
      const { data: userProjects } = await admin
        .from("projects")
        .select("id, name, status, created_at")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });
      projectsData = userProjects || [];
    }

    // Get previous estimates
    const { data: savedEstimates } = await admin
      .from("remuneration_estimates")
      .select("id, project_id, hourly_rate, currency, final_amount, created_at, ai_total_hours, final_total_hours, contingency_percentage, project_summary")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });

    // Fetch clients so UI can display recipient client names and emails for any estimate
    const { data: allClients } = await admin
      .from("clients")
      .select("id, name, email, login_id, project_id");

    return NextResponse.json({
      projects: projectsData,
      savedEstimates: savedEstimates || [],
      clients: allClients || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

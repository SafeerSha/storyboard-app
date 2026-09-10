import { NextResponse } from "next/server";
import { getAuthenticatedClient } from "@/lib/client-session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const client = await getAuthenticatedClient();
    if (!client) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Fetch the latest published estimate for this client's project
    const { data: estimates, error: estError } = await admin
      .from("remuneration_estimates")
      .select("*")
      .eq("project_id", client.project_id)
      .order("created_at", { ascending: false });

    if (estError) {
      return NextResponse.json({ error: estError.message }, { status: 500 });
    }

    if (!estimates || estimates.length === 0) {
      return NextResponse.json({ estimate: null, stories: [] });
    }

    // Find the latest estimate published to this client
    const matchingEstimate = estimates.find((est) => {
      const pub = est.project_summary?.publishing;
      if (!pub || pub.status === "draft" || pub.status === "recalled") return false;
      const clientIds = pub.published_to_client_ids;
      return Array.isArray(clientIds) && clientIds.includes(client.id);
    });

    if (!matchingEstimate) {
      return NextResponse.json({ estimate: null, stories: [] });
    }

    // Fetch story estimates
    const { data: stories, error: storyError } = await admin
      .from("remuneration_story_estimates")
      .select("*")
      .eq("remuneration_estimate_id", matchingEstimate.id)
      .order("created_at", { ascending: true });

    if (storyError) {
      console.error("Failed to load story estimates for client:", storyError);
    }

    return NextResponse.json({
      estimate: matchingEstimate,
      stories: stories || [],
      clientInfo: {
        id: client.id,
        name: client.name,
      },
    });
  } catch (err: any) {
    console.error("Client remuneration fetch error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

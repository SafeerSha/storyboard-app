import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedClient } from "@/lib/client-session";
import { getOpenFeedbackCountForStories } from "@/lib/feedback-store";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const admin = createAdminClient();

  // 1. Check Freelancer
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let isAuthorized = false;

  if (user) {
    const { data: project } = await admin
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (project) isAuthorized = true;
  }

  // 2. Check Client
  if (!isAuthorized) {
    const client = await getAuthenticatedClient();
    if (client && client.project_id === projectId) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: stories } = await admin
      .from("stories")
      .select("id")
      .eq("project_id", projectId);

    const storyIds = (stories || []).map(s => s.id);
    const counts = await getOpenFeedbackCountForStories(storyIds);

    return NextResponse.json({ counts });
  } catch (e) {
    return NextResponse.json({ counts: {} });
  }
}

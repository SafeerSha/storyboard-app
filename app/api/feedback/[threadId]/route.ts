import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedClient } from "@/lib/client-session";
import { getAuthenticatedTeamUser } from "@/lib/team-session";
import { updateFeedbackThreadStatus } from "@/lib/feedback-store";

const patchSchema = z.object({
  storyId: z.string().uuid(),
  status: z.enum(["open", "resolved"]),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;

  try {
    const json = await req.json();
    const input = patchSchema.parse(json);

    const admin = createAdminClient();
    const { data: story } = await admin
      .from("stories")
      .select("id, project_id")
      .eq("id", input.storyId)
      .maybeSingle();

    if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });

    let isAuthorized = false;

    // 1. Check Team User
    const teamUser = await getAuthenticatedTeamUser();
    if (teamUser && teamUser.project_id === story.project_id) {
      isAuthorized = true;
    }

    // 2. Check Freelancer / Super Admin
    if (!isAuthorized) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await admin
          .from("freelancer_profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.role === "super_admin") {
          isAuthorized = true;
        } else {
          const { data: project } = await admin
            .from("projects")
            .select("id, owner_id")
            .eq("id", story.project_id)
            .eq("owner_id", user.id)
            .maybeSingle();

          if (project) isAuthorized = true;
        }
      }
    }

    // 3. Check Client
    if (!isAuthorized) {
      const client = await getAuthenticatedClient();
      if (client && client.project_id === story.project_id) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const res = await updateFeedbackThreadStatus({
      storyId: input.storyId,
      threadId,
      status: input.status,
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to update thread status" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, status: input.status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid request" },
      { status: 400 }
    );
  }
}

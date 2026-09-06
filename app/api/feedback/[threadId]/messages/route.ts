import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedClient } from "@/lib/client-session";
import { getAuthenticatedTeamUser } from "@/lib/team-session";
import { addFeedbackMessage, updateFeedbackThreadStatus } from "@/lib/feedback-store";
import type { FeedbackAuthorType } from "@/lib/types";

const postSchema = z.object({
  storyId: z.string().uuid(),
  body: z.string().min(1).max(5000),
});

async function resolveSessionForStory(storyId: string) {
  const admin = createAdminClient();
  const { data: story } = await admin
    .from("stories")
    .select("id, project_id, status")
    .eq("id", storyId)
    .maybeSingle();

  if (!story) return { error: "Story not found", status: 404 };

  // 1. Team User session
  const teamUser = await getAuthenticatedTeamUser();
  if (teamUser && teamUser.project_id === story.project_id) {
    return {
      story,
      authorType: "team_user" as FeedbackAuthorType,
      authorId: teamUser.id,
      authorName: teamUser.name || "Team Member",
    };
  }

  // 2. Freelancer / Super Admin session
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
      return {
        story,
        authorType: "freelancer" as FeedbackAuthorType,
        authorId: user.id,
        authorName: "Super Admin",
      };
    }

    const { data: project } = await admin
      .from("projects")
      .select("id, owner_id")
      .eq("id", story.project_id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (project) {
      return {
        story,
        authorType: "freelancer" as FeedbackAuthorType,
        authorId: user.id,
        authorName: "Freelancer",
      };
    }
  }

  // 3. Client session
  const client = await getAuthenticatedClient();
  if (client && client.project_id === story.project_id) {
    return {
      story,
      authorType: "client" as FeedbackAuthorType,
      authorId: client.id,
      authorName: client.name || "Client",
    };
  }

  return { error: "Unauthorized", status: 401 };
}

export async function POST(req: Request, { params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;

  try {
    const json = await req.json();
    const input = postSchema.parse(json);

    const auth = await resolveSessionForStory(input.storyId);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const message = await addFeedbackMessage({
      storyId: input.storyId,
      threadId,
      body: input.body,
      authorType: auth.authorType,
      authorId: auth.authorId,
      authorName: auth.authorName,
    });

    // If client or team user replies, reopen thread if it was marked resolved
    if (auth.authorType === "client" || auth.authorType === "team_user") {
      await updateFeedbackThreadStatus({
        storyId: input.storyId,
        threadId,
        status: "open",
      });

      const admin = createAdminClient();
      if (auth.authorType === "client") {
        await admin
          .from("stories")
          .update({
            status: "changes_requested",
            client_review_status: "changes_requested",
            updated_at: new Date().toISOString(),
          })
          .eq("id", input.storyId);
      } else {
        await admin
          .from("stories")
          .update({
            team_review_status: "changes_requested",
            updated_at: new Date().toISOString(),
          })
          .eq("id", input.storyId);
      }
    }

    return NextResponse.json({ ok: true, message });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to post message" },
      { status: 400 }
    );
  }
}

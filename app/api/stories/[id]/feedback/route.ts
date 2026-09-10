import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedClient } from "@/lib/client-session";
import { getAuthenticatedTeamUser } from "@/lib/team-session";
import { getStoryFeedback, createFeedbackThread, resolveSession, syncStoryReviewStatus } from "@/lib/feedback-store";
import { isTeamUserReviewer } from "@/lib/story-reviewer-auth";
import type { FeedbackAuthorType, FeedbackSectionType } from "@/lib/types";

const postSchema = z.object({
  sectionType: z.enum(["acceptance_criteria", "assumption", "clarification", "general"]),
  itemId: z.string().nullable().optional(),
  itemText: z.string().max(3000).nullable().optional(),
  body: z.string().min(1).max(5000),
});

// resolveSession moved to @/lib/feedback-store
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await resolveSession(id);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const threads = await getStoryFeedback(id);
    return NextResponse.json({ threads });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load feedback" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await resolveSession(id);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Enforce story-level reviewer access control for team users
  if (auth.authorType === "team_user") {
    const isReviewer = await isTeamUserReviewer(id, auth.authorId);
    if (!isReviewer) {
      return NextResponse.json(
        { error: "Forbidden. Only assigned reviewers can create change requests or feedback threads for this story." },
        { status: 403 }
      );
    }
  }

  try {
    const json = await req.json();
    const input = postSchema.parse(json);

    const thread = await createFeedbackThread({
      storyId: id,
      sectionType: input.sectionType as FeedbackSectionType,
      itemId: input.itemId || null,
      itemText: input.itemText || null,
      body: input.body,
      authorType: auth.authorType,
      authorId: auth.authorId,
      authorName: auth.authorName,
    });

    // If client requested changes, update status
    if (auth.authorType === "client") {
      const admin = createAdminClient();
      await admin
        .from("stories")
        .update({
          status: "changes_requested",
          client_review_status: "changes_requested",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
    } else if (auth.authorType === "team_user") {
      const admin = createAdminClient();
      await admin
        .from("stories")
        .update({
          team_review_status: "changes_requested",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
    }

    const syncResult = await syncStoryReviewStatus(id);

    return NextResponse.json({ ok: true, thread, syncResult });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create feedback" },
      { status: 400 }
    );
  }
}

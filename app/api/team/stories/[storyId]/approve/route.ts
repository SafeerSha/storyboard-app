import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedTeamUser } from "@/lib/team-session";
import { getStoryFeedback, updateFeedbackThreadStatus } from "@/lib/feedback-store";
import { isTeamUserReviewer } from "@/lib/story-reviewer-auth";
import { logAudit } from "@/lib/audit";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  const teamUser = await getAuthenticatedTeamUser();
  if (!teamUser) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { storyId } = await params;
  const admin = createAdminClient();

  // Validate that story belongs to user's assigned project
  const { data: story, error: storyError } = await admin
    .from("stories")
    .select("id, project_id, title, status, client_review_status")
    .eq("id", storyId)
    .eq("project_id", teamUser.project_id)
    .maybeSingle();

  if (storyError || !story) {
    return NextResponse.json(
      { error: "Story not found or does not belong to your assigned project." },
      { status: 404 }
    );
  }

  // Enforce story-level reviewer access control
  const isReviewer = await isTeamUserReviewer(story.id, teamUser.id);
  if (!isReviewer) {
    return NextResponse.json(
      { error: "Forbidden. Only assigned reviewers can approve this story." },
      { status: 403 }
    );
  }

  const threads = await getStoryFeedback(story.id);
  const openThreads = threads.filter((t) => t.status === "open");

  const body = await req.json().catch(() => ({}));
  if (openThreads.length > 0 && !body.confirmWithUnresolved) {
    return NextResponse.json(
      {
        error: `This story has ${openThreads.length} unresolved feedback thread${
          openThreads.length === 1 ? "" : "s"
        }. Review them or confirm approval.`,
        unresolvedCount: openThreads.length,
        requiresConfirmation: true,
      },
      { status: 400 }
    );
  }

  // Mark all threads as resolved on approval
  for (const t of openThreads) {
    await updateFeedbackThreadStatus({
      storyId: story.id,
      threadId: t.id,
      status: "resolved",
    });
  }

  const now = new Date().toISOString();

  // Update story with Team Review approval
  const { data: updatedStory, error: updateError } = await admin
    .from("stories")
    .update({
      team_review_status: "approved",
      team_approved_by_id: teamUser.id,
      team_approved_by_name: teamUser.name,
      team_approved_at: now,
      updated_at: now,
    })
    .eq("id", story.id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: "Approval failed." }, { status: 400 });
  }

  // Audit log
  await logAudit({
    action: "story_approved",
    actorId: teamUser.id,
    actorType: "team_user",
    actorName: teamUser.name,
    targetType: "story",
    targetId: story.id,
    details: {
      storyTitle: story.title,
      projectId: teamUser.project_id,
      reviewType: "team_review",
    },
  });

  return NextResponse.json({
    ok: true,
    story: updatedStory,
    team_review_status: "approved",
  });
}

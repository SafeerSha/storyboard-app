import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedClient } from "@/lib/client-session";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request, { params }: { params: Promise<{ storyId: string }> }) {
  const client = await getAuthenticatedClient();
  if (!client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storyId } = await params;
  const db = createAdminClient();
  const { data: story } = await db
    .from("stories")
    .select("id,project_id,title")
    .eq("id", storyId)
    .eq("project_id", client.project_id)
    .single();

  if (!story) return NextResponse.json({ error: "Story not found." }, { status: 404 });

  const { getStoryFeedback, updateFeedbackThreadStatus } = await import("@/lib/feedback-store");
  const threads = await getStoryFeedback(story.id);
  const openThreads = threads.filter(t => t.status === "open");

  const body = await req.json().catch(() => ({}));
  if (openThreads.length > 0 && !body.confirmWithUnresolved) {
    return NextResponse.json({ 
      error: `This story has ${openThreads.length} unresolved change request${openThreads.length === 1 ? '' : 's'}. Review them or confirm approval.`,
      unresolvedCount: openThreads.length,
      requiresConfirmation: true
    }, { status: 400 });
  }

  // Mark all threads as resolved on approval
  for (const t of openThreads) {
    await updateFeedbackThreadStatus({ storyId: story.id, threadId: t.id, status: "resolved" });
  }

  const now = new Date().toISOString();
  const { error } = await db.from("stories").update({ 
    status: "approved", 
    client_review_status: "approved",
    client_approved_by_id: client.id,
    client_approved_by_name: client.name,
    client_approved_at: now,
    updated_at: now,
  }).eq("id", story.id);

  if (error) {
    console.error("Failed to approve story:", error);
    return NextResponse.json({ error: error.message || "Action failed." }, { status: 400 });
  }

  await logAudit({
    action: "story_approved",
    actorId: client.id,
    actorType: "client",
    actorName: client.name,
    targetType: "story",
    targetId: story.id,
    details: {
      storyTitle: story.title,
      projectId: client.project_id,
      reviewType: "client_review",
    }
  });

  return NextResponse.json({ ok: true, status: "approved", client_review_status: "approved" });
}

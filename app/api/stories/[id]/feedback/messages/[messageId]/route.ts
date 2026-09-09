import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveSession, updateFeedbackMessage, deleteFeedbackMessage } from "@/lib/feedback-store";
import { createAdminClient } from "@/lib/supabase/admin";

const patchSchema = z.object({
  body: z.string().min(1).max(5000),
});

async function verifyAuthor(storyId: string, messageId: string) {
  const auth = await resolveSession(storyId);
  if ("error" in auth) {
    return { error: auth.error, status: auth.status };
  }

  const db = createAdminClient();

  // Find message to verify author
  let authorId = null;

  // Check dedicated table first
  const { data: msg } = await db
    .from("story_feedback_messages")
    .select("author_id")
    .eq("id", messageId)
    .maybeSingle();

  if (msg) {
    authorId = msg.author_id;
  } else {
    // Fallback to story_comments
    const { data: comment } = await db
      .from("story_comments")
      .select("body, author_name, id") // ID is used as author_id for legacy unparsed
      .eq("id", messageId)
      .maybeSingle();

    if (comment) {
      if (typeof comment.body === "string" && comment.body.startsWith("__FEEDBACK_THREAD__:__FEEDBACK_THREAD__:")) {
         // Should not happen, but just in case
      }
      if (typeof comment.body === "string" && comment.body.startsWith("__FEEDBACK_THREAD__:")) {
        try {
          const payload = JSON.parse(comment.body.slice("__FEEDBACK_THREAD__:".length));
          authorId = payload.author_id;
        } catch {
          authorId = comment.id; // Legacy
        }
      } else {
        authorId = comment.id; // Legacy
      }
    }
  }

  if (!authorId) {
    return { error: "Message not found", status: 404 };
  }

  if (authorId !== auth.authorId) {
    return { error: "You can only modify your own messages", status: 403 };
  }

  return { success: true };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const { id: storyId, messageId } = await params;
  
  const authRes = await verifyAuthor(storyId, messageId);
  if ("error" in authRes) {
    return NextResponse.json({ error: authRes.error }, { status: authRes.status });
  }

  try {
    const rawBody = await req.json();
    const parsed = patchSchema.parse(rawBody);

    const { ok } = await updateFeedbackMessage({
      messageId,
      body: parsed.body,
    });

    if (!ok) {
      return NextResponse.json({ error: "Failed to update message" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data." }, { status: 400 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const { id: storyId, messageId } = await params;
  
  const authRes = await verifyAuthor(storyId, messageId);
  if ("error" in authRes) {
    return NextResponse.json({ error: authRes.error }, { status: authRes.status });
  }

  try {
    const { ok } = await deleteFeedbackMessage(messageId);

    if (!ok) {
      return NextResponse.json({ error: "Failed to delete message" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

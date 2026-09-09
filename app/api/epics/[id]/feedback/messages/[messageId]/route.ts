import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveEpicSession, updateEpicFeedbackMessage, deleteEpicFeedbackMessage } from "@/lib/epic-feedback-store";
import { createAdminClient } from "@/lib/supabase/admin";

const patchSchema = z.object({
  body: z.string().min(1).max(5000),
});

async function verifyAuthor(epicId: string, messageId: string) {
  const auth = await resolveEpicSession(epicId);
  if ("error" in auth) {
    return { error: auth.error, status: auth.status };
  }

  const db = createAdminClient();

  const { data: msg } = await db
    .from("epic_feedback_messages")
    .select("author_id")
    .eq("id", messageId)
    .maybeSingle();

  if (!msg) {
    return { error: "Message not found", status: 404 };
  }

  if (msg.author_id !== auth.authorId) {
    return { error: "You can only modify your own messages", status: 403 };
  }

  return { success: true };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const { id: epicId, messageId } = await params;
  
  const authRes = await verifyAuthor(epicId, messageId);
  if ("error" in authRes) {
    return NextResponse.json({ error: authRes.error }, { status: authRes.status });
  }

  try {
    const rawBody = await req.json();
    const parsed = patchSchema.parse(rawBody);

    const { ok } = await updateEpicFeedbackMessage({
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
  const { id: epicId, messageId } = await params;
  
  const authRes = await verifyAuthor(epicId, messageId);
  if ("error" in authRes) {
    return NextResponse.json({ error: authRes.error }, { status: authRes.status });
  }

  try {
    const { ok } = await deleteEpicFeedbackMessage(messageId);

    if (!ok) {
      return NextResponse.json({ error: "Failed to delete message" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

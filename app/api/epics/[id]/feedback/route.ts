import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveEpicSession, getEpicFeedbackThreads, addEpicFeedbackThread, addEpicFeedbackMessage } from "@/lib/epic-feedback-store";

const postSchema = z.object({
  body: z.string().min(1).max(5000),
  threadId: z.string().uuid().optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: epicId } = await params;
  const auth = await resolveEpicSession(epicId);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const threads = await getEpicFeedbackThreads(epicId);
  return NextResponse.json({ threads });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: epicId } = await params;
  const auth = await resolveEpicSession(epicId);

  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const rawBody = await req.json();
    const parsed = postSchema.parse(rawBody);

    if (parsed.threadId) {
      // Add message to existing thread
      const result = await addEpicFeedbackMessage({
        threadId: parsed.threadId,
        authorType: auth.authorType as any,
        authorId: auth.authorId as string,
        authorName: auth.authorName as string,
        body: parsed.body,
      });

      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: result.message });
    } else {
      // Create new thread
      const result = await addEpicFeedbackThread({
        epicId,
        authorType: auth.authorType as any,
        authorId: auth.authorId as string,
        authorName: auth.authorName as string,
        body: parsed.body,
      });

      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      return NextResponse.json({ success: true, thread: result.thread, message: result.message });
    }
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload format." }, { status: 400 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

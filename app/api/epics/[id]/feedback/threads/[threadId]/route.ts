import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveEpicSession } from "@/lib/epic-feedback-store";
import { createAdminClient } from "@/lib/supabase/admin";

const patchSchema = z.object({
  status: z.enum(["open", "resolved"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; threadId: string }> }
) {
  const { id: epicId, threadId } = await params;
  
  const authRes = await resolveEpicSession(epicId);
  if ("error" in authRes) {
    return NextResponse.json({ error: authRes.error }, { status: authRes.status });
  }

  try {
    const rawBody = await req.json();
    const parsed = patchSchema.parse(rawBody);

    const db = createAdminClient();

    // Verify thread belongs to this epic
    const { data: thread } = await db
      .from("epic_feedback_threads")
      .select("id")
      .eq("id", threadId)
      .eq("epic_id", epicId)
      .maybeSingle();

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const { error } = await db
      .from("epic_feedback_threads")
      .update({ status: parsed.status, updated_at: new Date().toISOString() })
      .eq("id", threadId);

    if (error) {
      return NextResponse.json({ error: "Failed to update thread status" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload format." }, { status: 400 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

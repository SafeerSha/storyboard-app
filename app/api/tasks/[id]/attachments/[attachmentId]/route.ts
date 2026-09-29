import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isR2Configured, deleteFromR2 } from "@/lib/r2";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const { id: taskId, attachmentId } = await params;
    const admin = createAdminClient();

    const { data: attachment, error: fetchErr } = await admin
      .from("task_attachments")
      .select("id, file_key")
      .eq("id", attachmentId)
      .eq("task_id", taskId)
      .maybeSingle();

    if (fetchErr || !attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    if (attachment.file_key && isR2Configured()) {
      try {
        await deleteFromR2(attachment.file_key);
      } catch (r2Err) {
        console.warn("Failed to delete from R2:", r2Err);
      }
    }

    const { error: delErr } = await admin
      .from("task_attachments")
      .delete()
      .eq("id", attachmentId);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/tasks/[id]/attachments/[attachmentId] error:", err);
    return NextResponse.json({ error: err.message || "Failed to delete attachment" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTeamUser } from "@/lib/team-session";
import { getAuthenticatedClient } from "@/lib/client-session";
import { isR2Configured, uploadToR2 } from "@/lib/r2";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import type { TaskAttachment } from "@/lib/types/task";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const admin = createAdminClient();

    const { data: attachments, error } = await admin
      .from("task_attachments")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ attachments: attachments || [] });
  } catch (err: any) {
    console.error("GET /api/tasks/[id]/attachments error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch attachments" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const admin = createAdminClient();

    // Verify task
    const { data: task, error: taskErr } = await admin
      .from("tasks")
      .select("id, project_id")
      .eq("id", taskId)
      .maybeSingle();

    if (taskErr || !task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const originalName = file.name || "attachment";
    const extension = path.extname(originalName) || "";
    const attachmentId = crypto.randomUUID();
    const safeBaseName = path.basename(originalName, extension).replace(/[^a-zA-Z0-9_-]/g, "_");
    const uniqueFileName = `${attachmentId}-${safeBaseName}${extension}`;
    const storageKey = `tasks/${task.project_id}/${taskId}/${uniqueFileName}`;
    const contentType = file.type || "application/octet-stream";

    let fileUrl = "";

    // 1. Try Cloudflare R2
    if (isR2Configured()) {
      try {
        const uploadedUrl = await uploadToR2(storageKey, buffer, contentType);
        fileUrl = uploadedUrl;
      } catch (r2Err) {
        console.warn("R2 upload error, falling back to local:", r2Err);
      }
    }

    // 2. Fallback to local storage
    if (!fileUrl) {
      try {
        const uploadsDir = path.resolve(process.cwd(), "public", "uploads", "tasks", taskId);
        await fs.mkdir(uploadsDir, { recursive: true });
        const filePath = path.join(uploadsDir, uniqueFileName);
        await fs.writeFile(filePath, buffer);
        fileUrl = `/uploads/tasks/${taskId}/${uniqueFileName}`;
      } catch (fsErr: any) {
        console.warn("Local storage write failed, using data URL:", fsErr?.message);
        const base64 = buffer.toString("base64");
        fileUrl = `data:${contentType};base64,${base64}`;
      }
    }

    // Identify uploader
    let uploaderId: string | null = null;
    let uploaderName = "Team Member";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      uploaderId = user.id;
      const { data: profile } = await admin
        .from("freelancer_profiles")
        .select("name")
        .eq("id", user.id)
        .maybeSingle();
      uploaderName = profile?.name || user.email?.split("@")[0] || "Freelancer";
    } else {
      const teamUser = await getAuthenticatedTeamUser();
      if (teamUser) {
        uploaderId = teamUser.id;
        uploaderName = teamUser.name;
      } else {
        const client = await getAuthenticatedClient();
        if (client) {
          uploaderId = client.id;
          uploaderName = client.name;
        }
      }
    }

    const { data: attachment, error: insertErr } = await admin
      .from("task_attachments")
      .insert({
        id: attachmentId,
        task_id: taskId,
        name: originalName,
        file_url: fileUrl,
        file_key: storageKey,
        file_type: contentType,
        file_size: buffer.length,
        uploaded_by_id: uploaderId,
        uploaded_by_name: uploaderName,
      })
      .select("*")
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Touch task updated_at
    await admin
      .from("tasks")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", taskId);

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/tasks/[id]/attachments error:", err);
    return NextResponse.json({ error: err.message || "Failed to upload attachment" }, { status: 500 });
  }
}

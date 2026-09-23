import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeProjectMember } from "@/lib/project-auth";
import { isR2Configured, uploadToR2, deleteFromR2 } from "@/lib/r2";
import type { NoteImage } from "@/lib/types";
import path from "path";
import fs from "fs/promises";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = new Set(["image/webp", "image/png", "image/jpeg", "image/jpg"]);

function isValidImageBuffer(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  // WebP: RIFF....WEBP
  const isWebp =
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const isPng =
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
    buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A;
  // JPEG: FF D8 FF
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

  return isWebp || isPng || isJpeg;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const { id: projectId, noteId } = await params;
    if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(noteId)) {
      return NextResponse.json({ error: "Invalid identifier format" }, { status: 400 });
    }

    const auth = await authorizeProjectMember(projectId);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File size exceeds the 5MB limit" }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
      return NextResponse.json(
        { error: "Invalid file type. Only WebP, PNG, and JPEG images are allowed" },
        { status: 400 }
      );
    }

    const rawName = (formData.get("name") as string) || file.name || "discussion-note-image.webp";
    const name = path.basename(rawName).replace(/[^a-zA-Z0-9._-]/g, "_");
    const widthStr = formData.get("width") as string | null;
    const heightStr = formData.get("height") as string | null;
    const originalSizeStr = formData.get("originalSize") as string | null;

    const width = widthStr ? parseInt(widthStr, 10) : undefined;
    const height = heightStr ? parseInt(heightStr, 10) : undefined;
    const originalSize = originalSizeStr ? parseInt(originalSizeStr, 10) : file.size;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!isValidImageBuffer(buffer)) {
      return NextResponse.json(
        { error: "Corrupted or invalid image content" },
        { status: 400 }
      );
    }

    const imageId = crypto.randomUUID();
    const storageKey = `Project-Notes/${projectId}/${noteId}/${imageId}.webp`;

    let imageUrl = "";

    // 1. Try Cloudflare R2 first
    if (isR2Configured()) {
      try {
        const uploadedUrl = await uploadToR2(storageKey, buffer, "image/webp");
        const publicUrl = process.env.R2_PUBLIC_URL?.trim();
        const hasValidPublicCdn =
          publicUrl &&
          !publicUrl.includes("r2.cloudflarestorage.com");

        if (hasValidPublicCdn) {
          imageUrl = uploadedUrl;
        } else {
          imageUrl = `/api/projects/${projectId}/notes/${noteId}/images/${imageId}`;
        }
      } catch (r2Err: any) {
        console.error("Cloudflare R2 upload error:", r2Err);
      }
    }

    // 2. Fallback to public upload directory if R2 is not configured or failed
    if (!imageUrl) {
      try {
        const uploadsBaseDir = path.resolve(process.cwd(), "public", "uploads", "notes");
        const uploadsDir = path.resolve(uploadsBaseDir, projectId, noteId);
        if (!uploadsDir.startsWith(uploadsBaseDir)) {
          throw new Error("Invalid destination directory");
        }
        await fs.mkdir(uploadsDir, { recursive: true });
        const filePath = path.join(uploadsDir, `${imageId}.webp`);
        await fs.writeFile(filePath, buffer);
        imageUrl = `/uploads/notes/${projectId}/${noteId}/${imageId}.webp`;
      } catch (fsErr: any) {
        console.warn("Local storage fallback failed, using data URL:", fsErr?.message);
        // 3. Fallback to base64 data URL
        const base64 = buffer.toString("base64");
        imageUrl = `data:image/webp;base64,${base64}`;
      }
    }

    const newImage: NoteImage = {
      id: imageId,
      name,
      url: imageUrl,
      key: storageKey,
      size: buffer.length,
      originalSize,
      type: "image/webp",
      width,
      height,
      created_at: new Date().toISOString(),
    };

    // Update note in database
    const admin = createAdminClient();
    const { data: note, error: fetchError } = await admin
      .from("project_notes")
      .select("*")
      .eq("id", noteId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (fetchError || !note) {
      return NextResponse.json({ error: fetchError?.message || "Note not found" }, { status: 404 });
    }

    const currentImages: NoteImage[] = Array.isArray(note.images) ? note.images : [];
    const updatedImages = [...currentImages, newImage];

    let updateRes = await admin
      .from("project_notes")
      .update({
        images: updatedImages,
        updated_at: new Date().toISOString(),
      })
      .eq("id", noteId)
      .eq("project_id", projectId)
      .select()
      .single();

    // If images column not yet added to SQL schema, return image anyway
    if (updateRes.error && updateRes.error.message?.includes("images")) {
      console.warn("Note updated without images column (pending SQL migration)");
    }

    return NextResponse.json({
      success: true,
      image: newImage,
      images: updatedImages,
    });
  } catch (err: any) {
    console.error("Error uploading note image:", err);
    return NextResponse.json(
      { error: err.message || "Failed to upload image" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const { id: projectId, noteId } = await params;
    if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(noteId)) {
      return NextResponse.json({ error: "Invalid identifier format" }, { status: 400 });
    }

    const auth = await authorizeProjectMember(projectId);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 403 });
    }

    const url = new URL(req.url);
    let imageId = url.searchParams.get("imageId");

    if (!imageId) {
      try {
        const body = await req.json();
        imageId = body.imageId;
      } catch {
        // No body provided
      }
    }

    if (!imageId || !UUID_REGEX.test(imageId)) {
      return NextResponse.json({ error: "Valid Image ID is required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: note, error: fetchError } = await admin
      .from("project_notes")
      .select("*")
      .eq("id", noteId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (fetchError || !note) {
      return NextResponse.json({ error: fetchError?.message || "Note not found" }, { status: 404 });
    }

    const currentImages: NoteImage[] = Array.isArray(note.images) ? note.images : [];
    const imageToDelete = currentImages.find((img) => img.id === imageId);

    if (imageToDelete) {
      // 1. Delete from Cloudflare R2 if configured
      if (imageToDelete.key && isR2Configured()) {
        try {
          await deleteFromR2(imageToDelete.key);
        } catch (r2Err: any) {
          console.warn("Failed to delete from Cloudflare R2:", r2Err?.message);
        }
      }

      // 2. Delete from local uploads if exists
      try {
        const uploadsBaseDir = path.resolve(process.cwd(), "public", "uploads", "notes");
        const localPath = path.resolve(
          uploadsBaseDir,
          projectId,
          noteId,
          `${imageId}.webp`
        );
        if (localPath.startsWith(uploadsBaseDir)) {
          await fs.unlink(localPath);
        }
      } catch {
        // File may not exist locally, ignore
      }
    }

    const remainingImages = currentImages.filter((img) => img.id !== imageId);

    await admin
      .from("project_notes")
      .update({
        images: remainingImages,
        updated_at: new Date().toISOString(),
      })
      .eq("id", noteId)
      .eq("project_id", projectId);

    return NextResponse.json({
      success: true,
      images: remainingImages,
    });
  } catch (err: any) {
    console.error("Error deleting note image:", err);
    return NextResponse.json(
      { error: err.message || "Failed to delete image" },
      { status: 500 }
    );
  }
}

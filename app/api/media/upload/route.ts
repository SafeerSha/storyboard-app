import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { isR2Configured, uploadToR2 } from "@/lib/r2";

export const dynamic = "force-dynamic";

// Standard supported formats (AC-2.1, AC-2.2)
const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
];

const SUPPORTED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/ogg",
  "video/x-matroska",
];

const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "media";

    if (!file) {
      return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
    }

    const contentType = file.type?.toLowerCase() || "";
    const isImage = SUPPORTED_IMAGE_TYPES.includes(contentType);
    const isVideo = SUPPORTED_VIDEO_TYPES.includes(contentType);

    // AC-2.2: Validate supported formats
    if (!isImage && !isVideo) {
      return NextResponse.json(
        {
          error: `Unsupported file format (${contentType || "unknown"}). Supported formats: JPEG, PNG, WebP, GIF, SVG for images; MP4, WebM, MOV for videos.`,
        },
        { status: 400 }
      );
    }

    // AC-2.2: Validate size restrictions
    const maxSize = isVideo ? MAX_VIDEO_SIZE_BYTES : MAX_IMAGE_SIZE_BYTES;
    const maxLabel = isVideo ? "100MB" : "15MB";

    if (file.size > maxSize) {
      const fileSizeMb = (file.size / (1024 * 1024)).toFixed(1);
      return NextResponse.json(
        {
          error: `File size (${fileSizeMb}MB) exceeds the maximum allowed limit of ${maxLabel} for ${
            isVideo ? "videos" : "images"
          }.`,
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const originalName = file.name || (isVideo ? "video.mp4" : "image.jpg");
    const extension = path.extname(originalName) || (isVideo ? ".mp4" : ".jpg");
    const safeBaseName = path
      .basename(originalName, extension)
      .replace(/[^a-zA-Z0-9_-]/g, "_");
    const uniqueId = crypto.randomUUID();
    const uniqueFileName = `${uniqueId}-${safeBaseName}${extension}`;
    const sanitizedFolder = folder.replace(/[^a-zA-Z0-9_-]/g, "");
    const storageKey = `${sanitizedFolder}/${uniqueFileName}`;

    let fileUrl = "";

    // 1. Try Cloudflare R2 if configured
    if (isR2Configured()) {
      try {
        const uploadedUrl = await uploadToR2(storageKey, buffer, contentType);
        fileUrl = uploadedUrl;
      } catch (r2Err) {
        console.warn("[Media Upload] Cloudflare R2 failed, falling back to local:", r2Err);
      }
    }

    // 2. Fallback to local storage in public/uploads/media
    if (!fileUrl) {
      try {
        const uploadsDir = path.resolve(process.cwd(), "public", "uploads", sanitizedFolder);
        await fs.mkdir(uploadsDir, { recursive: true });
        const filePath = path.join(uploadsDir, uniqueFileName);
        await fs.writeFile(filePath, buffer);
        fileUrl = `/uploads/${sanitizedFolder}/${uniqueFileName}`;
      } catch (fsErr: any) {
        console.warn("[Media Upload] Local filesystem write failed, using data URL:", fsErr?.message);
        const base64 = buffer.toString("base64");
        fileUrl = `data:${contentType};base64,${base64}`;
      }
    }

    // AC-2.3: Return confirmation and preview URL
    return NextResponse.json({
      success: true,
      url: fileUrl,
      fileName: originalName,
      fileType: contentType,
      size: file.size,
      mediaType: isVideo ? "video" : "image",
      uploadedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Media Upload Error]:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to upload file due to a server error." },
      { status: 500 }
    );
  }
}

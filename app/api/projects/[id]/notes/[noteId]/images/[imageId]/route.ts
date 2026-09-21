import { NextResponse } from "next/server";
import { getObjectFromR2 } from "@/lib/r2";
import fs from "fs";
import path from "path";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; noteId: string; imageId: string }> }
) {
  try {
    const { id: projectId, noteId, imageId } = await params;
    const storageKey = `Project-Notes/${projectId}/${noteId}/${imageId}.webp`;

    let data = await getObjectFromR2(storageKey);

    // Fallback to local storage if not yet in R2
    if (!data) {
      try {
        const localPath = path.join(
          process.cwd(),
          "public",
          "uploads",
          "notes",
          projectId,
          noteId,
          `${imageId}.webp`
        );
        if (fs.existsSync(localPath)) {
          const buffer = fs.readFileSync(localPath);
          data = { body: buffer, contentType: "image/webp" };
        }
      } catch {
        // Ignore fallback error
      }
    }

    if (!data) {
      return new NextResponse("Image not found", { status: 404 });
    }

    return new NextResponse(Buffer.from(data.body), {
      headers: {
        "Content-Type": data.contentType || "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err: any) {
    return new NextResponse("Internal server error", { status: 500 });
  }
}

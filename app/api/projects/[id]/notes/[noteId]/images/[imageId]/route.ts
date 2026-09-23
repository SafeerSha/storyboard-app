import { NextResponse } from "next/server";
import { getObjectFromR2 } from "@/lib/r2";
import { authorizeProjectMember } from "@/lib/project-auth";
import fs from "fs";
import path from "path";

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; noteId: string; imageId: string }> }
) {
  try {
    const { id: projectId, noteId, imageId } = await params;

    // 1. Strict UUID validation to prevent path traversal
    if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(noteId) || !UUID_REGEX.test(imageId)) {
      return new NextResponse("Invalid resource identifier", { status: 400 });
    }

    // 2. Authorize project member (Freelancer, Super Admin, or Assigned Team Member)
    const auth = await authorizeProjectMember(projectId);
    if (!auth.authorized) {
      return new NextResponse(auth.error || "Unauthorized", { status: 403 });
    }

    const storageKey = `Project-Notes/${projectId}/${noteId}/${imageId}.webp`;

    let data = await getObjectFromR2(storageKey);

    // Fallback to local storage if not yet in R2
    if (!data) {
      try {
        const baseUploadsDir = path.resolve(process.cwd(), "public", "uploads", "notes");
        const localPath = path.resolve(baseUploadsDir, projectId, noteId, `${imageId}.webp`);

        // Ensure resolved path does not traverse outside the base uploads directory
        if (localPath.startsWith(baseUploadsDir) && fs.existsSync(localPath)) {
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

    // Private cache header to prevent caching confidential project diagrams in public proxies/CDNs
    return new NextResponse(Buffer.from(data.body), {
      headers: {
        "Content-Type": data.contentType || "image/webp",
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
      },
    });
  } catch (err: any) {
    return new NextResponse("Internal server error", { status: 500 });
  }
}

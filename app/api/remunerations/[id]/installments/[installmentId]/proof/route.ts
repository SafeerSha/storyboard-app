import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getObjectFromR2 } from "@/lib/r2";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; installmentId: string }> }
) {
  try {
    const { id: remunerationId, installmentId } = await params;
    const auth = await createClient();
    const {
      data: { user },
    } = await auth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // 1. Fetch remuneration and project for authorization
    const { data: remuneration } = await admin
      .from("remunerations")
      .select("*, project:projects(id, owner_id)")
      .eq("id", remunerationId)
      .maybeSingle();

    if (!remuneration) {
      return NextResponse.json({ error: "Remuneration not found" }, { status: 404 });
    }

    const { data: profile } = await admin
      .from("freelancer_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const isSuperAdmin = profile?.role === "super_admin";
    if (remuneration.project?.owner_id !== user.id && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden. Access denied." }, { status: 403 });
    }

    // 2. Fetch proof record
    const { data: proof } = await admin
      .from("remuneration_proofs")
      .select("*")
      .eq("installment_id", installmentId)
      .eq("remuneration_id", remunerationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!proof) {
      return NextResponse.json({ error: "No proof attached for this payment" }, { status: 404 });
    }

    // 3. Fetch file from Cloudflare R2
    const r2Object = await getObjectFromR2(proof.storage_key);
    if (!r2Object) {
      return NextResponse.json({ error: "Proof file not found in storage" }, { status: 404 });
    }

    // 4. Stream back private response
    const headers = new Headers();
    headers.set("Content-Type", proof.mime_type || r2Object.contentType || "application/octet-stream");
    headers.set("Content-Disposition", `inline; filename="${encodeURIComponent(proof.file_name)}"`);
    headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");

    return new Response(r2Object.body as any, {
      status: 200,
      headers,
    });
  } catch (err: any) {
    console.error("GET proof error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

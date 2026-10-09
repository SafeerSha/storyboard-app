import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyRemunerationAgreementCreated } from "@/lib/notifications/service";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: remunerationId } = await params;
    const auth = await createClient();
    const {
      data: { user },
    } = await auth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const admin = createAdminClient();

    // 1. Fetch remuneration
    const { data: rem, error: remError } = await admin
      .from("remunerations")
      .select("*")
      .eq("id", remunerationId)
      .maybeSingle();

    if (remError || !rem) {
      return NextResponse.json({ error: "Remuneration agreement not found." }, { status: 404 });
    }

    // 2. Fetch project
    const { data: project } = await admin
      .from("projects")
      .select("id, name, owner_id")
      .eq("id", rem.project_id)
      .maybeSingle();

    if (!project) {
      return NextResponse.json({ error: "Associated project not found." }, { status: 404 });
    }

    // Verify ownership
    const { data: profile } = await admin
      .from("freelancer_profiles")
      .select("role, name")
      .eq("id", user.id)
      .maybeSingle();

    const isSuperAdmin = profile?.role === "super_admin";
    if (project.owner_id !== user.id && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden. Access denied." }, { status: 403 });
    }

    // 3. Resolve client & target email
    const { data: clients } = await admin
      .from("clients")
      .select("id, name, email, status")
      .eq("project_id", rem.project_id);

    const client = clients && clients.length > 0
      ? clients.find((c) => c.status === "active") || clients[0]
      : null;

    const targetEmail = body.clientEmail || client?.email;

    if (!targetEmail || !targetEmail.includes("@")) {
      return NextResponse.json(
        { error: "No valid client email address provided or found for this project." },
        { status: 400 }
      );
    }

    // Update client email if not set
    if (client && body.clientEmail && client.email !== body.clientEmail) {
      await admin.from("clients").update({ email: body.clientEmail }).eq("id", client.id);
    }

    // 4. Dispatch Agreement Email
    await notifyRemunerationAgreementCreated({
      remunerationId: rem.id,
      projectName: project.name,
      clientName: client?.name || body.clientName || "Valued Client",
      clientEmail: targetEmail,
      totalAmount: Number(rem.total_amount) || 0,
      currency: rem.currency || "INR",
      paymentMethod: rem.payment_method || "single",
      agreementDate: rem.agreement_date || rem.created_at?.split("T")[0],
      notes: rem.notes,
    });

    return NextResponse.json({
      success: true,
      message: `Agreement confirmation email sent successfully to ${targetEmail}`,
    });
  } catch (err: any) {
    console.error("POST /api/remunerations/[id]/send-agreement-email error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

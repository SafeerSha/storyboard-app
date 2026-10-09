import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordRemunerationAuditEvent, notifyPaymentReceived } from "@/lib/notifications/service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: remunerationId } = await params;
    const auth = await createClient();
    const { data: { user } } = await auth.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const body = await req.json();
    const { amount, dueDate, sendEmail } = body;

    if (!amount || amount <= 0) return NextResponse.json({ error: "Valid amount required" }, { status: 400 });

    // Fetch remuneration to verify access and get count of installments for numbering
    const { data: rem, error: remErr } = await admin
      .from("remunerations")
      .select("*, project:projects(id, name, owner_id)")
      .eq("id", remunerationId)
      .maybeSingle();
      
    if (remErr || !rem) return NextResponse.json({ error: "Remuneration not found" }, { status: 404 });

    const { data: profile } = await admin.from("freelancer_profiles").select("role, name, email").eq("id", user.id).maybeSingle();
    const isSuperAdmin = profile?.role === "super_admin";
    if (rem.project?.owner_id !== user.id && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get current installments count
    const { data: currentInsts } = await admin.from("remuneration_installments").select("id").eq("remuneration_id", remunerationId);
    const nextInstNumber = (currentInsts?.length || 0) + 1;

    // Create installment (Request)
    const { data: newInst, error: instErr } = await admin.from("remuneration_installments").insert({
      remuneration_id: remunerationId,
      installment_number: nextInstNumber,
      name: `Payment Request #${nextInstNumber}`,
      amount,
      due_date: dueDate || null,
      status: "requested",
      requested_date: new Date().toISOString(),
      received_amount: 0
    }).select().single();

    if (instErr) return NextResponse.json({ error: instErr.message }, { status: 500 });

    const actorName = profile?.name || user.email?.split("@")[0] || "Owner";
    
    // Audit log
    await recordRemunerationAuditEvent({
      remunerationId,
      installmentId: newInst.id,
      actorId: user.id,
      actorName,
      action: "payment_requested",
      title: `Payment Request #${nextInstNumber} Created`,
      description: `Requested ${rem.currency} ${amount}${dueDate ? ` due on ${dueDate}` : ""}.`,
      metadata: { amount, dueDate, sendEmail }
    });

    return NextResponse.json({ success: true, request: newInst });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

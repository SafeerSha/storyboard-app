import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordRemunerationAuditEvent } from "@/lib/notifications/service";

export const dynamic = "force-dynamic";

export async function DELETE(
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

    // 1. Fetch remuneration and verify ownership
    const { data: rem, error: remErr } = await admin
      .from("remunerations")
      .select("*, project:projects(id, name, owner_id)")
      .eq("id", remunerationId)
      .maybeSingle();

    if (remErr || !rem) {
      return NextResponse.json({ error: "Remuneration not found" }, { status: 404 });
    }

    const { data: profile } = await admin
      .from("freelancer_profiles")
      .select("role, name, email")
      .eq("id", user.id)
      .maybeSingle();

    const isSuperAdmin = profile?.role === "super_admin";
    if (rem.project?.owner_id !== user.id && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden. Access denied." }, { status: 403 });
    }

    // 2. Fetch the installment
    const { data: installment, error: instErr } = await admin
      .from("remuneration_installments")
      .select("*")
      .eq("id", installmentId)
      .eq("remuneration_id", remunerationId)
      .maybeSingle();

    if (instErr || !installment) {
      return NextResponse.json({ error: "Installment milestone not found" }, { status: 404 });
    }

    // 3. Find any linked payments
    const { data: linkedPayments } = await admin
      .from("remuneration_payments")
      .select("id")
      .eq("installment_id", installmentId);

    const paymentIds = (linkedPayments || []).map((p) => p.id);

    // 4. Delete payment team splits if any
    if (paymentIds.length > 0) {
      await admin.from("payment_team_splits").delete().in("payment_id", paymentIds);
    }

    // 5. Delete proofs if any
    await admin.from("remuneration_proofs").delete().eq("installment_id", installmentId);

    // 6. Delete payments
    if (paymentIds.length > 0) {
      await admin.from("remuneration_payments").delete().eq("installment_id", installmentId);
    }

    // 7. Delete the installment
    const { error: delErr } = await admin
      .from("remuneration_installments")
      .delete()
      .eq("id", installmentId)
      .eq("remuneration_id", remunerationId);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    // 8. Recalculate Remuneration Status & Totals
    const { data: remainingInsts } = await admin
      .from("remuneration_installments")
      .select("id, status, amount, received_amount")
      .eq("remuneration_id", remunerationId);

    const totalCollected = (remainingInsts || []).reduce(
      (sum, i) => sum + (Number(i.received_amount) || 0),
      0
    );
    const totalAmount = Number(rem.total_amount) || 0;
    const remainingBalance = Math.max(0, totalAmount - totalCollected);

    const allPaid =
      remainingInsts &&
      remainingInsts.length > 0 &&
      remainingInsts.every(
        (i) =>
          i.status === "paid" ||
          i.status === "completed" ||
          Number(i.received_amount) >= Number(i.amount) - 0.01
      );

    const newParentStatus = allPaid && remainingBalance === 0 ? "completed" : "active";

    await admin
      .from("remunerations")
      .update({
        status: newParentStatus,
        agreement_status: newParentStatus === "completed" ? "completed" : "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", remunerationId);

    // 9. Record audit event
    const actorName = profile?.name || user.email?.split("@")[0] || "Owner";
    await recordRemunerationAuditEvent({
      remunerationId,
      actorId: user.id,
      actorName,
      action: "installment_deleted",
      title: "Payment Request / Milestone Removed",
      description: `Deleted ${installment.name || `Installment #${installment.installment_number}`} of amount ${rem.currency} ${installment.amount}.`,
      metadata: {
        installmentId,
        name: installment.name,
        amount: installment.amount,
        hadPayments: paymentIds.length > 0,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE installment error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordRemunerationAuditEvent } from "@/lib/notifications/service";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  try {
    const { id: remunerationId, paymentId } = await params;
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

    // 2. Fetch the payment record
    const { data: payment, error: payErr } = await admin
      .from("remuneration_payments")
      .select("*")
      .eq("id", paymentId)
      .eq("remuneration_id", remunerationId)
      .maybeSingle();

    if (payErr || !payment) {
      return NextResponse.json({ error: "Transaction payment record not found" }, { status: 404 });
    }

    const paymentAmount = Number(payment.amount) || 0;
    const instId = payment.installment_id;

    // 3. Delete team splits associated with this payment
    await admin.from("payment_team_splits").delete().eq("payment_id", paymentId);

    // 4. Delete proofs associated with this payment
    await admin.from("remuneration_proofs").delete().eq("payment_id", paymentId);

    // 5. Delete the payment record
    const { error: delPayErr } = await admin
      .from("remuneration_payments")
      .delete()
      .eq("id", paymentId)
      .eq("remuneration_id", remunerationId);

    if (delPayErr) {
      return NextResponse.json({ error: delPayErr.message }, { status: 500 });
    }

    // 6. Update or clean up the associated installment
    if (instId) {
      const { data: inst } = await admin
        .from("remuneration_installments")
        .select("*")
        .eq("id", instId)
        .maybeSingle();

      if (inst) {
        // Check remaining payments on this installment
        const { data: otherPayments } = await admin
          .from("remuneration_payments")
          .select("amount")
          .eq("installment_id", instId);

        const newReceivedTotal = (otherPayments || []).reduce(
          (sum, p) => sum + (Number(p.amount) || 0),
          0
        );

        const isIndependent = inst.name?.startsWith("Independent Payment");

        if (isIndependent && newReceivedTotal <= 0 && (!otherPayments || otherPayments.length === 0)) {
          // Clean up auto-created dummy installment for independent payment
          await admin.from("remuneration_installments").delete().eq("id", instId);
        } else {
          const todayStr = new Date().toISOString().split("T")[0];
          const instTarget = Number(inst.amount) || 0;
          let newStatus = inst.status;

          if (newReceivedTotal >= instTarget - 0.01 && instTarget > 0) {
            newStatus = "paid";
          } else if (newReceivedTotal > 0) {
            newStatus = "partially_paid";
          } else {
            if (inst.due_date && inst.due_date < todayStr) {
              newStatus = "due";
            } else if (inst.requested_date) {
              newStatus = "requested";
            } else {
              newStatus = "planned";
            }
          }

          await admin
            .from("remuneration_installments")
            .update({
              received_amount: newReceivedTotal,
              status: newStatus,
              updated_at: new Date().toISOString(),
            })
            .eq("id", instId);
        }
      }
    }

    // 7. Recalculate Remuneration metrics and status
    const { data: allInsts } = await admin
      .from("remuneration_installments")
      .select("id, status, amount, received_amount")
      .eq("remuneration_id", remunerationId);

    const totalCollected = (allInsts || []).reduce(
      (sum, i) => sum + (Number(i.received_amount) || 0),
      0
    );
    const totalAmount = Number(rem.total_amount) || 0;
    const remainingBalance = Math.max(0, totalAmount - totalCollected);

    const allPaid =
      allInsts &&
      allInsts.length > 0 &&
      allInsts.every(
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

    // 8. Record audit log
    const actorName = profile?.name || user.email?.split("@")[0] || "Owner";
    await recordRemunerationAuditEvent({
      remunerationId,
      actorId: user.id,
      actorName,
      action: "payment_deleted",
      title: "Transaction Record Deleted",
      description: `Removed transaction of ${rem.currency} ${paymentAmount.toLocaleString()}${payment.payment_method ? ` (${payment.payment_method})` : ""}.`,
      metadata: {
        paymentId,
        amount: paymentAmount,
        paymentDate: payment.payment_date,
        reference: payment.payment_reference,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE payment error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

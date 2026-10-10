import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, getAppBaseUrl } from "@/lib/email/resend";
import { generatePaymentAllocatedTeamEmail } from "@/lib/email/templates/payment-allocated-team";
import {
  recordRemunerationAuditEvent,
  logNotification,
  createInAppNotification,
} from "@/lib/notifications/service";

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
    const {
      paymentId,
      teamMemberId,
      memberName,
      recipientEmail,
      amount,
      role,
      percentage,
    } = body;

    if (!recipientEmail || !recipientEmail.includes("@")) {
      return NextResponse.json(
        { error: "A valid recipient email address is required." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // 1. Fetch Remuneration
    const { data: rem, error: remErr } = await admin
      .from("remunerations")
      .select("*, project:projects(id, name, owner_id)")
      .eq("id", remunerationId)
      .maybeSingle();

    if (remErr || !rem) {
      return NextResponse.json({ error: "Remuneration agreement not found." }, { status: 404 });
    }

    // 2. Verify Ownership / Permissions
    const { data: profile } = await admin
      .from("freelancer_profiles")
      .select("role, name, email")
      .eq("id", user.id)
      .maybeSingle();

    const isSuperAdmin = profile?.role === "super_admin";
    if (rem.project?.owner_id !== user.id && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden. Access denied." }, { status: 403 });
    }

    // 3. Fetch Payment details if paymentId provided
    let paymentRecord: any = null;
    if (paymentId) {
      const { data: pm } = await admin
        .from("remuneration_payments")
        .select("*")
        .eq("id", paymentId)
        .eq("remuneration_id", remunerationId)
        .maybeSingle();
      paymentRecord = pm;
    }

    const allocatedAmount = Number(amount) || 0;
    const totalPaymentAmount = paymentRecord ? Number(paymentRecord.amount) || allocatedAmount : allocatedAmount;
    const currency = rem.currency || "INR";
    const projectName = rem.project?.name || "Project";
    const paymentDate = paymentRecord?.payment_date
      ? new Date(paymentRecord.payment_date).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : new Date().toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
    const paymentMethod = paymentRecord?.payment_method || "Bank Transfer";
    const paymentReference = paymentRecord?.payment_reference || null;

    // 4. Update team_users email if teamMemberId exists and email was missing/changed
    if (teamMemberId) {
      try {
        await admin
          .from("team_users")
          .update({ email: recipientEmail, updated_at: new Date().toISOString() })
          .eq("id", teamMemberId);
      } catch {}
    }

    // 5. Generate Email
    const { subject, html, text } = generatePaymentAllocatedTeamEmail({
      recipientName: memberName || "Team Member",
      projectName,
      paymentAmount: totalPaymentAmount,
      allocatedAmount,
      percentage: percentage || null,
      currency,
      role: role || null,
      receivedDate: paymentDate,
      paymentMethod,
      paymentReference,
      portalUrl: `${getAppBaseUrl()}/team`,
    });

    // 6. Send Email
    const emailResult = await sendEmail({
      to: recipientEmail,
      subject,
      html,
      text,
    });

    // 7. Log Notification Delivery
    await logNotification({
      remunerationId,
      paymentId: paymentId || null,
      recipient: recipientEmail,
      recipientName: memberName || "Team Member",
      recipientType: "team_member",
      notificationType: "payment_allocated",
      channel: "email",
      status: emailResult.success ? "sent" : "failed",
      title: `Payment Share: ${currency} ${allocatedAmount.toLocaleString()}`,
      failureReason: emailResult.error,
    });

    // 8. In-App Notification if user ID exists
    if (teamMemberId) {
      await createInAppNotification({
        userId: teamMemberId,
        title: "💵 Payment Share Paid",
        message: `You were allocated ${currency} ${allocatedAmount.toLocaleString()} from a payment on ${projectName}.`,
        linkUrl: `${getAppBaseUrl()}/team`,
        type: "payment_allocated",
      });
    }

    // 9. Audit trail event
    const actorName = profile?.name || user.email?.split("@")[0] || "Owner";
    await recordRemunerationAuditEvent({
      remunerationId,
      paymentId: paymentId || null,
      actorId: user.id,
      actorName,
      action: "team_payment_email_sent",
      title: `Allocation Email Sent to ${memberName || "Team Member"}`,
      description: `Sent allocation notification of ${currency} ${allocatedAmount.toLocaleString()} to ${recipientEmail}.`,
      metadata: {
        recipientEmail,
        memberName,
        amount: allocatedAmount,
        paymentId,
      },
    });

    if (!emailResult.success) {
      return NextResponse.json(
        { error: emailResult.error || "Failed to send email via mail server." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Payment allocation email sent to ${recipientEmail}`,
    });
  } catch (err: any) {
    console.error("POST /api/remunerations/[id]/send-team-email error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

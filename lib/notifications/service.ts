import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, getAppBaseUrl } from "@/lib/email/resend";
import { generatePaymentRequestedEmail } from "@/lib/email/templates/payment-requested";
import { generatePaymentReceivedEmail } from "@/lib/email/templates/payment-received";
import { generateRemunerationCompletedEmail } from "@/lib/email/templates/remuneration-completed";

export interface CreateInAppNotificationParams {
  userId: string;
  title: string;
  message: string;
  type?: string;
  linkUrl?: string;
}

export interface RecordAuditTrailParams {
  remunerationId: string;
  installmentId?: string | null;
  actorId: string;
  actorName: string;
  action: string;
  title: string;
  description?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Creates an in-app notification in public.notifications
 */
export async function createInAppNotification({
  userId,
  title,
  message,
  type = "remuneration",
  linkUrl,
}: CreateInAppNotificationParams) {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("notifications").insert({
      user_id: userId,
      title,
      message,
      type,
      link_url: linkUrl || null,
      is_read: false,
    });

    if (error) {
      console.warn("[Notification Service] Error creating notification:", error.message);
    }
  } catch (err: any) {
    console.warn("[Notification Service] Failed to create in-app notification:", err?.message);
  }
}

/**
 * Records an immutable financial audit trail event in public.remuneration_events
 */
export async function recordRemunerationAuditEvent({
  remunerationId,
  installmentId,
  actorId,
  actorName,
  action,
  title,
  description,
  metadata = {},
}: RecordAuditTrailParams) {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("remuneration_events").insert({
      remuneration_id: remunerationId,
      installment_id: installmentId || null,
      actor_id: actorId,
      actor_name: actorName,
      action,
      title,
      description: description || null,
      metadata,
    });

    if (error) {
      console.warn("[Audit Trail] Error recording audit event:", error.message);
    }
  } catch (err: any) {
    console.warn("[Audit Trail] Failed to record audit event:", err?.message);
  }
}

/**
 * Dispatches notification and email when an installment payment is requested from client
 */
export async function notifyPaymentRequested({
  remunerationId,
  installmentId,
  installmentNumber,
  totalInstallments,
  amount,
  currency,
  dueDate,
  notes,
  projectName,
  clientName,
  clientEmail,
  ownerId,
  actorName,
}: {
  remunerationId: string;
  installmentId: string;
  installmentNumber: number;
  totalInstallments?: number;
  amount: number;
  currency: string;
  dueDate: string;
  notes?: string | null;
  projectName: string;
  clientName: string;
  clientEmail?: string | null;
  ownerId: string;
  actorName: string;
}) {
  const baseUrl = getAppBaseUrl();
  const remUrl = `${baseUrl}/remunerations/${remunerationId}`;

  // 1. Audit Trail
  await recordRemunerationAuditEvent({
    remunerationId,
    installmentId,
    actorId: ownerId,
    actorName,
    action: "payment_requested",
    title: `Payment Requested: Installment #${installmentNumber}`,
    description: `Requested payment of ${currency} ${amount.toLocaleString()} due on ${dueDate}.`,
    metadata: { installmentNumber, amount, currency, dueDate },
  });

  // 2. (No self-notification — the freelancer clicked Request themselves; audit trail is sufficient)

  // 3. Email to Client if client email exists
  if (clientEmail && clientEmail.includes("@")) {
    try {
      const emailHtml = generatePaymentRequestedEmail({
        clientName,
        projectName,
        installmentNumber,
        totalInstallments,
        amount,
        currency,
        dueDate,
        notes,
        portalUrl: `${baseUrl}/client`,
      });

      await sendEmail({
        to: clientEmail,
        subject: `Payment Request — ${projectName} (Installment #${installmentNumber})`,
        html: emailHtml,
      });
    } catch (err) {
      console.warn("[Email Service] Failed to send payment request email:", err);
    }
  }
}

/**
 * Dispatches notification and receipt email when an installment is marked received
 */
export async function notifyPaymentReceived({
  remunerationId,
  installmentId,
  installmentNumber,
  amount,
  currency,
  receivedDate,
  paymentMethod,
  paymentReference,
  remainingAmount,
  projectName,
  clientName,
  clientEmail,
  ownerId,
  ownerEmail,
  actorName,
  sendEmailNotification = true,
}: {
  remunerationId: string;
  installmentId: string;
  installmentNumber: number;
  amount: number;
  currency: string;
  receivedDate: string;
  paymentMethod: string;
  paymentReference?: string | null;
  remainingAmount: number;
  projectName: string;
  clientName: string;
  clientEmail?: string | null;
  ownerId: string;
  ownerEmail?: string | null;
  actorName: string;
  sendEmailNotification?: boolean;
}) {
  const baseUrl = getAppBaseUrl();
  const remUrl = `${baseUrl}/remunerations/${remunerationId}`;

  // 1. Audit Trail
  await recordRemunerationAuditEvent({
    remunerationId,
    installmentId,
    actorId: ownerId,
    actorName,
    action: "payment_received",
    title: `Payment Received: Installment #${installmentNumber}`,
    description: `Confirmed payment of ${currency} ${amount.toLocaleString()} received via ${paymentMethod}${paymentReference ? ` (Ref: ${paymentReference})` : ""}.${sendEmailNotification ? "" : " (Confirmation email suppressed by toggle)"}`,
    metadata: { installmentNumber, amount, currency, paymentMethod, paymentReference, sendEmailNotification },
  });

  // 2. In-App Notification
  await createInAppNotification({
    userId: ownerId,
    title: "💰 Payment Received",
    message: `${currency} ${amount.toLocaleString()} received for ${projectName} (Installment #${installmentNumber}).`,
    linkUrl: remUrl,
    type: "payment_received",
  });

  // 3. Receipt email to Client and/or internal owner (if enabled)
  if (sendEmailNotification) {
    const recipients = [clientEmail, ownerEmail].filter((e): e is string => Boolean(e && e.includes("@")));
    if (recipients.length > 0) {
    try {
      const emailHtml = generatePaymentReceivedEmail({
        recipientName: clientName || "Valued Client",
        projectName,
        installmentNumber,
        amount,
        currency,
        receivedDate,
        paymentMethod,
        paymentReference,
        remainingAmount,
        viewUrl: remUrl,
      });

      await sendEmail({
        to: recipients,
        subject: `Payment Receipt — ${projectName} (Installment #${installmentNumber})`,
        html: emailHtml,
      });
    } catch (err) {
      console.warn("[Email Service] Failed to send payment receipt email:", err);
    }
  }
}
}

/**
 * Dispatches completion notification when entire remuneration reaches 100% paid
 */
export async function notifyRemunerationCompleted({
  remunerationId,
  totalAmount,
  currency,
  projectName,
  clientName,
  clientEmail,
  ownerId,
  ownerEmail,
  actorName,
}: {
  remunerationId: string;
  totalAmount: number;
  currency: string;
  projectName: string;
  clientName: string;
  clientEmail?: string | null;
  ownerId: string;
  ownerEmail?: string | null;
  actorName: string;
}) {
  const baseUrl = getAppBaseUrl();
  const remUrl = `${baseUrl}/remunerations/${remunerationId}`;

  // 1. Audit Trail
  await recordRemunerationAuditEvent({
    remunerationId,
    actorId: ownerId,
    actorName,
    action: "remuneration_completed",
    title: "Remuneration Fully Settled",
    description: `All payments completed in full. Total collected: ${currency} ${totalAmount.toLocaleString()}.`,
    metadata: { totalAmount, currency },
  });

  // 2. In-App Notification
  await createInAppNotification({
    userId: ownerId,
    title: "🎉 Remuneration Completed!",
    message: `All scheduled payments for ${projectName} have been completed in full!`,
    linkUrl: remUrl,
    type: "remuneration_completed",
  });

  // 3. Completion Email
  const recipients = [clientEmail, ownerEmail].filter((e): e is string => Boolean(e && e.includes("@")));
  if (recipients.length > 0) {
    try {
      const emailHtml = generateRemunerationCompletedEmail({
        recipientName: clientName || "Valued Partner",
        projectName,
        totalAmount,
        currency,
        viewUrl: remUrl,
      });

      await sendEmail({
        to: recipients,
        subject: `🎉 Remuneration Settled in Full — ${projectName}`,
        html: emailHtml,
      });
    } catch (err) {
      console.warn("[Email Service] Failed to send remuneration completion email:", err);
    }
  }
}

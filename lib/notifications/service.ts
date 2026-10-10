import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, getAppBaseUrl } from "@/lib/email/resend";
import { generatePaymentRequestedEmail } from "@/lib/email/templates/payment-requested";
import { generatePaymentReceivedEmail } from "@/lib/email/templates/payment-received";
import { generateRemunerationCompletedEmail } from "@/lib/email/templates/remuneration-completed";
import { generatePaymentAllocatedTeamEmail } from "@/lib/email/templates/payment-allocated-team";
import { generateInstallmentCreatedClientEmail } from "@/lib/email/templates/installment-created-client";
import { generateRemunerationAgreementClientEmail } from "@/lib/email/templates/remuneration-agreement-client";
import {
  DEFAULT_CLIENT_EMAIL_SETTINGS,
  DEFAULT_TEAM_NOTIFICATION_SETTINGS,
  type ClientEmailSettings,
  type TeamNotificationSettings,
  type RemunerationNotificationPreferences,
  type NotificationLog,
} from "@/lib/types/remuneration";

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
  paymentId?: string | null;
  actorId: string;
  actorName: string;
  action: string;
  title: string;
  description?: string | null;
  metadata?: Record<string, any>;
}

export interface LogNotificationParams {
  remunerationId?: string | null;
  installmentId?: string | null;
  paymentId?: string | null;
  recipient: string;
  recipientName?: string | null;
  recipientType: "client" | "team_member" | "admin";
  notificationType: string;
  channel: "email" | "in_app" | "sms";
  status: "sent" | "failed" | "skipped";
  title?: string | null;
  message?: string | null;
  failureReason?: string | null;
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
  paymentId,
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
      metadata: {
        ...metadata,
        paymentId: paymentId || undefined,
      },
    });

    if (error) {
      console.warn("[Audit Trail] Error recording audit event:", error.message);
    }
  } catch (err: any) {
    console.warn("[Audit Trail] Failed to record audit event:", err?.message);
  }
}

/**
 * Records an immutable notification history record in public.notification_logs
 */
export async function logNotification({
  remunerationId,
  installmentId,
  paymentId,
  recipient,
  recipientName,
  recipientType,
  notificationType,
  channel,
  status,
  title,
  message,
  failureReason,
  metadata = {},
}: LogNotificationParams): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("notification_logs").insert({
      remuneration_id: remunerationId || null,
      installment_id: installmentId || null,
      payment_id: paymentId || null,
      recipient,
      recipient_name: recipientName || null,
      recipient_type: recipientType,
      notification_type: notificationType,
      channel,
      status,
      title: title || null,
      message: message || null,
      failure_reason: failureReason || null,
      metadata,
    });
  } catch (err: any) {
    console.warn("[Notification Log] Error saving notification log:", err?.message);
  }
}

/**
 * Retrieves the persisted notification preferences for a remuneration contract,
 * with graceful defaults if not yet configured.
 */
export async function getRemunerationNotificationPreferences(
  remunerationId: string
): Promise<RemunerationNotificationPreferences> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("remuneration_notification_preferences")
      .select("*")
      .eq("remuneration_id", remunerationId)
      .maybeSingle();

    if (error && error.code !== "PGRST116" && !error.message.includes("does not exist")) {
      console.warn("[Notification Service] Error loading preferences:", error.message);
    }

    if (data) {
      return {
        id: data.id,
        remuneration_id: remunerationId,
        client_email_settings: {
          ...DEFAULT_CLIENT_EMAIL_SETTINGS,
          ...(data.client_email_settings || {}),
        },
        team_notification_settings: {
          ...DEFAULT_TEAM_NOTIFICATION_SETTINGS,
          ...(data.team_notification_settings || {}),
        },
        require_full_split: Boolean(data.require_full_split),
      };
    }
  } catch (err: any) {
    console.warn("[Notification Service] Failed to fetch notification preferences:", err?.message);
  }

  return {
    remuneration_id: remunerationId,
    client_email_settings: DEFAULT_CLIENT_EMAIL_SETTINGS,
    team_notification_settings: DEFAULT_TEAM_NOTIFICATION_SETTINGS,
    require_full_split: false,
  };
}

/**
 * Saves or updates notification preferences for a remuneration contract.
 */
export async function saveRemunerationNotificationPreferences(
  remunerationId: string,
  prefs: {
    client_email_settings?: Partial<ClientEmailSettings>;
    team_notification_settings?: Partial<TeamNotificationSettings>;
    require_full_split?: boolean;
  }
): Promise<RemunerationNotificationPreferences> {
  const current = await getRemunerationNotificationPreferences(remunerationId);

  const mergedClient = {
    ...current.client_email_settings,
    ...(prefs.client_email_settings || {}),
  };

  const mergedTeam = {
    ...current.team_notification_settings,
    ...(prefs.team_notification_settings || {}),
  };

  const requireFull = prefs.require_full_split !== undefined ? prefs.require_full_split : current.require_full_split;

  const admin = createAdminClient();
  const upsertPayload = {
    remuneration_id: remunerationId,
    client_email_settings: mergedClient,
    team_notification_settings: mergedTeam,
    require_full_split: requireFull,
    updated_at: new Date().toISOString(),
  };

  const { data } = await admin
    .from("remuneration_notification_preferences")
    .upsert(upsertPayload, { onConflict: "remuneration_id" })
    .select()
    .single();

  return {
    id: data?.id,
    remuneration_id: remunerationId,
    client_email_settings: mergedClient,
    team_notification_settings: mergedTeam,
    require_full_split: requireFull,
  };
}

/**
 * Dispatches notification and email when an installment payment is requested from client,
 * strictly verifying client email preferences and logging delivery history.
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

  // 2. Check Client Email Preference
  const prefs = await getRemunerationNotificationPreferences(remunerationId);
  const isEnabled = prefs.client_email_settings.payment_reminder !== false;

  if (clientEmail && clientEmail.includes("@")) {
    if (!isEnabled) {
      await logNotification({
        remunerationId,
        installmentId,
        recipient: clientEmail,
        recipientName: clientName,
        recipientType: "client",
        notificationType: "payment_requested",
        channel: "email",
        status: "skipped",
        title: `Payment Request Skipped for Installment #${installmentNumber}`,
        message: "Client email notification suppressed by configuration preference.",
      });
      return;
    }

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

      const res = await sendEmail({
        to: clientEmail,
        subject: `Payment Request — ${projectName} (Installment #${installmentNumber})`,
        html: emailHtml,
      });

      await logNotification({
        remunerationId,
        installmentId,
        recipient: clientEmail,
        recipientName: clientName,
        recipientType: "client",
        notificationType: "payment_requested",
        channel: "email",
        status: res.success ? "sent" : "failed",
        title: `Payment Request Email: Installment #${installmentNumber}`,
        failureReason: res.error,
      });
    } catch (err: any) {
      console.warn("[Email Service] Failed to send payment request email:", err);
      await logNotification({
        remunerationId,
        installmentId,
        recipient: clientEmail,
        recipientName: clientName,
        recipientType: "client",
        notificationType: "payment_requested",
        channel: "email",
        status: "failed",
        failureReason: err?.message,
      });
    }
  }
}

/**
 * Dispatches notification and receipt email when an actual payment is recorded,
 * respecting client email settings, and notifying project owner and team members.
 */
export async function notifyPaymentReceived({
  remunerationId,
  installmentId,
  paymentId,
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
  installmentId?: string | null;
  paymentId?: string | null;
  installmentNumber?: number;
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
    installmentId: installmentId || null,
    paymentId: paymentId || null,
    actorId: ownerId,
    actorName,
    action: "payment_received",
    title: `Payment Received: ${currency} ${amount.toLocaleString()}`,
    description: `Confirmed payment received via ${paymentMethod}${paymentReference ? ` (Ref: ${paymentReference})` : ""}.${sendEmailNotification ? "" : " (Receipt email suppressed)"}`,
    metadata: { installmentNumber, amount, currency, paymentMethod, paymentReference },
  });

  // 2. In-App Notification to Owner
  await createInAppNotification({
    userId: ownerId,
    title: "💰 Payment Received",
    message: `${currency} ${amount.toLocaleString()} received for ${projectName}${installmentNumber ? ` (Installment #${installmentNumber})` : ""}.`,
    linkUrl: remUrl,
    type: "payment_received",
  });

  await logNotification({
    remunerationId,
    installmentId: installmentId || null,
    paymentId: paymentId || null,
    recipient: ownerId,
    recipientName: actorName,
    recipientType: "admin",
    notificationType: "payment_received",
    channel: "in_app",
    status: "sent",
    title: "Payment Received In-App Notification",
  });

  // 3. Client Receipt Email (Check Notification Preferences)
  const prefs = await getRemunerationNotificationPreferences(remunerationId);
  const clientEmailAllowed = sendEmailNotification && prefs.client_email_settings.payment_received && prefs.client_email_settings.payment_receipt;

  if (clientEmail && clientEmail.includes("@")) {
    if (!clientEmailAllowed) {
      await logNotification({
        remunerationId,
        installmentId: installmentId || null,
        paymentId: paymentId || null,
        recipient: clientEmail,
        recipientName: clientName,
        recipientType: "client",
        notificationType: "payment_received",
        channel: "email",
        status: "skipped",
        title: "Client Payment Receipt Email",
        message: "Suppressed by client email settings or user toggle.",
      });
    } else {
      try {
        const emailHtml = generatePaymentReceivedEmail({
          recipientName: clientName || "Valued Client",
          projectName,
          installmentNumber: installmentNumber || 1,
          amount,
          currency,
          receivedDate,
          paymentMethod,
          paymentReference,
          remainingAmount,
          viewUrl: remUrl,
        });

        const res = await sendEmail({
          to: clientEmail,
          subject: `Payment Receipt — ${projectName}${installmentNumber ? ` (Installment #${installmentNumber})` : ""}`,
          html: emailHtml,
        });

        await logNotification({
          remunerationId,
          installmentId: installmentId || null,
          paymentId: paymentId || null,
          recipient: clientEmail,
          recipientName: clientName,
          recipientType: "client",
          notificationType: "payment_receipt",
          channel: "email",
          status: res.success ? "sent" : "failed",
          title: `Payment Receipt: ${currency} ${amount.toLocaleString()}`,
          failureReason: res.error,
        });
      } catch (err: any) {
        console.warn("[Email Service] Failed to send payment receipt email:", err);
      }
    }
  }
}

/**
 * Notifies team members when payment splits are allocated to them,
 * strictly verifying team notification preferences and logging results.
 */
export async function notifyPaymentAllocatedToTeam({
  remunerationId,
  paymentId,
  projectName,
  paymentAmount,
  currency,
  receivedDate,
  paymentMethod,
  paymentReference,
  splits,
}: {
  remunerationId: string;
  paymentId: string;
  projectName: string;
  paymentAmount: number;
  currency: string;
  receivedDate: string;
  paymentMethod: string;
  paymentReference?: string | null;
  splits: Array<{
    teamMemberId: string;
    name: string;
    role?: string | null;
    amount: number;
    percentage?: number | null;
    notes?: string | null;
  }>;
}) {
  if (!splits || splits.length === 0) return;

  const prefs = await getRemunerationNotificationPreferences(remunerationId);
  const teamPref = prefs.team_notification_settings.payment_allocated;
  const admin = createAdminClient();
  const baseUrl = getAppBaseUrl();

  for (const split of splits) {
    if (split.amount <= 0) continue;

    // 1. In-App Notification if enabled
    if (teamPref.in_app) {
      await createInAppNotification({
        userId: split.teamMemberId,
        title: "💵 Payment Split Allocated",
        message: `You were allocated ${currency} ${split.amount.toLocaleString()}${split.percentage ? ` (${split.percentage}%)` : ""} from a payment on ${projectName}.`,
        linkUrl: `${baseUrl}/team`,
        type: "payment_allocated",
      });

      await logNotification({
        remunerationId,
        paymentId,
        recipient: split.teamMemberId,
        recipientName: split.name,
        recipientType: "team_member",
        notificationType: "payment_allocated",
        channel: "in_app",
        status: "sent",
        title: `Split Allocated: ${currency} ${split.amount.toLocaleString()}`,
      });
    } else {
      await logNotification({
        remunerationId,
        paymentId,
        recipient: split.teamMemberId,
        recipientName: split.name,
        recipientType: "team_member",
        notificationType: "payment_allocated",
        channel: "in_app",
        status: "skipped",
        message: "In-app notification disabled in team notification settings.",
      });
    }

    // 2. Email Notification if enabled
    if (teamPref.email) {
      let recipientEmail = "";

      // Check if team member has email in freelancer_profiles or team_users
      const { data: profile } = await admin
        .from("freelancer_profiles")
        .select("email")
        .eq("id", split.teamMemberId)
        .maybeSingle();

      if (profile?.email) {
        recipientEmail = profile.email;
      } else {
        let { data: teamUser, error: tuErr } = await admin
          .from("team_users")
          .select("email, username")
          .eq("id", split.teamMemberId)
          .maybeSingle();

        if (tuErr && (tuErr.code === "42703" || tuErr.message?.includes("email"))) {
          const fallback = await admin
            .from("team_users")
            .select("username")
            .eq("id", split.teamMemberId)
            .maybeSingle();
          teamUser = fallback.data ? { ...fallback.data, email: null } : null;
        }

        if (teamUser?.email && teamUser.email.includes("@")) {
          recipientEmail = teamUser.email;
        } else if (teamUser?.username && teamUser.username.includes("@")) {
          recipientEmail = teamUser.username;
        }
      }

      if (recipientEmail && recipientEmail.includes("@")) {
        try {
          const { subject, html, text } = generatePaymentAllocatedTeamEmail({
            recipientName: split.name,
            projectName,
            paymentAmount,
            allocatedAmount: split.amount,
            percentage: split.percentage,
            currency,
            role: split.role,
            receivedDate,
            paymentMethod,
            paymentReference,
            notes: split.notes,
            portalUrl: `${baseUrl}/team`,
          });

          const res = await sendEmail({
            to: recipientEmail,
            subject,
            html,
            text,
          });

          await logNotification({
            remunerationId,
            paymentId,
            recipient: recipientEmail,
            recipientName: split.name,
            recipientType: "team_member",
            notificationType: "payment_allocated",
            channel: "email",
            status: res.success ? "sent" : "failed",
            title: `Split Allocated Email: ${currency} ${split.amount.toLocaleString()}`,
            failureReason: res.error,
          });
        } catch (err: any) {
          console.warn("[Email Service] Failed to send team allocation email:", err);
          await logNotification({
            remunerationId,
            paymentId,
            recipient: recipientEmail,
            recipientName: split.name,
            recipientType: "team_member",
            notificationType: "payment_allocated",
            channel: "email",
            status: "failed",
            failureReason: err?.message,
          });
        }
      }
    }
  }
}

/**
 * Notifies client when a new milestone installment is planned,
 * if enabled in client email settings.
 */
export async function notifyInstallmentCreated({
  remunerationId,
  installmentId,
  installmentNumber,
  name,
  amount,
  currency,
  dueDate,
  description,
  projectName,
  clientName,
  clientEmail,
}: {
  remunerationId: string;
  installmentId: string;
  installmentNumber: number;
  name?: string | null;
  amount: number;
  currency: string;
  dueDate?: string | null;
  description?: string | null;
  projectName: string;
  clientName: string;
  clientEmail?: string | null;
}) {
  if (!clientEmail || !clientEmail.includes("@")) return;

  const prefs = await getRemunerationNotificationPreferences(remunerationId);
  if (!prefs.client_email_settings.installment_created) {
    await logNotification({
      remunerationId,
      installmentId,
      recipient: clientEmail,
      recipientName: clientName,
      recipientType: "client",
      notificationType: "installment_created",
      channel: "email",
      status: "skipped",
      message: "Installment created email suppressed by client email settings.",
    });
    return;
  }

  try {
    const { subject, html, text } = generateInstallmentCreatedClientEmail({
      clientName,
      projectName,
      installmentNumber,
      name,
      amount,
      currency,
      dueDate,
      description,
      portalUrl: `${getAppBaseUrl()}/client`,
    });

    const res = await sendEmail({
      to: clientEmail,
      subject,
      html,
      text,
    });

    await logNotification({
      remunerationId,
      installmentId,
      recipient: clientEmail,
      recipientName: clientName,
      recipientType: "client",
      notificationType: "installment_created",
      channel: "email",
      status: res.success ? "sent" : "failed",
      title: `Installment Created Email: #${installmentNumber}`,
      failureReason: res.error,
    });
  } catch (err: any) {
    console.warn("[Email Service] Failed to send installment created email:", err);
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

/**
 * Dispatches confirmation email to client when a project remuneration agreement is created.
 */
export async function notifyRemunerationAgreementCreated({
  remunerationId,
  projectName,
  clientName,
  clientEmail,
  totalAmount,
  currency,
  paymentMethod,
  agreementDate,
  notes,
}: {
  remunerationId: string;
  projectName: string;
  clientName: string;
  clientEmail: string;
  totalAmount: number;
  currency: string;
  paymentMethod: string;
  agreementDate?: string | null;
  notes?: string | null;
}) {
  if (!clientEmail || !clientEmail.includes("@")) return;

  const baseUrl = getAppBaseUrl();

  try {
    const { subject, html, text } = generateRemunerationAgreementClientEmail({
      clientName,
      projectName,
      totalAmount,
      currency,
      paymentMethod,
      agreementDate,
      notes,
      portalUrl: `${baseUrl}/client`,
    });

    const res = await sendEmail({
      to: clientEmail,
      subject,
      html,
      text,
    });

    await logNotification({
      remunerationId,
      recipient: clientEmail,
      recipientName: clientName,
      recipientType: "client",
      notificationType: "agreement_created",
      channel: "email",
      status: res.success ? "sent" : "failed",
      title: `Agreement Confirmation: ${projectName}`,
      message: `Sent payment agreement confirmation for ${currency} ${totalAmount.toLocaleString()} to ${clientEmail}.`,
      metadata: { totalAmount, currency, paymentMethod, agreementDate },
    });
  } catch (err: any) {
    console.warn("[Email Service] Failed to send agreement creation email:", err);
    await logNotification({
      remunerationId,
      recipient: clientEmail,
      recipientName: clientName,
      recipientType: "client",
      notificationType: "agreement_created",
      channel: "email",
      status: "failed",
      title: `Agreement Confirmation Failed: ${projectName}`,
      failureReason: err?.message || "Internal sending error",
    });
  }
}

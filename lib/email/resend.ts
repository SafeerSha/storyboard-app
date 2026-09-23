import nodemailer from "nodemailer";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateQuotationPublishedEmail,
  QuotationPublishedEmailProps,
} from "./templates/quotation-published";
import {
  generateQuotationApprovedEmail,
  QuotationApprovedEmailProps,
} from "./templates/quotation-approved";
import {
  generateQuotationChangesRequestedEmail,
  QuotationChangesRequestedEmailProps,
} from "./templates/quotation-changes-requested";
import {
  generateDiscussionMessageEmail,
  DiscussionMessageEmailProps,
} from "./templates/discussion-message";
import {
  generateQuotationRecalledEmail,
  QuotationRecalledEmailProps,
} from "./templates/quotation-recalled";

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface SendEmailOptions {
  from?: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export interface SendEmailResult {
  success: boolean;
  simulated?: boolean;
  id?: string;
  error?: string;
}

export function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}


/**
 * Fetch the admin's configured "email_from" from their profile in the DB.
 * Falls back to SMTP_USER env var if not configured.
 */
let _cachedEmailFrom: string | null = null;
let _cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // Re-fetch from DB at most once per minute

export async function getDefaultFromEmail(): Promise<string> {
  const now = Date.now();
  if (_cachedEmailFrom && now - _cacheTimestamp < CACHE_TTL_MS) {
    return _cachedEmailFrom;
  }

  try {
    const admin = createAdminClient();
    // Fetch the first super_admin's email_from (primary workspace admin)
    const { data } = await admin
      .from("freelancer_profiles")
      .select("email_from")
      .eq("role", "super_admin")
      .not("email_from", "is", null)
      .not("email_from", "eq", "")
      .limit(1)
      .maybeSingle();

    if (data?.email_from) {
      _cachedEmailFrom = data.email_from;
      _cacheTimestamp = now;
      return data.email_from;
    }
  } catch (err) {
    console.warn("[Email Service] Could not fetch email_from from DB, using fallback:", err);
  }

  return process.env.SMTP_USER || "noreply@example.com";
}

/**
 * Create a reusable nodemailer SMTP transporter.
 * Defaults to Gmail SMTP if SMTP_HOST is not explicitly set.
 */
function createTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = port === 465; // true for 465 (SSL), false for 587 (STARTTLS)

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Send an email via Gmail SMTP (nodemailer) with graceful development fallback.
 * If SMTP_USER / SMTP_PASS are not configured, logs a formatted preview to the
 * server console and resolves cleanly without error.
 */
export async function sendEmail({
  from: customFrom,
  to,
  subject,
  html,
  text,
  replyTo,
  attachments,
}: SendEmailOptions): Promise<SendEmailResult> {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const sanitizedCustomFrom = customFrom ? customFrom.replace(/[\r\n]/g, "").trim() : undefined;
  const from = sanitizedCustomFrom || (await getDefaultFromEmail());
  const sanitizedSubject = subject.replace(/[\r\n]/g, " ").trim();
  const sanitizedReplyTo = replyTo ? replyTo.replace(/[\r\n]/g, "").trim() : undefined;
  const recipientList = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);

  if (recipientList.length === 0) {
    console.warn("[Email Service] No valid recipients provided, skipping send.");
    return { success: false, error: "No valid recipient email provided." };
  }

  // Graceful development mode fallback
  if (!smtpUser || !smtpPass) {
    console.log("\n================ [EMAIL NOTIFICATION (DEV MODE)] ================");
    console.log(`To:          ${recipientList.join(", ")}`);
    console.log(`From:        ${from}`);
    console.log(`Subject:     ${sanitizedSubject}`);
    if (attachments && attachments.length > 0) {
      console.log(`Attachments: ${attachments.map((a) => a.filename).join(", ")}`);
    }
    console.log(`Notice:      SMTP credentials are not configured in .env.`);
    console.log(`             Email was simulated successfully in development.`);
    if (text) {
      console.log(`Text Body Preview:\n${text.slice(0, 300)}...`);
    }
    console.log("===============================================================\n");

    return {
      success: true,
      simulated: true,
      id: `sim_${Date.now()}`,
    };
  }

  try {
    const transporter = createTransporter();

    const info = await transporter.sendMail({
      from,
      to: recipientList.join(", "),
      subject: sanitizedSubject,
      html,
      text: text || undefined,
      replyTo: sanitizedReplyTo,
      attachments:
        attachments && attachments.length > 0
          ? attachments.map((a) => ({
              filename: a.filename,
              content: a.content,
              contentType: a.contentType,
            }))
          : undefined,
    });

    console.log(`[Email Service] Email sent successfully via SMTP. MessageId: ${info.messageId}`);
    return {
      success: true,
      id: info.messageId,
    };
  } catch (err: any) {
    console.error("[Email Service] Unexpected error sending email:", err);
    return {
      success: false,
      error: err.message || "Failed to send email",
    };
  }
}

/**
 * High-level helper: Notify client that a quotation has been published
 */
export async function sendQuotationPublishedNotification(
  clientEmail: string,
  props: Omit<QuotationPublishedEmailProps, "reviewUrl"> & {
    reviewUrl?: string;
    fromEmail?: string;
    pdfAttachment?: { filename: string; content: Buffer };
  }
) {
  const appUrl = getAppBaseUrl();
  const reviewUrl = props.reviewUrl || `${appUrl}/client/estimate`;
  const { subject, html, text } = generateQuotationPublishedEmail({
    ...props,
    reviewUrl,
  });

  return sendEmail({
    from: props.fromEmail,
    to: clientEmail,
    subject,
    html,
    text,
    attachments: props.pdfAttachment ? [props.pdfAttachment] : undefined,
  });
}

/**
 * High-level helper: Notify freelancer that a client approved their quotation
 */
export async function sendQuotationApprovedNotification(
  freelancerEmail: string,
  props: Omit<QuotationApprovedEmailProps, "viewUrl"> & { viewUrl?: string }
) {
  const appUrl = getAppBaseUrl();
  const viewUrl = props.viewUrl || `${appUrl}/remuneration`;
  const { subject, html, text } = generateQuotationApprovedEmail({
    ...props,
    viewUrl,
  });

  return sendEmail({
    to: freelancerEmail,
    subject,
    html,
    text,
  });
}

/**
 * High-level helper: Notify freelancer that a client requested changes
 */
export async function sendQuotationChangesRequestedNotification(
  freelancerEmail: string,
  props: Omit<QuotationChangesRequestedEmailProps, "viewUrl"> & { viewUrl?: string }
) {
  const appUrl = getAppBaseUrl();
  const viewUrl = props.viewUrl || `${appUrl}/remuneration`;
  const { subject, html, text } = generateQuotationChangesRequestedEmail({
    ...props,
    viewUrl,
  });

  return sendEmail({
    to: freelancerEmail,
    subject,
    html,
    text,
  });
}

/**
 * High-level helper: Notify either party about a section discussion message
 */
export async function sendDiscussionNotification(
  recipientEmail: string,
  props: Omit<DiscussionMessageEmailProps, "actionUrl"> & { actionUrl?: string }
) {
  const appUrl = getAppBaseUrl();
  const actionUrl = props.actionUrl || `${appUrl}/client/estimate`;
  const { subject, html, text } = generateDiscussionMessageEmail({
    ...props,
    actionUrl,
  });

  return sendEmail({
    to: recipientEmail,
    subject,
    html,
    text,
  });
}

/**
 * High-level helper: Notify client that a quotation has been recalled/revoked
 */
export async function sendQuotationRecalledNotification(
  clientEmail: string,
  props: QuotationRecalledEmailProps & { fromEmail?: string }
) {
  const { subject, html, text } = generateQuotationRecalledEmail(props);

  return sendEmail({
    from: props.fromEmail,
    to: clientEmail,
    subject,
    html,
    text,
  });
}

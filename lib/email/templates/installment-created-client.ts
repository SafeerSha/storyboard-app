import { getAppBaseUrl } from "../resend";
import { formatCurrency } from "@/lib/types/remuneration";

export interface InstallmentCreatedClientEmailProps {
  clientName: string;
  projectName: string;
  installmentNumber: number;
  name?: string | null;
  amount: number;
  currency: string;
  dueDate?: string | null;
  description?: string | null;
  portalUrl?: string;
}

export function generateInstallmentCreatedClientEmail({
  clientName,
  projectName,
  installmentNumber,
  name,
  amount,
  currency,
  dueDate,
  description,
  portalUrl,
}: InstallmentCreatedClientEmailProps): { subject: string; html: string; text: string } {
  const appUrl = portalUrl || `${getAppBaseUrl()}/client`;
  const formattedAmount = formatCurrency(amount, currency);

  const subject = `Payment Milestone Scheduled: ${formattedAmount} for ${projectName}`;

  const text = `
Dear ${clientName},

A new payment milestone has been scheduled for your project "${projectName}".

Milestone: #${installmentNumber}${name ? ` - ${name}` : ""}
Amount: ${formattedAmount}
${dueDate ? `Scheduled Due Date: ${dueDate}\n` : ""}
${description ? `Description: ${description}` : ""}

You can view your project contract and payment schedule anytime on your Client Portal:
${appUrl}

Warm regards,
REQly Project Management
`.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8F9FB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0F172A;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; border: 1px solid rgba(15,23,42, 0.08); overflow: hidden; box-shadow: 0 4px 24px rgba(15,23,42, 0.04);">
          <tr>
            <td style="padding: 28px 32px; background: #0F172A;">
              <span style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; color: #CCA038; display: block; margin-bottom: 4px;">PROJECT BILLING UPDATE</span>
              <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff;">Payment Milestone Scheduled</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #4A4658;">
                Dear <strong>${clientName}</strong>,
              </p>
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #334155;">
                A payment milestone has been configured for <strong>${projectName}</strong> in accordance with our project deliverables schedule.
              </p>

              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8F9FB; border-radius: 12px; border: 1px solid rgba(15,23,42, 0.08); margin-bottom: 24px; padding: 16px;">
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #334155; width: 45%;">Project</td>
                  <td style="padding: 8px 12px; font-size: 13px; font-weight: 600; color: #0F172A;">${projectName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #334155;">Milestone</td>
                  <td style="padding: 8px 12px; font-size: 13px; font-weight: 600; color: #0F172A;">#${installmentNumber}${name ? ` - ${name}` : ""}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #334155;">Milestone Amount</td>
                  <td style="padding: 8px 12px; font-size: 15px; font-weight: 800; color: #785312;">${formattedAmount}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #334155;">Scheduled Due Date</td>
                  <td style="padding: 8px 12px; font-size: 13px; font-weight: 600; color: #0F172A;">${dueDate || "Open / Not scheduled"}</td>
                </tr>
                ${description ? `
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #334155;">Deliverables</td>
                  <td style="padding: 8px 12px; font-size: 13px; color: #334155;">${description}</td>
                </tr>
                ` : ""}
              </table>

              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
                <tr>
                  <td align="center">
                    <a href="${appUrl}" style="display: inline-block; background-color: #CCA038; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-size: 14px; font-weight: 600;">
                      View Client Portal
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  return { subject, html, text };
}

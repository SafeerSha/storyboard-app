import { getAppBaseUrl } from "../resend";
import { formatCurrency } from "@/lib/types/remuneration";

export interface RemunerationAgreementClientEmailProps {
  clientName: string;
  projectName: string;
  totalAmount: number;
  currency: string;
  paymentMethod: "single" | "installments" | string;
  agreementDate?: string | null;
  notes?: string | null;
  portalUrl?: string;
}

export function generateRemunerationAgreementClientEmail({
  clientName,
  projectName,
  totalAmount,
  currency,
  paymentMethod,
  agreementDate,
  notes,
  portalUrl,
}: RemunerationAgreementClientEmailProps): { subject: string; html: string; text: string } {
  const appUrl = portalUrl || `${getAppBaseUrl()}/client`;
  const formattedAmount = formatCurrency(totalAmount, currency);
  const formattedDate = agreementDate
    ? new Date(agreementDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });

  const methodLabel = paymentMethod === "single" ? "Single Lump-Sum Payment" : "Milestone / Installment Payments";
  const subject = `Payment Agreement Established: ${formattedAmount} for ${projectName}`;

  const text = `
Dear ${clientName},

We are pleased to confirm that the payment agreement for your project "${projectName}" has been established.

Agreement Details:
- Project: ${projectName}
- Total Agreement Amount: ${formattedAmount}
- Payment Terms: ${methodLabel}
- Agreement Date: ${formattedDate}
${notes ? `- Agreement Notes: ${notes}\n` : ""}

You can view your project contract and payment tracking anytime on your Client Portal:
${appUrl}

Warm regards,
Project Management Team
`.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8F9FB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; border: 1px solid rgba(15,23,42, 0.08); overflow: hidden; box-shadow: 0 4px 24px rgba(15,23,42, 0.04);">
          <!-- Header Banner -->
          <tr>
            <td style="padding: 28px 32px; background: #0F172A;">
              <span style="font-size: 11px; font-weight: 700; letter-spacing: 0.12em; color: #CCA038; display: block; margin-bottom: 6px; text-transform: uppercase;">PROJECT AGREEMENT CONFIRMATION</span>
              <h1 style="margin: 0; font-size: 21px; font-weight: 700; color: #ffffff;">Payment Agreement Established</h1>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #0F172A;">
                Dear <strong>${clientName}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #334155;">
                We are pleased to confirm that the financial agreement and payment terms for <strong>${projectName}</strong> have been finalized.
              </p>

              <!-- Agreement Breakdown Box -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8F9FB; border-radius: 12px; border: 1px solid rgba(15,23,42, 0.08); margin-bottom: 24px; padding: 16px;">
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #334155; width: 40%;">Project</td>
                  <td style="padding: 8px 12px; font-size: 13px; font-weight: 600; color: #0F172A;">${projectName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #334155;">Total Agreement Value</td>
                  <td style="padding: 8px 12px; font-size: 16px; font-weight: 800; color: #785312;">${formattedAmount}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #334155;">Payment Structure</td>
                  <td style="padding: 8px 12px; font-size: 13px; font-weight: 600; color: #0F172A;">${methodLabel}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #334155;">Agreement Date</td>
                  <td style="padding: 8px 12px; font-size: 13px; font-weight: 600; color: #0F172A;">${formattedDate}</td>
                </tr>
                ${
                  notes
                    ? `
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #334155;">Notes & Terms</td>
                  <td style="padding: 8px 12px; font-size: 13px; color: #4A4658;">${notes}</td>
                </tr>
                `
                    : ""
                }
              </table>

              <!-- Action Button -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${appUrl}" target="_blank" style="display: inline-block; background-color: #CCA038; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 28px; rounded: 10px; border-radius: 10px; box-shadow: 0 2px 8px rgba(204,160,56, 0.25);">
                      Open Client Portal
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #64748B;">
                You can access all project deliverables, milestones, and receipts at any time through your dedicated client portal.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #F8F9FB; border-top: 1px solid rgba(15,23,42, 0.06); text-align: center; font-size: 12px; color: #64748B;">
              This is an automated agreement confirmation from your project management workspace.
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

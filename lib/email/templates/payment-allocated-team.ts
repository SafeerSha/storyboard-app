import { getAppBaseUrl } from "../resend";
import { formatCurrency } from "@/lib/types/remuneration";

export interface PaymentAllocatedTeamEmailProps {
  recipientName: string;
  projectName: string;
  paymentAmount: number;
  allocatedAmount: number;
  percentage?: number | null;
  currency: string;
  role?: string | null;
  receivedDate: string;
  paymentMethod: string;
  paymentReference?: string | null;
  notes?: string | null;
  portalUrl?: string;
}

export function generatePaymentAllocatedTeamEmail({
  recipientName,
  projectName,
  paymentAmount,
  allocatedAmount,
  percentage,
  currency,
  role,
  receivedDate,
  paymentMethod,
  paymentReference,
  notes,
  portalUrl,
}: PaymentAllocatedTeamEmailProps): { subject: string; html: string; text: string } {
  const appUrl = portalUrl || `${getAppBaseUrl()}/team`;
  const formattedAllocated = formatCurrency(allocatedAmount, currency);
  const formattedTotalPayment = formatCurrency(paymentAmount, currency);

  const subject = `✅ Payment Paid Successfully — Your Share of ${formattedAllocated} for ${projectName}`;

  const text = `
Hello ${recipientName},

A client payment of ${formattedTotalPayment} has been paid successfully for ${projectName}, and your share of ${formattedAllocated}${percentage ? ` (${percentage}%)` : ""} has been allocated to you.

Project: ${projectName}
Role: ${role || "Collaborator"}
Your Share: ${formattedAllocated}
Total Payment Received: ${formattedTotalPayment}
Date Received: ${receivedDate}
Payment Method: ${paymentMethod}
${paymentReference ? `Transaction Reference: ${paymentReference}` : ""}
${notes ? `Notes: ${notes}` : ""}

View your workspace and project details at:
${appUrl}

Best regards,
REQly Financial Team
`.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF9FC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #252331;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FAF9FC; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; border: 1px solid rgba(74, 61, 100, 0.08); overflow: hidden; box-shadow: 0 4px 24px rgba(70, 55, 95, 0.04);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; background: linear-gradient(135deg, #1f1b2e 0%, #2e2640 100%);">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #B8944E; display: block; margin-bottom: 6px;">REQLY REMUNERATION</span>
                    <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">Payment Paid Successfully</h1>
                  </td>
                  <td align="right">
                    <div style="background-color: rgba(184, 148, 78, 0.2); border: 1px solid rgba(184, 148, 78, 0.4); border-radius: 12px; padding: 8px 14px; text-align: center;">
                      <span style="font-size: 10px; font-weight: 700; color: #E5C378; text-transform: uppercase; display: block;">YOUR SHARE</span>
                      <span style="font-size: 18px; font-weight: 800; color: #ffffff;">${formattedAllocated}</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #4A4658;">
                Hi <strong>${recipientName}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #706C7D;">
                A client payment of <strong>${formattedTotalPayment}</strong> has been paid successfully for <strong>${projectName}</strong>, and your share of <strong>${formattedAllocated}</strong> has been credited to your project split.
              </p>

              <!-- Transaction Summary Box -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FAF9FC; border-radius: 12px; border: 1px solid rgba(74, 61, 100, 0.08); margin-bottom: 24px; padding: 16px;">
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #706C7D; width: 45%;">Project</td>
                  <td style="padding: 8px 12px; font-size: 13px; font-weight: 600; color: #252331;">${projectName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #706C7D;">Your Share Amount</td>
                  <td style="padding: 8px 12px; font-size: 14px; font-weight: 800; color: #2E8B70;">${formattedAllocated}${percentage ? ` <span style="font-size: 11px; font-weight: 600; color: #706C7D;">(${percentage}%)</span>` : ""}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #706C7D;">Role / Deliverable</td>
                  <td style="padding: 8px 12px; font-size: 13px; font-weight: 600; color: #252331;">${role || "Collaborator"}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #706C7D;">Total Payment Received</td>
                  <td style="padding: 8px 12px; font-size: 13px; font-weight: 600; color: #252331;">${formattedTotalPayment}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #706C7D;">Date Received</td>
                  <td style="padding: 8px 12px; font-size: 13px; font-weight: 600; color: #252331;">${receivedDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #706C7D;">Payment Method</td>
                  <td style="padding: 8px 12px; font-size: 13px; font-weight: 600; color: #252331;">${paymentMethod}</td>
                </tr>
                ${paymentReference ? `
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #706C7D;">Transaction / UTR</td>
                  <td style="padding: 8px 12px; font-size: 13px; font-family: monospace; font-weight: 600; color: #252331;">${paymentReference}</td>
                </tr>
                ` : ""}
                ${notes ? `
                <tr>
                  <td style="padding: 8px 12px; font-size: 13px; color: #706C7D;">Notes</td>
                  <td style="padding: 8px 12px; font-size: 13px; color: #706C7D;">${notes}</td>
                </tr>
                ` : ""}
              </table>

              <!-- CTA Button -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="${appUrl}" style="display: inline-block; background-color: #B8944E; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-size: 14px; font-weight: 600; box-shadow: 0 2px 8px rgba(184, 148, 78, 0.3);">
                      Open Team Workspace
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #9994A5; text-align: center;">
                This notification was generated automatically according to your team payout settings in REQly.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #FAF9FC; border-top: 1px solid rgba(74, 61, 100, 0.06); text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #9994A5;">
                &copy; ${new Date().getFullYear()} REQly StoryBoard • Remuneration & Payout Operations
              </p>
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

import { renderEmailBase, escapeHtml } from "./base";

export interface PaymentRequestedEmailProps {
  clientName: string;
  projectName: string;
  installmentNumber: number;
  totalInstallments?: number;
  amount: number;
  currency: string;
  dueDate: string;
  notes?: string | null;
  portalUrl?: string;
}

export function generatePaymentRequestedEmail({
  clientName,
  projectName,
  installmentNumber,
  totalInstallments,
  amount,
  currency,
  dueDate,
  notes,
  portalUrl,
}: PaymentRequestedEmailProps) {
  const safeClientName = escapeHtml(clientName);
  const safeProjectName = escapeHtml(projectName);
  const safeNotes = escapeHtml(notes);
  const safeDueDate = escapeHtml(dueDate);

  const formattedAmount = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 2,
  }).format(amount);

  const installmentLabel =
    totalInstallments && totalInstallments > 1
      ? `Installment #${installmentNumber} of ${totalInstallments}`
      : `Payment #${installmentNumber}`;

  const preheader = `Payment request for ${formattedAmount} on ${safeProjectName} is due by ${safeDueDate}.`;

  const contentHtml = `
    <div style="font-size: 16px; font-weight: 700; color: #09090b; margin-bottom: 8px; letter-spacing: -0.2px;">
      Hi ${safeClientName},
    </div>
    <p style="margin: 0 0 24px 0; font-size: 14.5px; line-height: 1.6; color: #3f3f46;">
      A payment has been requested for <strong>${safeProjectName}</strong>. Please find the scheduled installment details below:
    </p>

    <!-- Payment Highlight Card -->
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fafafa; border: 1px solid #e4e4e7; border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
      <tr>
        <td style="padding: 22px 24px;">
          <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
            <tr>
              <td class="kpi-column" style="vertical-align: top; width: 50%;">
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #71717a; letter-spacing: 0.8px;">
                  ${installmentLabel}
                </div>
                <div style="font-size: 26px; font-weight: 800; color: #18181b; margin-top: 6px; letter-spacing: -0.5px;">
                  ${formattedAmount}
                </div>
              </td>
              <td class="kpi-column" style="vertical-align: top; width: 50%; border-left: 1px solid #e4e4e7; padding-left: 24px;">
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #71717a; letter-spacing: 0.8px;">
                  Due Date
                </div>
                <div style="font-size: 20px; font-weight: 700; color: #b8944e; margin-top: 8px; letter-spacing: -0.3px;">
                  ${safeDueDate}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${
      safeNotes
        ? `
      <div style="background-color: #f4f4f5; border-radius: 8px; padding: 14px 16px; margin-bottom: 24px;">
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #71717a; margin-bottom: 4px;">
          Payment Instructions / Notes
        </div>
        <div style="font-size: 13.5px; color: #27272a; line-height: 1.5;">
          ${safeNotes}
        </div>
      </div>
    `
        : ""
    }

    <p style="margin: 0; font-size: 13.5px; line-height: 1.6; color: #71717a;">
      Once the payment is completed, please share or attach the transaction reference or payment screenshot so our team can record and confirm it promptly.
    </p>
  `;

  return renderEmailBase({
    title: `Payment Request: ${safeProjectName}`,
    preheader,
    contentHtml,
    badgeText: "Payment Request",
    actionText: portalUrl ? "View Client Portal" : undefined,
    actionUrl: portalUrl,
  });
}

import { renderEmailBase, escapeHtml } from "./base";

export interface PaymentReceivedEmailProps {
  recipientName: string;
  projectName: string;
  installmentNumber: number;
  amount: number;
  currency: string;
  receivedDate: string;
  paymentMethod: string;
  paymentReference?: string | null;
  remainingAmount: number;
  viewUrl?: string;
}

export function generatePaymentReceivedEmail({
  recipientName,
  projectName,
  installmentNumber,
  amount,
  currency,
  receivedDate,
  paymentMethod,
  paymentReference,
  remainingAmount,
  viewUrl,
}: PaymentReceivedEmailProps) {
  const safeRecipientName = escapeHtml(recipientName);
  const safeProjectName = escapeHtml(projectName);
  const safePaymentMethod = escapeHtml(paymentMethod);
  const safePaymentReference = escapeHtml(paymentReference || "N/A");
  const safeReceivedDate = escapeHtml(receivedDate);

  const formattedAmount = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 2,
  }).format(amount);

  const formattedRemaining = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 2,
  }).format(remainingAmount);

  const preheader = `Payment of ${formattedAmount} received for ${safeProjectName}.`;

  const contentHtml = `
    <div style="font-size: 16px; font-weight: 700; color: #09090b; margin-bottom: 8px; letter-spacing: -0.2px;">
      Hi ${safeRecipientName},
    </div>
    <p style="margin: 0 0 24px 0; font-size: 14.5px; line-height: 1.6; color: #3f3f46;">
      A payment for <strong>${safeProjectName}</strong> has been successfully received and recorded in REQly.
    </p>

    <!-- Received Summary Card -->
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
      <tr>
        <td style="padding: 22px 24px;">
          <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
            <tr>
              <td class="kpi-column" style="vertical-align: top; width: 50%;">
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #166534; letter-spacing: 0.8px;">
                  Payment Received (Installment #${installmentNumber})
                </div>
                <div style="font-size: 26px; font-weight: 800; color: #15803d; margin-top: 6px; letter-spacing: -0.5px;">
                  ${formattedAmount}
                </div>
              </td>
              <td class="kpi-column" style="vertical-align: top; width: 50%; border-left: 1px solid #bbf7d0; padding-left: 24px;">
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #166534; letter-spacing: 0.8px;">
                  Remaining Balance
                </div>
                <div style="font-size: 20px; font-weight: 700; color: #1e293b; margin-top: 8px; letter-spacing: -0.3px;">
                  ${formattedRemaining}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Payment Metadata Details -->
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fafafa; border: 1px solid #e4e4e7; border-radius: 8px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 14px 18px; border-bottom: 1px solid #e4e4e7; font-size: 13px; color: #71717a; width: 40%;">Payment Date</td>
        <td style="padding: 14px 18px; border-bottom: 1px solid #e4e4e7; font-size: 13.5px; font-weight: 600; color: #18181b;">${safeReceivedDate}</td>
      </tr>
      <tr>
        <td style="padding: 14px 18px; border-bottom: 1px solid #e4e4e7; font-size: 13px; color: #71717a;">Payment Method</td>
        <td style="padding: 14px 18px; border-bottom: 1px solid #e4e4e7; font-size: 13.5px; font-weight: 600; color: #18181b;">${safePaymentMethod}</td>
      </tr>
      <tr>
        <td style="padding: 14px 18px; font-size: 13px; color: #71717a;">Transaction Reference</td>
        <td style="padding: 14px 18px; font-size: 13.5px; font-family: monospace; color: #27272a;">${safePaymentReference}</td>
      </tr>
    </table>
  `;

  return renderEmailBase({
    title: `Payment Receipt: ${safeProjectName}`,
    preheader,
    contentHtml,
    badgeText: "Payment Receipt",
    actionText: viewUrl ? "View Remuneration" : undefined,
    actionUrl: viewUrl,
  });
}

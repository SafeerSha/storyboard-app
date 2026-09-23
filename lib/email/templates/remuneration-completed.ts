import { renderEmailBase, escapeHtml } from "./base";

export interface RemunerationCompletedEmailProps {
  recipientName: string;
  projectName: string;
  totalAmount: number;
  currency: string;
  viewUrl?: string;
}

export function generateRemunerationCompletedEmail({
  recipientName,
  projectName,
  totalAmount,
  currency,
  viewUrl,
}: RemunerationCompletedEmailProps) {
  const safeRecipientName = escapeHtml(recipientName);
  const safeProjectName = escapeHtml(projectName);

  const formattedAmount = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 2,
  }).format(totalAmount);

  const preheader = `All payments for ${safeProjectName} are fully completed (${formattedAmount}).`;

  const contentHtml = `
    <div style="font-size: 16px; font-weight: 700; color: #09090b; margin-bottom: 8px; letter-spacing: -0.2px;">
      Hi ${safeRecipientName},
    </div>
    <p style="margin: 0 0 24px 0; font-size: 14.5px; line-height: 1.6; color: #3f3f46;">
      Great news! All scheduled payments for <strong>${safeProjectName}</strong> have been completed in full.
    </p>

    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 12px; margin-bottom: 24px; text-align: center;">
      <tr>
        <td style="padding: 28px 24px;">
          <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #166534; letter-spacing: 1px;">
            Total Remuneration Settled
          </div>
          <div style="font-size: 32px; font-weight: 800; color: #15803d; margin-top: 6px;">
            ${formattedAmount}
          </div>
          <div style="display: inline-block; margin-top: 12px; padding: 4px 12px; background-color: #dcfce7; border-radius: 9999px; font-size: 12px; font-weight: 600; color: #166534;">
            Status: Fully Paid (100%)
          </div>
        </td>
      </tr>
    </table>

    <p style="margin: 0; font-size: 13.5px; line-height: 1.6; color: #71717a;">
      All installments and corresponding payment proofs are archived securely in the project's financial ledger. Thank you for your partnership!
    </p>
  `;

  return renderEmailBase({
    title: `Remuneration Completed: ${safeProjectName}`,
    preheader,
    contentHtml,
    badgeText: "Remuneration Completed",
    actionText: viewUrl ? "View Completed Remuneration" : undefined,
    actionUrl: viewUrl,
  });
}

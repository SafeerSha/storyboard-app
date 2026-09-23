import { renderEmailBase, escapeHtml } from "./base";

export interface QuotationApprovedEmailProps {
  freelancerName: string;
  clientName: string;
  projectName: string;
  totalHours: number;
  totalAmount: number;
  currency: string;
  approvalNote?: string;
  viewUrl: string;
}

export function generateQuotationApprovedEmail({
  freelancerName,
  clientName,
  projectName,
  totalHours,
  totalAmount,
  currency,
  approvalNote,
  viewUrl,
}: QuotationApprovedEmailProps) {
  const safeFreelancerName = escapeHtml(freelancerName);
  const safeClientName = escapeHtml(clientName);
  const safeProjectName = escapeHtml(projectName);
  const safeApprovalNote = escapeHtml(approvalNote);

  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 0,
  }).format(totalAmount);

  const preheader = `Great news! ${safeClientName} has formally approved the quotation for ${safeProjectName}.`;

  const contentHtml = `
    <p style="margin: 0 0 16px 0;">Hi <strong>${safeFreelancerName}</strong>,</p>
    <p style="margin: 0 0 20px 0;">
      Great news! <strong>${safeClientName}</strong> has officially accepted and approved the scope and estimation package for <strong>${safeProjectName}</strong>.
    </p>

    <!-- Success Badge Box -->
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 20px 24px;">
          <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
            <tr>
              <td style="vertical-align: top; width: 50%;">
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #15803d; letter-spacing: 0.5px;">Status</div>
                <div style="font-size: 18px; font-weight: 800; color: #166534; margin-top: 4px;">APPROVED</div>
              </td>
              <td style="vertical-align: top; width: 50%; border-left: 1px solid #bbf7d0; padding-left: 20px;">
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #15803d; letter-spacing: 0.5px;">Approved Package</div>
                <div style="font-size: 18px; font-weight: 800; color: #166534; margin-top: 4px;">${formattedAmount} <span style="font-size: 13px; font-weight: 500; color: #4ade80;">(${Number(totalHours) || 0} hrs)</span></div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${
      safeApprovalNote
        ? `
      <div style="margin: 0 0 24px 0; padding: 14px 18px; background-color: #fafaf9; border-left: 4px solid #16a34a; border-radius: 6px;">
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #78716c; margin-bottom: 4px;">Client Sign-Off Note:</div>
        <div style="font-size: 13px; color: #1c1917; font-style: italic; line-height: 1.5;">&ldquo;${safeApprovalNote}&rdquo;</div>
      </div>
    `
        : ""
    }

    <p style="margin: 0 0 12px 0;">
      You can now proceed with confidence, milestone scheduling, or story backlog execution in your project workspace.
    </p>
  `;

  return {
    subject: `Quotation Approved for ${projectName} (${clientName})`,
    html: renderEmailBase({
      title: `Quotation Approved: ${projectName}`,
      preheader,
      contentHtml,
      actionText: "View Approved Quotation",
      actionUrl: viewUrl,
    }),
    text: `Hi ${freelancerName},\n\nGreat news! ${clientName} has approved the quotation for ${projectName}.\nPackage: ${formattedAmount} (${totalHours} hrs)\n\nView details: ${viewUrl}`,
  };
}

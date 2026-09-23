import { renderEmailBase, escapeHtml } from "./base";

export interface DiscussionMessageEmailProps {
  recipientName: string;
  senderName: string;
  projectName: string;
  sectionTitle: string;
  message: string;
  proposedHours?: number | null;
  proposedAmount?: number | null;
  currency?: string;
  actionUrl: string;
}

export function generateDiscussionMessageEmail({
  recipientName,
  senderName,
  projectName,
  sectionTitle,
  message,
  proposedHours,
  proposedAmount,
  currency = "USD",
  actionUrl,
}: DiscussionMessageEmailProps) {
  const safeRecipientName = escapeHtml(recipientName);
  const safeSenderName = escapeHtml(senderName);
  const safeProjectName = escapeHtml(projectName);
  const safeSectionTitle = escapeHtml(sectionTitle);
  const safeMessage = escapeHtml(message);

  const preheader = `New negotiation note from ${safeSenderName} on "${safeSectionTitle}" (${safeProjectName})`;

  const formattedProposedAmount =
    proposedAmount !== null && proposedAmount !== undefined
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency,
          maximumFractionDigits: 0,
        }).format(proposedAmount)
      : null;

  const contentHtml = `
    <p style="margin: 0 0 16px 0;">Hello <strong>${safeRecipientName}</strong>,</p>
    <p style="margin: 0 0 20px 0;">
      <strong>${safeSenderName}</strong> posted a comment on <strong>${safeSectionTitle}</strong> in the <strong>${safeProjectName}</strong> quotation.
    </p>

    <!-- Message Quote Box -->
    <div style="margin: 0 0 20px 0; padding: 18px 20px; background-color: #fafaf9; border-left: 4px solid #B8944E; border-radius: 8px;">
      <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #78716c; margin-bottom: 6px;">
        ${safeSectionTitle}
      </div>
      <div style="font-size: 14px; color: #1c1917; line-height: 1.6; white-space: pre-wrap;">${safeMessage}</div>

      ${
        proposedHours || formattedProposedAmount
          ? `
        <div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed #d6d3d1; font-size: 12px; color: #44403c;">
          <strong>Proposed Counter-Offer:</strong> 
          ${proposedHours ? `<span style="display:inline-block; background:#e7e5e4; padding:2px 8px; border-radius:4px; margin-left:4px; font-weight:600;">${Number(proposedHours) || 0} hrs</span>` : ""}
          ${formattedProposedAmount ? `<span style="display:inline-block; background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:4px; margin-left:4px; font-weight:700;">${formattedProposedAmount}</span>` : ""}
        </div>
      `
          : ""
      }
    </div>

    <p style="margin: 0 0 12px 0;">
      Click below to open the quotation drawer and respond directly to this topic.
    </p>
  `;

  return {
    subject: `New Discussion Note: ${sectionTitle} (${projectName})`,
    html: renderEmailBase({
      title: `Discussion Update: ${projectName}`,
      preheader,
      contentHtml,
      actionText: "Reply to Message",
      actionUrl,
    }),
    text: `Hello ${recipientName},\n\n${senderName} commented on "${sectionTitle}" in ${projectName}:\n\n"${message}"\n\nReply here: ${actionUrl}`,
  };
}

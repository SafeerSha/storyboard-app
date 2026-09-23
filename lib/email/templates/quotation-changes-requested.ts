import { renderEmailBase, escapeHtml } from "./base";

export interface QuotationChangesRequestedEmailProps {
  freelancerName: string;
  clientName: string;
  projectName: string;
  clientNote?: string;
  viewUrl: string;
}

export function generateQuotationChangesRequestedEmail({
  freelancerName,
  clientName,
  projectName,
  clientNote,
  viewUrl,
}: QuotationChangesRequestedEmailProps) {
  const safeFreelancerName = escapeHtml(freelancerName);
  const safeClientName = escapeHtml(clientName);
  const safeProjectName = escapeHtml(projectName);
  const safeClientNote = escapeHtml(clientNote);

  const preheader = `${safeClientName} has requested adjustments or provided feedback on the quotation for ${safeProjectName}.`;

  const contentHtml = `
    <p style="margin: 0 0 16px 0;">Hi <strong>${safeFreelancerName}</strong>,</p>
    <p style="margin: 0 0 20px 0;">
      <strong>${safeClientName}</strong> has reviewed the quotation for <strong>${safeProjectName}</strong> and requested revisions or clarification on the scope.
    </p>

    <!-- Revision Request Box -->
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 20px 24px;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #b45309; letter-spacing: 0.5px;">Status Update</div>
          <div style="font-size: 18px; font-weight: 800; color: #92400e; margin-top: 4px;">Revisions &amp; Discussion Requested</div>
        </td>
      </tr>
    </table>

    ${
      safeClientNote
        ? `
      <div style="margin: 0 0 24px 0; padding: 14px 18px; background-color: #fafaf9; border-left: 4px solid #f59e0b; border-radius: 6px;">
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #78716c; margin-bottom: 4px;">Client Feedback / Target Requirements:</div>
        <div style="font-size: 13px; color: #1c1917; font-style: italic; line-height: 1.5;">&ldquo;${safeClientNote}&rdquo;</div>
      </div>
    `
        : ""
    }

    <p style="margin: 0 0 12px 0;">
      Open the quotation workspace to reply to their specific notes, adjust hourly allocations, or agree on a tailored package.
    </p>
  `;

  return {
    subject: `Changes Requested on Quotation: ${projectName} (${clientName})`,
    html: renderEmailBase({
      title: `Changes Requested: ${projectName}`,
      preheader,
      contentHtml,
      actionText: "Review Feedback & Discuss",
      actionUrl: viewUrl,
    }),
    text: `Hi ${freelancerName},\n\n${clientName} has requested changes on the quotation for ${projectName}.\nNotes: ${clientNote || "No notes provided"}\n\nReview feedback: ${viewUrl}`,
  };
}

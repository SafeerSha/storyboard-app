import { renderEmailBase, escapeHtml } from "./base";

export interface QuotationRecalledEmailProps {
  clientName: string;
  projectName: string;
  freelancerName: string;
  recallReason?: string;
  estimateLabel?: string;
}

export function generateQuotationRecalledEmail({
  clientName,
  projectName,
  freelancerName,
  recallReason,
  estimateLabel,
}: QuotationRecalledEmailProps) {
  const safeClientName = escapeHtml(clientName);
  const safeProjectName = escapeHtml(projectName);
  const safeFreelancerName = escapeHtml(freelancerName);
  const safeRecallReason = escapeHtml(recallReason);
  const safeEstimateLabel = escapeHtml(estimateLabel);

  const labelSuffix = safeEstimateLabel ? ` (${safeEstimateLabel})` : "";
  const preheader = `The quotation and scope proposal for ${safeProjectName}${labelSuffix} has been recalled for revisions.`;

  const contentHtml = `
    <!-- Greeting & Overview -->
    <div style="font-size: 16px; font-weight: 700; color: #09090b; margin-bottom: 8px; letter-spacing: -0.2px;">
      Hi ${safeClientName},
    </div>
    <p style="margin: 0 0 24px 0; font-size: 14.5px; line-height: 1.6; color: #3f3f46;">
      Please be advised that the formal scope and estimation proposal previously published for <strong>${safeProjectName}</strong>${safeEstimateLabel ? ` (<em>${safeEstimateLabel}</em>)` : ""} has been <strong>recalled by ${safeFreelancerName}</strong> for internal review and scope adjustments.
    </p>

    <!-- Withdrawal Status Box -->
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 20px 24px;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #b45309; letter-spacing: 0.8px;">
            Status Update
          </div>
          <div style="font-size: 18px; font-weight: 800; color: #92400e; margin-top: 4px; letter-spacing: -0.3px;">
            Quotation Withdrawn &amp; In Revision
          </div>
          <div style="font-size: 12.5px; color: #78350f; margin-top: 6px; line-height: 1.5;">
            The interactive estimate view has been temporarily removed from your Client Portal while updates are being prepared.
          </div>
        </td>
      </tr>
    </table>

    ${
      safeRecallReason
        ? `
      <!-- Reason for Recall -->
      <div style="margin: 0 0 24px 0; padding: 14px 18px; background-color: #fafafa; border-left: 3px solid #d97706; border-radius: 4px; border-top: 1px solid #f4f4f5; border-right: 1px solid #f4f4f5; border-bottom: 1px solid #f4f4f5;">
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #71717a; margin-bottom: 4px; letter-spacing: 0.5px;">
          Note from ${safeFreelancerName}:
        </div>
        <div style="font-size: 13.5px; color: #27272a; font-style: italic; line-height: 1.55;">
          &ldquo;${safeRecallReason}&rdquo;
        </div>
      </div>
    `
        : ""
    }

    <!-- Next Steps Explanation -->
    <p style="margin: 0 0 16px 0; font-size: 13.5px; line-height: 1.6; color: #52525b;">
      You do not need to take any action at this time. Once the updated scope deliverables, hourly breakdowns, and fees have been re-calibrated, an updated quotation will be re-published to your portal for review.
    </p>

    <!-- Executive Sign-off -->
    <div style="margin-top: 24px; font-size: 13px; color: #3f3f46; line-height: 1.6;">
      Warm regards,<br />
      <strong style="color: #09090b;">${freelancerName}</strong><br />
    </div>
  `;

  return {
    subject: `Notice: Quotation Recalled for ${projectName}${labelSuffix}`,
    html: renderEmailBase({
      title: `Quotation Recalled: ${projectName}${labelSuffix}`,
      preheader,
      contentHtml,
      badgeText: "Quotation Withdrawn",
    }),
    text: `Hi ${clientName},\n\nPlease be advised that the formal scope and estimation proposal previously published for ${projectName}${labelSuffix} has been recalled for scope adjustments and revisions.\n\n${recallReason ? `NOTE FROM ${freelancerName.toUpperCase()}:\n"${recallReason}"\n\n` : ""}The quotation has been temporarily removed from your Client Portal. You will receive an updated notification once revisions are completed.\n\nWarm regards,\n${freelancerName}\nProject Workspace`,
  };
}

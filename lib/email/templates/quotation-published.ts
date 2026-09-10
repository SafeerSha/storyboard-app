import { renderEmailBase } from "./base";

export interface QuotationPublishedEmailProps {
  clientName: string;
  projectName: string;
  freelancerName: string;
  totalHours: number;
  totalAmount: number;
  currency: string;
  publishNote?: string;
  reviewUrl: string;
  clientLoginPin?: string;
  estimateLabel?: string;
}

export function generateQuotationPublishedEmail({
  clientName,
  projectName,
  freelancerName,
  totalHours,
  totalAmount,
  currency,
  publishNote,
  reviewUrl,
  clientLoginPin,
  estimateLabel,
}: QuotationPublishedEmailProps) {
  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 0,
  }).format(totalAmount);

  const labelSuffix = estimateLabel ? ` (${estimateLabel})` : "";
  const preheader = `Formal quotation and scope proposal for ${projectName}${labelSuffix} is ready for your review.`;

  const contentHtml = `
    <!-- Greeting & Overview -->
    <div style="font-size: 16px; font-weight: 700; color: #09090b; margin-bottom: 8px; letter-spacing: -0.2px;">
      Hi ${clientName},
    </div>
    <p style="margin: 0 0 24px 0; font-size: 14.5px; line-height: 1.6; color: #3f3f46;">
      Here is the remuneration quotation for <strong>${projectName}</strong>${estimateLabel ? ` (<em>${estimateLabel}</em>)` : ""}. Please review the summary below or view the detailed breakdown in the Client Portal.
    </p>

    <!-- Executive KPI Summary Card -->
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fafafa; border: 1px solid #e4e4e7; border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
      <tr>
        <td style="padding: 22px 24px;">
          <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
            <tr>
              <td class="kpi-column" style="vertical-align: top; width: 50%;">
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #71717a; letter-spacing: 0.8px;">
                  Total Estimated Effort
                </div>
                <div style="font-size: 26px; font-weight: 800; color: #09090b; margin-top: 6px; letter-spacing: -0.5px;">
                  ${totalHours} <span style="font-size: 14px; font-weight: 500; color: #71717a;">hrs</span>
                </div>
                <div style="font-size: 11.5px; color: #a1a1aa; margin-top: 4px;">
                  Engineering &amp; Quality Assurance
                </div>
              </td>
              <td class="kpi-column" style="vertical-align: top; width: 50%; border-left: 1px solid #e4e4e7; padding-left: 24px;">
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #71717a; letter-spacing: 0.8px;">
                  Total Proposed Remuneration
                </div>
                <div style="font-size: 26px; font-weight: 800; color: #846326; margin-top: 6px; letter-spacing: -0.5px;">
                  ${formattedAmount}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Specification Metadata Table -->
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border: 1px solid #e4e4e7; border-radius: 10px; margin-bottom: 24px; background-color: #ffffff; overflow: hidden;">
      <tr>
        <td style="padding: 11px 18px; border-bottom: 1px solid #f4f4f5; font-size: 13px; color: #71717a; width: 36%;">Project</td>
        <td style="padding: 11px 18px; border-bottom: 1px solid #f4f4f5; font-size: 13px; font-weight: 600; color: #18181b;">${projectName}</td>
      </tr>
      <tr>
        <td style="padding: 11px 18px; border-bottom: ${clientLoginPin ? "1px solid #f4f4f5" : "none"}; font-size: 13px; color: #71717a;">Document Format</td>
        <td style="padding: 11px 18px; border-bottom: ${clientLoginPin ? "1px solid #f4f4f5" : "none"}; font-size: 13px; color: #18181b;">
          <strong style="color: #09090b;">Itemized PDF Attached</strong> <span style="font-size: 12px; color: #71717a;">+ Interactive Client Portal</span>
        </td>
      </tr>
      ${
        clientLoginPin
          ? `
        <tr>
          <td style="padding: 11px 18px; font-size: 13px; color: #71717a;">Client Portal PIN</td>
          <td style="padding: 11px 18px; font-size: 13px;">
            <code style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; font-weight: 700; color: #09090b; background-color: #f4f4f5; padding: 3px 10px; border-radius: 4px; border: 1px solid #e4e4e7; letter-spacing: 1px;">${clientLoginPin}</code>
          </td>
        </tr>
      `
          : ""
      }
    </table>

    ${
      publishNote
        ? `
      <!-- Personal Note from Project Lead -->
      <div style="margin: 0 0 24px 0; padding: 14px 18px; background-color: #fafafa; border-left: 3px solid #B8944E; border-radius: 4px; border-top: 1px solid #f4f4f5; border-right: 1px solid #f4f4f5; border-bottom: 1px solid #f4f4f5;">
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #71717a; margin-bottom: 4px; letter-spacing: 0.5px;">
          Note from ${freelancerName}:
        </div>
        <div style="font-size: 13.5px; color: #27272a; font-style: italic; line-height: 1.55;">
          &ldquo;${publishNote}&rdquo;
        </div>
      </div>
    `
        : ""
    }

    <!-- Discussion & Negotiation Callout -->
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #faf8f5; border: 1px solid #ebdcc5; border-radius: 10px; margin-bottom: 8px;">
      <tr>
        <td style="padding: 16px 20px;">
          <div style="font-size: 13px; font-weight: 700; color: #846326; margin-bottom: 4px; letter-spacing: 0.2px;">
            Interactive Scope Review &amp; Discussion
          </div>
          <div style="font-size: 12.5px; color: #4a3e2c; line-height: 1.55;">
            You can review the detailed time breakdown for each deliverable, leave comments on specific sections, or submit counter-offers directly in your Client Portal before making a final decision.
          </div>
        </td>
      </tr>
    </table>
  `;

  const secondaryHtml = `
    <!-- PDF Attachment Badge -->
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 16px;">
      <tr>
        <td style="padding: 12px 18px; font-size: 12.5px; color: #334155; line-height: 1.5;">
          <table role="presentation" border="0" cellspacing="0" cellpadding="0">
            <tr>
              <td style="vertical-align: middle; padding-right: 12px;">
                <span style="display: inline-block; background-color: #fee2e2; color: #991b1b; font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 4px; border: 1px solid #fecaca; letter-spacing: 0.5px;">PDF</span>
              </td>
              <td style="vertical-align: middle;">
                <strong style="color: #0f172a;">Itemized Quotation PDF Attached:</strong>
                <span style="color: #64748b;"> A full breakdown has been attached to this email for your records and procurement process.</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Executive Sign-off -->
    <div style="margin-top: 20px; font-size: 13px; color: #3f3f46; line-height: 1.6;">
      Warm regards,<br />
      <strong style="color: #09090b;">${freelancerName}</strong><br />
    </div>
  `;

  return {
    subject: `Quotation & Scope Proposal: ${projectName}${labelSuffix}`,
    html: renderEmailBase({
      title: `Project Quotation: ${projectName}${labelSuffix}`,
      preheader,
      contentHtml,
      actionText: "Review & Discuss Estimation",
      actionUrl: reviewUrl,
      badgeText: estimateLabel ? `Quotation • ${estimateLabel}` : "Formal Scope & Quotation",
      secondaryHtml,
    }),
    text: `Hi ${clientName},\n\nWe have finalized and published the formal scope of work and remuneration quotation for ${projectName}${labelSuffix}, prepared by ${freelancerName}.\n\nKEY ESTIMATE SUMMARY:\n- Estimated Effort: ${totalHours} hrs\n- Proposed Investment: ${formattedAmount}\n- Project Lead: ${freelancerName}\n${clientLoginPin ? `- Client Access PIN: ${clientLoginPin}\n` : ""}\n${publishNote ? `NOTE FROM ${freelancerName.toUpperCase()}:\n"${publishNote}"\n\n` : ""}CLIENT PORTAL LINK:\n${reviewUrl}\n\nClick the link above to review, discuss, and negotiate on the estimation directly in your Client Portal.\n\nATTACHMENT:\nAn itemized PDF copy of this estimation is attached to this email.\n\nWarm regards,\n${freelancerName}\nProject Workspace`,
  };
}

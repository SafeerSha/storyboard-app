export interface EmailBaseProps {
  title: string;
  preheader?: string;
  contentHtml: string;
  actionText?: string;
  actionUrl?: string;
  badgeText?: string;
  secondaryHtml?: string;
}

export function renderEmailBase({
  title,
  preheader,
  contentHtml,
  actionText,
  actionUrl,
  badgeText = "Formal Quotation",
  secondaryHtml,
}: EmailBaseProps): string {
  const brandGold = "#B8944E";
  const brandDark = "#09090b";

  return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
  <title>${title}</title>
  ${preheader ? `<span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">${preheader}</span>` : ""}
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #18181b; }
    .btn-action:hover { background-color: #27272a !important; color: #ffffff !important; }
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; border-radius: 0 !important; border: none !important; }
      .email-content { padding: 24px 18px !important; }
      .email-header { padding: 20px 18px !important; }
      .email-footer { padding: 20px 18px !important; }
      .kpi-column { display: block !important; width: 100% !important; border-left: none !important; border-top: 1px solid #e4e4e7 !important; padding-left: 0 !important; padding-top: 16px !important; margin-top: 16px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <!-- Outer Background Wrapper -->
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5; padding: 32px 12px;">
    <tr>
      <td align="center">
        <!-- Main Standard Card Container -->
        <table role="presentation" class="email-container" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid #e4e4e7;">
          
          <!-- Executive Brand Header -->
          <tr>
            <td class="email-header" style="background-color: ${brandDark}; padding: 24px 32px; border-bottom: 2px solid ${brandGold};">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align: middle;">
                    <div style="font-size: 18px; font-weight: 800; letter-spacing: -0.3px; color: #ffffff; line-height: 1;">
                      Project <span style="color: ${brandGold};">Quotation</span>
                    </div>
                    <div style="font-size: 11px; color: #a1a1aa; margin-top: 3px; letter-spacing: 0.2px; font-weight: 400;">
                      Scope Deliverables &amp; Estimation
                    </div>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #e4e4e7; background-color: #27272a; padding: 5px 12px; border-radius: 9999px; border: 1px solid #3f3f46;">
                      ${badgeText}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td class="email-content" style="padding: 36px 32px 28px 32px; text-align: left;">
              ${contentHtml}

              ${
                actionText && actionUrl
                  ? `
                <!-- Primary Action CTA Button -->
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 28px; margin-bottom: 24px;">
                  <tr>
                    <td align="center">
                      <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                        <tr>
                          <td align="center" style="border-radius: 8px; background-color: #09090b; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);">
                            <a href="${actionUrl}" target="_blank" class="btn-action" style="display: inline-block; padding: 14px 36px; font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 8px; background-color: #09090b; letter-spacing: 0.3px; text-align: center;">
                              ${actionText} &rarr;
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              `
                  : ""
              }

              ${secondaryHtml ? secondaryHtml : ""}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

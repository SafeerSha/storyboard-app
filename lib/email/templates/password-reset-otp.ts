import { escapeHtml } from "./base";

export interface PasswordResetOtpEmailProps {
  otp: string;
  recipientName?: string;
  expiresInMinutes?: number;
}

export function generatePasswordResetOtpEmail({
  otp,
  recipientName,
  expiresInMinutes = 10,
}: PasswordResetOtpEmailProps): string {
  const brandGold = "#B8944E";
  const brandDark = "#252331";
  const safeName = recipientName ? escapeHtml(recipientName) : "there";
  const safeOtp = escapeHtml(otp);

  return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
  <title>Reset Your Password - REQly</title>
  <span style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">Your REQly verification code is ${safeOtp}</span>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #F5F2F7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #252331; }
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; border-radius: 0 !important; border: none !important; }
      .email-content { padding: 24px 20px !important; }
      .email-header { padding: 20px 20px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #F5F2F7; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F5F2F7; padding: 40px 12px;">
    <tr>
      <td align="center">
        <!-- Main Container Card -->
        <table role="presentation" class="email-container" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(70, 55, 95, 0.08); border: 1px solid rgba(74, 61, 100, 0.08);">
          
          <!-- Brand Header -->
          <tr>
            <td class="email-header" style="background-color: #ffffff; padding: 28px 32px 20px 32px; border-bottom: 1px solid rgba(74, 61, 100, 0.08); text-align: center;">
              <div style="font-size: 22px; font-weight: 800; letter-spacing: -0.04em; color: ${brandDark}; line-height: 1;">
                REQ<span style="color: ${brandGold};">ly</span>
              </div>
              <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #9994A5; margin-top: 6px;">
                Password Verification Code
              </div>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td class="email-content" style="padding: 32px 32px 28px 32px; text-align: left;">
              <h1 style="font-size: 18px; font-weight: 700; color: ${brandDark}; margin: 0 0 12px 0;">
                Hello ${safeName},
              </h1>
              <p style="font-size: 14px; line-height: 1.6; color: #585365; margin: 0 0 24px 0;">
                We received a request to reset your REQly account password. Use the verification code below to complete the reset process:
              </p>

              <!-- OTP Code Display Card -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td align="center" style="background: linear-gradient(135deg, #FAF8FC 0%, #F5F0FB 100%); border: 1.5px dashed ${brandGold}; border-radius: 12px; padding: 20px 16px;">
                    <div style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 34px; font-weight: 700; letter-spacing: 8px; color: ${brandDark}; margin-left: 8px;">
                      ${safeOtp}
                    </div>
                    <div style="font-size: 12px; font-weight: 500; color: #8F8A9B; margin-top: 8px;">
                      Expires in <strong style="color: ${brandDark};">${expiresInMinutes} minutes</strong>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="font-size: 13px; line-height: 1.5; color: #7A7587; margin: 0 0 16px 0;">
                If you did not make this request, you can safely ignore this email. Your current password will remain unchanged.
              </p>

              <!-- Security Notice -->
              <div style="background-color: #FAF9FC; border-left: 3px solid ${brandGold}; padding: 12px 16px; border-radius: 4px; font-size: 12px; color: #706C7D; line-height: 1.5;">
                <strong>Security Reminder:</strong> Never share your verification code with anyone. REQly team members will never ask for your code.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #FAF9FC; border-top: 1px solid rgba(74, 61, 100, 0.08); padding: 20px 32px; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #A19CAE;">
                &copy; ${new Date().getFullYear()} REQly. From requirements to delivery.
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
}

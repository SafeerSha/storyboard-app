import { getAppBaseUrl } from "../resend";
import { MEETING_PLATFORM_CONFIG, MEETING_TYPE_CONFIG, MeetingPlatform, MeetingType } from "@/lib/types/meeting";

export interface MeetingInvitationEmailProps {
  recipientName?: string;
  projectName: string;
  meetingTitle: string;
  meetingType: MeetingType;
  platform: MeetingPlatform;
  meetingUrl?: string | null;
  formattedDate: string;
  formattedTime: string;
  durationText?: string;
  agendaItems: string[];
  invitationMessage?: string | null;
  organizerName: string;
}

export function generateMeetingInvitationEmail({
  recipientName,
  projectName,
  meetingTitle,
  meetingType,
  platform,
  meetingUrl,
  formattedDate,
  formattedTime,
  durationText,
  agendaItems,
  invitationMessage,
  organizerName,
}: MeetingInvitationEmailProps): { subject: string; html: string; text: string } {
  const typeConfig = MEETING_TYPE_CONFIG[meetingType] || { label: meetingType };
  const platformConfig = MEETING_PLATFORM_CONFIG[platform] || { label: platform };
  const invitationLine = invitationMessage?.trim() || "You’re invited to join the following meeting.";

  const subject = `📅 Meeting Invitation: ${meetingTitle} | ${projectName}`;

  // Plain-text alternative
  const textAgenda =
    agendaItems.length > 0
      ? agendaItems.map((item, idx) => `${idx + 1}. ${item}`).join("\n")
      : "No detailed agenda provided.";

  const text = `
Hello ${recipientName || "there"},

${invitationLine}

Meeting: ${meetingTitle}
Project: ${projectName}
Type: ${typeConfig.label}
Date: ${formattedDate}
Time: ${formattedTime}${durationText ? ` (${durationText})` : ""}
Platform: ${platformConfig.label}
${meetingUrl && platform !== "whatsapp_call" ? `Meeting Link: ${meetingUrl}\n` : ""}
Agenda:
${textAgenda}

Organized by: ${organizerName}

We look forward to meeting with you!
Reqly Team
`.trim();

  // Clean HTML Agenda List
  const htmlAgenda =
    agendaItems.length > 0
      ? agendaItems
          .map(
            (item, idx) => `
            <li style="margin-bottom: 8px; color: #353140; font-size: 14px; line-height: 1.5;">
              <span style="font-weight: 600; color: #80642F; margin-right: 6px;">${idx + 1}.</span>
              ${item}
            </li>`
          )
          .join("")
      : `<li style="color: #706C7D; font-size: 13px;">Open discussion.</li>`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF9FC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #252331;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FAF9FC; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; border: 1px solid rgba(74, 61, 100, 0.08); overflow: hidden; box-shadow: 0 4px 24px rgba(70, 55, 95, 0.04);">
          <!-- Top Header -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; background: linear-gradient(135deg, #1f1b2e 0%, #2e2640 100%);">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #B8944E; display: block; margin-bottom: 6px;">
                      PROJECT MEETING INVITATION
                    </span>
                    <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">
                      ${meetingTitle}
                    </h1>
                    <span style="font-size: 13px; color: #c4c0d1; display: block; margin-top: 4px;">
                      Project: <strong style="color: #ffffff;">${projectName}</strong>
                    </span>
                  </td>
                  <td align="right" valign="top">
                    <span style="display: inline-block; background-color: rgba(184, 148, 78, 0.2); border: 1px solid rgba(184, 148, 78, 0.4); border-radius: 8px; padding: 6px 12px; font-size: 11px; font-weight: 700; color: #E5C378; text-transform: uppercase;">
                      ${typeConfig.label}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 28px 32px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #252331; line-height: 1.5;">
                Hello <strong>${recipientName || "there"}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #5a5568;">
                ${invitationLine}
              </p>

              <!-- Meeting Details Box -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #faf9fc; border: 1px solid rgba(74, 61, 100, 0.08); border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding-bottom: 10px; font-size: 13px; color: #706C7D; width: 35%;">Date:</td>
                        <td style="padding-bottom: 10px; font-size: 13px; font-weight: 600; color: #252331;">${formattedDate}</td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 10px; font-size: 13px; color: #706C7D;">Time:</td>
                        <td style="padding-bottom: 10px; font-size: 13px; font-weight: 600; color: #252331;">
                          ${formattedTime} ${durationText ? `<span style="font-weight: 400; color: #706C7D;">(${durationText})</span>` : ""}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 10px; font-size: 13px; color: #706C7D;">Platform:</td>
                        <td style="padding-bottom: 10px; font-size: 13px; font-weight: 600; color: #252331;">${platformConfig.label}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 13px; color: #706C7D;">Organizer:</td>
                        <td style="font-size: 13px; font-weight: 600; color: #252331;">${organizerName}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${
                meetingUrl && platform !== "whatsapp_call"
                  ? `
              <!-- Join Button -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 28px; text-align: center;">
                <tr>
                  <td align="center">
                    <a href="${meetingUrl}" target="_blank" style="display: inline-block; background-color: #B8944E; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 10px; box-shadow: 0 2px 8px rgba(184, 148, 78, 0.25);">
                      Join Meeting Link
                    </a>
                  </td>
                </tr>
              </table>
              `
                  : ""
              }

              <!-- Agenda Section -->
              <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #80642F;">
                  Meeting Agenda
                </h3>
                <ul style="margin: 0; padding-left: 0; list-style: none;">
                  ${htmlAgenda}
                </ul>
              </div>

              <p style="margin: 24px 0 0 0; font-size: 13px; line-height: 1.6; color: #706C7D; border-top: 1px solid rgba(74, 61, 100, 0.06); pt: 16px;">
                Looking forward to our discussion,<br>
                <strong style="color: #252331;">${organizerName}</strong> &bull; Reqly Team
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #faf9fc; border-top: 1px solid rgba(74, 61, 100, 0.06); text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #9994A5;">
                This invitation was sent from REQly project collaboration platform.
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

  return { subject, html, text };
}

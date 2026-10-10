import {
  MEETING_PLATFORM_CONFIG,
  MEETING_TYPE_CONFIG,
  ProjectMeeting,
} from "@/lib/types/meeting";

/**
 * Splits multiline agenda text into clean numbered/bullet-less items
 */
export function parseAgendaItems(agendaText?: string | null): string[] {
  if (!agendaText) return [];
  return agendaText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.replace(/^(\d+[\.\)]\s*|[-*•]\s*)/, "").trim())
    .filter((line) => line.length > 0);
}

/**
 * Validates a meeting link URL
 */
export function isValidMeetingUrl(url?: string | null): boolean {
  if (!url || !url.trim()) return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Calculates readable duration between start and end ISO dates
 */
export function getMeetingDurationText(startIso: string, endIso: string): string {
  try {
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    const diffMins = Math.max(0, Math.round((end - start) / (1000 * 60)));
    if (diffMins === 0) return "0 min";
    if (diffMins < 60) return `${diffMins} mins`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return mins > 0 ? `${hours} hr ${mins} mins` : `${hours} hr${hours > 1 ? "s" : ""}`;
  } catch {
    return "";
  }
}

/**
 * Formats date into readable string (e.g. "15 Oct 2026")
 */
export function formatMeetingDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return isoString;
  }
}

/**
 * Formats time range (e.g. "3:00 PM – 3:30 PM")
 */
export function formatMeetingTimeRange(startIso: string, endIso: string): string {
  try {
    const startStr = new Date(startIso).toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const endStr = new Date(endIso).toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `${startStr} – ${endStr}`;
  } catch {
    return "";
  }
}

/**
 * Generates the standardized externally-shareable plain-text invitation.
 * CRITICAL: Internal meeting notes are NEVER included.
 */
export function formatMeetingInvitationPlainText(
  meeting: ProjectMeeting,
  projectName: string
): string {
  const typeConfig = MEETING_TYPE_CONFIG[meeting.meeting_type] || { label: meeting.meeting_type };
  const platformConfig = MEETING_PLATFORM_CONFIG[meeting.platform] || { label: meeting.platform };
  const formattedDate = formatMeetingDate(meeting.start_at);
  const timeRange = formatMeetingTimeRange(meeting.start_at, meeting.end_at);
  const duration = getMeetingDurationText(meeting.start_at, meeting.end_at);
  const agendaList = parseAgendaItems(meeting.agenda);

  const lines: string[] = [
    "Hi @all,",
    "",
    `You’re invited to the ${projectName} - ${meeting.title}.`,
    "",
    "Meeting details: ",
    "",
    `• Type: ${typeConfig.label}`,
    `• Date: ${formattedDate}`,
    `• Time: ${timeRange}${duration ? ` (${duration})` : ""}`,
    `• Platform: ${platformConfig.label}`,
    "",
  ];

  // Conditional meeting link (never for WhatsApp Call or empty)
  if (meeting.platform !== "whatsapp_call" && meeting.meeting_url) {
    lines.push(`Meeting Link: ${meeting.meeting_url}`);
  }

  lines.push("");
  lines.push("Agenda:");
  if (agendaList.length > 0) {
    agendaList.forEach((item, index) => {
      lines.push(`${index + 1}. ${item}`);
    });
  } else {
    lines.push("1. Open project discussion.");
  }

  lines.push("");
  // lines.push("Looking forward to your participation!");

  return lines.join("\n");
}

/**
 * Builds WhatsApp Click-to-Chat sharing URL
 */
export function getWhatsAppShareUrl(
  invitationText: string,
  recipientPhone?: string | null
): string {
  const encodedText = encodeURIComponent(invitationText);
  if (recipientPhone && recipientPhone.trim()) {
    const cleanPhone = recipientPhone.replace(/[^0-9]/g, "");
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  }
  return `https://wa.me/?text=${encodedText}`;
}

/**
 * Copy text to clipboard with fallback
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn("Clipboard API write failed, using textarea fallback:", err);
  }

  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error("Textarea clipboard fallback failed:", err);
    return false;
  }
}

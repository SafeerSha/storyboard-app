import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeProjectMember } from "@/lib/project-auth";
import { sendEmail } from "@/lib/email/resend";
import { generateMeetingInvitationEmail } from "@/lib/email/templates/meeting-invitation";
import {
  formatMeetingDate,
  formatMeetingTimeRange,
  getMeetingDurationText,
  parseAgendaItems,
} from "@/components/meetings/meeting-utils";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; meetingId: string }> }
) {
  try {
    const { id: projectId, meetingId } = await params;
    const auth = await authorizeProjectMember(projectId);
    if (!auth.authorized || !auth.actor) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 403 });
    }
    const actor = auth.actor;

    const admin = createAdminClient();

    // 1. Fetch meeting & project
    const [{ data: meeting }, { data: project }] = await Promise.all([
      admin
        .from("project_meetings")
        .select("*")
        .eq("id", meetingId)
        .eq("project_id", projectId)
        .maybeSingle(),
      admin.from("projects").select("id, name").eq("id", projectId).maybeSingle(),
    ]);

    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
    }

    const projectName = project?.name || "Project";
    const body = await req.json();
    const channel = body.channel as "email" | "whatsapp" | "clipboard";

    if (!["email", "whatsapp", "clipboard"].includes(channel)) {
      return NextResponse.json({ error: "Invalid sharing channel." }, { status: 400 });
    }

    const nowIso = new Date().toISOString();

    // 2. Handle Email Dispatch
    if (channel === "email") {
      const recipients = Array.isArray(body.recipients)
        ? body.recipients.map((r: any) => String(r).trim()).filter(Boolean)
        : [];

      if (recipients.length === 0) {
        return NextResponse.json(
          { error: "At least one valid recipient email is required." },
          { status: 400 }
        );
      }

      for (const email of recipients) {
        if (!email.includes("@")) {
          return NextResponse.json({ error: `Invalid email address: ${email}` }, { status: 400 });
        }
      }

      const agendaItems = parseAgendaItems(meeting.agenda);
      const formattedDate = formatMeetingDate(meeting.start_at);
      const formattedTime = formatMeetingTimeRange(meeting.start_at, meeting.end_at);
      const durationText = getMeetingDurationText(meeting.start_at, meeting.end_at);

      const emailContent = generateMeetingInvitationEmail({
        projectName,
        meetingTitle: meeting.title,
        meetingType: meeting.meeting_type,
        platform: meeting.platform,
        meetingUrl: meeting.meeting_url,
        formattedDate,
        formattedTime,
        durationText,
        agendaItems,
        invitationMessage: body.customMessage || null,
        organizerName: meeting.created_by_name || actor.name,
      });

      const sendResults = await Promise.all(
        recipients.map((toEmail: string) =>
          sendEmail({
            to: toEmail,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
          })
        )
      );

      const anyFailed = sendResults.find((r) => !r.success);
      if (anyFailed && sendResults.every((r) => !r.success)) {
        return NextResponse.json(
          { error: anyFailed.error || "Failed to dispatch email invitations." },
          { status: 500 }
        );
      }

      // Log event
      try {
        await admin.from("project_meeting_events").insert({
          meeting_id: meetingId,
          project_id: projectId,
          action: "shared_email",
          actor_id: actor.id,
          actor_name: actor.name,
          actor_type: actor.type || "freelancer",
          title: "Invitation Sent via Email",
          description: `Dispatched invitation to ${recipients.join(", ")}.`,
          metadata: { recipients, count: recipients.length },
        });
      } catch (e) {
        console.warn("Failed to log share event:", e);
      }
    } else if (channel === "whatsapp") {
      try {
        await admin.from("project_meeting_events").insert({
          meeting_id: meetingId,
          project_id: projectId,
          action: "shared_whatsapp",
          actor_id: actor.id,
          actor_name: actor.name,
          actor_type: actor.type || "freelancer",
          title: "Invitation Shared via WhatsApp",
          description: "Opened WhatsApp invitation sharing.",
          metadata: { recipientPhone: body.recipientPhone || null },
        });
      } catch (e) {
        console.warn("Failed to log share event:", e);
      }
    } else if (channel === "clipboard") {
      try {
        await admin.from("project_meeting_events").insert({
          meeting_id: meetingId,
          project_id: projectId,
          action: "copied_invitation",
          actor_id: actor.id,
          actor_name: actor.name,
          actor_type: actor.type || "freelancer",
          title: "Invitation Copied to Clipboard",
          description: "Copied plain-text meeting details to clipboard.",
        });
      } catch (e) {
        console.warn("Failed to log share event:", e);
      }
    }

    // Update meeting's last_shared metadata
    await admin
      .from("project_meetings")
      .update({
        last_shared_at: nowIso,
        last_shared_channel: channel,
      })
      .eq("id", meetingId)
      .eq("project_id", projectId);

    return NextResponse.json({
      success: true,
      message:
        channel === "email"
          ? "Invitations dispatched successfully via email!"
          : channel === "whatsapp"
          ? "WhatsApp share initiated."
          : "Invitation copied to clipboard.",
    });
  } catch (err: any) {
    console.error("POST /api/projects/[id]/meetings/[meetingId]/share error:", err);
    return NextResponse.json({ error: err.message || "Failed to share meeting" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeProjectMember } from "@/lib/project-auth";
import { logAudit } from "@/lib/audit";
import { MeetingPlatform, MeetingStatus, MeetingType } from "@/lib/types/meeting";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; meetingId: string }> }
) {
  try {
    const { id: projectId, meetingId } = await params;
    const auth = await authorizeProjectMember(projectId);
    if (!auth.authorized || !auth.actor) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data: meeting, error: mErr } = await admin
      .from("project_meetings")
      .select("*")
      .eq("id", meetingId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (mErr || !meeting) {
      return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
    }

    // Fetch meeting timeline events
    let events: any[] = [];
    try {
      const { data: evData } = await admin
        .from("project_meeting_events")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: false });
      events = evData || [];
    } catch (e) {
      console.warn("Failed to fetch meeting events:", e);
    }

    return NextResponse.json({ meeting, events });
  } catch (err: any) {
    console.error("GET /api/projects/[id]/meetings/[meetingId] error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch meeting" }, { status: 500 });
  }
}

export async function PATCH(
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
    const { data: existing, error: existErr } = await admin
      .from("project_meetings")
      .select("*")
      .eq("id", meetingId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (existErr || !existing) {
      return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
    }

    const body = await req.json();
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
      updated_by_id: actor.id,
      updated_by_name: actor.name,
    };

    const recordedEvents: Array<{
      action: string;
      title: string;
      description: string;
      metadata?: Record<string, any>;
    }> = [];

    // Title
    if (body.title !== undefined) {
      const t = String(body.title).trim();
      if (!t) return NextResponse.json({ error: "Title cannot be empty." }, { status: 400 });
      updates.title = t;
    }

    // Agenda
    if (body.agenda !== undefined) {
      const a = String(body.agenda).trim();
      if (!a) return NextResponse.json({ error: "Agenda cannot be empty." }, { status: 400 });
      updates.agenda = a;
    }

    // Meeting Type
    if (body.meeting_type !== undefined) {
      const mt = body.meeting_type as MeetingType;
      if (!["demo", "planning", "discussion"].includes(mt)) {
        return NextResponse.json({ error: "Invalid meeting type." }, { status: 400 });
      }
      updates.meeting_type = mt;
    }

    // Platform & Link
    if (body.platform !== undefined || body.meeting_url !== undefined) {
      const newPlatform = (body.platform || existing.platform) as MeetingPlatform;
      if (!["whatsapp_call", "teams", "google_meet", "zoom"].includes(newPlatform)) {
        return NextResponse.json({ error: "Invalid platform." }, { status: 400 });
      }
      updates.platform = newPlatform;

      if (newPlatform === "whatsapp_call") {
        updates.meeting_url = null;
      } else {
        const link = String(body.meeting_url !== undefined ? body.meeting_url : existing.meeting_url || "").trim();
        if (!link) {
          return NextResponse.json({ error: "Meeting link is required for this platform." }, { status: 400 });
        }
        try {
          const parsed = new URL(link);
          if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error();
        } catch {
          return NextResponse.json({ error: "Please enter a valid HTTP or HTTPS meeting URL." }, { status: 400 });
        }
        updates.meeting_url = link;
      }

      if (newPlatform !== existing.platform || updates.meeting_url !== existing.meeting_url) {
        recordedEvents.push({
          action: "platform_changed",
          title: "Platform / Link Updated",
          description: `Platform set to ${newPlatform}${updates.meeting_url ? " with new meeting link" : ""}.`,
        });
      }
    }

    // Rescheduling (Start / End times)
    const newStart = body.start_at ? new Date(body.start_at).toISOString() : existing.start_at;
    const newEnd = body.end_at ? new Date(body.end_at).toISOString() : existing.end_at;

    if (body.start_at !== undefined || body.end_at !== undefined) {
      if (new Date(newEnd).getTime() <= new Date(newStart).getTime()) {
        return NextResponse.json({ error: "Meeting end time must be after start time." }, { status: 400 });
      }
      updates.start_at = newStart;
      updates.end_at = newEnd;

      if (newStart !== existing.start_at || newEnd !== existing.end_at) {
        recordedEvents.push({
          action: "rescheduled",
          title: "Meeting Rescheduled",
          description: `Rescheduled to ${new Date(newStart).toLocaleString()}.`,
          metadata: { start_at: newStart, end_at: newEnd },
        });
      }
    }

    if (body.timezone !== undefined) updates.timezone = String(body.timezone).trim();
    if (body.invitation_message !== undefined) updates.invitation_message = String(body.invitation_message).trim();

    // Internal Note
    if (body.internal_note !== undefined) {
      const note = body.internal_note ? String(body.internal_note).trim() : null;
      updates.internal_note = note;
      if (note !== existing.internal_note) {
        recordedEvents.push({
          action: "note_updated",
          title: "Internal Note Updated",
          description: "Internal reference note was updated.",
        });
      }
    }

    // Status changes
    if (body.status !== undefined) {
      const newStatus = body.status as MeetingStatus;
      if (!["scheduled", "completed", "cancelled"].includes(newStatus)) {
        return NextResponse.json({ error: "Invalid status." }, { status: 400 });
      }
      updates.status = newStatus;

      if (newStatus === "completed" && existing.status !== "completed") {
        recordedEvents.push({
          action: "completed",
          title: "Meeting Marked Completed",
          description: "Meeting was successfully completed.",
        });
      }

      if (newStatus === "cancelled" && existing.status !== "cancelled") {
        const reason = body.cancellation_reason ? String(body.cancellation_reason).trim() : null;
        updates.cancellation_reason = reason;
        recordedEvents.push({
          action: "cancelled",
          title: "Meeting Cancelled",
          description: reason ? `Cancelled: ${reason}` : "Meeting was cancelled.",
          metadata: { reason },
        });
      }
    }

    // Execute update
    const { data: updatedMeeting, error: updateErr } = await admin
      .from("project_meetings")
      .update(updates)
      .eq("id", meetingId)
      .eq("project_id", projectId)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Record timeline events
    if (recordedEvents.length === 0) {
      recordedEvents.push({
        action: "updated",
        title: "Meeting Details Updated",
        description: "Meeting details were modified.",
      });
    }

    for (const ev of recordedEvents) {
      try {
        await admin.from("project_meeting_events").insert({
          meeting_id: meetingId,
          project_id: projectId,
          action: ev.action,
          actor_id: actor.id,
          actor_name: actor.name,
          actor_type: actor.type || "freelancer",
          title: ev.title,
          description: ev.description,
          metadata: ev.metadata || {},
        });
      } catch (e) {
        console.warn("Failed to log event:", e);
      }
    }

    // Log General Audit
    await logAudit({
      action: "meeting.updated",
      actorId: actor.id,
      actorType: actor.isSuperAdmin ? "super_admin" : (actor.type as any) || "freelancer",
      actorName: actor.name,
      targetType: "project_meeting",
      targetId: meetingId,
      details: { updates, projectId },
    });

    return NextResponse.json({ success: true, meeting: updatedMeeting });
  } catch (err: any) {
    console.error("PATCH /api/projects/[id]/meetings/[meetingId] error:", err);
    return NextResponse.json({ error: err.message || "Failed to update meeting" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; meetingId: string }> }
) {
  try {
    const { id: projectId, meetingId } = await params;
    const auth = await authorizeProjectMember(projectId);
    if (!auth.authorized || !auth.actor) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 403 });
    }

    const admin = createAdminClient();
    const { error: delErr } = await admin
      .from("project_meetings")
      .delete()
      .eq("id", meetingId)
      .eq("project_id", projectId);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE meeting error:", err);
    return NextResponse.json({ error: err.message || "Failed to delete meeting" }, { status: 500 });
  }
}

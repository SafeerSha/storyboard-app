import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeProjectMember } from "@/lib/project-auth";
import { logAudit } from "@/lib/audit";
import { MeetingPlatform, MeetingType } from "@/lib/types/meeting";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const auth = await authorizeProjectMember(projectId);
    if (!auth.authorized || !auth.actor) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 403 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const meetingType = url.searchParams.get("type");
    const search = url.searchParams.get("search");

    const admin = createAdminClient();
    let query = admin
      .from("project_meetings")
      .select("*")
      .eq("project_id", projectId)
      .order("start_at", { ascending: true });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (meetingType && meetingType !== "all") {
      query = query.eq("meeting_type", meetingType);
    }

    if (search && search.trim()) {
      const s = search.trim();
      query = query.or(`title.ilike.%${s}%,agenda.ilike.%${s}%`);
    }

    const { data: meetings, error } = await query;
    if (error) {
      // If table has not been created yet in Supabase SQL editor, handle gracefully
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        console.warn("Table project_meetings does not exist yet. Please run migration.");
        return NextResponse.json({
          meetings: [],
          warning: "Table project_meetings pending migration in Supabase SQL editor.",
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ meetings: meetings || [] });
  } catch (err: any) {
    console.error("GET /api/projects/[id]/meetings error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch meetings" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const auth = await authorizeProjectMember(projectId);
    if (!auth.authorized || !auth.actor) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 403 });
    }
    const actor = auth.actor;

    const body = await req.json();
    const title = String(body.title || "").trim();
    const agenda = String(body.agenda || "").trim();
    const meetingType = body.meeting_type as MeetingType;
    const platform = body.platform as MeetingPlatform;
    const startAt = body.start_at ? new Date(body.start_at).toISOString() : null;
    const endAt = body.end_at ? new Date(body.end_at).toISOString() : null;
    const timezone = String(body.timezone || "UTC").trim();
    // const invitationMessage = String(body.invitation_message || "").trim();
    const internalNote = body.internal_note ? String(body.internal_note).trim() : null;

    // 1. Validation
    if (!title) {
      return NextResponse.json({ error: "Meeting title is required." }, { status: 400 });
    }

    if (!agenda) {
      return NextResponse.json({ error: "Meeting agenda is required." }, { status: 400 });
    }

    if (!["demo", "planning", "discussion"].includes(meetingType)) {
      return NextResponse.json(
        { error: "Invalid meeting type. Must be Demo, Planning, or Discussion." },
        { status: 400 }
      );
    }

    if (!["whatsapp_call", "teams", "google_meet", "zoom"].includes(platform)) {
      return NextResponse.json({ error: "Invalid meeting platform." }, { status: 400 });
    }

    let meetingUrl: string | null = null;
    if (platform === "whatsapp_call") {
      meetingUrl = null;
    } else {
      meetingUrl = String(body.meeting_url || "").trim();
      if (!meetingUrl) {
        return NextResponse.json(
          { error: `Meeting link is required for ${platform === "google_meet" ? "Google Meet" : platform === "teams" ? "Microsoft Teams" : "Zoom"}.` },
          { status: 400 }
        );
      }
      try {
        const parsed = new URL(meetingUrl);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          throw new Error();
        }
      } catch {
        return NextResponse.json(
          { error: "Please enter a valid HTTP or HTTPS meeting URL." },
          { status: 400 }
        );
      }
    }

    if (!startAt || isNaN(Date.parse(startAt))) {
      return NextResponse.json({ error: "Valid start date and time is required." }, { status: 400 });
    }

    if (!endAt || isNaN(Date.parse(endAt))) {
      return NextResponse.json({ error: "Valid end date and time is required." }, { status: 400 });
    }

    if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
      return NextResponse.json(
        { error: "Meeting end time must be after start time." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // 2. Insert into project_meetings
    const insertPayload: Record<string, any> = {
      project_id: projectId,
      title,
      agenda,
      meeting_type: meetingType,
      platform,
      meeting_url: meetingUrl,
      start_at: startAt,
      end_at: endAt,
      timezone,
      // invitation_message: invitationMessage,
      internal_note: internalNote,
      status: "scheduled",
      created_by_id: actor.id,
      created_by_name: actor.name,
      created_by_type: actor.type || "freelancer",
    };

    const { data: meeting, error: insertErr } = await admin
      .from("project_meetings")
      .insert(insertPayload)
      .select()
      .single();

    if (insertErr) {
      if (insertErr.code === "42P01" || insertErr.message?.includes("does not exist")) {
        return NextResponse.json(
          { error: "Database table project_meetings has not been created yet. Please execute supabase/project_meetings.sql in the Supabase SQL Editor." },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // 3. Log Meeting Event in project_meeting_events
    try {
      await admin.from("project_meeting_events").insert({
        meeting_id: meeting.id,
        project_id: projectId,
        action: "created",
        actor_id: actor.id,
        actor_name: actor.name,
        actor_type: actor.type || "freelancer",
        title: "Meeting Scheduled",
        description: `Scheduled "${title}" on ${new Date(startAt).toLocaleDateString()} (${meetingType.toUpperCase()}).`,
        metadata: {
          platform,
          start_at: startAt,
          end_at: endAt,
          meeting_type: meetingType,
        },
      });
    } catch (e) {
      console.warn("Failed to log meeting event:", e);
    }

    // 4. Log General Audit Log
    await logAudit({
      action: "meeting.created",
      actorId: actor.id,
      actorType: actor.isSuperAdmin ? "super_admin" : (actor.type as any) || "freelancer",
      actorName: actor.name,
      targetType: "project_meeting",
      targetId: meeting.id,
      details: {
        projectId,
        title,
        platform,
        meetingType,
        startAt,
      },
    });

    return NextResponse.json({ success: true, meeting });
  } catch (err: any) {
    console.error("POST /api/projects/[id]/meetings error:", err);
    return NextResponse.json({ error: err.message || "Failed to schedule meeting" }, { status: 500 });
  }
}

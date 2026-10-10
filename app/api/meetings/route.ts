import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const status = searchParams.get("status");
    const meetingType = searchParams.get("type");
    const search = searchParams.get("search")?.trim().toLowerCase();

    const admin = createAdminClient();

    let query = admin
      .from("project_meetings")
      .select(`
        *,
        projects:projects(id, name, description)
      `)
      .order("start_at", { ascending: true });

    if (projectId && projectId !== "all") {
      query = query.eq("project_id", projectId);
    }
    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    if (meetingType && meetingType !== "all") {
      query = query.eq("meeting_type", meetingType);
    }

    const { data: rawMeetings, error } = await query;

    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return NextResponse.json({ meetings: [] });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let meetings = (rawMeetings || []).map((m: any) => ({
      ...m,
      projectName: m.projects?.name || "Project Meeting",
    }));

    if (search) {
      meetings = meetings.filter(
        (m: any) =>
          m.title?.toLowerCase().includes(search) ||
          m.agenda?.toLowerCase().includes(search) ||
          m.projectName?.toLowerCase().includes(search) ||
          m.platform?.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({ meetings });
  } catch (err: any) {
    console.error("GET /api/meetings error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch meetings" }, { status: 500 });
  }
}

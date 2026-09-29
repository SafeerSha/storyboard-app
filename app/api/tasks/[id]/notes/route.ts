import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTeamUser } from "@/lib/team-session";
import { getAuthenticatedClient } from "@/lib/client-session";
import type { TaskNote } from "@/lib/types/task";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const admin = createAdminClient();

    const { data: notes, error } = await admin
      .from("task_notes")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ notes: notes || [] });
  } catch (err: any) {
    console.error("GET /api/tasks/[id]/notes error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch notes" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const body = await req.json().catch(() => ({}));
    const content = body.content?.trim();

    if (!content) {
      return NextResponse.json({ error: "Note content is required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Verify task exists
    const { data: task, error: taskErr } = await admin
      .from("tasks")
      .select("id, project_id, title")
      .eq("id", taskId)
      .maybeSingle();

    if (taskErr || !task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Identify author actor
    let authorId: string | null = null;
    let authorType: "freelancer" | "team_user" | "client" = "freelancer";
    let authorName = "Team Member";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      authorId = user.id;
      authorType = "freelancer";
      const { data: profile } = await admin
        .from("freelancer_profiles")
        .select("name")
        .eq("id", user.id)
        .maybeSingle();
      authorName = profile?.name || user.email?.split("@")[0] || "Freelancer";
    } else {
      const teamUser = await getAuthenticatedTeamUser();
      if (teamUser) {
        authorId = teamUser.id;
        authorType = "team_user";
        authorName = teamUser.name;
      } else {
        const client = await getAuthenticatedClient();
        if (client) {
          authorId = client.id;
          authorType = "client";
          authorName = client.name;
        }
      }
    }

    const { data: note, error: insertErr } = await admin
      .from("task_notes")
      .insert({
        task_id: taskId,
        author_id: authorId,
        author_type: authorType,
        author_name: authorName,
        content,
      })
      .select("*")
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Touch task updated_at
    await admin
      .from("tasks")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", taskId);

    return NextResponse.json({ note }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/tasks/[id]/notes error:", err);
    return NextResponse.json({ error: err.message || "Failed to add note" }, { status: 500 });
  }
}

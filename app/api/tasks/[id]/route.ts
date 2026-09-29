import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTeamUser } from "@/lib/team-session";
import { getAuthenticatedClient } from "@/lib/client-session";
import { notifyTaskAssigned } from "@/lib/notifications/task-notifications";
import type { Task } from "@/lib/types/task";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const admin = createAdminClient();

    const { data: rawTask, error } = await admin
      .from("tasks")
      .select(`
        id,
        project_id,
        story_id,
        title,
        description,
        status,
        priority,
        category,
        assignees,
        due_date,
        assignee_id,
        assignee_type,
        assignee_name,
        assignee_email,
        created_by_id,
        created_by_type,
        created_by_name,
        created_at,
        updated_at,
        projects:projects(id, name),
        stories:stories(id, title, status)
      `)
      .eq("id", taskId)
      .maybeSingle();

    if (error || !rawTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Fetch notes and attachments
    const [notesRes, attachmentsRes] = await Promise.all([
      admin
        .from("task_notes")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true }),
      admin
        .from("task_attachments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false }),
    ]);

    const taskRecord = rawTask as any;
    const multiAssignees =
      Array.isArray(taskRecord.assignees) && taskRecord.assignees.length > 0
        ? taskRecord.assignees
        : taskRecord.assignee_id
        ? [
            {
              id: taskRecord.assignee_id,
              name: taskRecord.assignee_name || "Assignee",
              type: taskRecord.assignee_type || "freelancer",
              email: taskRecord.assignee_email || null,
            },
          ]
        : [];

    const task: Task = {
      ...taskRecord,
      category: taskRecord.category || null,
      assignees: multiAssignees,
      project: taskRecord.projects || null,
      story: taskRecord.stories || null,
      notes: notesRes.data || [],
      attachments: attachmentsRes.data || [],
      notes_count: notesRes.data?.length || 0,
      attachments_count: attachmentsRes.data?.length || 0,
    };

    return NextResponse.json({ task });
  } catch (err: any) {
    console.error("GET /api/tasks/[id] error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch task" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const body = await req.json().catch(() => ({}));
    const admin = createAdminClient();

    // 1. Fetch current task to detect changes
    const { data: currentTask, error: fetchErr } = await admin
      .from("tasks")
      .select(`
        *,
        projects:projects(id, name),
        stories:stories(id, title)
      `)
      .eq("id", taskId)
      .maybeSingle();

    if (fetchErr || !currentTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // 2. Identify updater actor
    let actorName = "Team Member";
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await admin
        .from("freelancer_profiles")
        .select("name")
        .eq("id", user.id)
        .maybeSingle();
      actorName = profile?.name || user.email?.split("@")[0] || "Freelancer";
    } else {
      const teamUser = await getAuthenticatedTeamUser();
      if (teamUser) {
        actorName = teamUser.name;
      } else {
        const client = await getAuthenticatedClient();
        if (client) {
          actorName = client.name;
        }
      }
    }

    // 3. Prepare update fields
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.description !== undefined) updates.description = body.description?.trim() || "";
    if (body.status !== undefined) updates.status = body.status;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.category !== undefined) updates.category = body.category || null;
    if (body.due_date !== undefined) updates.due_date = body.due_date || null;
    if (body.story_id !== undefined) updates.story_id = body.story_id || null;

    // Previous assignees list
    const currentTaskRecord = currentTask as any;
    const previousAssigneeIds = new Set<string>();
    if (Array.isArray(currentTaskRecord.assignees)) {
      currentTaskRecord.assignees.forEach((a: any) => a.id && previousAssigneeIds.add(a.id));
    }
    if (currentTaskRecord.assignee_id) {
      previousAssigneeIds.add(currentTaskRecord.assignee_id);
    }

    const newlyAssignedList: any[] = [];

    if (body.assignees !== undefined && Array.isArray(body.assignees)) {
      updates.assignees = body.assignees;
      const primary = body.assignees[0] || null;
      updates.assignee_id = primary?.id || null;
      updates.assignee_type = primary?.type || null;
      updates.assignee_name = primary?.name || null;
      updates.assignee_email = primary?.email || null;

      for (const a of body.assignees) {
        if (a.id && !previousAssigneeIds.has(a.id)) {
          newlyAssignedList.push(a);
        }
      }
    } else if (body.assignee_id !== undefined) {
      if (body.assignee_id !== currentTask.assignee_id && body.assignee_id !== null) {
        newlyAssignedList.push({
          id: body.assignee_id,
          name: body.assignee_name,
          type: body.assignee_type,
          email: body.assignee_email,
        });
      }
      updates.assignee_id = body.assignee_id;
      updates.assignee_type = body.assignee_type || null;
      updates.assignee_name = body.assignee_name || null;
      updates.assignee_email = body.assignee_email || null;
      updates.assignees = body.assignee_id
        ? [
            {
              id: body.assignee_id,
              name: body.assignee_name,
              type: body.assignee_type,
              email: body.assignee_email,
            },
          ]
        : [];
    }

    let updatedTask: any = null;
    const { data: updatedData, error: updateErr } = await admin
      .from("tasks")
      .update(updates)
      .eq("id", taskId)
      .select(`
        *,
        projects:projects(id, name),
        stories:stories(id, title, status)
      `)
      .single();

    if (updateErr) {
      // Fallback if category or assignees columns don't exist yet
      if (updateErr.message.includes("column") || updateErr.code === "42703") {
        const fallbackUpdates = { ...updates };
        delete fallbackUpdates.category;
        delete fallbackUpdates.assignees;
        const { data: fbData, error: fbError } = await admin
          .from("tasks")
          .update(fallbackUpdates)
          .eq("id", taskId)
          .select(`
            *,
            projects:projects(id, name),
            stories:stories(id, title, status)
          `)
          .single();
        if (fbError) {
          return NextResponse.json({ error: fbError.message }, { status: 500 });
        }
        updatedTask = fbData;
      } else {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
    } else {
      updatedTask = updatedData;
    }

    const finalAssignees =
      Array.isArray(updatedTask.assignees) && updatedTask.assignees.length > 0
        ? updatedTask.assignees
        : updates.assignees || (updatedTask.assignee_id ? [{
            id: updatedTask.assignee_id,
            name: updatedTask.assignee_name,
            type: updatedTask.assignee_type,
            email: updatedTask.assignee_email,
          }] : []);

    const formattedTask: Task = {
      ...updatedTask,
      category: updatedTask.category || body.category || null,
      assignees: finalAssignees,
      project: (updatedTask as any).projects || null,
      story: (updatedTask as any).stories || null,
    };

    // 4. Notify any newly added assignees
    if (newlyAssignedList.length > 0) {
      const projectName = formattedTask.project?.name || "Project";
      const storyTitle = formattedTask.story?.title || null;

      for (const a of newlyAssignedList) {
        if (a.id && a.name) {
          notifyTaskAssigned({
            taskId: formattedTask.id,
            taskTitle: formattedTask.title,
            projectId: formattedTask.project_id,
            projectName,
            storyTitle,
            priority: formattedTask.priority,
            dueDate: formattedTask.due_date,
            assigneeId: a.id,
            assigneeType: a.type,
            assigneeName: a.name,
            assigneeEmail: a.email,
            assignerName: actorName,
          }).catch((notifErr) =>
            console.warn("[Task Update] Notification error:", notifErr)
          );
        }
      }
    }

    return NextResponse.json({ task: formattedTask });
  } catch (err: any) {
    console.error("PATCH /api/tasks/[id] error:", err);
    return NextResponse.json({ error: err.message || "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const admin = createAdminClient();

    const { error } = await admin.from("tasks").delete().eq("id", taskId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/tasks/[id] error:", err);
    return NextResponse.json({ error: err.message || "Failed to delete task" }, { status: 500 });
  }
}

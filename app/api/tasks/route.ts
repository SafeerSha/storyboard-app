import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTeamUser } from "@/lib/team-session";
import { getAuthenticatedClient } from "@/lib/client-session";
import { notifyTaskAssigned } from "@/lib/notifications/task-notifications";
import type { Task, TaskStatus, TaskPriority, TaskAssigneeType } from "@/lib/types/task";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const storyId = searchParams.get("storyId");
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const assigneeId = searchParams.get("assigneeId");
    const search = searchParams.get("search")?.trim().toLowerCase();

    const category = searchParams.get("category");

    const admin = createAdminClient();

    let query = admin
      .from("tasks")
      .select(`
        *,
        projects:projects(id, name),
        stories:stories(id, title, status)
      `)
      .order("updated_at", { ascending: false });

    if (projectId && projectId !== "all") {
      query = query.eq("project_id", projectId);
    }
    if (storyId) {
      query = query.eq("story_id", storyId);
    }
    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    if (priority && priority !== "all") {
      query = query.eq("priority", priority);
    }
    if (category && category !== "all") {
      query = query.eq("category", category);
    }
    if (assigneeId && assigneeId !== "all") {
      query = query.eq("assignee_id", assigneeId);
    }

    const { data: rawTasks, error } = await query;

    if (error) {
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        return NextResponse.json({ tasks: [] });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let tasksList = (rawTasks || []).map((t: any) => {
      const multiAssignees =
        Array.isArray(t.assignees) && t.assignees.length > 0
          ? t.assignees
          : t.assignee_id
          ? [
              {
                id: t.assignee_id,
                name: t.assignee_name || "Assignee",
                type: t.assignee_type || "freelancer",
                email: t.assignee_email || null,
              },
            ]
          : [];

      return {
        ...t,
        category: t.category || null,
        assignees: multiAssignees,
        project: t.projects || null,
        story: t.stories || null,
        projects: undefined,
        stories: undefined,
      };
    }) as Task[];

    // Apply client search filter if provided
    if (search) {
      tasksList = tasksList.filter(
        (t) =>
          t.title.toLowerCase().includes(search) ||
          t.description?.toLowerCase().includes(search) ||
          t.story?.title?.toLowerCase().includes(search) ||
          t.assignee_name?.toLowerCase().includes(search) ||
          t.assignees?.some((a) => a.name.toLowerCase().includes(search))
      );
    }

    // Fetch notes and attachments counts in batch if tasks exist
    if (tasksList.length > 0) {
      const taskIds = tasksList.map((t) => t.id);

      const [notesRes, attachmentsRes] = await Promise.all([
        admin.from("task_notes").select("task_id").in("task_id", taskIds),
        admin.from("task_attachments").select("task_id").in("task_id", taskIds),
      ]);

      const notesCountMap: Record<string, number> = {};
      const attachmentsCountMap: Record<string, number> = {};

      if (notesRes.data) {
        for (const n of notesRes.data) {
          notesCountMap[n.task_id] = (notesCountMap[n.task_id] || 0) + 1;
        }
      }

      if (attachmentsRes.data) {
        for (const a of attachmentsRes.data) {
          attachmentsCountMap[a.task_id] = (attachmentsCountMap[a.task_id] || 0) + 1;
        }
      }

      tasksList = tasksList.map((t) => ({
        ...t,
        notes_count: notesCountMap[t.id] || 0,
        attachments_count: attachmentsCountMap[t.id] || 0,
      }));
    }

    return NextResponse.json({ tasks: tasksList });
  } catch (err: any) {
    console.error("GET /api/tasks error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch tasks" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.title || !body.project_id) {
      return NextResponse.json(
        { error: "Title and Project are required" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // 1. Identify Creator Actor
    let creatorId: string | null = null;
    let creatorType: "freelancer" | "team_user" | "client" = "freelancer";
    let creatorName = "Team Member";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      creatorId = user.id;
      creatorType = "freelancer";
      const { data: profile } = await admin
        .from("freelancer_profiles")
        .select("name")
        .eq("id", user.id)
        .maybeSingle();
      creatorName = profile?.name || user.email?.split("@")[0] || "Freelancer";
    } else {
      const teamUser = await getAuthenticatedTeamUser();
      if (teamUser) {
        creatorId = teamUser.id;
        creatorType = "team_user";
        creatorName = teamUser.name;
      } else {
        const client = await getAuthenticatedClient();
        if (client) {
          creatorId = client.id;
          creatorType = "client";
          creatorName = client.name;
        }
      }
    }

    // Prepare multi-assignees
    const multiAssignees: any[] =
      Array.isArray(body.assignees) && body.assignees.length > 0
        ? body.assignees
        : body.assignee_id
        ? [
            {
              id: body.assignee_id,
              name: body.assignee_name || "Assignee",
              type: body.assignee_type || "freelancer",
              email: body.assignee_email || null,
            },
          ]
        : [];

    const primaryAssignee = multiAssignees[0] || null;

    const taskPayload: any = {
      project_id: body.project_id,
      story_id: body.story_id || null,
      title: body.title.trim(),
      description: body.description?.trim() || "",
      status: (body.status || "todo") as TaskStatus,
      priority: (body.priority || "medium") as TaskPriority,
      category: body.category || null,
      due_date: body.due_date || null,
      assignee_id: primaryAssignee?.id || null,
      assignee_type: primaryAssignee?.type || null,
      assignee_name: primaryAssignee?.name || null,
      assignee_email: primaryAssignee?.email || null,
      assignees: multiAssignees,
      created_by_id: creatorId,
      created_by_type: creatorType,
      created_by_name: creatorName,
    };

    let newTask: any = null;
    const { data: insertedData, error: insertError } = await admin
      .from("tasks")
      .insert(taskPayload)
      .select(`
        *,
        projects:projects(id, name),
        stories:stories(id, title, status)
      `)
      .single();

    if (insertError) {
      // Fallback if category or assignees columns don't exist yet
      if (insertError.message.includes("column") || insertError.code === "42703") {
        const fallbackPayload = { ...taskPayload };
        delete fallbackPayload.category;
        delete fallbackPayload.assignees;
        const { data: fbData, error: fbError } = await admin
          .from("tasks")
          .insert(fallbackPayload)
          .select(`
            *,
            projects:projects(id, name),
            stories:stories(id, title, status)
          `)
          .single();
        if (fbError) {
          return NextResponse.json({ error: fbError.message }, { status: 500 });
        }
        newTask = fbData;
      } else {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    } else {
      newTask = insertedData;
    }

    const formattedTask: Task = {
      ...newTask,
      category: newTask.category || body.category || null,
      assignees: multiAssignees,
      project: (newTask as any).projects || null,
      story: (newTask as any).stories || null,
      notes_count: 0,
      attachments_count: 0,
    };

    // 2. Dispatch Notifications to ALL assigned members & clients
    const projectName = formattedTask.project?.name || "Project";
    const storyTitle = formattedTask.story?.title || null;

    for (const a of multiAssignees) {
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
          assignerName: creatorName,
        }).catch((notifErr) =>
          console.warn("[Task Create] Notification error:", notifErr)
        );
      }
    }

    return NextResponse.json({ task: formattedTask }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/tasks error:", err);
    return NextResponse.json({ error: err.message || "Failed to create task" }, { status: 500 });
  }
}

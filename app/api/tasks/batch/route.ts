import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTeamUser } from "@/lib/team-session";
import { getAuthenticatedClient } from "@/lib/client-session";
import { notifyTaskAssigned } from "@/lib/notifications/task-notifications";
import type { Task, TaskStatus, TaskPriority, TaskAssigneeType } from "@/lib/types/task";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.tasks) || body.tasks.length === 0 || !body.project_id) {
      return NextResponse.json(
        { error: "project_id and a non-empty tasks array are required" },
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

    const rowsToInsert = body.tasks.map((t: any) => {
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

      const primary = multiAssignees[0] || null;

      return {
        project_id: body.project_id,
        story_id: t.story_id || body.story_id || null,
        title: t.title.trim(),
        description: t.description?.trim() || "",
        status: (t.status || "todo") as TaskStatus,
        priority: (t.priority || "medium") as TaskPriority,
        category: t.category || body.category || null,
        due_date: t.due_date || null,
        assignee_id: primary?.id || null,
        assignee_type: (primary?.type || null) as TaskAssigneeType | null,
        assignee_name: primary?.name || null,
        assignee_email: primary?.email || null,
        assignees: multiAssignees,
        created_by_id: creatorId,
        created_by_type: creatorType,
        created_by_name: creatorName,
      };
    });

    let insertedTasks: any[] = [];
    const { data: rawInserted, error: insertError } = await admin
      .from("tasks")
      .insert(rowsToInsert)
      .select(`
        *,
        projects:projects(id, name),
        stories:stories(id, title, status)
      `);

    if (insertError) {
      // Fallback if category or assignees columns don't exist yet
      if (insertError.message.includes("column") || insertError.code === "42703") {
        const fallbackRows = rowsToInsert.map((r: any) => {
          const copy = { ...r };
          delete copy.category;
          delete copy.assignees;
          return copy;
        });
        const { data: fbData, error: fbError } = await admin
          .from("tasks")
          .insert(fallbackRows)
          .select(`
            *,
            projects:projects(id, name),
            stories:stories(id, title, status)
          `);
        if (fbError) {
          return NextResponse.json({ error: fbError.message }, { status: 500 });
        }
        insertedTasks = fbData || [];
      } else {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    } else {
      insertedTasks = rawInserted || [];
    }

    const formattedTasks: Task[] = insertedTasks.map((t: any, idx: number) => {
      const orig = rowsToInsert[idx];
      return {
        ...t,
        category: t.category || orig?.category || null,
        assignees: (Array.isArray(t.assignees) && t.assignees.length > 0) ? t.assignees : (orig?.assignees || []),
        project: t.projects || null,
        story: t.stories || null,
        notes_count: 0,
        attachments_count: 0,
      };
    });

    // Dispatch notifications to all assignees across all tasks
    for (const t of formattedTasks) {
      const targetAssignees = (t.assignees && t.assignees.length > 0)
        ? t.assignees
        : (t.assignee_id ? [{ id: t.assignee_id, name: t.assignee_name, type: t.assignee_type, email: t.assignee_email }] : []);

      for (const a of targetAssignees) {
        if (a.id && a.name) {
          notifyTaskAssigned({
            taskId: t.id,
            taskTitle: t.title,
            projectId: t.project_id,
            projectName: t.project?.name || "Project",
            storyTitle: t.story?.title || null,
            priority: t.priority,
            dueDate: t.due_date,
            assigneeId: a.id,
            assigneeType: a.type,
            assigneeName: a.name,
            assigneeEmail: a.email,
            assignerName: creatorName,
          }).catch((err) => console.warn("[Batch Task] Notification error:", err));
        }
      }
    }

    return NextResponse.json({ tasks: formattedTasks }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/tasks/batch error:", err);
    return NextResponse.json({ error: err.message || "Failed to batch create tasks" }, { status: 500 });
  }
}

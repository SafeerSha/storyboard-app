import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { TasksWorkspace } from "@/components/tasks/TasksWorkspace";
import type { Task } from "@/lib/types/task";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tasks & To-Do | StoryBoard",
  description:
    "Track and manage to-do tasks across team members, clients, and user stories.",
};

export default async function TasksPage() {
  const admin = createAdminClient();

  const [{ data: projectsData }, { data: rawTasks, error }] = await Promise.all([
    admin.from("projects").select("id, name").order("name", { ascending: true }),
    admin
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
      .order("updated_at", { ascending: false }),
  ]);

  let tasks: Task[] = [];
  if (!error && rawTasks) {
    tasks = rawTasks.map((t: any) => ({
      ...t,
      project: t.projects || null,
      story: t.stories || null,
      projects: undefined,
      stories: undefined,
    }));

    if (tasks.length > 0) {
      const taskIds = tasks.map((t) => t.id);
      const [notesRes, attachmentsRes] = await Promise.all([
        admin.from("task_notes").select("task_id").in("task_id", taskIds),
        admin.from("task_attachments").select("task_id").in("task_id", taskIds),
      ]);

      const notesMap: Record<string, number> = {};
      const attachMap: Record<string, number> = {};

      if (notesRes.data) {
        for (const n of notesRes.data) {
          notesMap[n.task_id] = (notesMap[n.task_id] || 0) + 1;
        }
      }
      if (attachmentsRes.data) {
        for (const a of attachmentsRes.data) {
          attachMap[a.task_id] = (attachMap[a.task_id] || 0) + 1;
        }
      }

      tasks = tasks.map((t) => ({
        ...t,
        notes_count: notesMap[t.id] || 0,
        attachments_count: attachMap[t.id] || 0,
      }));
    }
  }

  const projects = (projectsData || []).map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="w-full min-h-screen pb-16">
      {/* Top Header (DashboardHeader includes the centralized NotificationCenter automatically) */}
      <DashboardHeader
        title="To-Do Tasks"
        description="Manage and assign project tasks across teams, clients, and user stories."
        badge={
          <span className="rounded-full bg-[rgba(184,148,78,0.1)] px-2.5 py-0.5 text-xs font-semibold text-[#80642F] border border-[rgba(184,148,78,0.18)]">
            Workspace Tasks
          </span>
        }
      />

      {/* Main Workspace Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <TasksWorkspace initialTasks={tasks} initialProjects={projects} />
      </main>
    </div>
  );
}

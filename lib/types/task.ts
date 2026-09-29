export type TaskStatus = "todo" | "in_progress" | "in_review" | "done";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type TaskAssigneeType = "freelancer" | "team_user" | "client";

export type TaskCategory = "frontend" | "backend" | "fullstack" | "test";

export interface TaskAssigneeOption {
  id: string;
  name: string;
  type: TaskAssigneeType;
  email?: string | null;
  role?: string | null;
  username?: string | null;
  loginId?: string | null;
}

export interface TaskAssignee {
  id: string;
  name: string;
  type: TaskAssigneeType;
  email?: string | null;
  role?: string | null;
  username?: string | null;
}

export interface TaskNote {
  id: string;
  task_id: string;
  author_id?: string | null;
  author_type: "freelancer" | "team_user" | "client";
  author_name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  name: string;
  file_url: string;
  file_key?: string | null;
  file_type?: string | null;
  file_size?: number | null;
  uploaded_by_id?: string | null;
  uploaded_by_name?: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  story_id?: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  category?: TaskCategory | null;
  due_date?: string | null;

  // Single primary assignee (for backward-compat & quick indexing)
  assignee_id?: string | null;
  assignee_type?: TaskAssigneeType | null;
  assignee_name?: string | null;
  assignee_email?: string | null;

  // Multi-assignees list
  assignees?: TaskAssignee[];

  created_by_id?: string | null;
  created_by_type?: "freelancer" | "team_user" | "client" | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;

  // Joined metadata
  project?: {
    id: string;
    name: string;
  };
  story?: {
    id: string;
    title: string;
    status?: string;
  } | null;
  notes_count?: number;
  attachments_count?: number;
  notes?: TaskNote[];
  attachments?: TaskAttachment[];
}

export function getTaskStatusLabel(status: TaskStatus): string {
  switch (status) {
    case "todo":
      return "To Do";
    case "in_progress":
      return "In Progress";
    case "in_review":
      return "In Review";
    case "done":
      return "Done";
    default:
      return status;
  }
}

export function getTaskPriorityLabel(priority: TaskPriority): string {
  switch (priority) {
    case "low":
      return "Low";
    case "medium":
      return "Medium";
    case "high":
      return "High";
    case "urgent":
      return "Urgent";
    default:
      return priority;
  }
}

export function getTaskCategoryLabel(category?: TaskCategory | null): string {
  switch (category) {
    case "frontend":
      return "Frontend";
    case "backend":
      return "Backend";
    case "fullstack":
      return "Full Stack";
    case "test":
      return "Test / QA";
    default:
      return "";
  }
}

export function getTaskCategoryBadge(category?: TaskCategory | null): {
  label: string;
  bg: string;
  text: string;
  border: string;
  iconType: "frontend" | "backend" | "fullstack" | "test";
} | null {
  if (!category) return null;
  switch (category) {
    case "frontend":
      return {
        label: "Frontend",
        bg: "bg-sky-50",
        text: "text-sky-700",
        border: "border-sky-200",
        iconType: "frontend",
      };
    case "backend":
      return {
        label: "Backend",
        bg: "bg-emerald-50",
        text: "text-emerald-700",
        border: "border-emerald-200",
        iconType: "backend",
      };
    case "fullstack":
      return {
        label: "Full Stack",
        bg: "bg-purple-50",
        text: "text-purple-700",
        border: "border-purple-200",
        iconType: "fullstack",
      };
    case "test":
      return {
        label: "Test / QA",
        bg: "bg-amber-50",
        text: "text-amber-800",
        border: "border-amber-200",
        iconType: "test",
      };
    default:
      return null;
  }
}

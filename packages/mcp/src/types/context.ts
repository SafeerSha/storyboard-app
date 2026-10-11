export type UserRole = "super_admin" | "freelancer";

export interface ActorContext {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isSuperAdmin: boolean;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export type EpicPriority = "low" | "medium" | "high";

export type EpicStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "qa_review"
  | "done"
  | "active"
  | "completed";

export type StoryStatus =
  | "new"
  | "active"
  | "done"
  | "draft"
  | "review"
  | "changes_requested"
  | "approved"
  | "in_development"
  | "completed";

export interface ProjectEntity {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  status: "active" | "completed" | "archived";
  created_at: string;
  updated_at: string;
}

export interface EpicEntity {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  status: EpicStatus;
  sort_order: number;
  priority?: EpicPriority | null;
  created_by_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoryEntity {
  id: string;
  project_id: string;
  epic_id: string | null;
  title: string;
  description: string;
  acceptance_criteria: string[];
  assumptions: string[];
  clarifications: string[];
  raw_requirement?: string | null;
  status: StoryStatus;
  team_review_status?: "pending" | "approved" | "changes_requested";
  team_approved_by_id?: string | null;
  team_approved_by_name?: string | null;
  team_approved_at?: string | null;
  client_review_status?: "pending" | "approved" | "changes_requested";
  client_approved_by_id?: string | null;
  client_approved_by_name?: string | null;
  client_approved_at?: string | null;
  created_by_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TeamUserEntity {
  id: string;
  project_id: string | null;
  name: string;
  username: string;
  status: "active" | "disabled";
  created_at: string;
  updated_at: string;
}

export interface StoryReviewerEntity {
  id: string;
  story_id: string;
  team_user_id: string;
  assigned_by: string | null;
  created_at: string;
}

export interface PendingReviewEntity {
  story: StoryEntity;
  reviewer: TeamUserEntity;
  reviewerRole?: string;
  assignedAt: string;
}

export class ServiceError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string = "INTERNAL_ERROR", statusCode: number = 500) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

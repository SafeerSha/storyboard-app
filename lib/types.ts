export type StoryStatus = "draft" | "review" | "changes_requested" | "approved" | "in_development" | "completed";

export type Epic = {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  status: "active" | "completed" | "archived";
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Story = {
  id: string;
  project_id: string;
  epic_id: string | null;
  title: string;
  description: string;
  acceptance_criteria: string[];
  assumptions: string[];
  clarifications: string[];
  status: StoryStatus;
  team_review_status?: "pending" | "approved" | "changes_requested";
  team_approved_by_id?: string | null;
  team_approved_by_name?: string | null;
  team_approved_at?: string | null;
  client_review_status?: "pending" | "approved" | "changes_requested";
  client_approved_by_id?: string | null;
  client_approved_by_name?: string | null;
  client_approved_at?: string | null;
  raw_requirement?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type TeamUser = {
  id: string;
  project_id: string;
  name: string;
  username: string;
  status: "active" | "disabled";
  created_at: string;
  updated_at: string;
  projects?: { name: string } | null;
};

export type GeneratedStory = Omit<Story, "id" | "project_id" | "epic_id" | "created_at" | "updated_at"> & {
  epic_id?: string | null;
  suggestedEpic?: string;
};

export type GenerateStoriesResult = {
  stories: GeneratedStory[];
};

export type FeedbackSectionType = "acceptance_criteria" | "assumption" | "clarification" | "general";
export type FeedbackThreadStatus = "open" | "resolved";
export type FeedbackAuthorType = "client" | "freelancer" | "team_user";

export type FeedbackMessage = {
  id: string;
  thread_id: string;
  author_type: FeedbackAuthorType;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
};

export type FeedbackThread = {
  id: string;
  story_id: string;
  section_type: FeedbackSectionType;
  item_id: string | null;
  item_text?: string | null;
  status: FeedbackThreadStatus;
  created_by_type: FeedbackAuthorType;
  created_by_id: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  messages: FeedbackMessage[];
};

export type StoryWithFeedback = Story & {
  feedback_threads?: FeedbackThread[];
  open_feedback_count?: number;
};


export type StoryStatus = "draft" | "review" | "changes_requested" | "approved" | "in_development" | "completed";

export type Epic = {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  status: "active" | "completed" | "archived";
  sort_order: number;
  created_by_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectNoteStatus = "active" | "converted" | "archived";

export type ProjectNote = {
  id: string;
  project_id: string;
  title: string;
  content: string;
  tags?: string[];
  status: ProjectNoteStatus;
  converted_epic_id?: string | null;
  converted_at?: string | null;
  created_by_id?: string | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
};

export type ConvertNotePreviewStory = {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  assumptions: string[];
  clarifications: string[];
  status?: StoryStatus;
  enabled?: boolean;
};

export type ConvertNotePreviewResult = {
  epic: {
    name: string;
    description: string;
  };
  stories: ConvertNotePreviewStory[];
};

export type ConvertNoteCommitPayload = {
  mode: "new_epic_and_stories" | "existing_epic_stories" | "epic_only";
  targetEpicId?: string | null;
  epic?: {
    name: string;
    description: string;
  };
  stories: Array<{
    title: string;
    description: string;
    acceptanceCriteria: string[];
    assumptions: string[];
    clarifications: string[];
    status?: StoryStatus;
  }>;
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
  created_by_id?: string | null;
  reviewer_ids?: string[];
  reviewers?: Array<{ id: string; team_user_id: string; user_id?: string; name: string; username: string; role?: string }>;
  created_at?: string;
  updated_at?: string;
};

export type StoryReviewer = {
  id: string;
  story_id: string;
  team_user_id: string;
  user_id?: string; // backwards compatibility
  assigned_by?: string | null;
  created_at: string;
  name?: string;
  username?: string;
  role?: string;
  user?: {
    id: string;
    name: string;
    username: string;
    role?: string;
  };
};

export type ProjectTeamMember = {
  id: string;
  project_id: string;
  team_user_id: string;
  assigned_at: string;
  assigned_by?: string | null;
  team_user?: {
    id: string;
    name: string;
    username: string;
    role?: string;
    status: "active" | "disabled";
  };
};

export type TeamUser = {
  id: string;
  name: string;
  username: string;
  role?: string;
  status: "active" | "disabled";
  created_at: string;
  updated_at: string;
  project_id?: string | null;
  project_ids?: string[];
  assigned_projects?: Array<{ id: string; name: string }>;
  projects?: { name: string } | Array<{ id: string; name: string }> | null;
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
export type FeedbackAuthorType = "client" | "freelancer" | "team_user" | "admin";

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

// ==============================================================================
// Project Inbox & Personal AI Workspace Types
// ==============================================================================

export type InboxItemType =
  | "idea"
  | "upcoming_project"
  | "research"
  | "opportunity"
  | "experiment"
  | "feature"
  | "other";

export type InboxItemStatus =
  | "inbox"
  | "exploring"
  | "researching"
  | "planned"
  | "ready"
  | "archived";

export type InboxItemPriority = "low" | "medium" | "high";

export type ProjectInboxLink = {
  id: string;
  inbox_item_id: string;
  title: string;
  url: string;
  created_at: string;
  updated_at: string;
};

export type ProjectInboxAiMessage = {
  id: string;
  thread_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type ProjectInboxAiThread = {
  id: string;
  inbox_item_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages?: ProjectInboxAiMessage[];
};

export type ProjectInboxMemberRole = "owner" | "collaborator";
export type ProjectInboxUserType = "freelancer" | "team_user";

export type ProjectInboxMember = {
  id: string;
  inbox_item_id: string;
  user_id: string;
  user_type: ProjectInboxUserType;
  role: ProjectInboxMemberRole;
  added_by: string | null;
  created_at: string;
  name?: string;
  username?: string;
  email?: string;
};

export type ProjectInboxConversation = {
  id: string;
  inbox_item_id: string;
  title: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  message_count?: number;
};

export type ProjectInboxMessage = {
  id: string;
  conversation_id: string;
  sender_type: "user" | "ai";
  user_id: string | null;
  user_type?: ProjectInboxUserType | null;
  user_name: string;
  message: string;
  created_at: string;
};

export type ProjectInboxInsightType =
  | "insight"
  | "research"
  | "hook"
  | "risk"
  | "decision"
  | "mvp_idea"
  | "competitor"
  | "technical_finding"
  | "question"
  | "reference";

export type ProjectInboxInsight = {
  id: string;
  inbox_item_id: string;
  conversation_id: string;
  message_id: string;
  type: ProjectInboxInsightType;
  title: string;
  question: string;
  question_summary: string;
  ai_response: string;
  ai_response_summary: string;
  saved_by: string;
  saved_by_name: string;
  saved_by_type: ProjectInboxUserType;
  created_at: string;
  updated_at: string;
};

export type ProjectInboxItem = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  type: InboxItemType;
  status: InboxItemStatus;
  priority: InboxItemPriority;
  notes: string;
  research_notes: string;
  converted_project_id: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
  links?: ProjectInboxLink[];
  ai_threads?: ProjectInboxAiThread[];
  conversations?: ProjectInboxConversation[];
  members?: ProjectInboxMember[];
  members_count?: number;
  insights_count?: number;
  currentUserRole?: ProjectInboxMemberRole;
  converted_project?: { id: string; name: string } | null;
};




export type RemunerationStoryEstimate = {
  id: string;
  remuneration_estimate_id: string;
  epic_id: string | null;
  story_id: string | null;
  story_title: string | null;
  epic_name: string | null;
  complexity: string;
  ai_estimated_hours: number;
  final_hours: number;
  frontend_hours: number;
  backend_hours: number;
  database_hours: number;
  integration_hours: number;
  testing_hours: number;
  unit_testing_hours?: number;
  confidence: string | null;
  reasoning: string | null;
  assumptions: string[] | null;
  risks: string[] | null;
  created_at: string;
  updated_at: string;
};

export type RemunerationScope = "frontend" | "backend" | "both";

export type RemunerationServiceRates = {
  frontend?: number;
  backend?: number;
  dbDesign?: number;
  unitTesting?: number;
  deployment?: number;
  effectiveRate?: number;
};

export type RemunerationPublishingStatus =
  | "draft"
  | "published"
  | "negotiating"
  | "approved"
  | "rejected"
  | "recalled";

export type RemunerationDiscussionMessage = {
  id: string;
  author_id: string;
  author_name: string;
  author_type: "client" | "freelancer";
  message: string;
  proposed_hours?: number;
  proposed_amount?: number;
  created_at: string;
};

export type RemunerationDiscussionThread = {
  id: string;
  section_key: string; // e.g. "summary", "database_design", "unit_testing", "deployment", "story_<id>"
  section_title: string;
  status: "open" | "resolved";
  messages: RemunerationDiscussionMessage[];
  created_at: string;
  updated_at: string;
};

export type RemunerationClientAction = {
  status: "pending" | "approved" | "rejected" | "negotiating";
  decided_at?: string;
  decided_by_client_id?: string;
  decided_by_client_name?: string;
  notes?: string;
};

export type PublishedClientDetail = {
  id: string;
  name: string;
  email?: string;
};

export type RemunerationPublishingInfo = {
  status: RemunerationPublishingStatus;
  published_at?: string;
  published_to_client_ids: string[];
  published_to_clients?: PublishedClientDetail[];
  previous_client_ids?: string[];
  previous_clients?: PublishedClientDetail[];
  client_emails?: Record<string, string>;
  from_email?: string;
  publish_note?: string;
  recalled_at?: string;
  recall_reason?: string;
  estimate_label?: string;
  client_action?: RemunerationClientAction;
  discussions?: Record<string, RemunerationDiscussionThread>; // keyed by section_key
};

export type RemunerationProjectSummary = {
  complexity: string;
  summary: string;
  estimate_label?: string;
  risks?: string[];
  assumptions?: string[];
  scope?: RemunerationScope;
  includeDbDesign?: boolean;
  includeUnitTesting?: boolean;
  includeDeployment?: boolean;
  deploymentHours?: number;
  rates?: RemunerationServiceRates;
  effectiveRate?: number;
  publishing?: RemunerationPublishingInfo;
};

export type RemunerationEstimate = {
  id: string;
  project_id: string;
  created_by: string;
  hourly_rate: number;
  currency: string;
  contingency_percentage: number;
  ai_total_hours: number;
  final_total_hours: number;
  base_amount: number;
  contingency_amount: number;
  final_amount: number;
  project_summary: RemunerationProjectSummary | any;
  created_at: string;
  updated_at: string;
  story_estimates?: RemunerationStoryEstimate[];
};

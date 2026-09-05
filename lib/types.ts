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
  raw_requirement?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type GeneratedStory = Omit<Story, "id" | "project_id" | "epic_id" | "created_at" | "updated_at"> & { suggestedEpic?: string };

export type MeetingType = "demo" | "planning" | "discussion";

export type MeetingPlatform = "whatsapp_call" | "teams" | "google_meet" | "zoom";

export type MeetingStatus = "scheduled" | "completed" | "cancelled";

export type MeetingShareChannel = "whatsapp" | "email" | "clipboard";

export interface ProjectMeeting {
  id: string;
  project_id: string;
  title: string;
  agenda: string;
  meeting_type: MeetingType;
  platform: MeetingPlatform;
  meeting_url?: string | null;
  start_at: string;
  end_at: string;
  timezone: string;
  invitation_message: string;
  internal_note?: string | null;
  status: MeetingStatus;
  cancellation_reason?: string | null;
  last_shared_at?: string | null;
  last_shared_channel?: MeetingShareChannel | null;
  created_by_id: string;
  created_by_name: string;
  created_by_type: "freelancer" | "team_user" | "client" | "super_admin";
  updated_by_id?: string | null;
  updated_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectMeetingEvent {
  id: string;
  meeting_id: string;
  project_id: string;
  action:
    | "created"
    | "updated"
    | "rescheduled"
    | "platform_changed"
    | "completed"
    | "cancelled"
    | "note_updated"
    | "shared_whatsapp"
    | "shared_email"
    | "copied_invitation";
  actor_id: string;
  actor_name: string;
  actor_type: string;
  title: string;
  description?: string | null;
  metadata?: Record<string, any>;
  created_at: string;
}

export const MEETING_TYPE_CONFIG: Record<
  MeetingType,
  { label: string; badgeClass: string; bgClass: string; textClass: string; borderClass: string }
> = {
  demo: {
    label: "Demo",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
    bgClass: "bg-purple-50",
    textClass: "text-purple-700",
    borderClass: "border-purple-200",
  },
  planning: {
    label: "Planning",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    bgClass: "bg-blue-50",
    textClass: "text-blue-700",
    borderClass: "border-blue-200",
  },
  discussion: {
    label: "Discussion",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    bgClass: "bg-amber-50",
    textClass: "text-amber-700",
    borderClass: "border-amber-200",
  },
};

export const MEETING_PLATFORM_CONFIG: Record<
  MeetingPlatform,
  { label: string; requiresUrl: boolean; iconName: string; defaultPlaceholder?: string }
> = {
  whatsapp_call: {
    label: "WhatsApp Call",
    requiresUrl: false,
    iconName: "PhoneCall",
  },
  google_meet: {
    label: "Google Meet",
    requiresUrl: true,
    iconName: "Video",
    defaultPlaceholder: "https://meet.google.com/abc-defg-hij",
  },
  teams: {
    label: "Microsoft Teams",
    requiresUrl: true,
    iconName: "Video",
    defaultPlaceholder: "https://teams.microsoft.com/l/meetup-join/...",
  },
  zoom: {
    label: "Zoom",
    requiresUrl: true,
    iconName: "Video",
    defaultPlaceholder: "https://zoom.us/j/1234567890",
  },
};

export const MEETING_STATUS_CONFIG: Record<
  MeetingStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  scheduled: {
    label: "Scheduled",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dotClass: "bg-emerald-500",
  },
  completed: {
    label: "Completed",
    badgeClass: "bg-zinc-100 text-zinc-700 border-zinc-200",
    dotClass: "bg-zinc-500",
  },
  cancelled: {
    label: "Cancelled",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
    dotClass: "bg-rose-500",
  },
};

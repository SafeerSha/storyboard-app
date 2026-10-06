export type EpicKanbanStatus = "backlog" | "todo" | "in_progress" | "qa_review" | "done";

export type EpicStatus =
  | EpicKanbanStatus
  | "pending"
  | "active"
  | "completed"
  | "archived"
  | "qa"
  | "review"
  | "in_review"
  | string;

export interface EpicColumnConfig {
  id: EpicKanbanStatus;
  label: string;
  badgeLabel: string;
  dotColor: string;
  badgeBg: string;
  badgeText: string;
  headerBorderColor: string;
  borderColor: string;
  cardBorderAccent: string;
  bgTint: string;
  description: string;
}

export const EPIC_KANBAN_COLUMNS: EpicColumnConfig[] = [
  {
    id: "backlog",
    label: "Backlog / Pending",
    badgeLabel: "Backlog",
    dotColor: "bg-slate-400",
    badgeBg: "bg-slate-100",
    badgeText: "text-slate-700",
    headerBorderColor: "border-slate-200",
    borderColor: "border-slate-200",
    cardBorderAccent: "hover:border-slate-300",
    bgTint: "bg-slate-50/50",
    description: "Planned or awaiting kickoff requirements",
  },
  {
    id: "todo",
    label: "To Do",
    badgeLabel: "To Do",
    dotColor: "bg-amber-500",
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-800",
    headerBorderColor: "border-amber-200/80",
    borderColor: "border-amber-200/80",
    cardBorderAccent: "hover:border-amber-300",
    bgTint: "bg-amber-50/30",
    description: "Scoped and ready for development work",
  },
  {
    id: "in_progress",
    label: "In Progress",
    badgeLabel: "In Progress",
    dotColor: "bg-[#B8944E]",
    badgeBg: "bg-[rgba(184,148,78,0.12)]",
    badgeText: "text-[#80642F]",
    headerBorderColor: "border-[rgba(184,148,78,0.25)]",
    borderColor: "border-[rgba(184,148,78,0.25)]",
    cardBorderAccent: "hover:border-[#B8944E]/60",
    bgTint: "bg-[rgba(184,148,78,0.03)]",
    description: "Active development currently underway",
  },
  {
    id: "qa_review",
    label: "QA / Review",
    badgeLabel: "QA / Review",
    dotColor: "bg-purple-500",
    badgeBg: "bg-purple-100",
    badgeText: "text-purple-800",
    headerBorderColor: "border-purple-200/80",
    borderColor: "border-purple-200/80",
    cardBorderAccent: "hover:border-purple-300",
    bgTint: "bg-purple-50/30",
    description: "Under testing, verification, or client review",
  },
  {
    id: "done",
    label: "Done",
    badgeLabel: "Done",
    dotColor: "bg-emerald-500",
    badgeBg: "bg-emerald-100",
    badgeText: "text-emerald-800",
    headerBorderColor: "border-emerald-200/80",
    borderColor: "border-emerald-200/80",
    cardBorderAccent: "hover:border-emerald-300",
    bgTint: "bg-emerald-50/30",
    description: "Completed, verified, and accepted deliverables",
  },
];

/**
 * Normalizes any existing or legacy status string into one of the 5 canonical Epic Kanban column IDs.
 */
export function normalizeEpicStatus(status?: string | null): EpicKanbanStatus {
  if (!status) return "backlog";
  const s = status.toLowerCase().trim();
  if (s === "backlog" || s === "pending") return "backlog";
  if (s === "todo" || s === "to_do") return "todo";
  if (s === "in_progress" || s === "inprogress" || s === "active") return "in_progress";
  if (
    s === "qa" ||
    s === "review" ||
    s === "qa_review" ||
    s === "in_review" ||
    s === "qa / review"
  ) {
    return "qa_review";
  }
  if (s === "done" || s === "completed" || s === "archived") return "done";
  return "backlog";
}

/**
 * Returns human-readable label for any Epic status.
 */
export function getEpicStatusLabel(status?: string | null): string {
  const norm = normalizeEpicStatus(status);
  switch (norm) {
    case "backlog":
      return "Backlog / Pending";
    case "todo":
      return "To Do";
    case "in_progress":
      return "In Progress";
    case "qa_review":
      return "QA / Review";
    case "done":
      return "Done";
  }
}

/**
 * Story 1: Cycles the epic to the next logical status:
 * backlog -> todo -> in_progress -> qa_review -> done -> backlog
 */
export function getNextEpicStatus(currentStatus?: string | null): EpicKanbanStatus {
  const norm = normalizeEpicStatus(currentStatus);
  const cycleOrder: EpicKanbanStatus[] = ["backlog", "todo", "in_progress", "qa_review", "done"];
  const currentIndex = cycleOrder.indexOf(norm);
  const nextIndex = (currentIndex + 1) % cycleOrder.length;
  return cycleOrder[nextIndex];
}

/**
 * Story 3: Epic Priority levels and configs
 */
export type EpicPriority = "low" | "medium" | "high";

export interface EpicPriorityConfig {
  id: EpicPriority;
  label: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  dotColor: string;
}

export const EPIC_PRIORITIES: Record<EpicPriority, EpicPriorityConfig> = {
  low: {
    id: "low",
    label: "Low",
    badgeBg: "bg-slate-100",
    badgeText: "text-slate-700",
    borderColor: "border-slate-200",
    dotColor: "bg-slate-400",
  },
  medium: {
    id: "medium",
    label: "Medium",
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-800",
    borderColor: "border-amber-200",
    dotColor: "bg-amber-500",
  },
  high: {
    id: "high",
    label: "High",
    badgeBg: "bg-rose-50",
    badgeText: "text-rose-700",
    borderColor: "border-rose-200",
    dotColor: "bg-rose-500",
  },
};

/**
 * Normalizes priority strings to Low, Medium, or High
 */
export function normalizeEpicPriority(priority?: string | null): EpicPriority {
  if (!priority) return "medium";
  const p = priority.toLowerCase().trim();
  if (p === "low") return "low";
  if (p === "high") return "high";
  return "medium";
}

/**
 * Extracts priority from explicit column or from description metadata fallback
 */
export function extractEpicPriority(epic: { priority?: string | null; description?: string | null }): EpicPriority {
  if (epic.priority) {
    return normalizeEpicPriority(epic.priority);
  }
  if (epic.description) {
    const match = epic.description.match(/<!--priority:(low|medium|high)-->/i);
    if (match && match[1]) {
      return normalizeEpicPriority(match[1]);
    }
  }
  return "medium";
}

/**
 * Strips priority metadata tags from epic description for clean display
 */
export function cleanEpicDescription(description?: string | null): string {
  if (!description) return "";
  return description
    .replace(/<!--priority:(low|medium|high)-->/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Embeds priority tag in description as graceful fallback
 */
export function encodeEpicDescriptionWithPriority(description: string | null | undefined, priority: EpicPriority): string {
  const clean = cleanEpicDescription(description);
  return clean ? `${clean} <!--priority:${priority}-->` : `<!--priority:${priority}-->`;
}


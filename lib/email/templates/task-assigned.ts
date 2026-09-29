import { renderEmailBase, escapeHtml } from "./base";

export interface TaskAssignedEmailProps {
  recipientName: string;
  assignerName: string;
  projectName: string;
  taskTitle: string;
  description?: string | null;
  priority: string;
  dueDate?: string | null;
  storyTitle?: string | null;
  actionUrl: string;
}

export function generateTaskAssignedEmail({
  recipientName,
  assignerName,
  projectName,
  taskTitle,
  description,
  priority,
  dueDate,
  storyTitle,
  actionUrl,
}: TaskAssignedEmailProps) {
  const safeRecipientName = escapeHtml(recipientName);
  const safeAssignerName = escapeHtml(assignerName);
  const safeProjectName = escapeHtml(projectName);
  const safeTaskTitle = escapeHtml(taskTitle);
  const safeDescription = description ? escapeHtml(description) : "";
  const safeStoryTitle = storyTitle ? escapeHtml(storyTitle) : "";

  const priorityColor =
    priority === "urgent"
      ? "#e11d48"
      : priority === "high"
      ? "#ea580c"
      : priority === "medium"
      ? "#B8944E"
      : "#64748b";

  const preheader = `You've been assigned a new task: "${safeTaskTitle}" in ${safeProjectName}`;

  const contentHtml = `
    <p style="margin: 0 0 16px 0;">Hello <strong>${safeRecipientName}</strong>,</p>
    <p style="margin: 0 0 20px 0;">
      <strong>${safeAssignerName}</strong> has assigned you a new to-do task in <strong>${safeProjectName}</strong>.
    </p>

    <!-- Task Details Box -->
    <div style="margin: 0 0 24px 0; padding: 20px; background-color: #fafaf9; border-left: 4px solid ${priorityColor}; border-radius: 8px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: ${priorityColor}; letter-spacing: 0.5px;">
          ${priority.toUpperCase()} PRIORITY
        </span>
        ${
          dueDate
            ? `<span style="font-size: 12px; color: #78716c; font-weight: 500;">Due: ${dueDate}</span>`
            : ""
        }
      </div>

      <div style="font-size: 16px; font-weight: 600; color: #1c1917; margin-bottom: 8px;">
        ${safeTaskTitle}
      </div>

      ${
        safeDescription
          ? `<div style="font-size: 13px; color: #57534e; line-height: 1.5; margin-bottom: 12px; white-space: pre-wrap;">${safeDescription}</div>`
          : ""
      }

      ${
        safeStoryTitle
          ? `
        <div style="padding-top: 10px; border-top: 1px dashed #d6d3d1; font-size: 12px; color: #78716c;">
          <strong>Linked Story:</strong> <span style="color: #1c1917;">${safeStoryTitle}</span>
        </div>
      `
          : ""
      }
    </div>

    <p style="margin: 0 0 16px 0; font-size: 14px; color: #44403c;">
      Click the button below to view the task details, update status, add notes, or upload attachments.
    </p>
  `;

  return {
    subject: `[Task Assigned] ${taskTitle} - ${projectName}`,
    html: renderEmailBase({
      title: `Task Assigned: ${projectName}`,
      preheader,
      contentHtml,
      actionText: "View Task Details",
      actionUrl,
    }),
  };
}

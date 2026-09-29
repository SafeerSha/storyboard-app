import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, getAppBaseUrl } from "@/lib/email/resend";
import { generateTaskAssignedEmail } from "@/lib/email/templates/task-assigned";
import { createInAppNotification } from "@/lib/notifications/service";

export interface NotifyTaskAssignedParams {
  taskId: string;
  taskTitle: string;
  projectId: string;
  projectName: string;
  storyTitle?: string | null;
  priority: string;
  dueDate?: string | null;
  assigneeId: string;
  assigneeType?: string | null;
  assigneeName: string;
  assigneeEmail?: string | null;
  assignerName: string;
}

/**
 * Dispatches both in-app notification and email to the assigned user (member or client)
 */
export async function notifyTaskAssigned({
  taskId,
  taskTitle,
  projectId,
  projectName,
  storyTitle,
  priority,
  dueDate,
  assigneeId,
  assigneeType,
  assigneeName,
  assigneeEmail,
  assignerName,
}: NotifyTaskAssignedParams) {
  const baseUrl = getAppBaseUrl();
  const taskUrl = `${baseUrl}/tasks?projectId=${projectId}&taskId=${taskId}`;

  // 1. In-App Notification
  try {
    await createInAppNotification({
      userId: assigneeId,
      title: `Task Assigned: ${taskTitle}`,
      message: `${assignerName} assigned you a task in "${projectName}" (Priority: ${priority.toUpperCase()})`,
      type: "task",
      linkUrl: taskUrl,
    });
  } catch (err: any) {
    console.warn("[Task Notification] In-app notification error:", err?.message);
  }

  // 2. Email Notification
  try {
    let targetEmail = assigneeEmail?.trim() || "";

    // If email wasn't provided directly, look up from appropriate table
    if (!targetEmail || !targetEmail.includes("@")) {
      const admin = createAdminClient();

      if (assigneeType === "client") {
        const { data: client } = await admin
          .from("clients")
          .select("email")
          .eq("id", assigneeId)
          .maybeSingle();
        if (client?.email && client.email.includes("@")) {
          targetEmail = client.email;
        }
      } else if (assigneeType === "team_user") {
        const { data: teamUser } = await admin
          .from("team_users")
          .select("username")
          .eq("id", assigneeId)
          .maybeSingle();
        if (teamUser?.username && teamUser.username.includes("@")) {
          targetEmail = teamUser.username;
        }
      } else if (assigneeType === "freelancer") {
        const { data: profile } = await admin
          .from("freelancer_profiles")
          .select("email")
          .eq("id", assigneeId)
          .maybeSingle();
        if (profile?.email && profile.email.includes("@")) {
          targetEmail = profile.email;
        }
      }
    }

    if (targetEmail && targetEmail.includes("@")) {
      const emailContent = generateTaskAssignedEmail({
        recipientName: assigneeName || "Team Member",
        assignerName: assignerName || "Project Lead",
        projectName,
        taskTitle,
        priority,
        dueDate,
        storyTitle,
        actionUrl: taskUrl,
      });

      await sendEmail({
        to: targetEmail,
        subject: emailContent.subject,
        html: emailContent.html,
      });
    }
  } catch (err: any) {
    console.warn("[Task Notification] Email dispatch error:", err?.message);
  }
}

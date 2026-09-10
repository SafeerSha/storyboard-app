import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedClient } from "@/lib/client-session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDiscussionNotification, getAppBaseUrl } from "@/lib/email/resend";

const discussionSchema = z.object({
  estimateId: z.string().uuid(),
  sectionKey: z.string().min(1),
  sectionTitle: z.string().min(1),
  message: z.string().min(1).max(3000),
  proposedHours: z.number().nullable().optional(),
  proposedAmount: z.number().nullable().optional(),
});

async function notifyOnDiscussionMessage({
  admin,
  projectId,
  authorType,
  authorName,
  sectionTitle,
  message,
  proposedHours,
  proposedAmount,
  currency,
  publishing,
}: {
  admin: any;
  projectId: string;
  authorType: "client" | "freelancer";
  authorName: string;
  sectionTitle: string;
  message: string;
  proposedHours?: number | null;
  proposedAmount?: number | null;
  currency?: string;
  publishing: any;
}) {
  try {
    const { data: project } = await admin
      .from("projects")
      .select("name, owner_id")
      .eq("id", projectId)
      .maybeSingle();

    if (!project) return;
    const projectName = project.name || "Project";
    const appUrl = getAppBaseUrl();

    if (authorType === "client") {
      // Notify freelancer
      if (!project.owner_id) return;
      const { data: profile } = await admin
        .from("freelancer_profiles")
        .select("email, name, full_name")
        .eq("id", project.owner_id)
        .maybeSingle();

      if (profile?.email) {
        await sendDiscussionNotification(profile.email, {
          recipientName: profile.full_name || profile.name || "Project Lead",
          senderName: authorName,
          projectName,
          sectionTitle,
          message,
          proposedHours,
          proposedAmount,
          currency,
          actionUrl: `${appUrl}/remuneration`,
        });
      }
    } else {
      // Author is freelancer -> Notify clients
      const clientEmails = publishing?.client_emails || {};
      const publishedClientIds: string[] = publishing?.published_to_client_ids || [];

      if (publishedClientIds.length > 0) {
        const { data: clients } = await admin
          .from("clients")
          .select("id, name")
          .in("id", publishedClientIds);

        const clientMap = new Map<string, string>(
          (clients || []).map((c: any) => [c.id, String(c.name || "Client")])
        );

        for (const clientId of publishedClientIds) {
          const email = clientEmails[clientId];
          if (email && typeof email === "string" && email.trim().includes("@")) {
            const clientName = clientMap.get(clientId) || "Client";
            await sendDiscussionNotification(email.trim(), {
              recipientName: clientName,
              senderName: authorName,
              projectName,
              sectionTitle,
              message,
              proposedHours,
              proposedAmount,
              currency,
              actionUrl: `${appUrl}/client/estimate`,
            });
          }
        }
      }
    }
  } catch (err) {
    console.error("[notifyOnDiscussionMessage failed]:", err);
  }
}

export async function POST(req: Request) {
  try {
    const admin = createAdminClient();

    // 1. Check if authenticated as Client
    const clientUser = await getAuthenticatedClient();

    // 2. If not client, check if authenticated as Freelancer
    let freelancerUser: any = null;
    if (!clientUser) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      freelancerUser = user;
    }

    if (!clientUser && !freelancerUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      estimateId,
      sectionKey,
      sectionTitle,
      message,
      proposedHours,
      proposedAmount,
    } = discussionSchema.parse(body);

    // Fetch estimate
    const { data: estimate, error: estError } = await admin
      .from("remuneration_estimates")
      .select("*")
      .eq("id", estimateId)
      .maybeSingle();

    if (estError || !estimate) {
      return NextResponse.json({ error: "Estimate not found." }, { status: 404 });
    }

    const summary = estimate.project_summary || {};
    const publishing = summary.publishing || {};

    let authorType: "client" | "freelancer";
    let authorId: string;
    let authorName: string;

    if (clientUser) {
      // Validate client belongs to project and is in published_to_client_ids
      if (
        estimate.project_id !== clientUser.project_id ||
        !publishing.published_to_client_ids ||
        !publishing.published_to_client_ids.includes(clientUser.id)
      ) {
        return NextResponse.json({ error: "Access denied to this quotation." }, { status: 403 });
      }
      authorType = "client";
      authorId = clientUser.id;
      authorName = clientUser.name;
    } else {
      // Validate freelancer ownership
      const { data: project } = await admin
        .from("projects")
        .select("id, owner_id")
        .eq("id", estimate.project_id)
        .maybeSingle();

      if (project?.owner_id !== freelancerUser.id) {
        const { data: profile } = await admin
          .from("freelancer_profiles")
          .select("role, full_name")
          .eq("id", freelancerUser.id)
          .maybeSingle();

        if (profile?.role !== "super_admin") {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        authorName = profile?.full_name || freelancerUser.email?.split("@")[0] || "Admin";
      } else {
        const { data: profile } = await admin
          .from("freelancer_profiles")
          .select("full_name")
          .eq("id", freelancerUser.id)
          .maybeSingle();
        authorName = profile?.full_name || freelancerUser.email?.split("@")[0] || "Freelancer";
      }

      authorType = "freelancer";
      authorId = freelancerUser.id;
    }

    const now = new Date().toISOString();
    const discussions = { ...(publishing.discussions || {}) };

    const thread = discussions[sectionKey] || {
      id: crypto.randomUUID(),
      section_key: sectionKey,
      section_title: sectionTitle,
      status: "open",
      messages: [],
      created_at: now,
      updated_at: now,
    };

    const newMessage = {
      id: crypto.randomUUID(),
      author_id: authorId,
      author_name: authorName,
      author_type: authorType,
      message: message.trim(),
      proposed_hours: proposedHours !== undefined && proposedHours !== null ? Number(proposedHours) : undefined,
      proposed_amount: proposedAmount !== undefined && proposedAmount !== null ? Number(proposedAmount) : undefined,
      created_at: now,
    };

    thread.messages = [...(thread.messages || []), newMessage];
    thread.updated_at = now;
    discussions[sectionKey] = thread;

    // If client is negotiating/proposing and status is published, transition to negotiating
    let newPublishingStatus = publishing.status || "published";
    if (clientUser && (newPublishingStatus === "published" || newPublishingStatus === "approved")) {
      newPublishingStatus = "negotiating";
    }

    const updatedPublishing = {
      ...publishing,
      status: newPublishingStatus,
      discussions,
    };

    const updatedSummary = {
      ...summary,
      publishing: updatedPublishing,
    };

    const { error: updateError } = await admin
      .from("remuneration_estimates")
      .update({
        project_summary: updatedSummary,
        updated_at: now,
      })
      .eq("id", estimateId);

    if (updateError) {
      console.error("Failed to save discussion message:", updateError);
      return NextResponse.json({ error: "Failed to post message." }, { status: 500 });
    }

    // Trigger email notification asynchronously
    notifyOnDiscussionMessage({
      admin,
      projectId: estimate.project_id,
      authorType,
      authorName,
      sectionTitle,
      message: message.trim(),
      proposedHours,
      proposedAmount,
      currency: estimate.currency,
      publishing: updatedPublishing,
    });

    return NextResponse.json({
      ok: true,
      thread,
      publishingStatus: newPublishingStatus,
      message: "Discussion message posted successfully.",
    });
  } catch (err: any) {
    console.error("Discussion route error:", err);
    return NextResponse.json({ error: err.message || "Failed to process message." }, { status: 400 });
  }
}


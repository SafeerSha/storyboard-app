import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedClient } from "@/lib/client-session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendQuotationApprovedNotification,
  sendQuotationChangesRequestedNotification,
} from "@/lib/email/resend";

const actionSchema = z.object({
  estimateId: z.string().uuid(),
  action: z.enum(["approve", "request_changes", "reject"]),
  notes: z.string().max(4000).optional(),
});

async function notifyFreelancerOnClientAction({
  admin,
  projectId,
  clientName,
  action,
  notes,
  estimate,
}: {
  admin: any;
  projectId: string;
  clientName: string;
  action: "approve" | "request_changes" | "reject";
  notes?: string;
  estimate: any;
}) {
  try {
    const { data: project } = await admin
      .from("projects")
      .select("name, owner_id")
      .eq("id", projectId)
      .maybeSingle();

    if (!project || !project.owner_id) return;

    const { data: profile } = await admin
      .from("freelancer_profiles")
      .select("email, name, full_name")
      .eq("id", project.owner_id)
      .maybeSingle();

    if (!profile?.email) return;

    const freelancerName = profile.full_name || profile.name || "Project Lead";
    const projectName = project.name || "Project";

    if (action === "approve") {
      await sendQuotationApprovedNotification(profile.email, {
        freelancerName,
        clientName,
        projectName,
        totalHours: Number(estimate.final_total_hours || 0),
        totalAmount: Number(estimate.final_amount || 0),
        currency: estimate.currency || "USD",
        approvalNote: notes || undefined,
      });
    } else {
      await sendQuotationChangesRequestedNotification(profile.email, {
        freelancerName,
        clientName,
        projectName,
        clientNote: notes || undefined,
      });
    }
  } catch (err) {
    console.error("[notifyFreelancerOnClientAction failed]:", err);
  }
}

export async function POST(req: Request) {
  try {
    const client = await getAuthenticatedClient();
    if (!client) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { estimateId, action, notes = "" } = actionSchema.parse(body);

    const admin = createAdminClient();

    // Fetch estimate
    const { data: estimate, error: fetchError } = await admin
      .from("remuneration_estimates")
      .select("*")
      .eq("id", estimateId)
      .eq("project_id", client.project_id)
      .maybeSingle();

    if (fetchError || !estimate) {
      return NextResponse.json({ error: "Estimate not found." }, { status: 404 });
    }

    const summary = estimate.project_summary || {};
    const publishing = summary.publishing || {};

    if (
      !publishing.published_to_client_ids ||
      !Array.isArray(publishing.published_to_client_ids) ||
      !publishing.published_to_client_ids.includes(client.id)
    ) {
      return NextResponse.json({ error: "Quotation is not shared with your account." }, { status: 403 });
    }

    const newStatus =
      action === "approve"
        ? "approved"
        : action === "reject"
        ? "rejected"
        : "negotiating";

    const now = new Date().toISOString();

    const clientActionData = {
      status: newStatus,
      decided_at: now,
      decided_by_client_id: client.id,
      decided_by_client_name: client.name,
      notes: notes.trim(),
    };

    const discussions = { ...(publishing.discussions || {}) };

    // If client included notes on approve/reject/request_changes, append to summary discussion thread
    if (notes.trim()) {
      const threadKey = "summary";
      const existingThread = discussions[threadKey] || {
        id: crypto.randomUUID(),
        section_key: threadKey,
        section_title: "Project Scope & Overall Package",
        status: "open",
        messages: [],
        created_at: now,
        updated_at: now,
      };

      existingThread.messages = [
        ...(existingThread.messages || []),
        {
          id: crypto.randomUUID(),
          author_id: client.id,
          author_name: client.name,
          author_type: "client",
          message: `[${action === "approve" ? "Approval Note" : action === "reject" ? "Rejection Reason" : "Negotiation Request"}]: ${notes.trim()}`,
          created_at: now,
        },
      ];
      existingThread.updated_at = now;
      discussions[threadKey] = existingThread;
    }

    const updatedPublishing = {
      ...publishing,
      status: newStatus,
      client_action: clientActionData,
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
      console.error("Failed to record client action:", updateError);
      return NextResponse.json({ error: "Failed to record response." }, { status: 500 });
    }

    // Asynchronously dispatch email notification to freelancer
    notifyFreelancerOnClientAction({
      admin,
      projectId: client.project_id,
      clientName: client.name,
      action,
      notes: notes.trim(),
      estimate,
    });

    return NextResponse.json({
      ok: true,
      status: newStatus,
      clientAction: clientActionData,
      message:
        action === "approve"
          ? "Quotation approved successfully!"
          : action === "reject"
          ? "Quotation declined."
          : "Changes requested. The freelancer has been notified.",
    });
  } catch (err: any) {
    console.error("Client remuneration action error:", err);
    return NextResponse.json({ error: err.message || "Action failed." }, { status: 400 });
  }
}


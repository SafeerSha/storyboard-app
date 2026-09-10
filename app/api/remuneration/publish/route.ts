import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendQuotationPublishedNotification } from "@/lib/email/resend";
import { generateRemunerationPDFBuffer } from "@/lib/remuneration-export";

async function notifyClientsOnPublish({
  admin,
  userId,
  projectId,
  selectedClientIds,
  clientEmails,
  fromEmail,
  totalHours,
  totalAmount,
  currency,
  publishNote,
  estimateData,
  storyEstimates,
  estimateId,
  estimateLabel,
}: {
  admin: any;
  userId: string;
  projectId: string;
  selectedClientIds: string[];
  clientEmails: Record<string, string>;
  fromEmail?: string;
  totalHours: number;
  totalAmount: number;
  currency: string;
  publishNote?: string;
  estimateData?: any;
  storyEstimates?: any[];
  estimateId?: string;
  estimateLabel?: string;
}) {
  try {
    const [{ data: project }, { data: profile }, { data: clients }] = await Promise.all([
      admin.from("projects").select("name").eq("id", projectId).maybeSingle(),
      admin.from("freelancer_profiles").select("name, full_name, email").eq("id", userId).maybeSingle(),
      admin.from("clients").select("id, name, login_id").in("id", selectedClientIds),
    ]);

    const projectName = project?.name || "Project";
    const freelancerName = profile?.full_name || profile?.name || "Project Lead";

    // Prepare story list for PDF
    let effectiveStories = storyEstimates || [];
    if (effectiveStories.length === 0 && estimateId) {
      const { data: dbStories } = await admin
        .from("remuneration_story_estimates")
        .select("*")
        .eq("remuneration_estimate_id", estimateId);
      effectiveStories = dbStories || [];
    }

    // Generate PDF Buffer for Email Attachment (without tool brand prefix)
    let pdfAttachment: { filename: string; content: Buffer } | undefined = undefined;
    try {
      const sanitizedName = projectName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
      const labelSuffix = estimateLabel ? `-${estimateLabel.replace(/[^a-z0-9]/gi, "-").toLowerCase()}` : "";
      const dateStr = new Date().toISOString().split("T")[0];
      const pdfBuffer = await generateRemunerationPDFBuffer(
        projectName,
        {
          hourly_rate: estimateData?.hourly_rate || 0,
          currency,
          final_total_hours: totalHours,
          base_amount: estimateData?.base_amount || (totalHours * (estimateData?.hourly_rate || 0)),
          contingency_percentage: estimateData?.contingency_percentage || 0,
          contingency_amount: estimateData?.contingency_amount || 0,
          final_amount: totalAmount,
          project_summary: {
            ...(estimateData?.project_summary || {}),
            estimate_label: estimateLabel || undefined,
          },
          created_at: new Date().toISOString(),
        },
        effectiveStories
      );
      pdfAttachment = {
        filename: `${sanitizedName}${labelSuffix}-quotation-${dateStr}.pdf`,
        content: pdfBuffer,
      };
    } catch (pdfErr) {
      console.error("[PDF generation for email attachment error]:", pdfErr);
    }

    if (clients && clients.length > 0) {
      for (const client of clients) {
        const email = clientEmails[client.id];
        if (email && email.trim().includes("@")) {
          sendQuotationPublishedNotification(email.trim(), {
            fromEmail,
            clientName: client.name,
            projectName,
            freelancerName,
            totalHours,
            totalAmount,
            currency,
            publishNote: publishNote || undefined,
            clientLoginPin: client.login_id,
            estimateLabel: estimateLabel || undefined,
            pdfAttachment,
          }).catch((err) => console.error(`[Email notification error for client ${client.id}]:`, err));
        }
      }
    }
  } catch (err) {
    console.error("[notifyClientsOnPublish failed]:", err);
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await req.json();
    const {
      estimateId,
      project_id,
      estimateData,
      storyEstimates,
      selectedClientIds,
      clientEmails = {},
      fromEmail = "",
      publishNote = "",
      estimateLabel = "",
    } = payload;

    if (!selectedClientIds || !Array.isArray(selectedClientIds) || selectedClientIds.length === 0) {
      return NextResponse.json({ error: "Please select at least one client to publish to." }, { status: 400 });
    }

    const admin = createAdminClient();

    // Query client names and emails for published snapshot
    const { data: dbClients } = await admin
      .from("clients")
      .select("id, name, email")
      .in("id", selectedClientIds);

    const publishedClientsList = selectedClientIds.map((cid: string) => {
      const match = dbClients?.find((c) => c.id === cid);
      return {
        id: cid,
        name: match?.name || "Client",
        email: clientEmails[cid] || match?.email || "",
      };
    });

    let targetEstimateId = estimateId;

    // If estimateId is not provided, we first save the estimate
    if (!targetEstimateId) {
      if (!project_id || !estimateData || !storyEstimates) {
        return NextResponse.json({ error: "Missing required estimate data" }, { status: 400 });
      }

      // Check project ownership or super admin
      const { data: project } = await admin
        .from("projects")
        .select("id, owner_id")
        .eq("id", project_id)
        .maybeSingle();

      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      if (project.owner_id !== user.id) {
        const { data: profile } = await admin
          .from("freelancer_profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.role !== "super_admin") {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }

      const estimateLabelToUse = estimateLabel?.trim() || estimateData.project_summary?.estimate_label || undefined;

      const publishingInfo = {
        status: "published",
        published_at: new Date().toISOString(),
        published_to_client_ids: selectedClientIds,
        published_to_clients: publishedClientsList,
        client_emails: clientEmails,
        from_email: fromEmail?.trim() || undefined,
        publish_note: publishNote,
        estimate_label: estimateLabelToUse,
        client_action: {
          status: "pending",
        },
        discussions: {},
      };

      const updatedSummary = {
        ...(estimateData.project_summary || {}),
        estimate_label: estimateLabelToUse,
        publishing: publishingInfo,
      };

      const { data: newEstimate, error: insertError } = await admin
        .from("remuneration_estimates")
        .insert({
          project_id,
          created_by: user.id,
          hourly_rate: estimateData.hourly_rate,
          currency: estimateData.currency,
          contingency_percentage: estimateData.contingency_percentage,
          ai_total_hours: estimateData.ai_total_hours,
          final_total_hours: estimateData.final_total_hours,
          base_amount: estimateData.base_amount,
          contingency_amount: estimateData.contingency_amount,
          final_amount: estimateData.final_amount,
          project_summary: updatedSummary,
        })
        .select()
        .single();

      if (insertError || !newEstimate) {
        console.error("Failed to insert published estimate:", insertError);
        return NextResponse.json({ error: "Failed to save estimate" }, { status: 500 });
      }

      targetEstimateId = newEstimate.id;

      // Insert story estimates
      const storyInserts = storyEstimates.map((s: any) => ({
        remuneration_estimate_id: newEstimate.id,
        epic_id: s.epic_id || s.epicId || null,
        story_id: s.story_id || s.storyId || null,
        story_title: s.story_title || s.title || "Story",
        epic_name: s.epic_name || s.epicName || "Epic",
        complexity: s.complexity,
        ai_estimated_hours: s.ai_estimated_hours,
        final_hours: s.final_hours,
        frontend_hours: s.frontend_hours || 0,
        backend_hours: s.backend_hours || 0,
        database_hours: s.database_hours || 0,
        integration_hours: s.integration_hours || 0,
        testing_hours: s.testing_hours || 0,
        confidence: s.confidence,
        reasoning: s.reasoning,
        assumptions: s.assumptions || [],
        risks: s.risks || [],
      }));

      await admin.from("remuneration_story_estimates").insert(storyInserts);

      // Trigger asynchronous email dispatch
      notifyClientsOnPublish({
        admin,
        userId: user.id,
        projectId: project_id,
        selectedClientIds,
        clientEmails,
        fromEmail: fromEmail?.trim() || undefined,
        totalHours: Number(estimateData.final_total_hours || 0),
        totalAmount: Number(estimateData.final_amount || 0),
        currency: estimateData.currency || "USD",
        publishNote,
        estimateLabel: estimateLabelToUse,
        estimateData: {
          ...estimateData,
          project_summary: updatedSummary,
        },
        storyEstimates,
        estimateId: targetEstimateId,
      });

      return NextResponse.json({
        ok: true,
        estimateId: targetEstimateId,
        publishing: publishingInfo,
        message: "Estimate published to selected client(s) successfully.",
      });
    } else {
      // Existing estimate: fetch and update project_summary.publishing
      const { data: existing, error: fetchError } = await admin
        .from("remuneration_estimates")
        .select("id, project_id, created_by, project_summary, hourly_rate, currency, final_total_hours, base_amount, contingency_percentage, contingency_amount, final_amount")
        .eq("id", targetEstimateId)
        .maybeSingle();

      if (fetchError || !existing) {
        return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
      }

      const existingPublishing = existing.project_summary?.publishing || {};
      const mergedClientEmails = {
        ...(existingPublishing.client_emails || {}),
        ...clientEmails,
      };

      const finalFromEmail = fromEmail?.trim() || existingPublishing.from_email || undefined;
      const finalEstimateLabel = estimateLabel?.trim() || existingPublishing.estimate_label || existing.project_summary?.estimate_label || undefined;

      const updatedPublishing = {
        ...existingPublishing,
        status: "published",
        published_at: new Date().toISOString(),
        published_to_client_ids: selectedClientIds,
        published_to_clients: publishedClientsList,
        client_emails: mergedClientEmails,
        from_email: finalFromEmail,
        publish_note: publishNote || existingPublishing.publish_note || "",
        estimate_label: finalEstimateLabel,
        client_action: existingPublishing.client_action || {
          status: "pending",
        },
        discussions: existingPublishing.discussions || {},
      };

      const updatedSummary = {
        ...(existing.project_summary || {}),
        estimate_label: finalEstimateLabel,
        publishing: updatedPublishing,
      };

      const { error: updateError } = await admin
        .from("remuneration_estimates")
        .update({
          project_summary: updatedSummary,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetEstimateId);

      if (updateError) {
        console.error("Failed to update published estimate:", updateError);
        return NextResponse.json({ error: "Failed to update estimate publishing status" }, { status: 500 });
      }

      // Trigger asynchronous email dispatch
      notifyClientsOnPublish({
        admin,
        userId: user.id,
        projectId: existing.project_id,
        selectedClientIds,
        clientEmails: mergedClientEmails,
        fromEmail: finalFromEmail,
        totalHours: Number(existing.final_total_hours || 0),
        totalAmount: Number(existing.final_amount || 0),
        currency: existing.currency || "USD",
        publishNote: publishNote || existingPublishing.publish_note,
        estimateLabel: finalEstimateLabel,
        estimateData: {
          hourly_rate: existing.hourly_rate,
          currency: existing.currency,
          base_amount: existing.base_amount,
          contingency_percentage: existing.contingency_percentage,
          contingency_amount: existing.contingency_amount,
          final_amount: existing.final_amount,
          project_summary: updatedSummary,
        },
        storyEstimates: storyEstimates || [],
        estimateId: targetEstimateId,
      });

      return NextResponse.json({
        ok: true,
        estimateId: targetEstimateId,
        publishing: updatedPublishing,
        message: "Estimate published to selected client(s) successfully.",
      });
    }
  } catch (err: any) {
    console.error("Publishing error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}


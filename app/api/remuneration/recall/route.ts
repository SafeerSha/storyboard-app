import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendQuotationRecalledNotification } from "@/lib/email/resend";

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
    const { estimateId, recallReason = "", fromEmail } = payload;

    if (!estimateId) {
      return NextResponse.json({ error: "Estimate ID is required to recall a quotation." }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: existing, error: fetchError } = await admin
      .from("remuneration_estimates")
      .select("id, project_id, created_by, project_summary")
      .eq("id", estimateId)
      .maybeSingle();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Estimate not found." }, { status: 404 });
    }

    // Authorize caller: must be super_admin, creator of estimate, or owner of project
    const { data: project } = await admin
      .from("projects")
      .select("id, owner_id")
      .eq("id", existing.project_id)
      .maybeSingle();

    const isOwner = project?.owner_id === user.id || existing.created_by === user.id;
    if (!isOwner) {
      const { data: profile } = await admin
        .from("freelancer_profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.role !== "super_admin") {
        return NextResponse.json({ error: "Forbidden: Access denied to this quotation." }, { status: 403 });
      }
    }

    const existingPublishing = existing.project_summary?.publishing || {};
    const previousClientIds: string[] = existingPublishing.published_to_client_ids || [];
    const clientEmails: Record<string, string> = existingPublishing.client_emails || {};
    const finalFromEmail = fromEmail?.trim() || existingPublishing.from_email || undefined;

    // Build updated publishing info: status is 'recalled', access is withdrawn
    let previousClients = existingPublishing.published_to_clients;
    if (!previousClients || previousClients.length === 0) {
      if (previousClientIds.length > 0) {
        const { data: prevDbClients } = await admin
          .from("clients")
          .select("id, name, email")
          .in("id", previousClientIds);

        previousClients = previousClientIds.map((cid: string) => {
          const match = prevDbClients?.find((c) => c.id === cid);
          return {
            id: cid,
            name: match?.name || "Client",
            email: clientEmails[cid] || match?.email || "",
          };
        });
      } else {
        previousClients = [];
      }
    }

    const updatedPublishing = {
      ...existingPublishing,
      status: "recalled",
      recalled_at: new Date().toISOString(),
      recall_reason: recallReason.trim(),
      previous_client_ids: previousClientIds,
      previous_clients: previousClients,
      published_to_client_ids: [], // Vanishes from client portal immediately
    };

    const updatedSummary = {
      ...(existing.project_summary || {}),
      publishing: updatedPublishing,
    };

    const { error: updateError } = await admin
      .from("remuneration_estimates")
      .update({
        project_summary: updatedSummary,
        updated_at: new Date().toISOString(),
      })
      .eq("id", estimateId);

    if (updateError) {
      console.error("Failed to update estimate recall status:", updateError);
      return NextResponse.json({ error: "Failed to update estimate recall status" }, { status: 500 });
    }

    // Dispatches recall notification email to all clients who previously received access
    if (previousClientIds.length > 0) {
      (async () => {
        try {
          const [{ data: project }, { data: profile }, { data: clients }] = await Promise.all([
            admin.from("projects").select("name").eq("id", existing.project_id).maybeSingle(),
            admin.from("freelancer_profiles").select("name, full_name").eq("id", user.id).maybeSingle(),
            admin.from("clients").select("id, name, email").in("id", previousClientIds),
          ]);

          const projectName = project?.name || "Project";
          const freelancerName = profile?.full_name || profile?.name || "Project Lead";

          if (clients && clients.length > 0) {
            for (const client of clients) {
              const email = clientEmails[client.id] || client.email;
              if (email && email.trim().includes("@")) {
                await sendQuotationRecalledNotification(email.trim(), {
                  fromEmail: finalFromEmail,
                  clientName: client.name,
                  projectName,
                  freelancerName,
                  recallReason: recallReason.trim() || undefined,
                  estimateLabel: existingPublishing.estimate_label || existing.project_summary?.estimate_label || undefined,
                }).catch((err) => console.error(`[Email error notifying recall to client ${client.id}]:`, err));
              }
            }
          }
        } catch (err) {
          console.error("[Async email recall notification failed]:", err);
        }
      })();
    }

    return NextResponse.json({
      ok: true,
      estimateId,
      publishing: updatedPublishing,
      message: "Quotation recalled successfully. Client portal access has been revoked and clients have been notified.",
    });
  } catch (err: any) {
    console.error("Recall quotation error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

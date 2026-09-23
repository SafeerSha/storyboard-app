import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyPaymentRequested } from "@/lib/notifications/service";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; installmentId: string }> }
) {
  try {
    const { id: remunerationId, installmentId } = await params;
    const auth = await createClient();
    const {
      data: { user },
    } = await auth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // 1. Fetch remuneration and project
    const { data: remuneration } = await admin
      .from("remunerations")
      .select("*, project:projects(id, name, owner_id)")
      .eq("id", remunerationId)
      .maybeSingle();

    if (!remuneration) {
      return NextResponse.json({ error: "Remuneration not found" }, { status: 404 });
    }

    const { data: profile } = await admin
      .from("freelancer_profiles")
      .select("role, name")
      .eq("id", user.id)
      .maybeSingle();

    const isSuperAdmin = profile?.role === "super_admin";
    if (remuneration.project?.owner_id !== user.id && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden. Access denied." }, { status: 403 });
    }

    // 2. Fetch installment
    const { data: installment } = await admin
      .from("remuneration_installments")
      .select("*")
      .eq("id", installmentId)
      .eq("remuneration_id", remunerationId)
      .maybeSingle();

    if (!installment) {
      return NextResponse.json({ error: "Installment not found" }, { status: 404 });
    }

    if (installment.status === "completed") {
      return NextResponse.json(
        { error: "Cannot request payment for an installment that is already completed." },
        { status: 400 }
      );
    }

    // 3. Count total installments
    const { count: totalInstallments } = await admin
      .from("remuneration_installments")
      .select("id", { count: "exact", head: true })
      .eq("remuneration_id", remunerationId);

    // 4. Fetch client for email dispatch
    const { data: clients } = await admin
      .from("clients")
      .select("id, name, email")
      .eq("project_id", remuneration.project_id);

    const client = clients?.find((c) => c.email) || clients?.[0] || null;

    const requestedDate = new Date().toISOString();

    // 5. Update installment status to requested
    const { data: updatedInstallment, error: updateErr } = await admin
      .from("remuneration_installments")
      .update({
        status: "requested",
        requested_date: requestedDate,
        updated_at: requestedDate,
      })
      .eq("id", installmentId)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // 6. Update parent remuneration status to requested if not completed
    if (remuneration.status !== "completed") {
      await admin
        .from("remunerations")
        .update({
          status: "requested",
          updated_at: requestedDate,
        })
        .eq("id", remunerationId);
    }

    const actorName = profile?.name || user.email?.split("@")[0] || "Owner";

    // 7. Dispatch audit trail, in-app notification & client email
    await notifyPaymentRequested({
      remunerationId,
      installmentId,
      installmentNumber: installment.installment_number,
      totalInstallments: totalInstallments || undefined,
      amount: Number(installment.amount),
      currency: remuneration.currency,
      dueDate: installment.due_date,
      notes: installment.notes,
      projectName: remuneration.project?.name || "Project",
      clientName: client?.name || "Client",
      clientEmail: client?.email,
      ownerId: user.id,
      actorName,
    });

    return NextResponse.json({
      success: true,
      installment: updatedInstallment,
      remunerationStatus: "requested",
    });
  } catch (err: any) {
    console.error("POST request installment error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

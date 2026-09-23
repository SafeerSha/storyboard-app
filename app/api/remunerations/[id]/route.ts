import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await createClient();
    const {
      data: { user },
    } = await auth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // 1. Fetch remuneration
    const { data: remuneration, error: rErr } = await admin
      .from("remunerations")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (rErr) {
      return NextResponse.json({ error: rErr.message }, { status: 500 });
    }

    if (!remuneration) {
      return NextResponse.json({ error: "Remuneration not found" }, { status: 404 });
    }

    // 2. Fetch project and verify ownership
    const { data: project } = await admin
      .from("projects")
      .select("id, name, owner_id")
      .eq("id", remuneration.project_id)
      .maybeSingle();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { data: profile } = await admin
      .from("freelancer_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const isSuperAdmin = profile?.role === "super_admin";
    if (project.owner_id !== user.id && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden. Access denied." }, { status: 403 });
    }

    // 3. Fetch derived client
    const { data: clients } = await admin
      .from("clients")
      .select("id, name, email, login_id, status")
      .eq("project_id", project.id);

    const client = clients?.find((c) => c.status === "active") || clients?.[0] || null;

    // 4. Fetch installments
    const { data: installments } = await admin
      .from("remuneration_installments")
      .select("*")
      .eq("remuneration_id", id)
      .order("installment_number", { ascending: true });

    const installmentIds = (installments || []).map((i) => i.id);

    // 5. Fetch proofs and payments
    let proofs: any[] = [];
    let payments: any[] = [];
    if (installmentIds.length > 0) {
      const [proofsRes, paymentsRes] = await Promise.all([
        admin.from("remuneration_proofs").select("*").in("installment_id", installmentIds),
        admin.from("remuneration_payments").select("*").in("installment_id", installmentIds).order("payment_date", { ascending: false }),
      ]);
      proofs = proofsRes.data || [];
      payments = paymentsRes.data || [];
    }

    const proofsByInst = new Map<string, any[]>();
    proofs.forEach((p) => {
      const list = proofsByInst.get(p.installment_id) || [];
      list.push(p);
      proofsByInst.set(p.installment_id, list);
    });

    const paymentsByInst = new Map<string, any[]>();
    payments.forEach((pm) => {
      const list = paymentsByInst.get(pm.installment_id) || [];
      list.push(pm);
      paymentsByInst.set(pm.installment_id, list);
    });

    // 6. Fetch timeline events
    const { data: events } = await admin
      .from("remuneration_events")
      .select("*")
      .eq("remuneration_id", id)
      .order("created_at", { ascending: false });

    // Calculate metrics
    let totalReceived = 0;
    const enrichedInstallments = (installments || []).map((inst) => {
      const rec = Number(inst.received_amount) || 0;
      totalReceived += rec;
      return {
        ...inst,
        amount: Number(inst.amount),
        received_amount: rec,
        proofs: proofsByInst.get(inst.id) || [],
        payments: paymentsByInst.get(inst.id) || [],
      };
    });

    const totalAmount = Number(remuneration.total_amount) || 0;
    const remainingAmount = Math.max(0, totalAmount - totalReceived);

    return NextResponse.json({
      remuneration: {
        ...remuneration,
        total_amount: totalAmount,
        received_amount: totalReceived,
        remaining_amount: remainingAmount,
        project,
        client,
        installments: enrichedInstallments,
        timeline: events || [],
      },
    });
  } catch (err: any) {
    console.error("GET /api/remunerations/[id] error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

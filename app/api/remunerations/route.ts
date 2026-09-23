import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRemunerationSchema } from "@/lib/types/remuneration";
import { recordRemunerationAuditEvent, createInAppNotification } from "@/lib/notifications/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await createClient();
    const {
      data: { user },
    } = await auth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Check if user is super admin
    const { data: profile } = await admin
      .from("freelancer_profiles")
      .select("role, name")
      .eq("id", user.id)
      .maybeSingle();

    const isSuperAdmin = profile?.role === "super_admin";

    // 1. Fetch authorized projects
    let projectsQuery = admin.from("projects").select("id, name, owner_id");
    if (!isSuperAdmin) {
      projectsQuery = projectsQuery.eq("owner_id", user.id);
    }
    const { data: userProjects, error: pErr } = await projectsQuery;
    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    const projectMap = new Map((userProjects || []).map((p) => [p.id, p]));
    const projectIds = Array.from(projectMap.keys());

    if (projectIds.length === 0) {
      return NextResponse.json({
        remunerations: [],
        stats: {
          totalRemuneration: 0,
          totalReceived: 0,
          totalPending: 0,
          totalOverdue: 0,
          upcomingPayments: [],
          recentPayments: [],
          overduePayments: [],
        },
      });
    }

    // 2. Fetch clients mapped to these projects
    const { data: clientsData } = await admin
      .from("clients")
      .select("id, name, email, login_id, project_id, status")
      .in("project_id", projectIds);

    const clientMap = new Map<string, any>();
    (clientsData || []).forEach((c) => {
      // Keep first active client per project
      if (!clientMap.has(c.project_id) || c.status === "active") {
        clientMap.set(c.project_id, c);
      }
    });

    // 3. Fetch remunerations
    const { data: remunerations, error: rErr } = await admin
      .from("remunerations")
      .select("*")
      .in("project_id", projectIds)
      .order("created_at", { ascending: false });

    if (rErr) {
      // Graceful fallback if table is not yet migrated in Supabase
      if (rErr.code === "42P01" || rErr.message.includes("does not exist")) {
        return NextResponse.json({
          remunerations: [],
          stats: {
            totalRemuneration: 0,
            totalReceived: 0,
            totalPending: 0,
            totalOverdue: 0,
            upcomingPayments: [],
            recentPayments: [],
            overduePayments: [],
          },
          needsMigration: true,
        });
      }
      return NextResponse.json({ error: rErr.message }, { status: 500 });
    }

    const remIds = (remunerations || []).map((r) => r.id);

    // 4. Fetch installments for these remunerations
    let installments: any[] = [];
    if (remIds.length > 0) {
      const { data: instData } = await admin
        .from("remuneration_installments")
        .select("*")
        .in("remuneration_id", remIds)
        .order("installment_number", { ascending: true });
      installments = instData || [];
    }

    const installmentsByRem = new Map<string, any[]>();
    installments.forEach((inst) => {
      const list = installmentsByRem.get(inst.remuneration_id) || [];
      list.push(inst);
      installmentsByRem.set(inst.remuneration_id, list);
    });

    // 5. Aggregate metrics & populate joined data
    const todayStr = new Date().toISOString().split("T")[0];
    let totalRemuneration = 0;
    let totalReceived = 0;
    let totalPending = 0;
    let totalOverdue = 0;

    const upcomingPayments: any[] = [];
    const recentPayments: any[] = [];
    const overduePayments: any[] = [];

    const enrichedRemunerations = (remunerations || []).map((rem) => {
      const p = projectMap.get(rem.project_id);
      const c = clientMap.get(rem.project_id);
      const insts = installmentsByRem.get(rem.id) || [];

      let remReceived = 0;
      let nextDue: string | null = null;
      let hasOverdue = false;

      insts.forEach((inst) => {
        const amt = Number(inst.amount) || 0;
        const rec = Number(inst.received_amount) || 0;
        remReceived += rec;

        const isOverdue = inst.status !== "completed" && inst.due_date < todayStr;
        if (isOverdue) {
          hasOverdue = true;
          totalOverdue += amt - rec;
          overduePayments.push({
            id: inst.id,
            remunerationId: rem.id,
            projectName: p?.name || "Project",
            clientName: c?.name || "Client",
            installmentNumber: inst.installment_number,
            amount: amt - rec,
            currency: rem.currency,
            dueDate: inst.due_date,
            status: inst.status,
          });
        }

        if (inst.status !== "completed" && !nextDue) {
          nextDue = inst.due_date;
        }

        if (inst.status !== "completed" && inst.due_date >= todayStr) {
          upcomingPayments.push({
            id: inst.id,
            remunerationId: rem.id,
            projectName: p?.name || "Project",
            clientName: c?.name || "Client",
            installmentNumber: inst.installment_number,
            amount: amt,
            currency: rem.currency,
            dueDate: inst.due_date,
            status: inst.status,
          });
        }

        if (inst.status === "completed" && inst.received_date) {
          recentPayments.push({
            id: inst.id,
            remunerationId: rem.id,
            projectName: p?.name || "Project",
            clientName: c?.name || "Client",
            amount: rec,
            currency: rem.currency,
            receivedDate: inst.received_date,
            paymentMethod: inst.payment_method || "Other",
            paymentReference: inst.payment_reference,
          });
        }
      });

      const remTotal = Number(rem.total_amount) || 0;
      const remRemaining = Math.max(0, remTotal - remReceived);

      totalRemuneration += remTotal;
      totalReceived += remReceived;
      totalPending += remRemaining;

      return {
        ...rem,
        total_amount: remTotal,
        received_amount: remReceived,
        remaining_amount: remRemaining,
        next_due_date: nextDue,
        is_overdue: hasOverdue,
        project: p || null,
        client: c || null,
        installments: insts,
      };
    });

    // Sort upcoming by due date ASC, recent by received date DESC
    upcomingPayments.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    recentPayments.sort((a, b) => b.receivedDate.localeCompare(a.receivedDate));
    overduePayments.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    return NextResponse.json({
      remunerations: enrichedRemunerations,
      stats: {
        totalRemuneration,
        totalReceived,
        totalPending,
        totalOverdue,
        upcomingPayments: upcomingPayments.slice(0, 5),
        recentPayments: recentPayments.slice(0, 5),
        overduePayments: overduePayments.slice(0, 5),
      },
    });
  } catch (err: any) {
    console.error("GET /api/remunerations error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await createClient();
    const {
      data: { user },
    } = await auth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parseResult = createRemunerationSchema.safeParse(body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues.map((i) => i.message).join(", ");
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const data = parseResult.data;
    const admin = createAdminClient();

    // 1. Verify project exists and belongs to user (or super admin)
    const { data: project } = await admin
      .from("projects")
      .select("id, name, owner_id")
      .eq("id", data.projectId)
      .maybeSingle();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { data: profile } = await admin
      .from("freelancer_profiles")
      .select("role, name")
      .eq("id", user.id)
      .maybeSingle();

    const isSuperAdmin = profile?.role === "super_admin";
    if (project.owner_id !== user.id && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden. You do not own this project." }, { status: 403 });
    }

    // 2. Verify project has at least one active client
    const { data: clients } = await admin
      .from("clients")
      .select("id, name, email, status")
      .eq("project_id", data.projectId);

    if (!clients || clients.length === 0) {
      return NextResponse.json(
        {
          error: "This project has no client assigned. Please create or assign a client to this project first.",
        },
        { status: 400 }
      );
    }

    const client = clients.find((c) => c.status === "active") || clients[0];

    // 3. Create Remuneration Record
    const { data: remuneration, error: remError } = await admin
      .from("remunerations")
      .insert({
        project_id: data.projectId,
        created_by: user.id,
        total_amount: data.totalAmount,
        currency: data.currency || "INR",
        payment_method: data.paymentMethod,
        status: "new",
        notes: data.notes || null,
      })
      .select()
      .single();

    if (remError) {
      return NextResponse.json({ error: remError.message }, { status: 500 });
    }

    // 4. Create Installment Records
    const installmentRows = data.installments.map((inst) => ({
      remuneration_id: remuneration.id,
      installment_number: inst.installmentNumber,
      amount: inst.amount,
      due_date: inst.dueDate,
      status: "new",
      notes: inst.notes || null,
      received_amount: 0,
    }));

    const { data: createdInstallments, error: instError } = await admin
      .from("remuneration_installments")
      .insert(installmentRows)
      .select()
      .order("installment_number", { ascending: true });

    if (instError) {
      // Rollback remuneration
      await admin.from("remunerations").delete().eq("id", remuneration.id);
      return NextResponse.json({ error: instError.message }, { status: 500 });
    }

    const actorName = profile?.name || user.email?.split("@")[0] || "Owner";

    // 5. Record Creation Audit Trail
    await recordRemunerationAuditEvent({
      remunerationId: remuneration.id,
      actorId: user.id,
      actorName,
      action: "remuneration_created",
      title: "Remuneration Configured",
      description: `Created ${data.paymentMethod === "single" ? "single payment" : `${data.installments.length}-installment`} schedule totaling ${data.currency} ${data.totalAmount.toLocaleString()} for ${project.name} (${client.name}).`,
      metadata: {
        totalAmount: data.totalAmount,
        currency: data.currency,
        paymentMethod: data.paymentMethod,
        installmentsCount: data.installments.length,
      },
    });

    // 6. In-App Notification
    await createInAppNotification({
      userId: user.id,
      title: "Remuneration Created",
      message: `Remuneration of ${data.currency} ${data.totalAmount.toLocaleString()} configured for ${project.name}.`,
      linkUrl: `/remunerations/${remuneration.id}`,
      type: "remuneration_created",
    });

    return NextResponse.json(
      {
        remuneration: {
          ...remuneration,
          project,
          client,
          installments: createdInstallments,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("POST /api/remunerations error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

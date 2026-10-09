import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  recordRemunerationAuditEvent,
  getRemunerationNotificationPreferences,
  saveRemunerationNotificationPreferences,
  notifyInstallmentCreated,
  notifyRemunerationAgreementCreated,
} from "@/lib/notifications/service";
import { createRemunerationSchema } from "@/lib/types/remuneration";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required." }, { status: 400 });
    }

    const auth = await createClient();
    const {
      data: { user },
    } = await auth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // 1. Verify project exists and user has access
    const { data: project } = await admin
      .from("projects")
      .select("id, name, owner_id")
      .eq("id", projectId)
      .maybeSingle();

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const { data: profile } = await admin
      .from("freelancer_profiles")
      .select("role, name")
      .eq("id", user.id)
      .maybeSingle();

    const isSuperAdmin = profile?.role === "super_admin";
    if (project.owner_id !== user.id && !isSuperAdmin) {
      // Check if team user assigned to this project
      const { data: teamMembership } = await admin
        .from("project_team_members")
        .select("id")
        .eq("project_id", projectId)
        .maybeSingle();

      if (!teamMembership) {
        return NextResponse.json({ error: "Forbidden. Access denied." }, { status: 403 });
      }
    }

    // 2. Fetch Client Info
    const { data: clients } = await admin
      .from("clients")
      .select("id, name, email, login_id, status")
      .eq("project_id", projectId);

    const client = clients && clients.length > 0
      ? clients.find((c) => c.status === "active") || clients[0]
      : null;

    // 2.5 Fetch Project Team Members
    const { data: ptms } = await admin
      .from("project_team_members")
      .select("team_user_id, team_users(id, name, username, email, role, status)")
      .eq("project_id", projectId);

    const { data: legacyTu } = await admin
      .from("team_users")
      .select("id, name, username, email, role, status")
      .eq("project_id", projectId);

    const teamMembersMap = new Map<string, any>();
    (ptms || []).forEach((p: any) => {
      if (p.team_users && p.team_users.id) {
        teamMembersMap.set(p.team_users.id, p.team_users);
      }
    });
    (legacyTu || []).forEach((tu: any) => {
      if (tu && tu.id && !teamMembersMap.has(tu.id)) {
        teamMembersMap.set(tu.id, tu);
      }
    });
    const teamMembersList = Array.from(teamMembersMap.values());

    // 3. Fetch Remuneration for this project
    const { data: remRecords, error: remError } = await admin
      .from("remunerations")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (remError) {
      if (remError.code === "42P01" || remError.message.includes("does not exist")) {
        return NextResponse.json({ remuneration: null, client, teamMembers: teamMembersList, needsMigration: true });
      }
      return NextResponse.json({ error: remError.message }, { status: 500 });
    }

    const remuneration = remRecords && remRecords.length > 0 ? remRecords[0] : null;

    if (!remuneration) {
      return NextResponse.json({
        remuneration: null,
        client: client || null,
        project,
        teamMembers: teamMembersList,
      });
    }

    // 4. Fetch Installments
    const { data: installments } = await admin
      .from("remuneration_installments")
      .select("*")
      .eq("remuneration_id", remuneration.id)
      .order("installment_number", { ascending: true });

    const installmentIds = (installments || []).map((i) => i.id);

    // 5. Fetch Actual Payments, Proofs, Team Splits, and Timeline Events
    let proofs: any[] = [];
    let payments: any[] = [];
    let paymentSplits: any[] = [];

    if (installmentIds.length > 0) {
      const [proofsRes, paymentsRes] = await Promise.all([
        admin.from("remuneration_proofs").select("*").in("installment_id", installmentIds),
        admin
          .from("remuneration_payments")
          .select("*")
          .eq("remuneration_id", remuneration.id)
          .order("payment_date", { ascending: false }),
      ]);
      proofs = proofsRes.data || [];
      payments = paymentsRes.data || [];

      const paymentIds = payments.map((p) => p.id);
      if (paymentIds.length > 0) {
        try {
          const { data: splitsRes } = await admin
            .from("payment_team_splits")
            .select("*")
            .in("payment_id", paymentIds)
            .order("created_at", { ascending: true });
          paymentSplits = splitsRes || [];
        } catch {}
      }
    }

    const proofsByInst = new Map<string, any[]>();
    proofs.forEach((p) => {
      const list = proofsByInst.get(p.installment_id) || [];
      list.push(p);
      proofsByInst.set(p.installment_id, list);
    });

    const splitsByPayment = new Map<string, any[]>();
    paymentSplits.forEach((s) => {
      const list = splitsByPayment.get(s.payment_id) || [];
      list.push(s);
      splitsByPayment.set(s.payment_id, list);
    });

    const paymentsByInst = new Map<string, any[]>();
    const enrichedPayments = payments.map((pm) => {
      const sps = splitsByPayment.get(pm.id) || [];
      const inst = installments?.find((i) => i.id === pm.installment_id);
      const enrichedPm = {
        ...pm,
        amount: Number(pm.amount) || 0,
        team_splits: sps,
        installment: inst ? {
          id: inst.id,
          installment_number: inst.installment_number,
          name: inst.name,
          amount: Number(inst.amount) || 0,
          due_date: inst.due_date,
        } : null,
      };

      const list = paymentsByInst.get(pm.installment_id) || [];
      list.push(enrichedPm);
      paymentsByInst.set(pm.installment_id, list);

      return enrichedPm;
    });

    // 6. Fetch Timeline Audit Events & Notification Logs
    const [eventsRes, logsRes, notifPrefs] = await Promise.all([
      admin
        .from("remuneration_events")
        .select("*")
        .eq("remuneration_id", remuneration.id)
        .order("created_at", { ascending: false })
        .limit(30),
      admin
        .from("notification_logs")
        .select("*")
        .eq("remuneration_id", remuneration.id)
        .order("created_at", { ascending: false })
        .limit(30),
      getRemunerationNotificationPreferences(remuneration.id),
    ]);

    const events = eventsRes.data || [];
    const notificationLogs = logsRes.data || [];

    // 7. Aggregate Financial Metrics
    const todayStr = new Date().toISOString().split("T")[0];
    let totalReceived = 0;
    let totalOverdue = 0;
    let totalPlannedInstallments = 0;
    let nextDue: string | null = null;
    let hasOverdue = false;

    const enrichedInstallments = (installments || []).map((inst) => {
      const amt = Number(inst.amount) || 0;
      const rec = Number(inst.received_amount) || 0;
      totalPlannedInstallments += amt;
      totalReceived += rec;

      const remainingBalance = Math.max(0, amt - rec);
      const isCompleted = rec >= amt - 0.01;
      const isOverdue = !isCompleted && Boolean(inst.due_date && inst.due_date < todayStr);

      if (isOverdue) {
        hasOverdue = true;
        totalOverdue += remainingBalance;
      }

      if (!isCompleted && !nextDue && inst.due_date) {
        nextDue = inst.due_date;
      }

      // Normalized status
      let calculatedStatus = inst.status;
      if (isCompleted) calculatedStatus = "paid";
      else if (rec > 0) calculatedStatus = "partially_paid";
      else if (isOverdue) calculatedStatus = "due";
      else if (!calculatedStatus || calculatedStatus === "new") calculatedStatus = "planned";

      return {
        ...inst,
        amount: amt,
        received_amount: rec,
        remaining_balance: remainingBalance,
        status: calculatedStatus,
        is_overdue: isOverdue,
        proofs: proofsByInst.get(inst.id) || [],
        payments: paymentsByInst.get(inst.id) || [],
      };
    });

    const totalAmount = Number(remuneration.total_amount) || 0;
    const remainingAmount = Math.max(0, totalAmount - totalReceived);
    const progressPercent = totalAmount > 0 ? Math.min(100, Math.round((totalReceived / totalAmount) * 100)) : 0;

    // Calculate team split metrics across actual recorded payments
    const totalDistributedToTeam = paymentSplits.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
    const totalUndistributed = Math.max(0, totalReceived - totalDistributedToTeam);

    // Load project-level target splits
    let targetSplits: any[] = Array.isArray(remuneration.splits) ? remuneration.splits : [];
    if (targetSplits.length === 0) {
      try {
        const { data: splitRecords } = await admin
          .from("remuneration_splits")
          .select("*")
          .eq("remuneration_id", remuneration.id)
          .order("created_at", { ascending: true });
        if (splitRecords && splitRecords.length > 0) {
          targetSplits = splitRecords.map((s) => ({
            id: s.id,
            teamMemberId: s.team_user_id,
            name: s.member_name,
            role: s.role,
            percentage: Number(s.percentage) || null,
            amount: Number(s.amount) || 0,
            notes: s.notes,
          }));
        }
      } catch {}
    }

    return NextResponse.json({
      remuneration: {
        ...remuneration,
        total_amount: totalAmount,
        received_amount: totalReceived,
        remaining_amount: remainingAmount,
        overdue_amount: totalOverdue,
        planned_installments_total: totalPlannedInstallments,
        total_distributed_to_team: totalDistributedToTeam,
        total_undistributed: totalUndistributed,
        progress_percent: progressPercent,
        next_due_date: nextDue,
        is_overdue: hasOverdue,
        agreement_date: remuneration.agreement_date || remuneration.created_at?.split("T")[0] || todayStr,
        agreement_status: remuneration.agreement_status || remuneration.status || "active",
        splits: targetSplits,
        send_receipt_email: remuneration.send_receipt_email !== false,
        project,
        client: client || null,
        installments: enrichedInstallments,
        payments: enrichedPayments,
        timeline: events,
        notification_preferences: notifPrefs,
        notification_logs: notificationLogs,
      },
      client: client || null,
      project,
      teamMembers: teamMembersList,
    });
  } catch (err: any) {
    console.error("GET /api/projects/[id]/remuneration error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const auth = await createClient();
    const {
      data: { user },
    } = await auth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parseResult = createRemunerationSchema.safeParse({
      ...body,
      projectId,
    });

    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues.map((i) => i.message).join(", ");
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const data = parseResult.data;
    const admin = createAdminClient();

    // Verify ownership
    const { data: project } = await admin
      .from("projects")
      .select("id, name, owner_id")
      .eq("id", projectId)
      .maybeSingle();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { data: profile } = await admin
      .from("freelancer_profiles")
      .select("role, name, email")
      .eq("id", user.id)
      .maybeSingle();

    const isSuperAdmin = profile?.role === "super_admin";
    if (project.owner_id !== user.id && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden. Only project owner can configure remuneration." }, { status: 403 });
    }

    // Insert Remuneration Agreement Record
    const insertPayload: Record<string, any> = {
      project_id: projectId,
      created_by: user.id,
      total_amount: data.totalAmount,
      currency: data.currency || "INR",
      payment_method: data.paymentMethod,
      agreement_date: data.agreementDate || new Date().toISOString().split("T")[0],
      agreement_status: data.agreementStatus || "active",
      status: "active",
      notes: data.notes || null,
      send_receipt_email: data.sendAgreementEmail ?? true,
      splits: data.splits || [],
    };

    let remuneration: any = null;
    const { data: remData, error: remError } = await admin
      .from("remunerations")
      .insert(insertPayload)
      .select()
      .single();

    if (remError) {
      // Fallback if newly added columns aren't in database yet
      const fallbackPayload: Record<string, any> = {
        project_id: projectId,
        created_by: user.id,
        total_amount: data.totalAmount,
        currency: data.currency || "INR",
        payment_method: data.paymentMethod,
        status: "active",
        notes: data.notes || null,
      };
      const { data: fallbackRem, error: fbErr } = await admin
        .from("remunerations")
        .insert(fallbackPayload)
        .select()
        .single();
      if (fbErr) return NextResponse.json({ error: fbErr.message }, { status: 500 });
      remuneration = fallbackRem;
    } else {
      remuneration = remData;
    }

    // Insert splits if present
    if (data.splits && data.splits.length > 0) {
      try {
        const splitRows = data.splits.map((s) => ({
          remuneration_id: remuneration.id,
          team_user_id: s.teamMemberId,
          member_name: s.name,
          role: s.role || null,
          percentage: s.percentage ?? null,
          amount: s.amount,
          notes: s.notes || null,
        }));
        await admin.from("remuneration_splits").insert(splitRows);
      } catch (splitErr) {
        console.warn("Could not insert splits:", splitErr);
      }
    }

    // Initialize default notification preferences
    await saveRemunerationNotificationPreferences(remuneration.id, {
      client_email_settings: {
        payment_received: data.sendAgreementEmail ?? true,
        payment_receipt: data.sendAgreementEmail ?? true,
      },
    });

    const actorName = profile?.name || user.email?.split("@")[0] || "Owner";

    // Fetch client to resolve email if not passed directly
    const { data: clients } = await admin
      .from("clients")
      .select("id, name, email, status")
      .eq("project_id", projectId);
    const client = clients && clients.length > 0
      ? clients.find((c) => c.status === "active") || clients[0]
      : null;

    // Record audit event
    await recordRemunerationAuditEvent({
      remunerationId: remuneration.id,
      actorId: user.id,
      actorName,
      action: "agreement_created",
      title: "Remuneration Agreement Established",
      description: `Agreed total remuneration of ${data.currency} ${data.totalAmount.toLocaleString()} for ${project.name}.`,
      metadata: {
        totalAmount: data.totalAmount,
        currency: data.currency,
        paymentMethod: data.paymentMethod,
        splitsCount: (data.splits || []).length,
      },
    });

    // Send Agreement Confirmation Email to Client
    const targetEmail = data.clientEmail || client?.email;
    if (data.sendAgreementEmail !== false && targetEmail) {
      await notifyRemunerationAgreementCreated({
        remunerationId: remuneration.id,
        projectName: project.name,
        clientName: client?.name || "Valued Client",
        clientEmail: targetEmail,
        totalAmount: data.totalAmount,
        currency: data.currency || "INR",
        paymentMethod: data.paymentMethod,
        agreementDate: data.agreementDate,
        notes: data.notes,
      });
    }

    return NextResponse.json(
      {
        remuneration: {
          ...remuneration,
          project,
          client: client || null,
          installments: [],
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("POST /api/projects/[id]/remuneration error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const auth = await createClient();
    const {
      data: { user },
    } = await auth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Verify project and access
    const { data: project } = await admin
      .from("projects")
      .select("id, name, owner_id")
      .eq("id", projectId)
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
      return NextResponse.json({ error: "Forbidden. Access denied." }, { status: 403 });
    }

    // Find active remuneration
    const { data: existingRem } = await admin
      .from("remunerations")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (!existingRem) {
      return NextResponse.json({ error: "No remuneration agreement found for this project." }, { status: 404 });
    }

    const body = await req.json();
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };

    // 1. Update Notification Preferences
    if (body.notificationPreferences) {
      await saveRemunerationNotificationPreferences(existingRem.id, body.notificationPreferences);
    }

    // 2. Update Agreement Core Fields
    if (body.sendReceiptEmail !== undefined) {
      updates.send_receipt_email = Boolean(body.sendReceiptEmail);
    }
    if (body.notes !== undefined) {
      updates.notes = body.notes;
    }
    if (body.agreementDate !== undefined) {
      updates.agreement_date = body.agreementDate;
    }
    if (body.agreementStatus !== undefined) {
      updates.agreement_status = body.agreementStatus;
      updates.status = body.agreementStatus;
    }
    if (body.splits !== undefined && Array.isArray(body.splits)) {
      updates.splits = body.splits;
    }
    if (body.totalAmount !== undefined && Number(body.totalAmount) > 0) {
      updates.total_amount = Number(body.totalAmount);
    }

    if (Object.keys(updates).length > 1) {
      await admin.from("remunerations").update(updates).eq("id", existingRem.id);
    }

    // 3. Edit / Update an Installment
    if (body.updateInstallment) {
      const u = body.updateInstallment;
      const instUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (u.name !== undefined) instUpdates.name = u.name;
      if (u.amount !== undefined && Number(u.amount) > 0) instUpdates.amount = Number(u.amount);
      if (u.dueDate !== undefined) instUpdates.due_date = u.dueDate || null;
      if (u.description !== undefined) instUpdates.description = u.description;
      if (u.notes !== undefined) instUpdates.notes = u.notes;
      if (u.status !== undefined) instUpdates.status = u.status;

      await admin
        .from("remuneration_installments")
        .update(instUpdates)
        .eq("id", u.id)
        .eq("remuneration_id", existingRem.id);

      await recordRemunerationAuditEvent({
        remunerationId: existingRem.id,
        installmentId: u.id,
        actorId: user.id,
        actorName: profile?.name || "Owner",
        action: "installment_updated",
        title: `Installment Updated`,
        description: `Modified details for installment milestone #${u.installmentNumber || ""}.`,
      });
    }

    // 4. Add a New Installment Milestone
    if (body.newInstallment) {
      const inst = body.newInstallment;
      const { data: currentInsts } = await admin
        .from("remuneration_installments")
        .select("installment_number")
        .eq("remuneration_id", existingRem.id)
        .order("installment_number", { ascending: false })
        .limit(1);

      const nextNumber = ((currentInsts?.[0]?.installment_number) || 0) + 1;

      let { data: insertedInst, error: newInstErr } = await admin
        .from("remuneration_installments")
        .insert({
          remuneration_id: existingRem.id,
          installment_number: nextNumber,
          name: inst.name || `Milestone #${nextNumber}`,
          description: inst.description || null,
          amount: Number(inst.amount),
          due_date: inst.dueDate || null,
          status: "planned",
          notes: inst.notes || null,
          received_amount: 0,
        })
        .select()
        .single();

      if (newInstErr && newInstErr.message.includes("due_date") && newInstErr.message.includes("not-null")) {
        const fallbackRes = await admin
          .from("remuneration_installments")
          .insert({
            remuneration_id: existingRem.id,
            installment_number: nextNumber,
            name: inst.name || `Milestone #${nextNumber}`,
            description: inst.description || null,
            amount: Number(inst.amount),
            due_date: new Date().toISOString().split("T")[0],
            status: "planned",
            notes: inst.notes || null,
            received_amount: 0,
          })
          .select()
          .single();
        insertedInst = fallbackRes.data;
        newInstErr = fallbackRes.error;
      }

      if (newInstErr) {
        return NextResponse.json({ error: newInstErr.message }, { status: 500 });
      }

      if (body.autoAdjustTotal) {
        const { data: allInsts } = await admin
          .from("remuneration_installments")
          .select("amount")
          .eq("remuneration_id", existingRem.id);
        const newTotal = (allInsts || []).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
        await admin.from("remunerations").update({ total_amount: newTotal }).eq("id", existingRem.id);
      }

      // Check client notification preference for installment creation
      const { data: clients } = await admin
        .from("clients")
        .select("name, email")
        .eq("project_id", projectId);
      const client = clients?.find((c) => c.email) || clients?.[0];

      if (insertedInst && client?.email) {
        await notifyInstallmentCreated({
          remunerationId: existingRem.id,
          installmentId: insertedInst.id,
          installmentNumber: nextNumber,
          name: inst.name,
          amount: Number(inst.amount),
          currency: existingRem.currency,
          dueDate: inst.dueDate || null,
          description: inst.description,
          projectName: project.name,
          clientName: client.name,
          clientEmail: client.email,
        });
      }

      await recordRemunerationAuditEvent({
        remunerationId: existingRem.id,
        installmentId: insertedInst?.id,
        actorId: user.id,
        actorName: profile?.name || "Owner",
        action: "installment_created",
        title: `New Milestone Added (#${nextNumber})`,
        description: `Added milestone of ${existingRem.currency} ${Number(inst.amount).toLocaleString()}${inst.dueDate ? ` due on ${inst.dueDate}` : ""}.`,
      });
    }

    // 5. Delete an Installment
    if (body.deleteInstallmentId) {
      // Check if any payments exist for this installment
      const { data: existingPayments } = await admin
        .from("remuneration_payments")
        .select("id")
        .eq("installment_id", body.deleteInstallmentId);

      if (existingPayments && existingPayments.length > 0) {
        return NextResponse.json(
          { error: "Cannot delete an installment that has recorded payments. Please cancel it instead to preserve transaction records." },
          { status: 400 }
        );
      }

      await admin
        .from("remuneration_installments")
        .delete()
        .eq("id", body.deleteInstallmentId)
        .eq("remuneration_id", existingRem.id);

      await recordRemunerationAuditEvent({
        remunerationId: existingRem.id,
        actorId: user.id,
        actorName: profile?.name || "Owner",
        action: "installment_deleted",
        title: "Installment Milestone Removed",
        description: `Deleted planned installment from schedule.`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("PATCH /api/projects/[id]/remuneration error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

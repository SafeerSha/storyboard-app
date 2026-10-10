import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedTeamUser } from "@/lib/team-session";
import { isTeamUserProjectMember } from "@/lib/story-reviewer-auth";

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

    // 1. Authenticate team member session
    const teamUser = await getAuthenticatedTeamUser();
    if (!teamUser) {
      return NextResponse.json({ error: "Unauthorized. Team session required." }, { status: 401 });
    }

    const admin = createAdminClient();

    // 2. Verify project membership
    const isMember =
      teamUser.project_id === projectId ||
      (await isTeamUserProjectMember(teamUser.id, projectId));

    if (!isMember) {
      return NextResponse.json({ error: "Forbidden. Access denied to this project." }, { status: 403 });
    }

    // 3. Fetch project details
    const { data: project } = await admin
      .from("projects")
      .select("id, name, description")
      .eq("id", projectId)
      .maybeSingle();

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    // 4. Fetch project remuneration record
    const { data: remRecords, error: remErr } = await admin
      .from("remunerations")
      .select("id, currency, agreement_status, status, created_at, updated_at, splits")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (remErr) {
      if (remErr.code === "42P01" || remErr.message.includes("does not exist")) {
        return NextResponse.json({
          hasAgreement: false,
          hasSplit: false,
          member: {
            id: teamUser.id,
            name: teamUser.name,
            username: teamUser.username,
            role: teamUser.role || "collaborator",
          },
          currency: "INR",
          allocatedAmount: 0,
          allocatedPercentage: null,
          totalPaid: 0,
          pendingBalance: 0,
          progressPercent: 0,
          status: "not_configured",
          disbursements: [],
        });
      }
      return NextResponse.json({ error: remErr.message }, { status: 500 });
    }

    const remuneration = remRecords && remRecords.length > 0 ? remRecords[0] : null;

    if (!remuneration) {
      return NextResponse.json({
        hasAgreement: false,
        hasSplit: false,
        member: {
          id: teamUser.id,
          name: teamUser.name,
          username: teamUser.username,
          role: teamUser.role || "collaborator",
        },
        currency: "INR",
        allocatedAmount: 0,
        allocatedPercentage: null,
        totalPaid: 0,
        pendingBalance: 0,
        progressPercent: 0,
        status: "not_configured",
        disbursements: [],
      });
    }

    const currency = remuneration.currency || "INR";

    // 5. Look up team member's agreed allocation/split
    // Check both relational table `remuneration_splits` and legacy jsonb `remunerations.splits`
    let memberSplit: {
      id?: string;
      amount: number;
      percentage: number | null;
      role?: string;
      notes?: string;
    } | null = null;

    try {
      const { data: relationalSplits } = await admin
        .from("remuneration_splits")
        .select("*")
        .eq("remuneration_id", remuneration.id)
        .eq("team_user_id", teamUser.id)
        .maybeSingle();

      if (relationalSplits) {
        memberSplit = {
          id: relationalSplits.id,
          amount: Number(relationalSplits.amount) || 0,
          percentage: relationalSplits.percentage ? Number(relationalSplits.percentage) : null,
          role: relationalSplits.role || teamUser.role,
          notes: relationalSplits.notes || undefined,
        };
      }
    } catch {
      // Table may not exist yet, fallback to JSONB
    }

    if (!memberSplit && Array.isArray(remuneration.splits)) {
      const found = remuneration.splits.find(
        (s: any) =>
          s.teamMemberId === teamUser.id ||
          s.team_user_id === teamUser.id ||
          s.name?.toLowerCase() === teamUser.name?.toLowerCase()
      );
      if (found) {
        memberSplit = {
          id: found.id,
          amount: Number(found.amount) || 0,
          percentage: found.percentage ? Number(found.percentage) : null,
          role: found.role || teamUser.role,
          notes: found.notes || undefined,
        };
      }
    }

    // 6. Fetch payments made to this team member from `payment_team_splits`
    let paymentSplits: any[] = [];
    try {
      const { data: splitsData, error: splitsErr } = await admin
        .from("payment_team_splits")
        .select(`
          id,
          payment_id,
          amount,
          percentage,
          notes,
          created_at,
          remuneration_payments(
            id,
            installment_id,
            payment_date,
            payment_method,
            payment_reference,
            notes,
            status,
            remuneration_installments(
              id,
              installment_number,
              name
            )
          )
        `)
        .eq("remuneration_id", remuneration.id)
        .eq("team_user_id", teamUser.id)
        .order("created_at", { ascending: false });

      if (splitsErr) {
        console.warn("Could not query payment_team_splits with join:", splitsErr);
        // Fallback to simple query if nested join fails
        const { data: fallbackSplits } = await admin
          .from("payment_team_splits")
          .select("id, payment_id, amount, percentage, notes, created_at")
          .eq("remuneration_id", remuneration.id)
          .eq("team_user_id", teamUser.id)
          .order("created_at", { ascending: false });
        paymentSplits = fallbackSplits || [];
      } else {
        paymentSplits = splitsData || [];
      }
    } catch (e) {
      console.warn("Could not query payment_team_splits:", e);
    }

    // Format disbursements
    const disbursements = paymentSplits.map((item: any) => {
      const payment = item.remuneration_payments;
      const installment = payment?.remuneration_installments;
      const installmentName = installment
        ? installment.name || `Milestone #${installment.installment_number}`
        : "General Disbursement";

      return {
        id: item.id,
        paymentId: item.payment_id,
        amount: Number(item.amount) || 0,
        paymentDate: payment?.payment_date || item.created_at,
        paymentMethod: payment?.payment_method || "direct",
        referenceNote: payment?.payment_reference || payment?.notes || item.notes || null,
        installmentName,
        status: payment?.status || "completed",
        notes: item.notes || null,
      };
    });

    const allocatedAmount = memberSplit ? memberSplit.amount : 0;
    const allocatedPercentage = memberSplit ? memberSplit.percentage : null;
    const totalPaid = disbursements.reduce((sum, d) => sum + d.amount, 0);
    const pendingBalance = Math.max(0, allocatedAmount - totalPaid);
    const progressPercent =
      allocatedAmount > 0
        ? Math.min(100, Math.round((totalPaid / allocatedAmount) * 100))
        : totalPaid > 0
        ? 100
        : 0;

    let payoutStatus: "fully_paid" | "partially_paid" | "pending" | "not_allocated" = "pending";
    if (!memberSplit && totalPaid === 0) {
      payoutStatus = "not_allocated";
    } else if (allocatedAmount > 0 && totalPaid >= allocatedAmount - 0.01) {
      payoutStatus = "fully_paid";
    } else if (totalPaid > 0) {
      payoutStatus = "partially_paid";
    } else {
      payoutStatus = "pending";
    }

    return NextResponse.json({
      hasAgreement: true,
      hasSplit: Boolean(memberSplit),
      projectName: project.name,
      currency,
      member: {
        id: teamUser.id,
        name: teamUser.name,
        username: teamUser.username,
        role: memberSplit?.role || teamUser.role || "collaborator",
        notes: memberSplit?.notes || null,
      },
      allocatedAmount,
      allocatedPercentage,
      totalPaid,
      pendingBalance,
      progressPercent,
      status: payoutStatus,
      disbursements,
    });
  } catch (err: any) {
    console.error("GET /api/team/projects/[id]/remuneration error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch member remuneration" }, { status: 500 });
  }
}

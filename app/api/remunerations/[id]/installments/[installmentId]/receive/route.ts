import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadToR2, isR2Configured } from "@/lib/r2";
import {
  notifyPaymentReceived,
  notifyPaymentAllocatedToTeam,
  notifyRemunerationCompleted,
  getRemunerationNotificationPreferences,
} from "@/lib/notifications/service";

export const dynamic = "force-dynamic";

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 4) return false;

  // PNG: 89 50 4E 47
  if (mimeType === "image/png") {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }

  // JPEG: FF D8 FF
  if (mimeType === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  // WEBP: RIFF ... WEBP
  if (mimeType === "image/webp") {
    const isRiff =
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46;
    if (!isRiff || buffer.length < 12) return false;
    const isWebp =
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50;
    return isWebp;
  }

  // PDF: %PDF (25 50 44 46)
  if (mimeType === "application/pdf") {
    return (
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46
    );
  }

  return true;
}

export async function POST(
  req: Request,
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

    // 1. Fetch remuneration and verify ownership
    const { data: remuneration, error: remError } = await admin
      .from("remunerations")
      .select("*, project:projects(id, name, owner_id)")
      .eq("id", remunerationId)
      .maybeSingle();

    if (remError || !remuneration) {
      return NextResponse.json({ error: "Remuneration not found" }, { status: 404 });
    }

    const { data: profile } = await admin
      .from("freelancer_profiles")
      .select("role, email, name")
      .eq("id", user.id)
      .maybeSingle();

    const isSuperAdmin = profile?.role === "super_admin";
    if (remuneration.project?.owner_id !== user.id && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden. Access denied." }, { status: 403 });
    }

    // 2. Fetch installment
    const { data: installment, error: instError } = await admin
      .from("remuneration_installments")
      .select("*")
      .eq("id", installmentId)
      .eq("remuneration_id", remunerationId)
      .maybeSingle();

    if (instError || !installment) {
      return NextResponse.json({ error: "Installment not found" }, { status: 404 });
    }

    // 3. Parse FormData or JSON
    const contentType = req.headers.get("content-type") || "";
    let receivedAmount: number = 0;
    let receivedDate: string = "";
    let paymentMethod: string = "Bank Transfer";
    let paymentReference: string | null = null;
    let notes: string | null = null;
    let shouldSendEmail: boolean = remuneration.send_receipt_email !== false;
    let proofFile: File | null = null;
    let teamSplits: any[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      receivedAmount = parseFloat(formData.get("receivedAmount") as string) || 0;
      receivedDate = (formData.get("receivedDate") as string) || new Date().toISOString().split("T")[0];
      paymentMethod = (formData.get("paymentMethod") as string) || "Bank Transfer";
      paymentReference = (formData.get("paymentReference") as string) || null;
      notes = (formData.get("notes") as string) || null;
      if (formData.has("sendEmail")) {
        shouldSendEmail = formData.get("sendEmail") === "true";
      }
      proofFile = formData.get("proof") as File | null;

      const splitsRaw = formData.get("teamSplits") as string | null;
      if (splitsRaw) {
        try {
          teamSplits = JSON.parse(splitsRaw);
        } catch {}
      }
    } else {
      const body = await req.json();
      receivedAmount = Number(body.receivedAmount) || 0;
      receivedDate = body.receivedDate || new Date().toISOString().split("T")[0];
      paymentMethod = body.paymentMethod || "Bank Transfer";
      paymentReference = body.paymentReference || null;
      notes = body.notes || null;
      if (body.sendEmail !== undefined) {
        shouldSendEmail = Boolean(body.sendEmail);
      }
      if (Array.isArray(body.teamSplits)) {
        teamSplits = body.teamSplits;
      }
    }

    if (!receivedAmount || receivedAmount <= 0) {
      return NextResponse.json({ error: "A valid positive payment amount is required." }, { status: 400 });
    }

    if (!receivedDate) {
      return NextResponse.json({ error: "Received date is required." }, { status: 400 });
    }

    // Check notification preferences for full split requirement
    const notifPrefs = await getRemunerationNotificationPreferences(remunerationId);
    const totalSplitAmount = teamSplits.reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0);

    if (totalSplitAmount > receivedAmount + 0.01) {
      return NextResponse.json(
        { error: `Total team splits (${totalSplitAmount}) cannot exceed the payment amount (${receivedAmount}).` },
        { status: 400 }
      );
    }

    if (notifPrefs.require_full_split && teamSplits.length > 0 && Math.abs(totalSplitAmount - receivedAmount) > 0.01) {
      return NextResponse.json(
        { error: "This project requires the full payment amount to be distributed among team members." },
        { status: 400 }
      );
    }

    // 4. Record the Payment Transaction in public.remuneration_payments
    const { data: paymentRecord, error: payError } = await admin
      .from("remuneration_payments")
      .insert({
        remuneration_id: remunerationId,
        installment_id: installmentId,
        amount: receivedAmount,
        payment_date: receivedDate,
        payment_method: paymentMethod,
        payment_reference: paymentReference,
        notes,
        status: "completed",
        recorded_by: user.id,
      })
      .select()
      .single();

    if (payError) {
      return NextResponse.json({ error: payError.message }, { status: 500 });
    }

    // 5. Handle Payment Proof File (if attached)
    let savedProofRecord: any = null;
    if (proofFile && proofFile.size > 0) {
      if (proofFile.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "Payment proof file exceeds the 10MB limit." },
          { status: 400 }
        );
      }

      if (!ALLOWED_MIME_TYPES.has(proofFile.type)) {
        return NextResponse.json(
          { error: "Unsupported file type. Only PNG, JPG, WEBP, and PDF are allowed." },
          { status: 400 }
        );
      }

      const fileBuffer = Buffer.from(await proofFile.arrayBuffer());
      if (!validateMagicBytes(fileBuffer, proofFile.type)) {
        return NextResponse.json(
          { error: "File content does not match the specified MIME type." },
          { status: 400 }
        );
      }

      const fileExt = proofFile.name.split(".").pop()?.toLowerCase() || "bin";
      const sanitizedBase = proofFile.name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
      const uniqueFileName = `${crypto.randomUUID()}-${sanitizedBase}.${fileExt}`;
      const storageKey = `remunerations/${remunerationId}/installments/${installmentId}/${uniqueFileName}`;

      if (isR2Configured()) {
        await uploadToR2(storageKey, fileBuffer, proofFile.type);
      }

      const { data: proofRow } = await admin
        .from("remuneration_proofs")
        .insert({
          remuneration_id: remunerationId,
          installment_id: installmentId,
          payment_id: paymentRecord.id,
          file_name: proofFile.name,
          storage_key: storageKey,
          file_size: proofFile.size,
          mime_type: proofFile.type,
          uploaded_by: user.id,
        })
        .select()
        .single();

      savedProofRecord = proofRow;
    }

    // 6. Save Payment Team Splits (in payment_team_splits table)
    if (teamSplits.length > 0) {
      try {
        const splitRows = teamSplits.map((s: any) => ({
          payment_id: paymentRecord.id,
          remuneration_id: remunerationId,
          team_user_id: s.teamMemberId,
          member_name: s.name,
          role: s.role || null,
          amount: Number(s.amount) || 0,
          percentage: Number(s.percentage) || null,
          notes: s.notes || null,
        }));
        await admin.from("payment_team_splits").insert(splitRows);
      } catch (splitErr) {
        console.warn("Could not insert into payment_team_splits table:", splitErr);
      }
    }

    // 7. Update Installment Received Amount & Status
    const currentReceived = Number(installment.received_amount) || 0;
    const newTotalReceived = currentReceived + receivedAmount;
    const installmentTarget = Number(installment.amount) || 0;

    // Status is 'paid' if fully paid, 'partially_paid' if partially paid
    const newInstallmentStatus =
      newTotalReceived >= installmentTarget - 0.01 ? "paid" : "partially_paid";

    const { data: updatedInstallment, error: updateInstErr } = await admin
      .from("remuneration_installments")
      .update({
        status: newInstallmentStatus,
        received_amount: newTotalReceived,
        received_date: receivedDate,
        payment_method: paymentMethod,
        payment_reference: paymentReference,
        notes: notes || installment.notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", installmentId)
      .select()
      .single();

    if (updateInstErr) {
      return NextResponse.json({ error: updateInstErr.message }, { status: 500 });
    }

    // 8. Check overall remuneration status
    const { data: allInstallments } = await admin
      .from("remuneration_installments")
      .select("id, status, amount, received_amount")
      .eq("remuneration_id", remunerationId);

    const totalCollected = (allInstallments || []).reduce(
      (sum, i) => sum + (Number(i.received_amount) || 0),
      0
    );
    const totalRemAmount = Number(remuneration.total_amount) || 0;
    const remainingBalance = Math.max(0, totalRemAmount - totalCollected);

    const allPaid =
      allInstallments &&
      allInstallments.length > 0 &&
      allInstallments.every((i) => i.status === "paid" || i.status === "completed" || Number(i.received_amount) >= Number(i.amount) - 0.01);

    const newParentStatus = allPaid && remainingBalance === 0 ? "completed" : "active";

    await admin
      .from("remunerations")
      .update({
        status: newParentStatus,
        agreement_status: newParentStatus === "completed" ? "completed" : "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", remunerationId);

    // 9. Fetch client info
    const { data: clients } = await admin
      .from("clients")
      .select("id, name, email")
      .eq("project_id", remuneration.project_id);

    const client = clients?.find((c) => c.email) || clients?.[0] || null;
    const actorName = profile?.name || user.email?.split("@")[0] || "Owner";

    // 10. Dispatch Notifications (Client & Team)
    await notifyPaymentReceived({
      remunerationId,
      installmentId,
      paymentId: paymentRecord.id,
      installmentNumber: installment.installment_number,
      amount: receivedAmount,
      currency: remuneration.currency,
      receivedDate,
      paymentMethod,
      paymentReference,
      remainingAmount: remainingBalance,
      projectName: remuneration.project?.name || "Project",
      clientName: client?.name || "Client",
      clientEmail: client?.email,
      ownerId: user.id,
      ownerEmail: profile?.email || user.email,
      actorName,
      sendEmailNotification: shouldSendEmail,
    });

    // Notify Team Members of their splits
    if (teamSplits.length > 0) {
      await notifyPaymentAllocatedToTeam({
        remunerationId,
        paymentId: paymentRecord.id,
        projectName: remuneration.project?.name || "Project",
        paymentAmount: receivedAmount,
        currency: remuneration.currency,
        receivedDate,
        paymentMethod,
        paymentReference,
        splits: teamSplits,
      });
    }

    if (newParentStatus === "completed") {
      await notifyRemunerationCompleted({
        remunerationId,
        totalAmount: totalRemAmount,
        currency: remuneration.currency,
        projectName: remuneration.project?.name || "Project",
        clientName: client?.name || "Client",
        clientEmail: client?.email,
        ownerId: user.id,
        ownerEmail: profile?.email || user.email,
        actorName,
      });
    }

    return NextResponse.json({
      success: true,
      payment: paymentRecord,
      installment: updatedInstallment,
      proof: savedProofRecord,
      parentStatus: newParentStatus,
      allCompleted: newParentStatus === "completed",
    });
  } catch (err: any) {
    console.error("POST mark installment as received error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

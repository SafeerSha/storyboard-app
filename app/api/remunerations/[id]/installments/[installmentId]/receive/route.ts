import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadToR2, isR2Configured } from "@/lib/r2";
import {
  notifyPaymentReceived,
  notifyRemunerationCompleted,
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

  return false;
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
      .select("role, name, email")
      .eq("id", user.id)
      .maybeSingle();

    const isSuperAdmin = profile?.role === "super_admin";
    if (remuneration.project?.owner_id !== user.id && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden. Access denied." }, { status: 403 });
    }

    // 2. Fetch installment with concurrency check
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
        { error: "Conflict: This payment installment has already been marked as completed." },
        { status: 409 }
      );
    }

    // 3. Parse FormData payload
    const formData = await req.formData();
    const rawAmount = formData.get("receivedAmount");
    const receivedAmount = Number(rawAmount);

    if (isNaN(receivedAmount) || receivedAmount <= 0) {
      return NextResponse.json(
        { error: "Received amount must be a positive number." },
        { status: 400 }
      );
    }

    const receivedDate = (formData.get("receivedDate") as string) || new Date().toISOString();
    const paymentMethod = (formData.get("paymentMethod") as string) || "Bank Transfer";
    const paymentReference = (formData.get("paymentReference") as string) || null;
    const notes = (formData.get("notes") as string) || null;
    const rawSendEmail = formData.get("sendEmail");
    const shouldSendEmail = rawSendEmail !== null
      ? rawSendEmail === "true" || rawSendEmail === "1"
      : (remuneration.send_receipt_email ?? true);

    // 4. Record Payment in public.remuneration_payments
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
        recorded_by: user.id,
      })
      .select()
      .single();

    if (payError) {
      return NextResponse.json({ error: payError.message }, { status: 500 });
    }

    // 5. Handle Payment Proof File (if attached)
    const proofFile = formData.get("proof") as File | null;
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

      // Generate secure unique storage key
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
          payment_id: paymentRecord?.id || null,
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

    // 6. Update installment to completed
    const { data: updatedInstallment, error: updateInstErr } = await admin
      .from("remuneration_installments")
      .update({
        status: "completed",
        received_amount: receivedAmount,
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

    // 7. Check if all installments for this remuneration are completed
    const { data: allInstallments } = await admin
      .from("remuneration_installments")
      .select("id, status, amount, received_amount")
      .eq("remuneration_id", remunerationId);

    const allCompleted =
      allInstallments &&
      allInstallments.length > 0 &&
      allInstallments.every((i) => i.status === "completed");

    const newParentStatus = allCompleted ? "completed" : "requested";

    await admin
      .from("remunerations")
      .update({
        status: newParentStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", remunerationId);

    // 8. Fetch client information for emails
    const { data: clients } = await admin
      .from("clients")
      .select("id, name, email")
      .eq("project_id", remuneration.project_id);

    const client = clients?.find((c) => c.email) || clients?.[0] || null;

    const actorName = profile?.name || user.email?.split("@")[0] || "Owner";

    // 9. Calculate total remaining across remuneration
    const totalCollected = (allInstallments || []).reduce(
      (sum, i) => sum + (Number(i.received_amount) || 0),
      0
    );
    const totalRemAmount = Number(remuneration.total_amount) || 0;
    const remainingBalance = Math.max(0, totalRemAmount - totalCollected);

    // 10. Dispatch notifications
    await notifyPaymentReceived({
      remunerationId,
      installmentId,
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

    if (allCompleted) {
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
      installment: updatedInstallment,
      payment: paymentRecord,
      proof: savedProofRecord,
      parentStatus: newParentStatus,
      allCompleted,
    });
  } catch (err: any) {
    console.error("POST mark installment as received error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

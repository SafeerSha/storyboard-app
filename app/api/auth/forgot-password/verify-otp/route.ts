import { NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email("Please enter a valid email address.").toLowerCase().trim(),
  otp: z.string().regex(/^\d{6}$/, "Verification code must be exactly 6 digits."),
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const body = await req.json();
    const { email, otp } = schema.parse(body);

    // Rate limiting: max 10 verification attempts per 15 minutes
    const rateLimit = checkRateLimit(`forgot-pwd-verify:${ip}:${email}`, {
      limit: 10,
      windowSeconds: 900,
    });

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          error: `Too many verification attempts. Please wait ${Math.ceil(
            rateLimit.resetInSeconds / 60
          )} minutes before trying again.`,
        },
        { status: 429 }
      );
    }

    const adminClient = createAdminClient();
    const nowIso = new Date().toISOString();

    // Query active unverified OTP for this email
    const { data: record, error: fetchError } = await adminClient
      .from("password_reset_otps")
      .select("id, email, otp_hash, attempts, expires_at, is_verified")
      .ilike("email", email)
      .eq("is_verified", false)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError || !record) {
      return NextResponse.json(
        { error: "The verification code has expired or is invalid. Please request a new code." },
        { status: 400 }
      );
    }

    // Check attempts limit (max 5)
    if (record.attempts >= 5) {
      await adminClient.from("password_reset_otps").delete().eq("id", record.id);
      return NextResponse.json(
        { error: "Too many incorrect attempts. Please request a new verification code." },
        { status: 400 }
      );
    }

    // Hash user-submitted OTP
    const submittedHash = crypto.createHash("sha256").update(otp).digest("hex");

    if (submittedHash !== record.otp_hash) {
      const nextAttempts = record.attempts + 1;
      await adminClient
        .from("password_reset_otps")
        .update({ attempts: nextAttempts })
        .eq("id", record.id);

      const remainingAttempts = Math.max(0, 5 - nextAttempts);
      const attemptNotice =
        remainingAttempts > 0
          ? ` (${remainingAttempts} attempt${remainingAttempts > 1 ? "s" : ""} left)`
          : ". Please request a new code.";

      return NextResponse.json(
        { error: `Invalid verification code${attemptNotice}` },
        { status: 400 }
      );
    }

    // Code is valid! Generate one-time reset token
    const resetToken = crypto.randomBytes(32).toString("hex");

    const { error: updateError } = await adminClient
      .from("password_reset_otps")
      .update({
        is_verified: true,
        verified_at: new Date().toISOString(),
        reset_token: resetToken,
      })
      .eq("id", record.id);

    if (updateError) {
      console.error("[Verify OTP] Error saving reset token:", updateError);
      return NextResponse.json(
        { error: "Unable to complete verification. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      resetToken,
      message: "Verification successful.",
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid input." },
        { status: 400 }
      );
    }
    console.error("[Verify OTP Error]:", error);
    return NextResponse.json(
      { error: "Unable to verify the code. Please try again." },
      { status: 500 }
    );
  }
}

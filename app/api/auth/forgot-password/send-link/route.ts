import { NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getAppBaseUrl, sendPasswordResetLinkNotification } from "@/lib/email/resend";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email("Please enter a valid email address.").toLowerCase().trim(),
});

const GENERIC_SUCCESS_MESSAGE =
  "If an account exists for this email address, a password reset link has been sent. Please check your inbox and spam folder.";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const body = await req.json();
    const { email } = schema.parse(body);

    // Rate limiting: max 5 requests per 15 minutes per IP and email
    const rateLimit = checkRateLimit(`forgot-pwd-link:${ip}:${email}`, {
      limit: 5,
      windowSeconds: 900,
    });

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          error: `Too many password reset requests. Please wait ${Math.ceil(
            rateLimit.resetInSeconds / 60
          )} minutes before requesting another link.`,
        },
        { status: 429 }
      );
    }

    const adminClient = createAdminClient();

    // 1. Look up user in freelancer_profiles
    const { data: profile } = await adminClient
      .from("freelancer_profiles")
      .select("id, name, email, status")
      .ilike("email", email)
      .maybeSingle();

    // 2. If not found in freelancer_profiles, look up in clients table
    let clientAccount: { id: string; name: string; email: string; status: string } | null = null;
    if (!profile) {
      const { data: client } = await adminClient
        .from("clients")
        .select("id, name, email, status")
        .ilike("email", email)
        .maybeSingle();
      if (client && client.email) {
        clientAccount = client;
      }
    }

    const targetAccount = profile || clientAccount;

    // AC-1.2: Generate secure, time-sensitive reset link and send email if account exists and is active
    if (targetAccount && targetAccount.status === "active") {
      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const expiresInMinutes = 60;
      const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();

      // Invalidate any existing reset tokens for this email
      await adminClient
        .from("password_reset_otps")
        .delete()
        .ilike("email", targetAccount.email);

      // Store hashed OTP and raw reset token
      const { error: insertError } = await adminClient
        .from("password_reset_otps")
        .insert({
          email: targetAccount.email.toLowerCase(),
          otp_hash: tokenHash,
          reset_token: token,
          expires_at: expiresAt,
          attempts: 0,
          is_verified: true,
        });

      if (insertError) {
        console.error("[Forgot Password Link] Error saving reset record:", insertError);
        // Note: For security, we do not reveal internal database errors to end user
        return NextResponse.json({
          ok: true,
          message: GENERIC_SUCCESS_MESSAGE,
        });
      }

      // Construct reset URL
      const appBaseUrl = getAppBaseUrl();
      const resetUrl = `${appBaseUrl}/reset-password?token=${token}&email=${encodeURIComponent(
        targetAccount.email
      )}`;

      // Send the email notification
      try {
        await sendPasswordResetLinkNotification(targetAccount.email, {
          resetUrl,
          recipientName: targetAccount.name || undefined,
          expiresInMinutes,
        });
      } catch (emailErr) {
        console.error("[Forgot Password Link] Failed to dispatch email:", emailErr);
      }
    }

    // AC-1.3: Always return a generic confirmation message regardless of whether the email was found
    return NextResponse.json({
      ok: true,
      message: GENERIC_SUCCESS_MESSAGE,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid email address." },
        { status: 400 }
      );
    }

    console.error("[Forgot Password Link Error]:", error);
    // Generic message even on unexpected errors
    return NextResponse.json({
      ok: true,
      message: GENERIC_SUCCESS_MESSAGE,
    });
  }
}

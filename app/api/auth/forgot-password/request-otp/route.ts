import { NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email/resend";
import { generatePasswordResetOtpEmail } from "@/lib/email/templates/password-reset-otp";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email("Please enter a valid email address.").toLowerCase().trim(),
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const body = await req.json();
    const { email } = schema.parse(body);

    // Rate limiting: max 4 requests per 15 minutes per IP and email
    const rateLimit = checkRateLimit(`forgot-pwd-req:${ip}:${email}`, {
      limit: 4,
      windowSeconds: 900,
    });

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          error: `Too many requests. Please wait ${Math.ceil(
            rateLimit.resetInSeconds / 60
          )} minutes before requesting another code.`,
        },
        { status: 429 }
      );
    }

    const adminClient = createAdminClient();

    // Check if user exists in freelancer_profiles
    const { data: profile } = await adminClient
      .from("freelancer_profiles")
      .select("id, name, email, status")
      .ilike("email", email)
      .maybeSingle();

    // If profile exists and is active, issue OTP
    if (profile && profile.status === "active") {
      const otp = crypto.randomInt(100000, 1000000).toString();
      const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

      // Invalidate existing OTPs for this email
      await adminClient
        .from("password_reset_otps")
        .delete()
        .ilike("email", email);

      // Store hashed OTP
      const { error: insertError } = await adminClient
        .from("password_reset_otps")
        .insert({
          email: profile.email.toLowerCase(),
          otp_hash: otpHash,
          expires_at: expiresAt,
          attempts: 0,
          is_verified: false,
        });

      if (insertError) {
        console.error("[Forgot Password] Error saving OTP:", insertError);
        return NextResponse.json(
          { error: "Unable to process request at this time. Please try again." },
          { status: 500 }
        );
      }

      // Send email via REQly SMTP with display name "REQly"
      const defaultEmail = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@reqly.com";
      const fromSender = defaultEmail.includes("<") ? defaultEmail : `"REQly" <${defaultEmail}>`;

      await sendEmail({
        from: fromSender,
        to: profile.email,
        subject: `${otp} is your REQly verification code`,
        html: generatePasswordResetOtpEmail({
          otp,
          recipientName: profile.name || undefined,
          expiresInMinutes: 10,
        }),
        text: `Your REQly password reset verification code is: ${otp}. This code is valid for 10 minutes.`,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "If an active account exists for this email, a verification code has been sent.",
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid email address." },
        { status: 400 }
      );
    }
    console.error("[Forgot Password Request Error]:", error);
    return NextResponse.json(
      { error: "Unable to process your request. Please try again." },
      { status: 500 }
    );
  }
}

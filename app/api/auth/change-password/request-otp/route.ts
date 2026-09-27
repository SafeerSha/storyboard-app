import { NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAnyFreelancer } from "@/lib/super-admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email/resend";
import { generatePasswordResetOtpEmail } from "@/lib/email/templates/password-reset-otp";

export const dynamic = "force-dynamic";

const schema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
});

export async function POST(req: Request) {
  try {
    const actor = await verifyAnyFreelancer();
    if (!actor || !actor.email) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in again." },
        { status: 401 }
      );
    }

    const ip = getClientIp(req);
    const body = await req.json();
    const { currentPassword } = schema.parse(body);

    // Rate limiting: max 5 requests per 15 minutes per IP and user
    const rateLimit = checkRateLimit(`change-pwd-req:${ip}:${actor.id}`, {
      limit: 5,
      windowSeconds: 900,
    });

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          error: `Too many attempts. Please wait ${Math.ceil(
            rateLimit.resetInSeconds / 60
          )} minutes before requesting another code.`,
        },
        { status: 429 }
      );
    }

    // 1. Verify current password against Supabase Auth
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY!;

    const tempAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: authData, error: authError } = await tempAuthClient.auth.signInWithPassword({
      email: actor.email,
      password: currentPassword,
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: "The current password you entered is incorrect." },
        { status: 400 }
      );
    }

    // 2. Current password is correct! Generate secure 6-digit OTP
    const adminClient = createAdminClient();
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // Invalidate existing OTPs for this email
    await adminClient
      .from("password_reset_otps")
      .delete()
      .ilike("email", actor.email);

    // Store new hashed OTP
    const { error: insertError } = await adminClient
      .from("password_reset_otps")
      .insert({
        email: actor.email.toLowerCase(),
        otp_hash: otpHash,
        expires_at: expiresAt,
        attempts: 0,
        is_verified: false,
      });

    if (insertError) {
      console.error("[Change Password] Error saving OTP:", insertError);
      return NextResponse.json(
        { error: "Unable to process request at this time. Please try again." },
        { status: 500 }
      );
    }

    // 3. Dispatch branded email with sender "REQly"
    const defaultEmail = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@reqly.com";
    const fromSender = defaultEmail.includes("<") ? defaultEmail : `"REQly" <${defaultEmail}>`;

    await sendEmail({
      from: fromSender,
      to: actor.email,
      subject: `${otp} is your REQly verification code`,
      html: generatePasswordResetOtpEmail({
        otp,
        recipientName: actor.name || undefined,
        expiresInMinutes: 10,
      }),
      text: `Your REQly password change verification code is: ${otp}. This code is valid for 10 minutes.`,
    });

    return NextResponse.json({
      ok: true,
      message: "Current password verified. A 6-digit verification code has been sent to your email.",
      email: actor.email,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid input." },
        { status: 400 }
      );
    }
    console.error("[Change Password Request Error]:", error);
    return NextResponse.json(
      { error: "Unable to verify current password. Please try again." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email/resend";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email("Please enter a valid email address.").toLowerCase().trim(),
  resetToken: z.string().min(32, "Invalid reset token."),
  newPassword: z.string().min(6, "Password must be at least 6 characters long.").max(200),
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const body = await req.json();
    const { email, resetToken, newPassword } = schema.parse(body);

    // Rate limiting: max 5 reset attempts per 15 minutes
    const rateLimit = checkRateLimit(`forgot-pwd-reset:${ip}:${email}`, {
      limit: 5,
      windowSeconds: 900,
    });

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          error: `Too many password reset attempts. Please wait ${Math.ceil(
            rateLimit.resetInSeconds / 60
          )} minutes before trying again.`,
        },
        { status: 429 }
      );
    }

    const adminClient = createAdminClient();

    // Verify reset token in database
    const { data: record, error: fetchError } = await adminClient
      .from("password_reset_otps")
      .select("id, email, reset_token, is_verified, verified_at")
      .eq("reset_token", resetToken)
      .ilike("email", email)
      .eq("is_verified", true)
      .maybeSingle();

    if (fetchError || !record) {
      return NextResponse.json(
        {
          error:
            "Invalid or expired password reset session. Please request a new verification code.",
        },
        { status: 400 }
      );
    }

    // Check if the reset token was verified within 15 minutes
    const verifiedAt = record.verified_at ? new Date(record.verified_at).getTime() : 0;
    const tokenAgeMs = Date.now() - verifiedAt;
    const MAX_TOKEN_AGE_MS = 15 * 60 * 1000; // 15 minutes

    if (!verifiedAt || tokenAgeMs > MAX_TOKEN_AGE_MS) {
      await adminClient.from("password_reset_otps").delete().eq("id", record.id);
      return NextResponse.json(
        {
          error: "Your reset session has expired. Please request a new verification code.",
        },
        { status: 400 }
      );
    }

    // Lookup user in freelancer_profiles
    const { data: profile, error: profileError } = await adminClient
      .from("freelancer_profiles")
      .select("id, email")
      .ilike("email", email)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Unable to find an account associated with this email address." },
        { status: 404 }
      );
    }

    // Update password in Supabase Auth via admin client
    const { error: authError } = await adminClient.auth.admin.updateUserById(profile.id, {
      password: newPassword,
    });

    if (authError) {
      console.error("[Reset Password] Supabase Auth update error:", authError);
      return NextResponse.json(
        { error: authError.message || "Failed to update password. Please try again." },
        { status: 500 }
      );
    }

    // Invalidate/delete all OTP and reset records for this user
    await adminClient
      .from("password_reset_otps")
      .delete()
      .ilike("email", email);

    // Send confirmation security notice
    try {
      const defaultEmail = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@reqly.com";
      const fromSender = defaultEmail.includes("<") ? defaultEmail : `"REQly" <${defaultEmail}>`;
      sendEmail({
        from: fromSender,
        to: email,
        subject: "Your REQly password was changed",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; background: #ffffff; border-radius: 12px; border: 1px solid #EBE7F2;">
            <div style="font-size: 20px; font-weight: 800; color: #252331; margin-bottom: 12px;">REQ<span style="color: #B8944E;">ly</span></div>
            <h2 style="font-size: 16px; font-weight: 700; color: #252331; margin: 0 0 8px 0;">Password Changed Successfully</h2>
            <p style="font-size: 13px; line-height: 1.6; color: #585365; margin: 0 0 16px 0;">
              Your REQly account password was just changed. If you made this change, you can safely disregard this notice.
            </p>
            <div style="background-color: #FAF9FC; border-left: 3px solid #B8944E; padding: 10px 14px; border-radius: 4px; font-size: 12px; color: #706C7D; line-height: 1.5;">
              If you did not request or authorize this change, please contact your workspace administrator immediately.
            </div>
          </div>
        `,
        text: `Your REQly account password was recently changed. If you did not make this change, please contact your workspace administrator immediately.`,
      }).catch((e) => console.warn("[Reset Password] Confirmation email warning:", e));
    } catch (e) {
      // non-blocking
    }

    return NextResponse.json({
      ok: true,
      message: "Password has been successfully updated.",
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid input." },
        { status: 400 }
      );
    }
    console.error("[Reset Password Error]:", error);
    return NextResponse.json(
      { error: "Unable to reset password. Please try again." },
      { status: 500 }
    );
  }
}

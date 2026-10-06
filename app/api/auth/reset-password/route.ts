import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email/resend";

export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(10, "Invalid reset token."),
  newPassword: z.string().min(6, "Password must be at least 6 characters long.").max(200),
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const body = await req.json();
    const { token, newPassword } = schema.parse(body);

    // Rate limiting: max 5 reset attempts per 15 minutes per IP
    const rateLimit = checkRateLimit(`reset-pwd-submit:${ip}`, {
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
    const nowIso = new Date().toISOString();

    // 1. Verify token in password_reset_otps table
    const { data: record, error: fetchError } = await adminClient
      .from("password_reset_otps")
      .select("id, email, reset_token, expires_at")
      .eq("reset_token", token)
      .gt("expires_at", nowIso)
      .maybeSingle();

    if (fetchError || !record) {
      return NextResponse.json(
        {
          error:
            "This password reset link is invalid, expired, or has already been used. Please request a new one.",
        },
        { status: 400 }
      );
    }

    const email = record.email.toLowerCase().trim();

    // 2. Lookup user in freelancer_profiles
    const { data: profile } = await adminClient
      .from("freelancer_profiles")
      .select("id, email, name")
      .ilike("email", email)
      .maybeSingle();

    // 3. Lookup client in clients table if not a freelancer
    let clientAccount: { id: string; email: string; name: string } | null = null;
    if (!profile) {
      const { data: client } = await adminClient
        .from("clients")
        .select("id, email, name")
        .ilike("email", email)
        .maybeSingle();
      if (client) {
        clientAccount = client;
      }
    }

    if (!profile && !clientAccount) {
      return NextResponse.json(
        { error: "Unable to find an account associated with this email address." },
        { status: 404 }
      );
    }

    // 4. Update password & invalidate sessions according to account type
    if (profile) {
      // Supabase Auth update for Freelancer / Super Admin
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
    } else if (clientAccount) {
      // Client account update
      const passwordHash = await bcrypt.hash(newPassword, 12);
      const { error: clientUpdateError } = await adminClient
        .from("clients")
        .update({
          password_hash: passwordHash,
          is_password_changed: true,
          password_changed_at: new Date().toISOString(),
        })
        .eq("id", clientAccount.id);

      if (clientUpdateError) {
        console.error("[Reset Password] Client password update error:", clientUpdateError);
        return NextResponse.json(
          { error: "Failed to update client password. Please try again." },
          { status: 500 }
        );
      }

      // AC-1.4: Invalidate old client sessions
      await adminClient.from("client_sessions").delete().eq("client_id", clientAccount.id);
    }

    // AC-1.4: Invalidate all reset tokens for this email once successfully updated
    await adminClient
      .from("password_reset_otps")
      .delete()
      .ilike("email", email);

    // 5. Send security confirmation email notification
    try {
      sendEmail({
        to: email,
        subject: "Your REQly password was changed",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; background: #ffffff; border-radius: 12px; border: 1px solid #EBE7F2;">
            <div style="font-size: 20px; font-weight: 800; color: #252331; margin-bottom: 12px;">REQ<span style="color: #B8944E;">ly</span></div>
            <h2 style="font-size: 16px; font-weight: 700; color: #252331; margin: 0 0 8px 0;">Password Changed Successfully</h2>
            <p style="font-size: 13px; line-height: 1.6; color: #585365; margin: 0 0 16px 0;">
              Your REQly account password was just changed. Old sessions and reset links have been terminated. If you made this change, you can safely disregard this notice.
            </p>
            <div style="background-color: #FAF9FC; border-left: 3px solid #B8944E; padding: 10px 14px; border-radius: 4px; font-size: 12px; color: #706C7D; line-height: 1.5;">
              If you did not request or authorize this change, please contact your workspace administrator immediately.
            </div>
          </div>
        `,
        text: `Your REQly account password was recently changed. Old sessions have been invalidated. If you did not make this change, please contact your workspace administrator immediately.`,
      }).catch((e) => console.warn("[Reset Password] Confirmation email notice warning:", e));
    } catch {
      // non-blocking
    }

    return NextResponse.json({
      ok: true,
      message: "Your password has been successfully reset. You may now sign in with your new password.",
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

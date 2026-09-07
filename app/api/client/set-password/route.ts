import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getAuthenticatedClient } from "@/lib/client-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({
  newPassword: z.string().min(1, "New password is required."),
  confirmPassword: z.string().min(1, "Password confirmation is required."),
});

export async function POST(req: Request) {
  try {
    // 1. Verify client session with onboarding authorization allowed
    const authenticatedClient = await getAuthenticatedClient({ allowPendingPasswordChange: true });
    if (!authenticatedClient) {
      return NextResponse.json({ error: "Unauthorized session. Please log in again." }, { status: 401 });
    }

    // Rate-limit password change attempts (max 5 per 15 minutes per client)
    const ip = getClientIp(req);
    const rateLimit = checkRateLimit(`set-password:${authenticatedClient.id}:${ip}`, {
      limit: 5,
      windowSeconds: 900,
    });
    if (!rateLimit.success) {
      return NextResponse.json(
        {
          error: `Too many password setup attempts. Please wait ${Math.ceil(
            rateLimit.resetInSeconds / 60
          )} minutes before trying again.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { newPassword, confirmPassword } = schema.parse(body);

    // 4. Validate passwords match (No complexity rules enforced as specified in Section 9)
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 2 & 3. Authoritatively query database to verify client is active and is_password_changed is currently FALSE
    // DO NOT trust browser state!
    let { data: clientRecord, error: clientError } = await supabase
      .from("clients")
      .select("id, status, is_password_changed")
      .eq("id", authenticatedClient.id)
      .single();

    if (clientError && (clientError.code === "42703" || clientError.message.includes("is_password_changed"))) {
      const fallback = await supabase
        .from("clients")
        .select("id, status")
        .eq("id", authenticatedClient.id)
        .single();
      clientRecord = fallback.data ? { ...fallback.data, is_password_changed: false } : null;
    }

    if (!clientRecord || clientRecord.status !== "active") {
      return NextResponse.json({ error: "Client account is inactive or not found." }, { status: 403 });
    }

    // If client has already completed password setup, forbid calling this endpoint again
    if (clientRecord.is_password_changed === true) {
      return NextResponse.json(
        { error: "Password setup has already been completed.", redirectTo: "/client" },
        { status: 400 }
      );
    }

    // 5. Hash the new password using bcrypt
    const password_hash = await bcrypt.hash(newPassword, 12);

    // 6, 7 & 8. Replace password_hash, set is_password_changed = true, update password_changed_at
    let updatePayload: Record<string, any> = {
      password_hash,
      is_password_changed: true,
      password_changed_at: new Date().toISOString(),
    };

    let { error: updateError } = await supabase
      .from("clients")
      .update(updatePayload)
      .eq("id", authenticatedClient.id);

    if (updateError && (updateError.code === "42703" || updateError.message.includes("is_password_changed"))) {
      delete updatePayload.is_password_changed;
      delete updatePayload.password_changed_at;
      const retry = await supabase
        .from("clients")
        .update(updatePayload)
        .eq("id", authenticatedClient.id);
      updateError = retry.error;
    }

    if (updateError) {
      throw updateError;
    }

    // 9 & 10. Client remains authenticated via existing session cookie; redirect directly to client home
    return NextResponse.json({
      ok: true,
      redirectTo: "/client",
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid input." }, { status: 400 });
    }
    return NextResponse.json({ error: error?.message || "Failed to set password." }, { status: 500 });
  }
}

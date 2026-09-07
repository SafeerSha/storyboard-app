import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClientSession } from "@/lib/client-session";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({
  loginId: z.string().regex(/^\d{6}$/, "Login PIN must be exactly 6 digits."),
  password: z.string().min(1, "Password is required.").max(200),
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const body = await req.json();
    const input = schema.parse(body);

    // Rate-limit 6-digit PIN login attempts: max 5 attempts per 15 minutes per IP+PIN
    const rateLimit = checkRateLimit(`login:${ip}:${input.loginId}`, {
      limit: 5,
      windowSeconds: 900,
    });

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          error: `Too many failed login attempts. Please wait ${Math.ceil(
            rateLimit.resetInSeconds / 60
          )} minutes before trying again.`,
        },
        { status: 429 }
      );
    }

    const supabase = createAdminClient();

    // Query client credentials and status
    let { data: client, error: queryError } = await supabase
      .from("clients")
      .select("id, status, is_password_changed, password_hash")
      .eq("login_id", input.loginId)
      .maybeSingle();

    if (queryError && (queryError.code === "42703" || queryError.message.includes("is_password_changed"))) {
      // Fallback query if is_password_changed not migrated in Supabase yet
      const fallback = await supabase
        .from("clients")
        .select("id, status, password_hash")
        .eq("login_id", input.loginId)
        .maybeSingle();
      client = fallback.data ? { ...fallback.data, is_password_changed: true } : null;
    }

    if (!client || client.status !== "active") {
      return NextResponse.json({ error: "Invalid login PIN or password." }, { status: 401 });
    }

    if (!client.password_hash) {
      return NextResponse.json({ error: "Invalid login PIN or password." }, { status: 401 });
    }

    // Verify bcrypt hash
    const isPasswordValid = await bcrypt.compare(input.password, client.password_hash);
    if (!isPasswordValid) {
      return NextResponse.json({ error: "Invalid login PIN or password." }, { status: 401 });
    }

    // Create persistent authenticated client session
    await createClientSession(client.id);

    // Determine if first-time onboarding password change is required
    const isPasswordChanged = client.is_password_changed !== false;
    const redirectTo = isPasswordChanged ? "/client" : "/client/set-password";

    return NextResponse.json({
      ok: true,
      isPasswordChanged,
      redirectTo,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid input." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to sign in. Please verify your PIN and password." }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClientSession } from "@/lib/client-session";
import { createTeamSession } from "@/lib/team-session";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({
  identifier: z.string().min(1, "Login ID is required."),
  password: z.string().min(1, "Password is required.").max(200),
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const body = await req.json();
    const input = schema.parse(body);
    const identifier = input.identifier.trim();

    // Generic rate limiting
    const rateLimit = checkRateLimit(`login:${ip}:${identifier}`, {
      limit: 10,
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

    // 1. Check Team Users table
    // Convert to lowercase for username comparison
    const username = identifier.toLowerCase();
    const { data: teamUser, error: teamError } = await supabase
      .from("team_users")
      .select("id, name, username, password_hash, status, project_id")
      .eq("username", username)
      .maybeSingle();

    if (teamUser && !teamError) {
      if (teamUser.status === "disabled") {
        return NextResponse.json(
          { error: "Your team account is disabled. Please contact your administrator." },
          { status: 403 }
        );
      }

      const isValid = await bcrypt.compare(input.password, teamUser.password_hash);
      if (isValid) {
        await createTeamSession(teamUser.id);
        return NextResponse.json({
          ok: true,
          redirectTo: "/team",
          userType: "team",
        });
      }
    }

    // 2. Check Clients table (using exact identifier)
    let { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, status, is_password_changed, password_hash")
      .eq("login_id", identifier)
      .maybeSingle();

    if (clientError && (clientError.code === "42703" || clientError.message.includes("is_password_changed"))) {
      const fallback = await supabase
        .from("clients")
        .select("id, status, password_hash")
        .eq("login_id", identifier)
        .maybeSingle();
      client = fallback.data ? { ...fallback.data, is_password_changed: true } : null;
    }

    if (client && client.status === "active" && client.password_hash) {
      const isPasswordValid = await bcrypt.compare(input.password, client.password_hash);
      if (isPasswordValid) {
        await createClientSession(client.id);
        const isPasswordChanged = client.is_password_changed !== false;
        const redirectTo = isPasswordChanged ? "/client" : "/client/set-password";
        return NextResponse.json({
          ok: true,
          redirectTo,
          userType: "client",
        });
      }
    }

    // 3. Fallback: If no match in team_users or clients, tell the client to try Supabase Auth (Admin/Freelancer)
    return NextResponse.json({
      action: "SUPABASE_AUTH",
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid input." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to process login request." }, { status: 500 });
  }
}

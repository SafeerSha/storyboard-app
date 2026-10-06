import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(10, "Invalid token format."),
});

function maskEmail(email: string): string {
  const parts = email.split("@");
  if (parts.length !== 2) return email;
  const [local, domain] = parts;
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token") || "";

    const { token: validatedToken } = schema.parse({ token });

    const adminClient = createAdminClient();
    const nowIso = new Date().toISOString();

    const { data: record, error } = await adminClient
      .from("password_reset_otps")
      .select("id, email, expires_at")
      .eq("reset_token", validatedToken)
      .gt("expires_at", nowIso)
      .maybeSingle();

    if (error || !record) {
      return NextResponse.json(
        {
          valid: false,
          error: "This password reset link is invalid, expired, or has already been used.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      email: maskEmail(record.email),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        valid: false,
        error: "This password reset link is invalid or expired.",
      },
      { status: 400 }
    );
  }
}

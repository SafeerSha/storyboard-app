import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySuperAdmin } from "@/lib/super-admin";
import { invalidateAllTeamSessions } from "@/lib/team-session";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifySuperAdmin();
  if (!admin) {
    return new NextResponse("Unauthorized. Super Admin access required.", { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const newPassword = String(body.password || body.newPassword || "");

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters long." }, { status: 400 });
    }

    const adminClient = createAdminClient();

    const { data: user, error: fetchError } = await adminClient
      .from("team_users")
      .select("id, username")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !user) {
      return NextResponse.json({ error: "Team user not found." }, { status: 404 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    const { error: updateError } = await adminClient
      .from("team_users")
      .update({
        password_hash: passwordHash,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Invalidate all active sessions so user must log in with new password
    await invalidateAllTeamSessions(id);

    // Audit log (without password)
    await logAudit({
      action: "team_user_password_reset",
      actorId: admin.id,
      actorType: "super_admin",
      actorName: admin.name,
      targetType: "team_user",
      targetId: id,
      details: { username: user.username },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to reset password." }, { status: 500 });
  }
}

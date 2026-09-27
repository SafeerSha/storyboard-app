import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAnyFreelancer } from "@/lib/super-admin";
import { invalidateAllTeamSessions } from "@/lib/team-session";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await verifyAnyFreelancer();
  if (!actor) {
    return new NextResponse("Unauthorized. Please log in.", { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const newPassword = String(body.password || body.newPassword || "");

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters long." }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Verify team user exists (scoped by owner_id for non-super-admins)
    let userQuery = adminClient
      .from("team_users")
      .select("id, username, owner_id")
      .eq("id", id);
    if (!actor.isSuperAdmin) {
      userQuery = userQuery.eq("owner_id", actor.id);
    }
    const { data: user, error: fetchError } = await userQuery.maybeSingle();

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

    await invalidateAllTeamSessions(id);

    await logAudit({
      action: "team_user_password_reset",
      actorId: actor.id,
      actorType: actor.isSuperAdmin ? "super_admin" : "freelancer",
      actorName: actor.name,
      targetType: "team_user",
      targetId: id,
      details: { username: user.username },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to reset password." }, { status: 500 });
  }
}

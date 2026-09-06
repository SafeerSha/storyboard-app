import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTeamSession } from "@/lib/team-session";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Query team_users table
    const { data: user, error: userError } = await admin
      .from("team_users")
      .select("id, name, username, password_hash, status, project_id")
      .eq("username", username)
      .maybeSingle();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Invalid username or password." },
        { status: 401 }
      );
    }

    // Check account status
    if (user.status === "disabled") {
      return NextResponse.json(
        { error: "Your account is disabled. Please contact your administrator." },
        { status: 403 }
      );
    }

    // Verify password hash
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid username or password." },
        { status: 401 }
      );
    }

    // Create session in team_sessions and set HTTP-only cookie storyboard_team_session
    await createTeamSession(user.id);

    return NextResponse.json({
      success: true,
      redirect: "/team",
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        projectId: user.project_id,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to authenticate." },
      { status: 500 }
    );
  }
}

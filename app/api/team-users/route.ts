import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySuperAdmin } from "@/lib/super-admin";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const admin = await verifySuperAdmin();
  if (!admin) {
    return new NextResponse("Unauthorized. Super Admin access required.", { status: 403 });
  }

  const adminClient = createAdminClient();
  const { data: users, error } = await adminClient
    .from("team_users")
    .select("id, project_id, name, username, status, created_at, updated_at, projects(name)")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ users: users || [] });
}

export async function POST(req: Request) {
  const admin = await verifySuperAdmin();
  if (!admin) {
    return new NextResponse("Unauthorized. Super Admin access required.", { status: 403 });
  }

  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    const projectId = String(body.projectId || "").trim();
    const status = body.status === "disabled" ? "disabled" : "active";

    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    if (!username || username.length < 3) {
      return NextResponse.json({ error: "Username must be at least 3 characters long." }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
      return NextResponse.json({ error: "Username may only contain letters, numbers, hyphens, periods, or underscores." }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters long." }, { status: 400 });
    }
    if (!projectId) {
      return NextResponse.json({ error: "Assigning a project is required." }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Verify project exists in database
    const { data: project, error: projectError } = await adminClient
      .from("projects")
      .select("id, name")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError || !project) {
      return NextResponse.json({ error: "Selected project was not found in the database." }, { status: 400 });
    }

    // Hash password securely with bcrypt
    const passwordHash = await bcrypt.hash(password, 12);

    // Insert into team_users
    const { data: newUser, error: insertError } = await adminClient
      .from("team_users")
      .insert({
        name,
        username,
        password_hash: passwordHash,
        project_id: projectId,
        status,
      })
      .select("id, project_id, name, username, status, created_at, updated_at")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json({ error: `Username '${username}' is already taken. Please choose another.` }, { status: 400 });
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Audit log (never logging password)
    await logAudit({
      action: "team_user_created",
      actorId: admin.id,
      actorType: "super_admin",
      actorName: admin.name,
      targetType: "team_user",
      targetId: newUser.id,
      details: {
        username: newUser.username,
        name: newUser.name,
        projectId: newUser.project_id,
        projectName: project.name,
        status: newUser.status,
      },
    });

    return NextResponse.json(
      {
        success: true,
        user: { ...newUser, projects: { name: project.name } },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create team user." }, { status: 500 });
  }
}

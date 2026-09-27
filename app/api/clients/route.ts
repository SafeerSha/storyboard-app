import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateTemporaryPassword } from "@/lib/client-credentials";

export const dynamic = "force-dynamic";

function randomLoginId() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function GET() {
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("freelancer_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isSuperAdmin = profile?.role === "super_admin";

  let projectIds: string[] = [];
  if (isSuperAdmin) {
    const { data: allProjects } = await admin.from("projects").select("id");
    projectIds = (allProjects ?? []).map((p: any) => p.id);
  } else {
    const { data: userProjects, error: projectsError } = await admin
      .from("projects")
      .select("id")
      .eq("owner_id", user.id);

    if (projectsError) return NextResponse.json({ error: projectsError.message }, { status: 500 });
    projectIds = (userProjects ?? []).map((p: any) => p.id);
  }

  // No projects → no clients
  if (projectIds.length === 0) {
    return NextResponse.json({ clients: [] });
  }

  let { data, error } = await admin
    .from("clients")
    .select("id,name,login_id,status,project_id,is_password_changed,projects(name)")
    .in("project_id", projectIds)
    .order("created_at", { ascending: false });

  if (error && (error.code === "42703" || error.message.includes("is_password_changed"))) {
    // Graceful fallback if is_password_changed column is not yet migrated in Supabase
    const fallback = await admin
      .from("clients")
      .select("id,name,login_id,status,project_id,projects(name)")
      .in("project_id", projectIds)
      .order("created_at", { ascending: false });

    data = (fallback.data ?? []).map((c: any) => ({
      ...c,
      is_password_changed: true,
    }));
    error = fallback.error;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ clients: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const name = String(body.name || "").trim();
  const projectId = String(body.projectId || "").trim();
  if (!name || !projectId) {
    return NextResponse.json({ error: "Client name and project are required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("freelancer_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isSuperAdmin = profile?.role === "super_admin";

  let projectQuery = admin.from("projects").select("id,name").eq("id", projectId);
  if (!isSuperAdmin) {
    projectQuery = projectQuery.eq("owner_id", user.id);
  }
  const { data: project } = await projectQuery.maybeSingle();

  if (!project) return NextResponse.json({ error: "Project not found or access denied." }, { status: 404 });

  let loginId = String(body.loginId || "").trim();
  let password = String(body.password || "");

  if (!/^\d{6}$/.test(loginId)) loginId = randomLoginId();
  if (!password) password = generateTemporaryPassword();

  // Hash the initial password immediately using bcrypt
  const passwordHash = await bcrypt.hash(password, 12);

  const insertPayload: Record<string, any> = {
    project_id: projectId,
    name,
    login_id: loginId,
    password_hash: passwordHash,
    is_password_changed: false,
  };

  let { data: client, error } = await admin
    .from("clients")
    .insert(insertPayload)
    .select("id,name,login_id,status,project_id,is_password_changed")
    .single();

  if (error && (error.code === "42703" || error.message.includes("is_password_changed"))) {
    // Retry without is_password_changed if migration not yet applied
    delete insertPayload.is_password_changed;
    const retry = await admin
      .from("clients")
      .insert(insertPayload)
      .select("id,name,login_id,status,project_id")
      .single();

    client = retry.data ? { ...retry.data, is_password_changed: false } : null;
    error = retry.error;
  }

  if (error) {
    return NextResponse.json(
      {
        error:
          error.code === "23505"
            ? "Login ID already exists. Please generate another PIN."
            : error.message,
      },
      { status: 400 }
    );
  }

  // Return the plaintext initial password only once in this immediate creation handoff
  return NextResponse.json(
    {
      client,
      initialPassword: password,
      generatedPassword: password,
    },
    { status: 201 }
  );
}

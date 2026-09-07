import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySuperAdmin } from "@/lib/super-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await verifySuperAdmin();
  if (!admin) return new NextResponse("Unauthorized", { status: 403 });

  const adminClient = createAdminClient();
  const { data: users, error } = await adminClient
    .from("freelancer_profiles")
    .select("id, name, email, role, status, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(users);
}

export async function POST(req: Request) {
  const admin = await verifySuperAdmin();
  if (!admin) return new NextResponse("Unauthorized", { status: 403 });

  try {
    const { name, email, password, role } = await req.json();

    if (!email || !password || password.length < 6) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 400 });
    }

    const adminClient = createAdminClient();
    
    // 1. Create the Auth User
    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true // Auto confirm so they can log in immediately
    });

    if (authError) throw authError;

    // 2. Create the Profile
    const { error: profileError } = await adminClient
      .from("freelancer_profiles")
      .insert({
        id: authUser.user.id,
        email,
        name: name || email.split("@")[0],
        role: role === "super_admin" ? "super_admin" : "freelancer",
        status: "active"
      });

    // 3. Rollback if profile creation fails
    if (profileError) {
      await adminClient.auth.admin.deleteUser(authUser.user.id);
      throw profileError;
    }

    return NextResponse.json({ success: true, userId: authUser.user.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create user" }, { status: 500 });
  }
}

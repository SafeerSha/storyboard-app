import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySuperAdmin } from "@/lib/super-admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifySuperAdmin();
  if (!admin) return new NextResponse("Unauthorized", { status: 403 });

  const { id } = await params;

  try {
    const { newPassword } = await req.json();

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters long." }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Verify freelancer profile exists
    const { data: profile, error: profileError } = await adminClient
      .from("freelancer_profiles")
      .select("id, email, name")
      .eq("id", id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "User account not found." }, { status: 404 });
    }

    // Update password in Supabase Auth
    const { error: authError } = await adminClient.auth.admin.updateUserById(id, {
      password: newPassword,
    });

    if (authError) throw authError;

    return NextResponse.json({
      success: true,
      message: "Password updated successfully.",
      user: { id: profile.id, email: profile.email, name: profile.name },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to reset password" }, { status: 500 });
  }
}

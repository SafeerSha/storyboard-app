import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySuperAdmin } from "@/lib/super-admin";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifySuperAdmin();
  if (!admin) return new NextResponse("Unauthorized", { status: 403 });

  const { id } = await params;

  try {
    const body = await req.json();
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) {
      const name = String(body.name || "").trim();
      if (!name) return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 });
      updatePayload.name = name;
    }

    if (body.role !== undefined) {
      if (body.role !== "super_admin" && body.role !== "freelancer") {
        return NextResponse.json({ error: "Invalid role. Must be 'super_admin' or 'freelancer'." }, { status: 400 });
      }
      if (admin.id === id && body.role !== "super_admin") {
        return NextResponse.json({ error: "You cannot demote your own Super Admin role." }, { status: 400 });
      }
      updatePayload.role = body.role;
    }

    if (body.status !== undefined) {
      if (body.status !== "active" && body.status !== "disabled") {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      if (admin.id === id && body.status !== "active") {
        return NextResponse.json({ error: "You cannot disable your own account." }, { status: 400 });
      }
      updatePayload.status = body.status;
    }

    const adminClient = createAdminClient();
    const { data: updatedProfile, error } = await adminClient
      .from("freelancer_profiles")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // Handle mapping projects to this freelancer
    if (Array.isArray(body.projectIds)) {
      const cleanProjectIds: string[] = Array.from(
        new Set(body.projectIds.map(String).map((s: string) => s.trim()).filter(Boolean))
      );

      // Find projects currently owned by this freelancer
      const { data: currentOwned } = await adminClient
        .from("projects")
        .select("id")
        .eq("owner_id", id);

      const currentOwnedIds = (currentOwned || []).map((p: any) => p.id);

      // Projects to unmap (reclaim to super admin)
      const toUnmap = currentOwnedIds.filter((pid: string) => !cleanProjectIds.includes(pid));
      if (toUnmap.length > 0) {
        await adminClient
          .from("projects")
          .update({ owner_id: admin.id })
          .in("id", toUnmap);
      }

      // Projects to map to this freelancer
      if (cleanProjectIds.length > 0) {
        await adminClient
          .from("projects")
          .update({ owner_id: id })
          .in("id", cleanProjectIds);
      }
    }

    return NextResponse.json({ success: true, profile: updatedProfile });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifySuperAdmin();
  if (!admin) return new NextResponse("Unauthorized", { status: 403 });

  const { id } = await params;

  if (admin.id === id) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }

  try {
    const adminClient = createAdminClient();

    // 1. Delete profile from freelancer_profiles
    const { error: profileError } = await adminClient
      .from("freelancer_profiles")
      .delete()
      .eq("id", id);

    if (profileError) throw profileError;

    // 2. Delete user from Supabase auth
    const { error: authError } = await adminClient.auth.admin.deleteUser(id);
    if (authError) {
      console.warn("Failed to delete auth user, but profile deleted:", authError.message);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to delete user" }, { status: 500 });
  }
}

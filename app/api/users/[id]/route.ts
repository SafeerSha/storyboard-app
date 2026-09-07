import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySuperAdmin } from "@/lib/super-admin";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifySuperAdmin();
  if (!admin) return new NextResponse("Unauthorized", { status: 403 });

  const { id } = await params;
  
  if (admin.id === id) {
    return NextResponse.json({ error: "You cannot modify your own status" }, { status: 400 });
  }

  try {
    const { status } = await req.json();

    if (status !== "active" && status !== "disabled") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from("freelancer_profiles")
      .update({ status })
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update user" }, { status: 500 });
  }
}

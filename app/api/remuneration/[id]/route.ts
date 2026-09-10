import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(req: Request, context: any) {
  const params = await context.params;
  const { id } = params;

  if (!id) {
    return NextResponse.json({ error: "Missing estimate ID" }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Check if the user is super_admin or the creator of the estimate
    const { data: profile } = await admin
      .from("freelancer_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "super_admin") {
      const { data: est } = await admin
        .from("remuneration_estimates")
        .select("created_by")
        .eq("id", id)
        .maybeSingle();
      if (!est || est.created_by !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Delete the estimate
    const { error } = await admin.from("remuneration_estimates").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/settings — Fetch current user's workspace settings (email_from, full_name, etc.)
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("freelancer_profiles")
      .select("id, name, full_name, email, role, email_from")
      .eq("id", user.id)
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      settings: {
        email_from: profile?.email_from || "",
        full_name: profile?.full_name || profile?.name || "",
        email: profile?.email || user.email || "",
        role: profile?.role || "freelancer",
      },
    });
  } catch (error: any) {
    console.error("[Settings GET] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PUT /api/settings — Update workspace settings (email_from, full_name)
 */
export async function PUT(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { email_from, full_name } = body;

    const admin = createAdminClient();

    // Build the update payload — only include fields that were provided
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof email_from === "string") {
      updates.email_from = email_from.trim();
    }
    if (typeof full_name === "string") {
      updates.full_name = full_name.trim();
    }

    const { error: updateError } = await admin
      .from("freelancer_profiles")
      .update(updates)
      .eq("id", user.id);

    if (updateError) {
      console.error("[Settings PUT] Update error:", updateError);
      return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: "Settings saved successfully.",
    });
  } catch (error: any) {
    console.error("[Settings PUT] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

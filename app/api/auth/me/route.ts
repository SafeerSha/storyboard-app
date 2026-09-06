import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({
        authenticated: false,
        user: null,
        role: null,
        profile: null,
      });
    }

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("freelancer_profiles")
      .select("id, name, email, role, status, created_at, updated_at")
      .eq("id", user.id)
      .maybeSingle();

    const resolvedRole = profile?.role || "freelancer";
    const resolvedName = profile?.name || user.user_metadata?.name || user.email?.split("@")[0] || "User";

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: resolvedName,
        role: resolvedRole,
        status: profile?.status || "active",
      },
      profileRecord: profile,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

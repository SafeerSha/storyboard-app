import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "./supabase/admin";

export async function verifySuperAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
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
  if (!user) return null;

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("freelancer_profiles")
    .select("id, name, email, role, status")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "super_admin" || profile?.status !== "active") {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: profile.name || user.email?.split("@")[0] || "Super Admin",
  };
}

/**
 * Verifies any active freelancer (super_admin OR freelancer role).
 * Used for routes accessible to all freelancers, where data is scoped per owner_id.
 */
export async function verifyAnyFreelancer() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
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
  if (!user) return null;

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("freelancer_profiles")
    .select("id, name, email, role, status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "active") {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: profile.name || user.email?.split("@")[0] || "Freelancer",
    role: profile.role as "super_admin" | "freelancer",
    isSuperAdmin: profile.role === "super_admin",
  };
}

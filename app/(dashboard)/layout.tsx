import { FreelancerLayout } from "@/components/layout/FreelancerLayout";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";

export default async function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  let initialUser: { id: string; name: string; email: string; role: string } | null = null;

  if (user) {
    const adminClient = createAdminClient();
    const { data: profile } = await adminClient
      .from("freelancer_profiles")
      .select("id, name, email, role, status")
      .eq("id", user.id)
      .maybeSingle();

    const role = profile?.role || "freelancer";
    const name =
      profile?.name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "Freelancer";

    initialUser = {
      id: user.id,
      name,
      email: user.email || "",
      role,
    };
  }

  return <FreelancerLayout initialUser={initialUser}>{children}</FreelancerLayout>;
}

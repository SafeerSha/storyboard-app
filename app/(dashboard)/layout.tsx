import { FreelancerLayout } from "@/components/layout/FreelancerLayout";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies, headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let initialUser: { id: string; name: string; email: string; role: string } | null = null;

  // 1. Fast path: check if identity headers were attached by middleware
  const headerList = await headers();
  const headerUserId = headerList.get("x-user-id");

  if (headerUserId) {
    const rawName = headerList.get("x-user-name");
    const name = rawName ? decodeURIComponent(rawName) : "Freelancer";
    const email = headerList.get("x-user-email") || "";
    const role = headerList.get("x-user-role") || "freelancer";

    initialUser = {
      id: headerUserId,
      name,
      email,
      role,
    };
  } else {
    // 2. Fallback path if headers were not present (e.g. direct server rendering without middleware hit)
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
    } else {
      // Check if team member is logged in
      const { getAuthenticatedTeamUser } = await import("@/lib/team-session");
      const teamUser = await getAuthenticatedTeamUser();
      if (teamUser) {
        initialUser = {
          id: teamUser.id,
          name: teamUser.name,
          email: teamUser.username,
          role: "collaborator",
        };
      }
    }
  }

  return <FreelancerLayout initialUser={initialUser}>{children}</FreelancerLayout>;
}


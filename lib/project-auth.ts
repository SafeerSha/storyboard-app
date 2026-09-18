import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedTeamUser } from "@/lib/team-session";
import { isTeamUserProjectMember } from "@/lib/story-reviewer-auth";

export interface ProjectActor {
  id: string;
  name: string;
  emailOrUsername: string;
  type: "freelancer" | "team_user";
  isSuperAdmin: boolean;
  isOwner: boolean;
}

export async function authorizeProjectMember(projectId: string): Promise<{
  authorized: boolean;
  actor: ProjectActor | null;
  error?: string;
}> {
  const admin = createAdminClient();

  // 1. Check Team User session first
  const teamUser = await getAuthenticatedTeamUser();
  if (teamUser) {
    const isMember =
      teamUser.project_id === projectId ||
      (await isTeamUserProjectMember(teamUser.id, projectId));
    if (isMember) {
      return {
        authorized: true,
        actor: {
          id: teamUser.id,
          name: teamUser.name,
          emailOrUsername: teamUser.username,
          type: "team_user",
          isSuperAdmin: false,
          isOwner: false,
        },
      };
    }
  }

  // 2. Check Supabase Auth (Freelancer or Super Admin)
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY!,
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
    const { data: profile } = await admin
      .from("freelancer_profiles")
      .select("id, name, email, role, status")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role === "super_admin") {
      return {
        authorized: true,
        actor: {
          id: user.id,
          name: profile.name || user.email?.split("@")[0] || "Super Admin",
          emailOrUsername: user.email || "",
          type: "freelancer",
          isSuperAdmin: true,
          isOwner: true,
        },
      };
    }

    const { data: project } = await admin
      .from("projects")
      .select("id, owner_id")
      .eq("id", projectId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (project) {
      return {
        authorized: true,
        actor: {
          id: user.id,
          name: profile?.name || user.email?.split("@")[0] || "Freelancer",
          emailOrUsername: user.email || "",
          type: "freelancer",
          isSuperAdmin: false,
          isOwner: true,
        },
      };
    }
  }

  return {
    authorized: false,
    actor: null,
    error: "Unauthorized or project access denied.",
  };
}

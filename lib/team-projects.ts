import { createAdminClient } from "@/lib/supabase/admin";

export interface TeamAssignedProject {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Retrieves all distinct projects mapped to a given team user.
 * Looks up both project_team_members memberships and any legacy fallback project_id,
 * ensuring deduplication and clean ordering.
 */
export async function getTeamUserAssignedProjects(
  teamUserId: string,
  fallbackProjectId?: string | null
): Promise<TeamAssignedProject[]> {
  if (!teamUserId) return [];

  const admin = createAdminClient();

  // 1. Fetch memberships from project_team_members joined with projects
  const { data: memberships, error } = await admin
    .from("project_team_members")
    .select(`
      project_id,
      projects (
        id,
        name,
        description,
        status,
        created_at,
        updated_at
      )
    `)
    .eq("team_user_id", teamUserId);

  if (error) {
    console.error("Error querying project_team_members for team user:", error);
  }

  const projectMap = new Map<string, TeamAssignedProject>();

  (memberships || []).forEach((m: any) => {
    const p = m.projects;
    if (p && p.id) {
      projectMap.set(p.id, {
        id: p.id,
        name: p.name || "Untitled Project",
        description: p.description || null,
        status: p.status || "active",
        created_at: p.created_at,
        updated_at: p.updated_at,
      });
    }
  });

  // 2. Fallback check for single-project assignment in team_users if not present yet
  if (fallbackProjectId && !projectMap.has(fallbackProjectId)) {
    const { data: fallbackProj } = await admin
      .from("projects")
      .select("id, name, description, status, created_at, updated_at")
      .eq("id", fallbackProjectId)
      .maybeSingle();

    if (fallbackProj && fallbackProj.id) {
      projectMap.set(fallbackProj.id, {
        id: fallbackProj.id,
        name: fallbackProj.name || "Untitled Project",
        description: fallbackProj.description || null,
        status: fallbackProj.status || "active",
        created_at: fallbackProj.created_at,
        updated_at: fallbackProj.updated_at,
      });
    }
  }

  // Return sorted alphabetically by name
  return Array.from(projectMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}

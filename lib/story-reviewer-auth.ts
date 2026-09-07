import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTeamUser } from "@/lib/team-session";

export interface StoryReviewerItem {
  id: string;
  team_user_id: string;
  user_id: string;
  name: string;
  username: string;
  role?: string;
}

/**
 * Verifies whether a team user has active membership in a project.
 */
export async function isTeamUserProjectMember(teamUserId: string, projectId: string): Promise<boolean> {
  if (!teamUserId || !projectId) return false;
  const admin = createAdminClient();

  const { data } = await admin
    .from("project_team_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("team_user_id", teamUserId)
    .limit(1)
    .maybeSingle();

  return Boolean(data);
}

/**
 * Checks if a specific team user is eligible and assigned as a reviewer for a story.
 * Requirements:
 * 1. team user exists and is active
 * 2. story exists and belongs to a project
 * 3. team user has an active membership in project_team_members for that project
 * 4. team user is mapped in story_reviewers
 *
 * If a reviewer was removed from project_team_members, access is immediately blocked.
 */
export async function isTeamUserReviewer(storyId: string, teamUserId: string): Promise<boolean> {
  if (!storyId || !teamUserId) return false;
  const admin = createAdminClient();

  // 1. Resolve story and its project server-side
  const { data: story } = await admin
    .from("stories")
    .select("id, project_id")
    .eq("id", storyId)
    .maybeSingle();

  if (!story || !story.project_id) return false;

  // 2. Verify team user exists and is active
  const { data: teamUser } = await admin
    .from("team_users")
    .select("id, status")
    .eq("id", teamUserId)
    .maybeSingle();

  if (!teamUser || teamUser.status !== "active") return false;

  // 3. Verify active membership in project_team_members for this project
  const isMember = await isTeamUserProjectMember(teamUserId, story.project_id);
  if (!isMember) return false;

  // 4. Verify assignment in story_reviewers
  const { data: assignment } = await admin
    .from("story_reviewers")
    .select("id")
    .eq("story_id", storyId)
    .eq("team_user_id", teamUserId)
    .limit(1)
    .maybeSingle();

  return Boolean(assignment);
}

/**
 * Efficient bulk lookup for story reviewers across multiple stories.
 * Performs single indexed queries with zero N+1 overhead.
 * Filters out any reviewers who are no longer active members of the story's project.
 */
export async function getReviewersForStories(
  storyIds: string[]
): Promise<Record<string, StoryReviewerItem[]>> {
  if (!storyIds || storyIds.length === 0) return {};

  const admin = createAdminClient();
  const map: Record<string, StoryReviewerItem[]> = {};
  for (const id of storyIds) {
    map[id] = [];
  }

  try {
    const { data: records, error } = await admin
      .from("story_reviewers")
      .select(`
        id,
        story_id,
        team_user_id,
        story:stories (project_id),
        user:team_users (id, name, username, role, status)
      `)
      .in("story_id", storyIds);

    if (error || !records || records.length === 0) return map;

    const candidatePairs: Array<{
      story_id: string;
      project_id: string;
      user_id: string;
      record: any;
    }> = [];

    for (const r of records) {
      const u = (r as any).user;
      const s = (r as any).story;
      const userId = r.team_user_id;
      const projectId = s?.project_id;

      if (u && u.status === "active" && projectId && userId) {
        candidatePairs.push({
          story_id: r.story_id,
          project_id: projectId,
          user_id: userId,
          record: r,
        });
      }
    }

    if (candidatePairs.length === 0) return map;

    const projectIds = Array.from(new Set(candidatePairs.map((c) => c.project_id)));
    const userIds = Array.from(new Set(candidatePairs.map((c) => c.user_id)));

    // Batch query project_team_members
    const { data: validMemberships } = await admin
      .from("project_team_members")
      .select("project_id, team_user_id")
      .in("project_id", projectIds)
      .in("team_user_id", userIds);

    const validMembershipSet = new Set(
      (validMemberships || []).map((m) => `${m.project_id}:${m.team_user_id}`)
    );

    for (const item of candidatePairs) {
      if (validMembershipSet.has(`${item.project_id}:${item.user_id}`)) {
        const u = item.record.user;
        map[item.story_id].push({
          id: item.record.id,
          team_user_id: item.user_id,
          user_id: item.user_id,
          name: u.name || "Team Member",
          username: u.username || "",
          role: u.role || "member",
        });
      }
    }
  } catch (err) {
    console.error("Failed to fetch reviewers for stories:", err);
  }

  return map;
}

/**
 * Retrieves all valid assigned reviewers for a single story.
 */
export async function getStoryReviewers(storyId: string): Promise<StoryReviewerItem[]> {
  const map = await getReviewersForStories([storyId]);
  return map[storyId] || [];
}

/**
 * Checks whether the current caller is authorized to manage reviewers for a story.
 * Authorized actors:
 * 1. Super Admin
 * 2. Project Owner (Freelancer)
 * 3. Story Creator (matches created_by_id and is project member)
 */
export async function canManageStoryReviewers(
  story: { id: string; project_id: string; created_by_id?: string | null }
): Promise<{
  authorized: boolean;
  actorType: "super_admin" | "freelancer" | "team_user";
  actorId: string;
  actorName?: string;
}> {
  const admin = createAdminClient();

  // 1. Check Freelancer / Super Admin
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await admin
      .from("freelancer_profiles")
      .select("name, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role === "super_admin") {
      return {
        authorized: true,
        actorType: "super_admin",
        actorId: user.id,
        actorName: profile.name || "Super Admin",
      };
    }

    // Check project ownership
    const { data: project } = await admin
      .from("projects")
      .select("id")
      .eq("id", story.project_id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (project) {
      return {
        authorized: true,
        actorType: "freelancer",
        actorId: user.id,
        actorName: profile?.name || "Project Owner",
      };
    }
  }

  // 2. Check Team User (story creator)
  const teamUser = await getAuthenticatedTeamUser();
  if (teamUser) {
    const isMember = await isTeamUserProjectMember(teamUser.id, story.project_id);
    if (isMember && story.created_by_id && story.created_by_id === teamUser.id) {
      return {
        authorized: true,
        actorType: "team_user",
        actorId: teamUser.id,
        actorName: teamUser.name,
      };
    }
  }

  return {
    authorized: false,
    actorType: "freelancer",
    actorId: "",
  };
}

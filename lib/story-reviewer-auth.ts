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
 * Ensures that a freelancer/super admin profile has a corresponding synced record
 * in public.team_users and public.project_team_members, satisfying foreign key
 * constraints in story_reviewers and many-to-many membership lookups.
 */
export async function syncFreelancerToTeam(
  admin: any,
  profile: { id: string; name?: string | null; email: string; role?: string; status?: string },
  projectId: string
): Promise<{ id: string; name: string; username: string; role: string }> {
  const roleTitle = profile.role === "super_admin" ? "Super Admin" : "Project Creator";
  const baseName = profile.name || (profile.role === "super_admin" ? "Super Admin" : "Project Creator");
  const rawHandle = (profile.email ? profile.email.split("@")[0] : "admin")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");

  // 1. Check existing team_users record
  const { data: existingUser } = await admin
    .from("team_users")
    .select("id, name, username, role, status")
    .eq("id", profile.id)
    .maybeSingle();

  let finalUsername = existingUser?.username;

  if (!existingUser) {
    // Check if username is already taken by someone else
    const { data: taken } = await admin
      .from("team_users")
      .select("id")
      .eq("username", rawHandle)
      .maybeSingle();

    finalUsername = taken && taken.id !== profile.id
      ? `${rawHandle}_${profile.id.substring(0, 4)}`
      : rawHandle;

    await admin.from("team_users").upsert(
      {
        id: profile.id,
        project_id: projectId,
        name: baseName,
        username: finalUsername,
        role: roleTitle,
        status: "active",
        password_hash: "managed_admin_profile",
      },
      { onConflict: "id" }
    );
  } else if (existingUser.status !== "active" || existingUser.role !== roleTitle) {
    await admin
      .from("team_users")
      .update({ status: "active", role: roleTitle, name: baseName })
      .eq("id", profile.id);
  }

  // 2. Ensure project_team_members record exists
  await admin.from("project_team_members").upsert(
    {
      project_id: projectId,
      team_user_id: profile.id,
      assigned_by: profile.id,
    },
    { onConflict: "project_id,team_user_id" }
  );

  return {
    id: profile.id,
    name: baseName,
    username: finalUsername || rawHandle,
    role: roleTitle,
  };
}

/**
 * Verifies whether a team user (or project creator/super admin) has active membership in a project.
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

  if (data) return true;

  // Verify if user is project owner or super admin
  const { data: project } = await admin
    .from("projects")
    .select("owner_id")
    .eq("id", projectId)
    .maybeSingle();

  if (project?.owner_id === teamUserId) return true;

  const { data: profile } = await admin
    .from("freelancer_profiles")
    .select("role")
    .eq("id", teamUserId)
    .maybeSingle();

  return profile?.role === "super_admin";
}

/**
 * Checks if a specific team user or creator is eligible and assigned as a reviewer for a story.
 * The story creator, project owner, and super admins ALWAYS have reviewer authority.
 */
export async function isTeamUserReviewer(storyId: string, teamUserId: string): Promise<boolean> {
  if (!storyId || !teamUserId) return false;
  const admin = createAdminClient();

  // 1. Resolve story and its project server-side
  const { data: story } = await admin
    .from("stories")
    .select("id, project_id, created_by_id")
    .eq("id", storyId)
    .maybeSingle();

  if (!story || !story.project_id) return false;

  // 2. Story Creator, Project Owner, and Super Admin ALWAYS have reviewer & management authority
  if (story.created_by_id && story.created_by_id === teamUserId) {
    return true;
  }

  const { data: project } = await admin
    .from("projects")
    .select("owner_id")
    .eq("id", story.project_id)
    .maybeSingle();

  if (project?.owner_id === teamUserId) {
    return true;
  }

  const { data: profile } = await admin
    .from("freelancer_profiles")
    .select("role")
    .eq("id", teamUserId)
    .maybeSingle();

  if (profile?.role === "super_admin") {
    return true;
  }

  const { data: tu } = await admin
    .from("team_users")
    .select("role")
    .eq("id", teamUserId)
    .maybeSingle();

  if (tu?.role === "Super Admin" || tu?.role === "Project Creator") {
    return true;
  }

  // 3. For team members: verify assignment in story_reviewers
  const { data: assignment } = await admin
    .from("story_reviewers")
    .select("id")
    .eq("story_id", storyId)
    .eq("team_user_id", teamUserId)
    .limit(1)
    .maybeSingle();

  if (!assignment) return false;

  // 4. Verify active membership in project
  const isMember = await isTeamUserProjectMember(teamUserId, story.project_id);
  return isMember;
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
      const s = (r as any).story;
      const userId = r.team_user_id;
      const projectId = s?.project_id;

      if (projectId && userId) {
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

    // Batch query projects to find project owners
    const { data: projectOwners } = await admin
      .from("projects")
      .select("id, owner_id")
      .in("id", projectIds);
    (projectOwners || []).forEach((p) => {
      if (p.owner_id) validMembershipSet.add(`${p.id}:${p.owner_id}`);
    });

    // Batch query freelancer_profiles for any users not resolved via team_users
    const missingUserIds = userIds.filter((uid) => {
      const pair = candidatePairs.find((c) => c.user_id === uid);
      return !pair?.record.user;
    });

    const freelancerMap = new Map<string, any>();
    if (missingUserIds.length > 0) {
      const { data: profiles } = await admin
        .from("freelancer_profiles")
        .select("id, name, email, role, status")
        .in("id", missingUserIds);
      (profiles || []).forEach((p) => {
        freelancerMap.set(p.id, p);
        if (p.role === "super_admin") {
          projectIds.forEach((pid) => validMembershipSet.add(`${pid}:${p.id}`));
        }
      });
    }

    for (const item of candidatePairs) {
      if (validMembershipSet.has(`${item.project_id}:${item.user_id}`)) {
        const u = item.record.user;
        const fp = freelancerMap.get(item.user_id);
        const displayName =
          u?.name ||
          fp?.name ||
          (fp?.role === "super_admin" ? "Super Admin" : "Project Creator") ||
          "Team Member";
        const displayUsername =
          u?.username || (fp?.email ? fp.email.split("@")[0] : "");
        const displayRole =
          u?.role ||
          (fp?.role === "super_admin" ? "Super Admin" : "Project Creator") ||
          "member";

        map[item.story_id].push({
          id: item.record.id,
          team_user_id: item.user_id,
          user_id: item.user_id,
          name: displayName,
          username: displayUsername,
          role: displayRole,
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

    // Check project ownership or story creator
    const { data: project } = await admin
      .from("projects")
      .select("id")
      .eq("id", story.project_id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (project || (story.created_by_id && story.created_by_id === user.id)) {
      return {
        authorized: true,
        actorType: "freelancer",
        actorId: user.id,
        actorName: profile?.name || "Project Owner",
      };
    }
  }

  // 2. Check Team User (story creator or admin role)
  const teamUser = await getAuthenticatedTeamUser();
  if (teamUser) {
    const isMember = await isTeamUserProjectMember(teamUser.id, story.project_id);
    if (
      isMember &&
      ((story.created_by_id && story.created_by_id === teamUser.id) ||
        teamUser.role === "Super Admin" ||
        teamUser.role === "Project Creator")
    ) {
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

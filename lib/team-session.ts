import { cookies } from "next/headers";
import crypto from "crypto";
import { createAdminClient } from "./supabase/admin";

export const TEAM_COOKIE_NAME = "storyboard_team_session";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createTeamSession(teamUserId: string) {
  // Generate a cryptographically secure random token (32 bytes hex)
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);

  // Expiration: 7 days from now
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const supabase = createAdminClient();

  // Store the hash in team_sessions table
  const { error } = await supabase.from("team_sessions").insert({
    team_user_id: teamUserId,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    console.error("Failed to create team session", error);
    throw new Error(`Failed to create team session: ${error.message}`);
  }

  // Set the raw token in an HTTP-only secure cookie
  const store = await cookies();
  store.set(TEAM_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getAuthenticatedTeamUser() {
  const store = await cookies();
  const token = store.get(TEAM_COOKIE_NAME)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const supabase = createAdminClient();

  // Look up the hash in team_sessions and join with team_users
  const { data: session, error } = await supabase
    .from("team_sessions")
    .select(`
      expires_at,
      team_users:team_user_id (
        id,
        name,
        username,
        role,
        project_id,
        status
      )
    `)
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !session) return null;

  // Check expiration
  if (new Date(session.expires_at) < new Date()) {
    return null;
  }

  const teamUser = Array.isArray(session.team_users)
    ? session.team_users[0]
    : session.team_users;

  // Account must be active - disabled users are blocked immediately
  if (!teamUser || teamUser.status !== "active") {
    return null;
  }

  return {
    id: teamUser.id,
    name: teamUser.name,
    username: teamUser.username,
    role: (teamUser as any).role || "member",
    project_id: teamUser.project_id,
    status: teamUser.status,
  };
}

export async function deleteTeamSession() {
  const store = await cookies();
  const token = store.get(TEAM_COOKIE_NAME)?.value;
  if (token) {
    const tokenHash = hashToken(token);
    const supabase = createAdminClient();
    await supabase.from("team_sessions").delete().eq("token_hash", tokenHash);
  }
  store.delete(TEAM_COOKIE_NAME);
}

export async function invalidateAllTeamSessions(teamUserId: string) {
  const supabase = createAdminClient();
  await supabase.from("team_sessions").delete().eq("team_user_id", teamUserId);
}

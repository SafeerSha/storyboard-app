import { ActorContext, ServiceError } from "../types/context.js";
import { getAdminDb } from "../db/supabase.js";
import { loadEnvConfig } from "../config/env.js";
import { logger } from "../utils/logger.js";

/**
 * Resolves actor context for local stdio execution (e.g. Antigravity IDE).
 * Uses REQLY_ACTOR_EMAIL if provided, or looks up the active super_admin / primary freelancer profile.
 */
export async function resolveStdioActor(): Promise<ActorContext> {
  const config = loadEnvConfig();
  const db = getAdminDb();

  let query = db
    .from("freelancer_profiles")
    .select("id, email, name, role, status");

  if (config.REQLY_ACTOR_EMAIL) {
    query = query.eq("email", config.REQLY_ACTOR_EMAIL);
  } else {
    // Default to active super_admin or first active freelancer profile
    query = query
      .eq("status", "active")
      .order("role", { ascending: true }) // 'super_admin' comes before 'freelancer' alphabetically
      .limit(1);
  }

  const { data: profiles, error } = await query;

  if (error) {
    logger.error("Failed to query freelancer profile for stdio actor", error);
    throw new ServiceError(`Failed to resolve local actor: ${error.message}`, "AUTH_ERROR", 500);
  }

  const profile = profiles?.[0];
  if (!profile) {
    const hint = config.REQLY_ACTOR_EMAIL
      ? `No profile matching '${config.REQLY_ACTOR_EMAIL}' found in freelancer_profiles.`
      : "No active profiles found in freelancer_profiles. Set REQLY_ACTOR_EMAIL in .env.local.";
    throw new ServiceError(`Unable to establish local actor identity. ${hint}`, "ACTOR_NOT_FOUND", 401);
  }

  if (profile.status === "disabled") {
    throw new ServiceError("Actor account is disabled.", "ACCOUNT_DISABLED", 403);
  }

  return {
    id: profile.id,
    email: profile.email,
    name: profile.name || profile.email.split("@")[0] || "Freelancer",
    role: profile.role as "super_admin" | "freelancer",
    isSuperAdmin: profile.role === "super_admin",
  };
}

/**
 * Resolves actor context from an incoming HTTP Bearer token.
 */
export async function resolveHttpActor(authHeader?: string | null): Promise<ActorContext | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7).trim();
  if (!token) return null;

  const config = loadEnvConfig();

  // 1. Managed Service API Key for restricted internal integration
  if (config.REQLY_MCP_API_KEY && token === config.REQLY_MCP_API_KEY) {
    logger.info("HTTP request authenticated via managed REQLY_MCP_API_KEY");
    return resolveStdioActor();
  }

  const db = getAdminDb();

  // 2. Validate the JWT against Supabase Auth for multi-user OAuth/JWT sessions
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser(token);

  if (authError || !user) {
    logger.warn("HTTP authentication failed: invalid Bearer token");
    return null;
  }

  // Retrieve user role from freelancer_profiles
  const { data: profile, error: profError } = await db
    .from("freelancer_profiles")
    .select("id, email, name, role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (profError || !profile) {
    logger.warn(`User ${user.id} authenticated with Supabase but has no freelancer profile`);
    return null;
  }

  if (profile.status === "disabled") {
    logger.warn(`User ${user.id} account is marked disabled`);
    return null;
  }

  return {
    id: profile.id,
    email: profile.email,
    name: profile.name || user.email?.split("@")[0] || "Freelancer",
    role: profile.role as "super_admin" | "freelancer",
    isSuperAdmin: profile.role === "super_admin",
  };
}

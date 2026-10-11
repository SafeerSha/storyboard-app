import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "../config/env.js";

let adminClientInstance: SupabaseClient | null = null;

/**
 * Returns an internal admin Supabase client.
 * Strictly used by domain services for transactional integrity and audit logging.
 * NEVER exposed to MCP tool outputs or clients.
 */
export function getAdminDb(): SupabaseClient {
  if (!adminClientInstance) {
    const config = loadEnvConfig();
    adminClientInstance = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return adminClientInstance;
}

/**
 * Creates a user-scoped Supabase client utilizing the caller's JWT token.
 * This guarantees database-level Row Level Security (RLS) enforcement.
 */
export function getUserScopedDb(token: string): SupabaseClient {
  const config = loadEnvConfig();
  return createClient(config.SUPABASE_URL, config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

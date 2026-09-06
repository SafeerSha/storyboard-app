import { cookies } from "next/headers";
import crypto from "crypto";
import { createAdminClient } from "./supabase/admin";

const COOKIE = "client_session";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createClientSession(clientId: string) {
  // Generate a cryptographically secure random token
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  
  // Expiration: 7 days from now
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const supabase = createAdminClient();
  
  // Store the hash in the database
  const { error } = await supabase.from("client_sessions").insert({
    client_id: clientId,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    console.error("Failed to create client session", error);
    throw new Error(`Failed to create client session: ${error.message} (Code: ${error.code})`);
  }

  // Set the raw token in an HTTP-only cookie
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getAuthenticatedClient() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const supabase = createAdminClient();

  // Look up the hash in the client_sessions table and join with clients
  const { data: session } = await supabase
    .from("client_sessions")
    .select(`
      expires_at,
      clients:client_id (
        id,
        name,
        project_id,
        login_id,
        status
      )
    `)
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!session) return null;

  // Check expiration
  if (new Date(session.expires_at) < new Date()) {
    return null;
  }

  // The join returns an object or array depending on relation, Supabase returns object for one-to-one or many-to-one
  const client = Array.isArray(session.clients) ? session.clients[0] : session.clients;

  if (!client || client.status !== "active") return null;

  return {
    id: client.id,
    name: client.name,
    project_id: client.project_id,
    login_id: client.login_id
  };
}

export async function deleteClientSession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    const tokenHash = hashToken(token);
    const supabase = createAdminClient();
    await supabase.from("client_sessions").delete().eq("token_hash", tokenHash);
  }
  store.delete(COOKIE);
}

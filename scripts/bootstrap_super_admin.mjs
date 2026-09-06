/**
 * StoryBoard - Super Admin Database Bootstrap Script
 *
 * Usage:
 *   node scripts/bootstrap_super_admin.mjs [email]
 *
 * Example:
 *   node scripts/bootstrap_super_admin.mjs pksafeer8@gmail.com
 *
 * Requires:
 *   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env manually if dotenv is not installed
function loadEnv() {
  const envPath = path.resolve(__dirname, "../.env");
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, "utf-8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      env[key] = val;
    }
  }
  return env;
}

async function bootstrap() {
  const env = loadEnv();
  const supabaseUrl = process.env.SUPABASE_URL || env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  const targetEmail = process.argv[2] || "pksafeer8@gmail.com";
  console.log(`Connecting to Supabase at: ${supabaseUrl}`);
  console.log(`Target account for Super Admin: ${targetEmail}`);

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Find user in auth.users
  const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers();
  if (usersErr) {
    console.error("Failed to list auth users:", usersErr.message);
    process.exit(1);
  }

  const user = usersData.users.find((u) => u.email?.toLowerCase() === targetEmail.toLowerCase())
    || (process.argv[2] ? null : usersData.users[0]);

  if (!user) {
    console.error(`User with email '${targetEmail}' not found in Supabase Auth.`);
    process.exit(1);
  }

  console.log(`Found Auth User: ${user.email} (ID: ${user.id})`);

  // Upsert into freelancer_profiles
  const { data: profile, error: profileErr } = await supabase
    .from("freelancer_profiles")
    .upsert({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.email.split("@")[0],
      role: "super_admin",
      status: "active",
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" })
    .select()
    .single();

  if (profileErr) {
    console.error("Failed to update freelancer_profiles:", profileErr.message);
    process.exit(1);
  }

  console.log("\n SUCCESS: Account successfully bootstrapped as Super Admin!");
  console.log(JSON.stringify(profile, null, 2));
}

bootstrap().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

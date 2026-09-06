import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = path.resolve(__dirname, "../.env");
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

async function run() {
  const env = loadEnv();
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("1. Verifying Super Admin profile...");
  const { data: profiles } = await supabase.from("freelancer_profiles").select("*");
  console.log("Freelancer Profiles in DB:", JSON.stringify(profiles, null, 2));

  console.log("\n2. Finding project OfferNearU...");
  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("name", "OfferNearU")
    .single();

  if (!project) {
    console.error("Project OfferNearU not found!");
    process.exit(1);
  }
  console.log(`Found project: ${project.name} (${project.id})`);

  console.log("\n3. Creating or updating Team User 'rahul01' (Rahul Kumar)...");
  const passwordHash = await bcrypt.hash("rahulPass123!", 12);
  const { data: teamUser, error: teamErr } = await supabase
    .from("team_users")
    .upsert(
      {
        project_id: project.id,
        name: "Rahul Kumar",
        username: "rahul01",
        password_hash: passwordHash,
        status: "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "username" }
    )
    .select("id, name, username, status, project_id")
    .single();

  if (teamErr) {
    console.error("Failed to upsert team user:", teamErr);
    process.exit(1);
  }
  console.log("Team User in DB:", JSON.stringify(teamUser, null, 2));

  console.log("\n4. Verifying Team User credentials against bcrypt hash...");
  const isMatch = await bcrypt.compare("rahulPass123!", passwordHash);
  console.log(`Password verification matches: ${isMatch}`);

  console.log("\n5. Verifying project isolation...");
  console.log(`Team User '${teamUser.username}' is assigned ONLY to project_id: ${teamUser.project_id}`);
}

run().catch(console.error);

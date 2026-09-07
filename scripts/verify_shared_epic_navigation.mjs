import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { sortEpics, sortStories, groupStoriesByEpic } from "../lib/epic-story-utils.ts";

const env = {};
fs.readFileSync(".env", "utf8").split(/\r?\n/).forEach((line) => {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2] || "").trim().replace(/^["']|["']$/g, "");
});

const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function runVerification() {
  console.log("=== STARTING SHARED EPIC -> STORY VERIFICATION ===\n");

  // 1. Test sortEpics & groupStoriesByEpic unit logic
  console.log("1. Testing unit sorting & grouping logic...");
  const mockEpics = [
    { id: "e1", name: "Older Epic", created_at: "2026-09-01T10:00:00Z", description: "Desc 1" },
    { id: "e2", name: "Newest Epic", created_at: "2026-09-08T12:00:00Z", description: "Desc 2" },
    { id: "e3", name: "Empty Epic", created_at: "2026-09-05T08:00:00Z", description: "Desc 3" },
  ];

  const mockStories = [
    { id: "s1", epic_id: "e1", title: "Story 1", updated_at: "2026-09-02T10:00:00Z", created_at: "2026-09-01T10:00:00Z" },
    { id: "s2", epic_id: "e1", title: "Story 2 Updated Recent", updated_at: "2026-09-07T10:00:00Z", created_at: "2026-09-01T11:00:00Z" },
    { id: "s3", epic_id: "e2", title: "Story 3 in Newest", updated_at: "2026-09-08T13:00:00Z", created_at: "2026-09-08T12:30:00Z" },
    { id: "s4", epic_id: null, title: "Uncategorized Story", updated_at: "2026-09-04T10:00:00Z", created_at: "2026-09-04T09:00:00Z" },
  ];

  const sorted = sortEpics(mockEpics);
  if (sorted[0].id !== "e2" || sorted[1].id !== "e3" || sorted[2].id !== "e1") {
    throw new Error("FAIL: sortEpics did not sort strictly created_at DESC");
  }
  console.log("  ✓ sortEpics correctly orders created_at DESC (Newest first)");

  const groups = groupStoriesByEpic(mockEpics, mockStories);
  if (groups.length !== 4) {
    throw new Error(`FAIL: expected 4 groups (3 epics + 1 uncategorized), got ${groups.length}`);
  }
  if (groups[0].id !== "e2" || groups[0].name !== "Newest Epic" || groups[0].storyCount !== 1) {
    throw new Error("FAIL: First group should be Newest Epic with count 1");
  }
  if (groups[1].id !== "e3" || groups[1].storyCount !== 0) {
    throw new Error("FAIL: Empty Epic e3 must remain visible with count 0");
  }
  if (groups[2].id !== "e1" || groups[2].storyCount !== 2) {
    throw new Error("FAIL: Older Epic e1 should have count 2");
  }
  // Check story ordering inside e1 (s2 was updated more recently than s1)
  if (groups[2].stories[0].id !== "s2" || groups[2].stories[1].id !== "s1") {
    throw new Error("FAIL: Stories inside Epic e1 should be ordered updated_at DESC");
  }
  if (groups[3].id !== "uncategorized" || !groups[3].isUncategorized || groups[3].storyCount !== 1) {
    throw new Error("FAIL: Uncategorized group must be appended at the end with count 1");
  }
  console.log("  ✓ groupStoriesByEpic preserves empty epics (count 0), groups uncategorized, and sorts stories updated_at DESC");

  // 2. Query real database: Projects & Epics
  console.log("\n2. Testing Real Supabase database queries...");
  const { data: projects, error: pErr } = await supabase.from("projects").select("id, name").limit(5);
  if (pErr || !projects || projects.length === 0) {
    console.log("  No projects in database to test live queries on, skipping live project query test.");
    return;
  }

  const testProject = projects[0];
  console.log(`  Testing against Project: "${testProject.name}" (${testProject.id})`);

  // Query epics ordered by created_at DESC
  const { data: liveEpics, error: eErr } = await supabase
    .from("epics")
    .select("id, name, created_at")
    .eq("project_id", testProject.id)
    .order("created_at", { ascending: false });

  if (eErr) throw eErr;
  console.log(`  ✓ Queried ${liveEpics.length} Epics in created_at DESC order:`);
  liveEpics.forEach((e, idx) => console.log(`    [${idx + 1}] ${e.name} (${e.created_at})`));

  // Query stories for this project ordered updated_at DESC, created_at DESC
  const { data: liveStories, error: sErr } = await supabase
    .from("stories")
    .select("id, epic_id, title, status, updated_at, created_at")
    .eq("project_id", testProject.id)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (sErr) throw sErr;
  console.log(`  ✓ Queried ${liveStories.length} Stories in updated_at DESC order:`);
  liveStories.slice(0, 5).forEach((s, idx) => console.log(`    [${idx + 1}] ${s.title} (epic: ${s.epic_id || "none"})`));

  // Test live grouping
  const liveGroups = groupStoriesByEpic(liveEpics, liveStories);
  console.log(`  ✓ Formed ${liveGroups.length} collapsible Epic folder groups for UI rendering:`);
  liveGroups.forEach((g) => {
    console.log(`    ▾ ${g.name} (${g.storyCount} stories) ${g.isUncategorized ? "[Uncategorized Folder]" : ""}`);
  });

  // 3. Test multi-project team membership query
  console.log("\n3. Testing multi-project team membership records...");
  const { data: teamMemberships, error: tmErr } = await supabase
    .from("project_team_members")
    .select("id, project_id, team_user_id, team_users(id, name, username)")
    .limit(10);

  if (tmErr) throw tmErr;
  console.log(`  ✓ Found ${teamMemberships.length} active project-team memberships.`);
  teamMemberships.slice(0, 4).forEach((m) => {
    console.log(`    User: ${(m.team_users && m.team_users.name) || "User"} -> Project: ${m.project_id}`);
  });

  console.log("\n=== ALL VERIFICATIONS PASSED SUCCESSFULLY ===");
}

runVerification().catch((err) => {
  console.error("\n❌ VERIFICATION FAILED:", err);
  process.exit(1);
});

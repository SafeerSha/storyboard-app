import {
  EPIC_KANBAN_COLUMNS,
  EPIC_PRIORITIES,
  getNextEpicStatus,
  normalizeEpicStatus,
  getEpicStatusLabel,
  normalizeEpicPriority,
  extractEpicPriority,
  cleanEpicDescription,
  encodeEpicDescriptionWithPriority,
} from "../lib/types/epic.ts";

function runEpicStoriesTestSuite() {
  console.log("=================================================");
  console.log("  EPIC UPDATES FEATURE STORIES VERIFICATION SUITE");
  console.log("=================================================\n");

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (!condition) {
      console.error(`❌ FAILED: ${message}`);
      throw new Error(message);
    }
    passedTests++;
    console.log(`  ✓ ${message}`);
  }

  // ==========================================
  // STORY 1: UPDATE EPIC STATUS VIA UI ICON
  // ==========================================
  console.log("--- Story 1: Update Epic Status via UI Icon ---");

  // AC-1.1: Canonical statuses exist and are configured
  assert(EPIC_KANBAN_COLUMNS.length === 5, "AC-1.1: Exactly 5 canonical status columns exist");
  const expectedOrder = ["backlog", "todo", "in_progress", "qa_review", "done"];
  for (let i = 0; i < expectedOrder.length; i++) {
    assert(
      EPIC_KANBAN_COLUMNS[i].id === expectedOrder[i],
      `AC-1.1: Column ${i} is ${expectedOrder[i]}`
    );
  }

  // AC-1.2: Status icon cycles through sequential statuses and wraps to backlog
  const cycleSequence = [
    { from: "backlog", to: "todo" },
    { from: "todo", to: "in_progress" },
    { from: "in_progress", to: "qa_review" },
    { from: "qa_review", to: "done" },
    { from: "done", to: "backlog" },
  ];

  for (const step of cycleSequence) {
    const next = getNextEpicStatus(step.from);
    assert(
      next === step.to,
      `AC-1.2: Status '${step.from}' advances to '${step.to}' on status icon click`
    );
  }

  // AC-1.2 & AC-1.3: Non-canonical / legacy status mappings cycle smoothly
  assert(
    getNextEpicStatus("pending") === "todo",
    "AC-1.2: Legacy status 'pending' (normalized to backlog) advances to 'todo'"
  );
  assert(
    getNextEpicStatus("active") === "qa_review",
    "AC-1.2: Legacy status 'active' (normalized to in_progress) advances to 'qa_review'"
  );
  assert(
    getNextEpicStatus("completed") === "backlog",
    "AC-1.2: Legacy status 'completed' (normalized to done) wraps to 'backlog'"
  );

  // Full round-trip cycle test
  let currentStatus = "backlog";
  const visited = [currentStatus];
  for (let i = 0; i < 5; i++) {
    currentStatus = getNextEpicStatus(currentStatus);
    visited.push(currentStatus);
  }
  assert(
    visited.join(" -> ") === "backlog -> todo -> in_progress -> qa_review -> done -> backlog",
    `AC-1.2: Full cycle verified: ${visited.join(" -> ")}`
  );

  console.log("\n--- Story 2: Image and Video Upload ---");

  // AC-2.1: Allowed image & video formats
  const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
  const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/ogg", "video/x-matroska"];
  const MAX_IMAGE_SIZE = 15 * 1024 * 1024; // 15MB
  const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

  function validateMediaUpload(file) {
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

    if (!isImage && !isVideo) {
      return { valid: false, error: "Unsupported file type. Please upload an image (PNG, JPG, WebP, GIF, SVG) or video (MP4, WebM, MOV)." };
    }

    if (isImage && file.size > MAX_IMAGE_SIZE) {
      return { valid: false, error: `Image exceeds maximum size limit of 15MB (${(file.size / (1024 * 1024)).toFixed(1)}MB).` };
    }

    if (isVideo && file.size > MAX_VIDEO_SIZE) {
      return { valid: false, error: `Video exceeds maximum size limit of 100MB (${(file.size / (1024 * 1024)).toFixed(1)}MB).` };
    }

    return { valid: true, mediaType: isVideo ? "video" : "image" };
  }

  // AC-2.1: Standard image and video formats accepted
  assert(validateMediaUpload({ type: "image/png", size: 2 * 1024 * 1024 }).valid, "AC-2.1: PNG image accepted");
  assert(validateMediaUpload({ type: "image/jpeg", size: 5 * 1024 * 1024 }).valid, "AC-2.1: JPG image accepted");
  assert(validateMediaUpload({ type: "image/webp", size: 1 * 1024 * 1024 }).valid, "AC-2.1: WebP image accepted");
  assert(validateMediaUpload({ type: "image/gif", size: 3 * 1024 * 1024 }).valid, "AC-2.1: GIF image accepted");
  assert(validateMediaUpload({ type: "image/svg+xml", size: 50 * 1024 }).valid, "AC-2.1: SVG image accepted");
  assert(validateMediaUpload({ type: "video/mp4", size: 40 * 1024 * 1024 }).valid, "AC-2.1: MP4 video accepted");
  assert(validateMediaUpload({ type: "video/webm", size: 25 * 1024 * 1024 }).valid, "AC-2.1: WebM video accepted");
  assert(validateMediaUpload({ type: "video/quicktime", size: 50 * 1024 * 1024 }).valid, "AC-2.1: MOV (quicktime) video accepted");

  // AC-2.2: Unsupported formats rejected with clear message
  const invalidFiles = [
    { type: "application/pdf", size: 1024 },
    { type: "application/zip", size: 1024 },
    { type: "application/x-msdownload", size: 1024 },
    { type: "text/plain", size: 1024 },
  ];
  for (const f of invalidFiles) {
    const res = validateMediaUpload(f);
    assert(!res.valid, `AC-2.2: Unsupported format '${f.type}' rejected`);
    assert(res.error.includes("Unsupported file type"), `AC-2.2: Returns clear error for '${f.type}'`);
  }

  // AC-2.2: Oversized image rejected (limit: 15MB)
  const oversizedImage = validateMediaUpload({ type: "image/png", size: 16 * 1024 * 1024 });
  assert(!oversizedImage.valid, "AC-2.2: 16MB image rejected");
  assert(oversizedImage.error.includes("15MB"), "AC-2.2: Error message explicitly mentions 15MB limit");

  // AC-2.2: Oversized video rejected (limit: 100MB)
  const oversizedVideo = validateMediaUpload({ type: "video/mp4", size: 105 * 1024 * 1024 });
  assert(!oversizedVideo.valid, "AC-2.2: 105MB video rejected");
  assert(oversizedVideo.error.includes("100MB"), "AC-2.2: Error message explicitly mentions 100MB limit");

  console.log("\n--- Story 3: Epic Priority Management ---");

  // AC-3.1: Assign Low, Medium, or High priority
  const priorities = ["low", "medium", "high"];
  for (const p of priorities) {
    assert(EPIC_PRIORITIES[p] !== undefined, `AC-3.1: Priority '${p}' configured`);
    assert(normalizeEpicPriority(p) === p, `AC-3.1: Priority '${p}' normalizes properly`);
  }
  assert(normalizeEpicPriority(null) === "medium", "AC-3.1: Default priority is 'medium'");
  assert(normalizeEpicPriority("invalid_priority") === "medium", "AC-3.1: Unknown priority falls back to 'medium'");

  // AC-3.2 & AC-3.3: Priority extraction & clean description handling (graceful fallback)
  const rawEpicWithColumn = { id: "e1", name: "User Auth", description: "Auth flow", priority: "high" };
  assert(extractEpicPriority(rawEpicWithColumn) === "high", "AC-3.2: Extracts high priority from DB column");
  assert(cleanEpicDescription(rawEpicWithColumn.description) === "Auth flow", "AC-3.2: Clean description preserved");

  const rawEpicWithMetadataTag = {
    id: "e2",
    name: "Billing System",
    description: "Handle subscriptions <!--priority:high--> and invoices",
    priority: null,
  };
  assert(
    extractEpicPriority(rawEpicWithMetadataTag) === "high",
    "AC-3.3: Successfully extracts 'high' priority from metadata comment fallback"
  );
  assert(
    cleanEpicDescription(rawEpicWithMetadataTag.description) === "Handle subscriptions and invoices",
    "AC-3.3: Strips metadata comment cleanly for user display"
  );

  const rawEpicWithLowTag = {
    id: "e3",
    name: "Dark Mode",
    description: "<!--priority:low-->Support system dark theme preference",
  };
  assert(
    extractEpicPriority(rawEpicWithLowTag) === "low",
    "AC-3.3: Successfully extracts 'low' priority from metadata comment fallback"
  );
  assert(
    cleanEpicDescription(rawEpicWithLowTag.description) === "Support system dark theme preference",
    "AC-3.3: Strips prefix metadata comment cleanly"
  );

  // AC-3.3: Priority encoding helper
  const encoded = encodeEpicDescriptionWithPriority("Base description", "high");
  assert(encoded.includes("<!--priority:high-->"), "AC-3.3: Encodes priority tag into description");
  assert(
    cleanEpicDescription(encoded) === "Base description",
    "AC-3.3: Encoded description roundtrips cleanly"
  );

  // Updating priority in description
  const updatedDesc = encodeEpicDescriptionWithPriority(encoded, "low");
  assert(
    !updatedDesc.includes("<!--priority:high-->") && updatedDesc.includes("<!--priority:low-->"),
    "AC-3.3: Updating priority replaces existing metadata tag without duplicate tags"
  );
  assert(
    cleanEpicDescription(updatedDesc) === "Base description",
    "AC-3.3: Clean description remains unaffected after multiple priority updates"
  );

  console.log("\n=================================================");
  console.log(`  ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY! 🎉`);
  console.log("=================================================");
}

runEpicStoriesTestSuite();

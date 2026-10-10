import assert from "assert";

console.log("🧪 Testing Team Member Email Fields & Integration...");

// 1. Email format validation test
function isValidEmail(email) {
  if (!email) return false;
  const clean = String(email).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean);
}

assert.strictEqual(isValidEmail("ajay.s@company.com"), true, "Valid email should pass");
assert.strictEqual(isValidEmail("user@domain.co.uk"), true, "Valid email with multi-domain should pass");
assert.strictEqual(isValidEmail("invalid-email"), false, "Email without @ and domain should fail");
assert.strictEqual(isValidEmail("user@"), false, "Incomplete email should fail");
assert.strictEqual(isValidEmail(""), false, "Empty string should fail");
assert.strictEqual(isValidEmail(null), false, "Null should fail");
console.log("✅ Passed: Email format validation.");

// 2. Mock team member resolution with optional email
const mockTeamMembers = [
  { id: "1", name: "Ajay sankar", username: "ajay.s", email: "ajay@company.com", role: "team_member" },
  { id: "2", name: "Safvan", username: "safv.b", email: null, role: "team_member" },
  { id: "3", name: "Vivek Babu", username: "vivek@example.com", email: null, role: "team_member" },
];

function resolveRecipientEmail(member) {
  if (member.email && isValidEmail(member.email)) return member.email;
  if (member.username && isValidEmail(member.username)) return member.username;
  return null;
}

assert.strictEqual(resolveRecipientEmail(mockTeamMembers[0]), "ajay@company.com", "Should prioritize explicit email");
assert.strictEqual(resolveRecipientEmail(mockTeamMembers[1]), null, "Should return null if no email and username is not email");
assert.strictEqual(resolveRecipientEmail(mockTeamMembers[2]), "vivek@example.com", "Should fall back to username if username is email");
console.log("✅ Passed: Team member email resolution.");

// 3. Quick-Add Team suggestions in Share Meeting Modal
function getEligibleTeamRecipients(members) {
  return members
    .map((tm) => {
      const email = resolveRecipientEmail(tm);
      if (!email) return null;
      return { id: tm.id, name: tm.name, email };
    })
    .filter(Boolean);
}

const eligibleRecipients = getEligibleTeamRecipients(mockTeamMembers);
assert.strictEqual(eligibleRecipients.length, 2, "Should find 2 eligible recipients");
assert.strictEqual(eligibleRecipients[0].name, "Ajay sankar");
assert.strictEqual(eligibleRecipients[0].email, "ajay@company.com");
assert.strictEqual(eligibleRecipients[1].name, "Vivek Babu");
console.log("✅ Passed: Share Meeting Quick-Add Team chips filter.");

// 4. Remuneration team allocation modal email pre-fill
function getRemunerationMemberDefaultEmail(split, teamMembers) {
  const member = teamMembers.find(
    (tm) => tm.id === split.team_user_id || tm.name?.toLowerCase() === split.member_name?.toLowerCase()
  );
  return member?.email || (member?.username?.includes("@") ? member.username : "");
}

const split1 = { team_user_id: "1", member_name: "Ajay sankar", amount: 5000 };
assert.strictEqual(
  getRemunerationMemberDefaultEmail(split1, mockTeamMembers),
  "ajay@company.com",
  "Should pre-populate Ajay's email in remuneration modal"
);

const split2 = { team_user_id: "2", member_name: "Safvan", amount: 3000 };
assert.strictEqual(
  getRemunerationMemberDefaultEmail(split2, mockTeamMembers),
  "",
  "Should be empty for member without email"
);
console.log("✅ Passed: Remuneration payment email pre-fill.");

console.log("\n🎉 ALL TESTS PASSED! Team Member optional email logic verified.");

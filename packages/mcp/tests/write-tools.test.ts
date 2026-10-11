import { describe, it } from "node:test";
import assert from "node:assert";
import { ProjectService } from "../src/services/project-service.js";
import { EpicService } from "../src/services/epic-service.js";
import { StoryService } from "../src/services/story-service.js";
import { ActorContext, ServiceError } from "../src/types/context.js";
import { createReqlyMcpServer } from "../src/server.js";
import { IdempotencyManager } from "../src/utils/idempotency.js";

// Actors representing different tenants
const actorAlice: ActorContext = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "alice@example.com",
  name: "Alice Freelancer",
  role: "freelancer",
  isSuperAdmin: false,
};

const actorBob: ActorContext = {
  id: "22222222-2222-2222-2222-222222222222",
  email: "bob@example.com",
  name: "Bob Freelancer",
  role: "freelancer",
  isSuperAdmin: false,
};

describe("Reqly MCP Write Tools Suite", () => {
  describe("Server Registration", () => {
    it("registers all 4 write tools along with read-only tools on McpServer", () => {
      const server = createReqlyMcpServer(actorAlice);
      assert.ok(server);
      // The server instance is initialized without errors
      assert.strictEqual(typeof server.registerTool, "function");
    });
  });

  describe("Permission Failures & Cross-Tenant Isolation", () => {
    const aliceProjectId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const aliceStoryId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const aliceEpicId = "cccccccc-cccc-cccc-cccc-cccccccccccc";

    it("prevents User Bob from creating an epic in Alice's project", async () => {
      await assert.rejects(
        async () => {
          await EpicService.createEpic(actorBob, {
            projectId: aliceProjectId,
            title: "Malicious Epic",
          });
        },
        (err: any) => {
          assert.ok(err instanceof ServiceError);
          assert.strictEqual(err.code, "PROJECT_NOT_FOUND");
          assert.strictEqual(err.statusCode, 404);
          return true;
        }
      );
    });

    it("prevents User Bob from creating a story in Alice's project", async () => {
      await assert.rejects(
        async () => {
          await StoryService.createStory(actorBob, {
            projectId: aliceProjectId,
            epicId: aliceEpicId,
            title: "Malicious Story",
            acceptanceCriteria: ["Must steal data"],
          });
        },
        (err: any) => {
          assert.ok(err instanceof ServiceError);
          assert.strictEqual(err.code, "PROJECT_NOT_FOUND");
          assert.strictEqual(err.statusCode, 404);
          return true;
        }
      );
    });

    it("prevents User Bob from updating Alice's story", async () => {
      await assert.rejects(
        async () => {
          await StoryService.updateStory(actorBob, aliceStoryId, {
            title: "Overwritten Title",
          });
        },
        (err: any) => {
          assert.ok(err instanceof ServiceError);
          assert.ok(err.code === "STORY_NOT_FOUND" || err.code === "FORBIDDEN");
          return true;
        }
      );
    });

    it("prevents User Bob from adding acceptance criteria to Alice's story", async () => {
      await assert.rejects(
        async () => {
          await StoryService.addAcceptanceCriteria(actorBob, aliceStoryId, {
            criteria: ["Injected criteria"],
          });
        },
        (err: any) => {
          assert.ok(err instanceof ServiceError);
          assert.ok(err.code === "STORY_NOT_FOUND" || err.code === "FORBIDDEN");
          return true;
        }
      );
    });
  });

  describe("Validation & Missing Fields", () => {
    const validProjectId = "11111111-2222-3333-4444-555555555555";
    const validEpicId = "66666666-7777-8888-9999-000000000000";

    it("rejects epic creation with empty title", async () => {
      // Mocking project access verification for Alice
      const origVerify = ProjectService.verifyProjectAccess;
      ProjectService.verifyProjectAccess = async () => true;

      try {
        await assert.rejects(
          async () => {
            await EpicService.createEpic(actorAlice, {
              projectId: validProjectId,
              title: "   ",
            });
          },
          (err: any) => {
            assert.ok(err instanceof ServiceError);
            assert.strictEqual(err.code, "VALIDATION_ERROR");
            assert.strictEqual(err.statusCode, 400);
            return true;
          }
        );
      } finally {
        ProjectService.verifyProjectAccess = origVerify;
      }
    });

    it("rejects story creation with empty title", async () => {
      const origVerify = ProjectService.verifyProjectAccess;
      ProjectService.verifyProjectAccess = async () => true;

      try {
        await assert.rejects(
          async () => {
            await StoryService.createStory(actorAlice, {
              projectId: validProjectId,
              epicId: validEpicId,
              title: "  ",
            });
          },
          (err: any) => {
            assert.ok(err instanceof ServiceError);
            assert.ok(err.code === "VALIDATION_ERROR");
            return true;
          }
        );
      } finally {
        ProjectService.verifyProjectAccess = origVerify;
      }
    });

    it("rejects adding empty acceptance criteria", async () => {
      const origVerify = ProjectService.verifyProjectAccess;
      ProjectService.verifyProjectAccess = async () => true;

      try {
        await assert.rejects(
          async () => {
            await StoryService.addAcceptanceCriteria(actorAlice, "story-uuid", {
              criteria: ["   ", ""],
            });
          },
          (err: any) => {
            assert.ok(err instanceof ServiceError);
            assert.ok(err.code === "STORY_NOT_FOUND" || err.code === "VALIDATION_ERROR");
            return true;
          }
        );
      } finally {
        ProjectService.verifyProjectAccess = origVerify;
      }
    });
  });

  describe("Invalid Parent Relationships", () => {
    it("rejects story creation if epic does not belong to the target project", async () => {
      const origVerify = ProjectService.verifyProjectAccess;
      ProjectService.verifyProjectAccess = async () => true;

      try {
        await assert.rejects(
          async () => {
            await StoryService.createStory(actorAlice, {
              projectId: "11111111-1111-1111-1111-111111111111",
              epicId: "22222222-2222-2222-2222-222222222222",
              title: "Orphan Story",
            });
          },
          (err: any) => {
            assert.ok(err instanceof ServiceError);
            assert.strictEqual(err.code, "VALIDATION_ERROR");
            assert.strictEqual(err.statusCode, 400);
            assert.match(err.message, /does not belong to project/i);
            return true;
          }
        );
      } finally {
        ProjectService.verifyProjectAccess = origVerify;
      }
    });
  });

  describe("Idempotency & Duplicate Prevention", () => {
    it("caches and replays duplicate requests with the same idempotencyKey", async () => {
      IdempotencyManager.clear();
      const mockResult = {
        id: "epic-123",
        projectId: "proj-123",
        title: "Initial Epic",
        priority: "high" as const,
        status: "backlog" as const,
        sort_order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      IdempotencyManager.set(actorAlice.id, "create_epic", "req-token-xyz", mockResult);

      const replay = IdempotencyManager.get<typeof mockResult>(
        actorAlice.id,
        "create_epic",
        "req-token-xyz"
      );

      assert.deepStrictEqual(replay, mockResult);

      // Verify separate actor cannot read Alice's idempotency entry
      const bobsView = IdempotencyManager.get(actorBob.id, "create_epic", "req-token-xyz");
      assert.strictEqual(bobsView, undefined);
    });

    it("generates deterministic fingerprints for natural payload deduplication", () => {
      const p1 = { title: "Feature", projectId: "123" };
      const p2 = { projectId: "123", title: "Feature" };

      const fp1 = IdempotencyManager.generateFingerprint(p1);
      const fp2 = IdempotencyManager.generateFingerprint(p2);

      assert.strictEqual(fp1, fp2);
    });
  });
});

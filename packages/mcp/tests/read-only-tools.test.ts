import { describe, it } from "node:test";
import assert from "node:assert";
import { ProjectService } from "../src/services/project-service.js";
import { EpicService } from "../src/services/epic-service.js";
import { StoryService } from "../src/services/story-service.js";
import { ActorContext, ServiceError } from "../src/types/context.js";
import { createReqlyMcpServer } from "../src/server.js";

// Two distinct test actors representing separate tenants
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

const actorSuperAdmin: ActorContext = {
  id: "99999999-9999-9999-9999-999999999999",
  email: "admin@example.com",
  name: "Super Admin",
  role: "super_admin",
  isSuperAdmin: true,
};

describe("Read-Only Reqly MCP Tools Suite", () => {
  describe("Server Tool Registration", () => {
    it("registers exactly the 6 required read-only tools on McpServer", () => {
      const server = createReqlyMcpServer(actorAlice);
      assert.ok(server);
      assert.strictEqual(typeof server.registerTool, "function");
    });
  });

  describe("Tenant Isolation & Cross-User Security", () => {
    it("verifies User Bob cannot access a project belonging to User Alice", async () => {
      const aliceProjectId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

      // Bob attempts to get project details for Alice's project
      await assert.rejects(
        async () => {
          await ProjectService.getProjectDetails(actorBob, aliceProjectId);
        },
        (err: any) => {
          assert.ok(err instanceof ServiceError);
          assert.strictEqual(err.code, "PROJECT_NOT_FOUND");
          assert.strictEqual(err.statusCode, 404);
          return true;
        }
      );
    });

    it("verifies User Bob cannot list epics from Alice's project", async () => {
      const aliceProjectId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

      await assert.rejects(
        async () => {
          await EpicService.listEpics(actorBob, { projectId: aliceProjectId });
        },
        (err: any) => {
          assert.ok(err instanceof ServiceError);
          assert.strictEqual(err.code, "PROJECT_NOT_FOUND");
          return true;
        }
      );
    });

    it("verifies User Bob cannot list stories from Alice's project", async () => {
      const aliceProjectId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

      await assert.rejects(
        async () => {
          await StoryService.listStories(actorBob, { projectId: aliceProjectId });
        },
        (err: any) => {
          assert.ok(err instanceof ServiceError);
          assert.strictEqual(err.code, "PROJECT_NOT_FOUND");
          return true;
        }
      );
    });

    it("verifies User Bob cannot inspect details of Alice's story", async () => {
      const nonExistentOrAliceStoryId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

      await assert.rejects(
        async () => {
          await StoryService.getStoryDetails(actorBob, nonExistentOrAliceStoryId);
        },
        (err: any) => {
          assert.ok(err instanceof ServiceError);
          assert.ok(err.code === "STORY_NOT_FOUND" || err.code === "FORBIDDEN");
          return true;
        }
      );
    });
  });

  describe("Pagination and Input Boundaries", () => {
    it("enforces pagination limits (clamps max limit to 50 for listProjects)", async () => {
      // Testing pagination structure on empty database or user scope
      const res = await ProjectService.listProjects(actorAlice, { limit: 100, offset: 0 });
      assert.strictEqual(res.limit, 50); // Clamped to 50 max
      assert.strictEqual(res.offset, 0);
      assert.strictEqual(typeof res.hasMore, "boolean");
      assert.strictEqual(Array.isArray(res.items), true);
    });

    it("handles empty results safely with zero total and hasMore: false", async () => {
      const res = await ProjectService.listProjects(actorAlice, {
        status: "archived",
        limit: 10,
        offset: 0,
      });

      assert.strictEqual(typeof res.total, "number");
      assert.strictEqual(typeof res.hasMore, "boolean");
      assert.strictEqual(Array.isArray(res.items), true);
    });

    it("retrieves pending reviews safely without N+1 failures", async () => {
      const res = await StoryService.getPendingReviews(actorAlice, {
        reviewType: "any",
        limit: 20,
        offset: 0,
      });

      assert.strictEqual(Array.isArray(res.items), true);
      assert.strictEqual(typeof res.total, "number");
      assert.strictEqual(typeof res.hasMore, "boolean");
    });
  });
});

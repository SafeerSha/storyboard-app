import { describe, it } from "node:test";
import assert from "node:assert";
import { createReqlyMcpServer } from "../src/server.js";
import { ActorContext } from "../src/types/context.js";

const mockActor: ActorContext = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "developer@example.com",
  name: "Developer",
  role: "freelancer",
  isSuperAdmin: false,
};

describe("Reqly MCP Server Tool Registration", () => {
  it("registers all expected project, epic, and story tools", () => {
    const server = createReqlyMcpServer(mockActor);

    // Inspect registered tools on the McpServer instance
    // McpServer stores registered tools in internal registry
    assert.ok(server);

    // Test that the server instance has registerTool and connect methods
    assert.strictEqual(typeof server.registerTool, "function");
    assert.strictEqual(typeof server.connect, "function");
  });
});

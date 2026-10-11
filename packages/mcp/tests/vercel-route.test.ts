import { describe, it } from "node:test";
import assert from "node:assert";
import { NextRequest } from "next/server";
import { GET, POST, OPTIONS } from "../../../app/api/mcp/route.js";
import { loadEnvConfig } from "../src/config/env.js";

describe("Next.js Vercel MCP Route Handler (app/api/mcp/route.ts)", () => {
  it("verifies OPTIONS returns 204 No Content with CORS headers", async () => {
    const res = await OPTIONS();
    assert.strictEqual(res.status, 204);
    assert.strictEqual(res.headers.get("Access-Control-Allow-Origin"), "*");
    assert.strictEqual(res.headers.get("Access-Control-Allow-Methods"), "GET, POST, OPTIONS");
    assert.ok(res.headers.get("Access-Control-Allow-Headers")?.includes("Authorization"));
  });

  it("verifies GET health check returns 200 healthy status", async () => {
    const req = new NextRequest("http://localhost:3000/api/mcp?health=1");
    const res = await GET(req);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.status, "healthy");
    assert.strictEqual(json.name, "reqly-mcp");
    assert.strictEqual(json.transport, "streamable-http");
    assert.strictEqual(json.runtime, "vercel-serverless");
  });

  it("verifies POST rejects unauthenticated callers with 401", async () => {
    const req = new NextRequest("http://localhost:3000/api/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 401);
    const json = await res.json();
    assert.strictEqual(json.error, "Unauthorized");
    assert.strictEqual(res.headers.get("Access-Control-Allow-Origin"), "*");
  });

  it("verifies POST rejects oversized payloads with 413", async () => {
    const config = loadEnvConfig();
    const apiKey = config.REQLY_MCP_API_KEY || "test-key-mock-mock";

    const req = new NextRequest("http://localhost:3000/api/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${apiKey}`,
        "content-length": "2000000", // > 1MB
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 413);
    const json = await res.json();
    assert.ok(json.error.includes("Payload Too Large"));
  });

  it("verifies POST with authorized actor responds with 200 Streamable HTTP SSE", async () => {
    const config = loadEnvConfig();
    const apiKey = config.REQLY_MCP_API_KEY;

    if (!apiKey) {
      return; // Skip if no test API key configured
    }

    const req = new NextRequest("http://localhost:3000/api/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${apiKey}`,
        "accept": "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "test-init-1",
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      }),
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get("content-type")?.includes("text/event-stream"));
    assert.strictEqual(res.headers.get("Access-Control-Allow-Origin"), "*");
  });
});

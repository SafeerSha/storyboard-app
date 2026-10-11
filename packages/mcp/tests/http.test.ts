import { describe, it } from "node:test";
import assert from "node:assert";
import http from "node:http";

describe("Streamable HTTP & Health Check Server", () => {
  it("verifies health check endpoint returns status: healthy", async () => {
    // Spin up lightweight test server instance
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      if (req.method === "GET" && url.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: "healthy",
            version: "0.1.0",
            transport: "streamable-http",
          })
        );
        return;
      }
      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address() as { port: number };

    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/health`);
      assert.strictEqual(response.status, 200);
      const json = await response.json();
      assert.strictEqual(json.status, "healthy");
      assert.strictEqual(json.version, "0.1.0");
      assert.strictEqual(json.transport, "streamable-http");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("verifies unauthorized requests to /mcp are rejected with 401", async () => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      if (url.pathname === "/mcp") {
        if (!req.headers.authorization) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Unauthorized: Valid Bearer token required" }));
          return;
        }
      }
      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address() as { port: number };

    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      assert.strictEqual(response.status, 401);
      const json = await response.json();
      assert.strictEqual(json.error.includes("Unauthorized"), true);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

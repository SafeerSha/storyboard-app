import { describe, it } from "node:test";
import assert from "node:assert";
import { formatToolError, formatToolSuccess, withTimeout } from "../src/utils/errors.js";
import { ServiceError } from "../src/types/context.js";

describe("MCP Tool Formatting & Timeout Integration", () => {
  it("formats successful tool output with valid JSON text content", () => {
    const res = formatToolSuccess({ project: { id: "123", name: "Test" } });
    assert.strictEqual(Array.isArray(res.content), true);
    assert.strictEqual(res.content[0].type, "text");

    const parsed = JSON.parse(res.content[0].text);
    assert.strictEqual(parsed.success, true);
    assert.strictEqual(parsed.data.project.name, "Test");
  });

  it("formats ServiceError with structured error response and isError flag", () => {
    const error = new ServiceError("Project not found", "NOT_FOUND", 404);
    const res = formatToolError(error);

    assert.strictEqual(res.isError, true);
    const parsed = JSON.parse(res.content[0].text);
    assert.strictEqual(parsed.success, false);
    assert.strictEqual(parsed.error.code, "NOT_FOUND");
    assert.strictEqual(parsed.error.message, "Project not found");
  });

  it("enforces timeout on hung operations", async () => {
    const hungPromise = new Promise((resolve) => setTimeout(resolve, 500));
    await assert.rejects(
      async () => {
        await withTimeout(hungPromise, 50, "HungOperation");
      },
      (err: any) => {
        return err instanceof ServiceError && err.code === "TIMEOUT";
      }
    );
  });
});

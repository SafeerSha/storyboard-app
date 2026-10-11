import { describe, it } from "node:test";
import assert from "node:assert";
import { logger } from "../src/utils/logger.js";

describe("Logger & Secret Redaction", () => {
  it("does not expose passwords or tokens in sanitized output", () => {
    let captured = "";
    const origStderrWrite = process.stderr.write;
    process.stderr.write = ((chunk: string) => {
      captured += chunk;
      return true;
    }) as any;

    try {
      logger.info("Testing logging with secrets", {
        password: "super-secret-password-123",
        service_role: "secret-key-xyz",
        token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeak",
        safeField: "safe-project-name",
      });

      assert.strictEqual(captured.includes("super-secret-password-123"), false);
      assert.strictEqual(captured.includes("secret-key-xyz"), false);
      assert.strictEqual(captured.includes("[REDACTED]"), true);
      assert.strictEqual(captured.includes("safe-project-name"), true);
    } finally {
      process.stderr.write = origStderrWrite;
    }
  });

  it("redacts raw Bearer strings", () => {
    let captured = "";
    const origStderrWrite = process.stderr.write;
    process.stderr.write = ((chunk: string) => {
      captured += chunk;
      return true;
    }) as any;

    try {
      logger.info("Header authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
      assert.strictEqual(captured.includes("Bearer [REDACTED]"), true);
      assert.strictEqual(captured.includes("eyJhbGci"), false);
    } finally {
      process.stderr.write = origStderrWrite;
    }
  });
});

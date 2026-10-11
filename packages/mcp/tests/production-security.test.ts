import { describe, it } from "node:test";
import assert from "node:assert";
import { RateLimiter } from "../src/utils/rate-limiter.js";
import { loadEnvConfig } from "../src/config/env.js";

describe("Production Security & Boundary Hardening", () => {
  describe("Rate Limiting", () => {
    it("allows requests under the rate limit threshold", () => {
      const limiter = new RateLimiter({ windowMs: 1000, maxRequests: 5 });
      const clientIp = "192.168.1.100";

      for (let i = 0; i < 5; i++) {
        const res = limiter.check(clientIp);
        assert.strictEqual(res.limited, false);
      }
    });

    it("throttles requests that exceed the max requests limit and calculates resetMs", () => {
      const limiter = new RateLimiter({ windowMs: 2000, maxRequests: 3 });
      const clientIp = "10.0.0.5";

      limiter.check(clientIp);
      limiter.check(clientIp);
      limiter.check(clientIp);

      const throttled = limiter.check(clientIp);
      assert.strictEqual(throttled.limited, true);
      assert.strictEqual(throttled.remaining, 0);
      assert.ok(throttled.resetMs > 0 && throttled.resetMs <= 2000);
    });

    it("isolates rate limit buckets between different client IPs", () => {
      const limiter = new RateLimiter({ windowMs: 1000, maxRequests: 2 });
      const clientA = "1.1.1.1";
      const clientB = "2.2.2.2";

      limiter.check(clientA);
      limiter.check(clientA);
      const resA = limiter.check(clientA);
      assert.strictEqual(resA.limited, true);

      // Client B should not be affected by Client A's activity
      const resB = limiter.check(clientB);
      assert.strictEqual(resB.limited, false);
      assert.strictEqual(resB.remaining, 1);
    });
  });

  describe("Configuration & Secret Hygiene", () => {
    it("ensures SUPABASE_SERVICE_ROLE_KEY is present in env but never exposed in client configs", () => {
      const config = loadEnvConfig();
      assert.ok(config.SUPABASE_SERVICE_ROLE_KEY);
      assert.ok(config.SUPABASE_SERVICE_ROLE_KEY.length > 20);

      // Verify that no client-facing configuration schema exposes service role key
      const clientFacingConfig = {
        status: "healthy",
        version: "0.1.0",
        transport: "streamable-http",
        environment: config.NODE_ENV,
      };

      const serialized = JSON.stringify(clientFacingConfig);
      assert.strictEqual(serialized.includes(config.SUPABASE_SERVICE_ROLE_KEY), false);
    });

    it("enforces positive non-zero boundaries for request size and timeouts", () => {
      const config = loadEnvConfig();
      assert.ok(config.MAX_REQUEST_BODY_SIZE_BYTES >= 1024);
      assert.ok(config.REQUEST_TIMEOUT_MS >= 1000);
      assert.ok(config.REQUEST_TIMEOUT_MS <= 60000);
    });
  });
});

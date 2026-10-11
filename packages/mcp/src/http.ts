import { createServer, IncomingMessage, ServerResponse } from "node:http";
import crypto from "node:crypto";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { loadEnvConfig } from "./config/env.js";
import { resolveHttpActor, resolveStdioActor } from "./auth/identity.js";
import { createReqlyMcpServer } from "./server.js";
import { logger } from "./utils/logger.js";
import { RateLimiter } from "./utils/rate-limiter.js";

async function main() {
  try {
    const config = loadEnvConfig();
    const rateLimiter = new RateLimiter({
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      maxRequests: config.RATE_LIMIT_MAX_REQUESTS,
    });

    // Allowed CORS origins list
    const allowedOrigins =
      config.ALLOWED_ORIGINS === "*"
        ? ["*"]
        : config.ALLOWED_ORIGINS.split(",").map((o) => o.trim());

    const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const startTime = Date.now();
      const requestId = (req.headers["x-request-id"] as string) || crypto.randomUUID();
      res.setHeader("X-Request-ID", requestId);

      // Security hardening headers
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "DENY");
      res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
      if (config.NODE_ENV === "production") {
        res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
      }

      // CORS resolution
      const origin = req.headers.origin;
      if (allowedOrigins.includes("*")) {
        res.setHeader("Access-Control-Allow-Origin", "*");
      } else if (origin && allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
      }
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-ID");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      const clientIp =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
        "127.0.0.1";

      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

      // 1. Health check endpoint (safe, no secrets, no rate-limiting)
      if (req.method === "GET" && url.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: "healthy",
            version: "0.1.0",
            environment: config.NODE_ENV,
            transport: "streamable-http",
            uptimeSeconds: Math.floor(process.uptime()),
            timestamp: new Date().toISOString(),
          })
        );
        return;
      }

      // 2. Rate limiting check for operational endpoints
      const rateLimitResult = rateLimiter.check(clientIp);
      res.setHeader("X-RateLimit-Limit", config.RATE_LIMIT_MAX_REQUESTS.toString());
      res.setHeader("X-RateLimit-Remaining", rateLimitResult.remaining.toString());

      if (rateLimitResult.limited) {
        logger.warn(`Rate limit exceeded for IP: ${clientIp.substring(0, 10)}***`);
        res.setHeader("Retry-After", Math.ceil(rateLimitResult.resetMs / 1000).toString());
        res.writeHead(429, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Too Many Requests",
            message: `Rate limit of ${config.RATE_LIMIT_MAX_REQUESTS} requests per minute exceeded.`,
            retryAfterSeconds: Math.ceil(rateLimitResult.resetMs / 1000),
          })
        );
        return;
      }

      // 3. Streamable HTTP MCP endpoint
      if (url.pathname === "/mcp") {
        // Enforce request size boundary (1MB)
        const contentLength = parseInt(req.headers["content-length"] || "0", 10);
        if (contentLength > config.MAX_REQUEST_BODY_SIZE_BYTES) {
          res.writeHead(413, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Payload Too Large: exceeds 1MB limit" }));
          return;
        }

        // Authenticate request
        let actor = await resolveHttpActor(req.headers.authorization);

        // Fallback for local development only if explicitly configured
        if (!actor && config.NODE_ENV !== "production" && config.REQLY_ACTOR_EMAIL) {
          logger.warn("No Bearer token provided; falling back to local REQLY_ACTOR_EMAIL in non-production mode");
          actor = await resolveStdioActor();
        }

        if (!actor) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "Unauthorized",
              message: "Valid Supabase Auth JWT or managed REQLY_MCP_API_KEY Bearer token required.",
            })
          );
          return;
        }

        try {
          // Initialize server and transport per request for stateless Streamable HTTP
          const server = createReqlyMcpServer(actor);
          const transport = new NodeStreamableHTTPServerTransport({
            sessionIdGenerator: undefined, // Stateless per-request mode
          });

          await server.connect(transport);
          await transport.handleRequest(req, res);

          const latencyMs = Date.now() - startTime;
          logger.info(`HTTP MCP request completed [${res.statusCode || 200}] in ${latencyMs}ms (actor: ${actor.email})`);
        } catch (transportError) {
          logger.error("Error processing Streamable HTTP request", transportError);
          if (!res.headersSent) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Internal Server Error" }));
          }
        }
        return;
      }

      // 404 for unknown routes
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not Found", availableRoutes: ["/health", "/mcp"] }));
    });

    httpServer.listen(config.PORT, config.HOST, () => {
      logger.info(`Reqly MCP Streamable HTTP server listening on http://${config.HOST}:${config.PORT}/mcp`);
      logger.info(`Health check available at http://${config.HOST}:${config.PORT}/health`);
    });

    const shutdown = async () => {
      logger.info("Shutting down Reqly MCP HTTP Server...");
      httpServer.close(() => {
        logger.info("HTTP Server stopped.");
        process.exit(0);
      });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    logger.error("Failed to start Reqly MCP HTTP Server", error);
    process.exit(1);
  }
}

main();

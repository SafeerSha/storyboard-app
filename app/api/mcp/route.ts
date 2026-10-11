import { NextRequest, NextResponse } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/server";
import { createReqlyMcpServer } from "../../../packages/mcp/src/server.js";
import { resolveHttpActor, resolveStdioActor } from "../../../packages/mcp/src/auth/identity.js";
import { RateLimiter } from "../../../packages/mcp/src/utils/rate-limiter.js";
import { logger } from "../../../packages/mcp/src/utils/logger.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Singleton sliding window rate limiter
const rateLimiter = new RateLimiter({
  windowMs: 60000,
  maxRequests: 100,
});

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-ID, MCP-Protocol-Version",
  "Access-Control-Expose-Headers": "MCP-Session-Id, MCP-Protocol-Version",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(req: NextRequest) {
  const isHealth = req.nextUrl.searchParams.get("health") === "1";

  if (isHealth || !req.headers.get("accept")?.includes("text/event-stream")) {
    return NextResponse.json(
      {
        status: "healthy",
        name: "reqly-mcp",
        version: "0.1.0",
        transport: "streamable-http",
        runtime: "vercel-serverless",
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          ...corsHeaders,
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }

  return NextResponse.json({ status: "ready" }, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  const rateLimitResult = rateLimiter.check(clientIp);

  if (rateLimitResult.limited) {
    logger.warn(`Vercel MCP Rate limit exceeded for IP: ${clientIp.substring(0, 10)}***`);
    return NextResponse.json(
      {
        error: "Too Many Requests",
        message: "Rate limit of 100 requests per minute exceeded.",
      },
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Retry-After": Math.ceil(rateLimitResult.resetMs / 1000).toString(),
        },
      }
    );
  }

  // Enforce bounded request size (1MB)
  const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
  if (contentLength > 1048576) {
    return NextResponse.json(
      { error: "Payload Too Large: exceeds 1MB limit" },
      { status: 413, headers: corsHeaders }
    );
  }

  // Authenticate actor from Bearer token
  const authHeader = req.headers.get("authorization");
  let actor = await resolveHttpActor(authHeader);

  // Non-production fallback to local actor if configured
  if (!actor && process.env.NODE_ENV !== "production" && process.env.REQLY_ACTOR_EMAIL) {
    try {
      actor = await resolveStdioActor();
    } catch {
      actor = null;
    }
  }

  if (!actor) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        message: "Valid Supabase Auth JWT or managed REQLY_MCP_API_KEY Bearer token required.",
      },
      {
        status: 401,
        headers: corsHeaders,
      }
    );
  }

  try {
    // Normalize Accept header to satisfy MCP Streamable HTTP specification
    let requestToHandle: Request = req;
    const accept = req.headers.get("accept") || "";
    if (!accept.includes("application/json") || !accept.includes("text/event-stream")) {
      const newHeaders = new Headers(req.headers);
      newHeaders.set("accept", "application/json, text/event-stream");
      requestToHandle = new Request(req.url, {
        method: req.method,
        headers: newHeaders,
        body: req.body,
        // @ts-expect-error duplex required for streaming body in Node fetch
        duplex: "half",
      });
    }

    const server = createReqlyMcpServer(actor);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless per-request mode
    });

    await server.connect(transport);
    const response = await transport.handleRequest(requestToHandle);

    // Inject security & CORS headers
    for (const [key, val] of Object.entries(corsHeaders)) {
      response.headers.set(key, val);
    }
    response.headers.set("X-Content-Type-Options", "nosniff");

    return response;
  } catch (error) {
    logger.error("Error handling Vercel MCP request", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500, headers: corsHeaders }
    );
  }
}

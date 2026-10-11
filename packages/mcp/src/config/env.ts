import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { logger } from "../utils/logger.js";

import { fileURLToPath } from "url";

// Helper to reliably find the repository root directory from module location
function findRepoRoot(startDir: string): string {
  let curr = startDir;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(curr, ".env.local")) || fs.existsSync(path.join(curr, ".env"))) {
      return curr;
    }
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }
  return path.resolve(startDir, "../../../..");
}

let currentFileDir = process.cwd();
try {
  if (typeof import.meta !== "undefined" && import.meta?.url) {
    currentFileDir = path.dirname(fileURLToPath(import.meta.url));
  }
} catch {
  currentFileDir = process.cwd();
}
const repoRootDir = findRepoRoot(currentFileDir);

const candidateEnvPaths = [
  path.resolve(repoRootDir, ".env.local"),
  path.resolve(repoRootDir, ".env"),
  path.resolve(process.cwd(), ".env.local"),
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "..", ".env.local"),
  path.resolve(process.cwd(), "..", ".env"),
];

for (const envPath of candidateEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

const envSchema = z.object({
  // Supabase connection
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(10, "SUPABASE_SERVICE_ROLE_KEY is required for MCP domain server operations"),

  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional().default(""),

  // Actor identification for local stdio
  REQLY_ACTOR_EMAIL: z
    .string()
    .email("REQLY_ACTOR_EMAIL must be a valid email when provided")
    .optional(),

  // Environment
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // HTTP server config
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default("127.0.0.1"),
  ALLOWED_ORIGINS: z.string().default("*"),

  // Rate limiting & security
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  REQLY_MCP_API_KEY: z.string().min(16).optional(),

  // Request boundaries & timeouts
  REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(15000),
  MAX_REQUEST_BODY_SIZE_BYTES: z.coerce.number().int().positive().default(1048576), // 1MB
});

export type EnvConfig = z.infer<typeof envSchema>;

export function loadEnvConfig(): EnvConfig {
  const parsed = envSchema.safeParse({
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY,
    REQLY_ACTOR_EMAIL: process.env.REQLY_ACTOR_EMAIL,
    NODE_ENV: process.env.NODE_ENV || "development",
    PORT: process.env.PORT || process.env.MCP_PORT,
    HOST: process.env.HOST || "127.0.0.1",
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || "*",
    RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS,
    RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
    REQLY_MCP_API_KEY: process.env.REQLY_MCP_API_KEY,
    REQUEST_TIMEOUT_MS: process.env.REQUEST_TIMEOUT_MS,
    MAX_REQUEST_BODY_SIZE_BYTES: process.env.MAX_REQUEST_BODY_SIZE_BYTES,
  });

  if (!parsed.success) {
    const missingKeys = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    logger.error(`MCP environment validation failed. Missing/invalid keys: ${missingKeys}`);
    throw new Error(
      `Invalid MCP server configuration. Missing or invalid keys: ${missingKeys}. Check .env or .env.local.`
    );
  }

  return parsed.data;
}

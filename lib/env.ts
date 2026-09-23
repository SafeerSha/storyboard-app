/**
 * Environment variable validation.
 *
 * Validates all required env vars at module-load time using Zod.
 * If any variable is missing or empty the process will throw a descriptive
 * error immediately — preventing cryptic runtime crashes deep in the call stack.
 *
 * Usage: import "@/lib/env" at the top of middleware.ts and any server entry point.
 */

import { z } from "zod";

const envSchema = z.object({
  // Supabase — server-only
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(10, "SUPABASE_PUBLISHABLE_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10, "SUPABASE_SERVICE_ROLE_KEY is required"),

  // Supabase — public (also validated server-side for completeness)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(10, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required"),

  // Client portal session signing secret (optional; sessions are cryptographically stored in DB)
  CLIENT_SESSION_SECRET: z
    .string()
    .min(32, "CLIENT_SESSION_SECRET must be at least 32 characters")
    .optional(),

  // AI
  GEMINI_API_KEY: z.string().min(10, "GEMINI_API_KEY is required"),

  // Email (Optional — lib/email/resend.ts simulates sending when unconfigured)
  SMTP_HOST: z.string().min(1, "SMTP_HOST is required").optional(),
  SMTP_PORT: z.coerce.number().int().positive("SMTP_PORT must be a positive integer").optional(),
  SMTP_USER: z.string().email("SMTP_USER must be a valid email address").optional(),
  SMTP_PASS: z.string().min(1, "SMTP_PASS is required").optional(),
});

function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  • ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `\n\n❌ Invalid environment variables:\n${errors}\n\n` +
        `Copy .env.example to .env and fill in the missing values.\n`
    );
  }

  return result.data;
}

// Validate once at module load time (server-side only).
// This runs when the module is first imported — fail fast before handling any request.
const env = typeof window === "undefined" ? validateEnv() : (process.env as any);

export default env;

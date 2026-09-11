/**
 * Structured server-side error logger.
 *
 * Outputs newline-delimited JSON to stdout so that log aggregation tools
 * (Vercel Log Drain, Datadog, Logtail, etc.) can parse and index them.
 *
 * Drop-in Sentry replacement: when you're ready to add Sentry, replace the
 * `transport` implementation below — the call sites stay the same.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.error("Story creation failed", error, { storyId, userId });
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  context?: Record<string, unknown>;
  environment: string;
}

function buildEntry(
  level: LogLevel,
  message: string,
  error?: unknown,
  context?: Record<string, unknown>
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    environment: process.env.NODE_ENV ?? "development",
  };

  if (error instanceof Error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV !== "production" ? error.stack : undefined,
    };
  } else if (error !== undefined) {
    entry.error = {
      name: "UnknownError",
      message: String(error),
    };
  }

  if (context && Object.keys(context).length > 0) {
    // Strip any accidental secret fields from structured context
    const safe = { ...context };
    for (const key of ["password", "password_hash", "token", "token_hash", "secret", "key"]) {
      if (key in safe) safe[key] = "[REDACTED]";
    }
    entry.context = safe;
  }

  return entry;
}

function transport(entry: LogEntry) {
  // In production: structured JSON so log drains can parse it
  if (process.env.NODE_ENV === "production") {
    process.stdout.write(JSON.stringify(entry) + "\n");
    return;
  }

  // In development: human-readable console output
  const prefix = `[${entry.level.toUpperCase()}] ${entry.timestamp}`;
  switch (entry.level) {
    case "error":
      console.error(prefix, entry.message, entry.error ?? "", entry.context ?? "");
      break;
    case "warn":
      console.warn(prefix, entry.message, entry.context ?? "");
      break;
    case "info":
      console.info(prefix, entry.message, entry.context ?? "");
      break;
    default:
      console.debug(prefix, entry.message, entry.context ?? "");
  }
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>) {
    transport(buildEntry("debug", message, undefined, context));
  },

  info(message: string, context?: Record<string, unknown>) {
    transport(buildEntry("info", message, undefined, context));
  },

  warn(message: string, context?: Record<string, unknown>) {
    transport(buildEntry("warn", message, undefined, context));
  },

  /**
   * Log a server error with full structured context.
   *
   * @param message  - Human-readable description of where/what failed
   * @param error    - The caught error (or any thrown value)
   * @param context  - Additional key-value pairs (IDs, request params, etc.)
   */
  error(message: string, error?: unknown, context?: Record<string, unknown>) {
    transport(buildEntry("error", message, error, context));
  },
};

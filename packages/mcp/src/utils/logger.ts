/**
 * Safe logger for Reqly MCP server.
 * Ensures stdout is never polluted in stdio mode (which would corrupt JSON-RPC),
 * and automatically redacts credentials, service keys, and tokens.
 */

const REDACTED_KEYS = [
  "password",
  "secret",
  "key",
  "token",
  "jwt",
  "bearer",
  "auth",
  "service_role",
  "serviceRole",
];

function sanitize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    // Redact Bearer tokens
    if (/bearer\s+[a-zA-Z0-9._-]+/i.test(value)) {
      return value.replace(/bearer\s+[a-zA-Z0-9._-]+/gi, "Bearer [REDACTED]");
    }
    // Redact JWT-like strings
    if (/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/.test(value)) {
      return "[REDACTED_JWT]";
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sanitize);
  }
  if (typeof value === "object") {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const isSensitive = REDACTED_KEYS.some((rk) => k.toLowerCase().includes(rk));
      cleaned[k] = isSensitive ? "[REDACTED]" : sanitize(v);
    }
    return cleaned;
  }
  return value;
}

export const logger = {
  info(message: string, context?: unknown) {
    const cleanMsg = sanitize(message);
    const formatted = context
      ? `[INFO] ${cleanMsg} ${JSON.stringify(sanitize(context))}`
      : `[INFO] ${cleanMsg}`;
    process.stderr.write(`${formatted}\n`);
  },
  warn(message: string, context?: unknown) {
    const cleanMsg = sanitize(message);
    const formatted = context
      ? `[WARN] ${cleanMsg} ${JSON.stringify(sanitize(context))}`
      : `[WARN] ${cleanMsg}`;
    process.stderr.write(`${formatted}\n`);
  },
  error(message: string, error?: unknown) {
    const cleanMsg = sanitize(message);
    let errStr = "";
    if (error instanceof Error) {
      errStr = ` - ${error.name}: ${sanitize(error.message)}`;
    } else if (error) {
      errStr = ` - ${JSON.stringify(sanitize(error))}`;
    }
    process.stderr.write(`[ERROR] ${cleanMsg}${errStr}\n`);
  },
  debug(message: string, context?: unknown) {
    if (process.env.DEBUG === "true" || process.env.NODE_ENV === "development") {
      const cleanMsg = sanitize(message);
      const formatted = context
        ? `[DEBUG] ${cleanMsg} ${JSON.stringify(sanitize(context))}`
        : `[DEBUG] ${cleanMsg}`;
      process.stderr.write(`${formatted}\n`);
    }
  },
};

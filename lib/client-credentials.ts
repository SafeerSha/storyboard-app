/**
 * Shared Client Credential & Onboarding Helpers
 */

export interface ClientShareData {
  portalUrl: string;
  loginPin: string;
  initialPassword?: string;
  password?: string;
  clientName?: string;
  projectName?: string;
}

/**
 * Generates a clean, cryptographically secure temporary initial password.
 * Format: 3 letters + special char + 6 digits/letters (e.g., "Sky#849261")
 */
export function generateTemporaryPassword(): string {
  const prefixes = ["Star", "Nova", "Echo", "Wave", "Apex", "Peak", "Loom", "Flow", "Beam", "Core", "Vibe", "Sync"];
  const symbols = ["#", "@", "!", "$", "%"];
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const symbol = symbols[Math.floor(Math.random() * symbols.length)];
  let suffix = "";
  for (let i = 0; i < 5; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }

  return `${prefix}${symbol}${suffix}`;
}

/**
 * Single unified helper for generating the client portal share message.
 * Returns ONLY Login Portal, Login PIN, and Password (when available).
 * No headings, greetings, explanations, or extra text.
 *
 * Example:
 * Login Portal:
 * http://localhost:3001/client/login
 *
 * Login PIN:
 * 713272
 *
 * Password:
 * Abc@12345
 */
export function buildClientPortalShareMessage(data: {
  portalUrl: string;
  loginPin: string;
  initialPassword?: string;
  password?: string;
}): string {
  const pwd = data.password || data.initialPassword;
  if (pwd) {
    return `Login Portal:\n${data.portalUrl}\n\nLogin PIN:\n${data.loginPin}\n\nPassword:\n${pwd}`;
  }
  return `Login Portal:\n${data.portalUrl}\n\nLogin PIN:\n${data.loginPin}`;
}

/**
 * Unified share message helpers matching the exact minimal format
 */
export function buildClientShareMessage(data: ClientShareData): string {
  return buildClientPortalShareMessage(data);
}

export function buildClientCopyDetailsText(data: ClientShareData): string {
  return buildClientPortalShareMessage(data);
}

/**
 * Builds direct WhatsApp URL with the exact minimal share message.
 * User must explicitly press Send inside WhatsApp.
 */
export function buildWhatsAppShareUrl(data: ClientShareData): string {
  const text = buildClientPortalShareMessage(data);
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

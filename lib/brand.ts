/**
 * Reqly — Central Brand Constants
 *
 * Single source of truth for all user-facing brand strings.
 * Import from here instead of scattering literals across components.
 *
 * IMPORTANT: Do NOT change PRODUCT_NAME or PRODUCT_TAGLINE here for technical
 * identifiers (cookie names, event names, localStorage keys, DB table names).
 * Those are intentionally preserved as-is to avoid breaking changes.
 */

export const PRODUCT_NAME = "REQly";
export const PRODUCT_TAGLINE = "From requirements to delivery.";

/** Short description for meta tags, manifests, and install prompts */
export const PRODUCT_DESCRIPTION =
  "Turn client requirements into structured stories, team reviews, and actionable project work.";

/** PWA short name — must be ≤12 chars for home screen labels */
export const PRODUCT_SHORT_NAME = "Reqly";

/** Copyright line */
export const PRODUCT_COPYRIGHT = `© ${new Date().getFullYear()} Reqly`;

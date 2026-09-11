/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  webpack: (config) => {
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { message: /\[webpack\.cache\.PackFileCacheStrategy\]/ },
    ];
    return config;
  },

  async headers() {
    // Content-Security-Policy:
    //  - default-src 'self' — block everything not explicitly allowed
    //  - script-src allows Next.js inline scripts and eval (needed for hot reload)
    //  - connect-src allows Supabase REST/Realtime and Google AI
    //  - img-src allows data URIs (avatars) and blob (PDF preview)
    const isDev = process.env.NODE_ENV === "development";

    const csp = [
      "default-src 'self'",
      // Next.js needs 'unsafe-inline' and 'unsafe-eval' in dev; tighten in prod
      isDev
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
        : "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      [
        "connect-src 'self'",
        "https://*.supabase.co",
        "wss://*.supabase.co",
        "https://generativelanguage.googleapis.com",
        isDev ? "ws://localhost:*" : "",
      ]
        .filter(Boolean)
        .join(" "),
      "img-src 'self' data: blob: https://*.supabase.co",
      "media-src 'self' blob:",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ]
      .filter(Boolean)
      .join("; ");

    const securityHeaders = [
      { key: "Content-Security-Policy", value: csp },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(self), geolocation=()",
      },
      // Only sent over HTTPS; browsers ignore it on HTTP.
      // 1 year max-age + includeSubDomains is the recommended production value.
      {
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      },
      { key: "X-DNS-Prefetch-Control", value: "on" },
    ];

    return [
      {
        // Apply to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;


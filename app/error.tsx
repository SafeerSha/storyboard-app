"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console in all environments. In production this surfaces in your
    // log drain (Vercel / Datadog). Replace with logger.error() when you have
    // a server-side logger accessible from client boundaries, or use Sentry here.
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F8F9FA",
        backgroundImage:
          "radial-gradient(circle at 15% 10%, rgba(210,193,235,0.30), transparent 35%), radial-gradient(circle at 85% 85%, rgba(202,220,240,0.22), transparent 35%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        padding: "1.5rem",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "1.25rem",
          padding: "2.5rem",
          maxWidth: "480px",
          width: "100%",
          textAlign: "center",
          boxShadow: "0 4px 32px rgba(15,23,42,0.10)",
          border: "1px solid rgba(15,23,42,0.10)",
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: "rgba(204,160,56,0.10)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.25rem",
            fontSize: "1.75rem",
          }}
        >
          ⚡
        </div>

        <h1
          style={{
            margin: "0 0 0.5rem",
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "#0F172A",
            letterSpacing: "-0.02em",
          }}
        >
          Something went wrong
        </h1>

        <p
          style={{
            margin: "0 0 1.75rem",
            fontSize: "0.9rem",
            color: "#334155",
            lineHeight: 1.6,
          }}
        >
          An unexpected error occurred. This has been logged and we&apos;ll look into it. Please try
          again.
        </p>

        {error.digest && (
          <p
            style={{
              margin: "-0.75rem 0 1.25rem",
              fontSize: "0.75rem",
              color: "#64748B",
              fontFamily: "monospace",
            }}
          >
            Error ID: {error.digest}
          </p>
        )}

        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
          <button
            onClick={() => reset()}
            style={{
              padding: "0.625rem 1.25rem",
              borderRadius: "0.625rem",
              background: "#CCA038",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            Try again
          </button>
          <button
            onClick={() => (window.location.href = "/")}
            style={{
              padding: "0.625rem 1.25rem",
              borderRadius: "0.625rem",
              background: "transparent",
              color: "#334155",
              border: "1px solid rgba(15,23,42,0.15)",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            Go home
          </button>
        </div>
      </div>
    </div>
  );
}

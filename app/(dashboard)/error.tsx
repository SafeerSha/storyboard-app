"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DashboardError]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div
        style={{
          background: "#fff",
          borderRadius: "1.25rem",
          padding: "2.5rem",
          maxWidth: "480px",
          width: "100%",
          textAlign: "center",
          boxShadow: "0 4px 32px rgba(74,61,100,0.08)",
          border: "1px solid rgba(74,61,100,0.10)",
        }}
      >
        <div
          style={{
            width: "52px",
            height: "52px",
            borderRadius: "50%",
            background: "rgba(184,148,78,0.10)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.125rem",
            fontSize: "1.5rem",
          }}
        >
          ⚡
        </div>

        <h2
          style={{
            margin: "0 0 0.5rem",
            fontSize: "1.125rem",
            fontWeight: 700,
            color: "#252331",
            letterSpacing: "-0.02em",
          }}
        >
          Something went wrong
        </h2>

        <p
          style={{
            margin: "0 0 1.5rem",
            fontSize: "0.875rem",
            color: "#706C7D",
            lineHeight: 1.6,
          }}
        >
          This section ran into an unexpected error. You can try again or navigate back to the
          dashboard.
        </p>

        {error.digest && (
          <p
            style={{
              margin: "-0.5rem 0 1rem",
              fontSize: "0.7rem",
              color: "#9994A5",
              fontFamily: "monospace",
            }}
          >
            Error ID: {error.digest}
          </p>
        )}

        <div style={{ display: "flex", gap: "0.625rem", justifyContent: "center" }}>
          <button
            onClick={() => reset()}
            style={{
              padding: "0.5rem 1.125rem",
              borderRadius: "0.625rem",
              background: "#B8944E",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: "0.8125rem",
              fontWeight: 600,
            }}
          >
            Try again
          </button>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "0.5rem 1.125rem",
              borderRadius: "0.625rem",
              background: "transparent",
              color: "#706C7D",
              border: "1px solid rgba(74,61,100,0.15)",
              textDecoration: "none",
              fontSize: "0.8125rem",
              fontWeight: 500,
            }}
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

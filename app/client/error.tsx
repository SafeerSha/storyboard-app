"use client";

import { useEffect } from "react";

export default function ClientPortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ClientPortalError]", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F2F7",
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
          maxWidth: "440px",
          width: "100%",
          textAlign: "center",
          boxShadow: "0 4px 32px rgba(74,61,100,0.10)",
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

        <h1
          style={{
            margin: "0 0 0.5rem",
            fontSize: "1.125rem",
            fontWeight: 700,
            color: "#252331",
            letterSpacing: "-0.02em",
          }}
        >
          Something went wrong
        </h1>

        <p
          style={{
            margin: "0 0 1.5rem",
            fontSize: "0.875rem",
            color: "#706C7D",
            lineHeight: 1.6,
          }}
        >
          An unexpected error occurred. Please try reloading the page. If this keeps happening,
          contact your project owner.
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

        <button
          onClick={() => reset()}
          style={{
            padding: "0.625rem 1.5rem",
            borderRadius: "0.625rem",
            background: "#B8944E",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontSize: "0.875rem",
            fontWeight: 600,
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}

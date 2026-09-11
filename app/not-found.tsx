import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F2F7",
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
          boxShadow: "0 4px 32px rgba(74,61,100,0.10)",
          border: "1px solid rgba(74,61,100,0.10)",
        }}
      >
        {/* Logo-ish number */}
        <div
          style={{
            fontSize: "4rem",
            fontWeight: 800,
            color: "rgba(184,148,78,0.20)",
            lineHeight: 1,
            marginBottom: "1rem",
            letterSpacing: "-0.04em",
          }}
        >
          404
        </div>

        <h1
          style={{
            margin: "0 0 0.5rem",
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "#252331",
            letterSpacing: "-0.02em",
          }}
        >
          Page not found
        </h1>

        <p
          style={{
            margin: "0 0 1.75rem",
            fontSize: "0.9rem",
            color: "#706C7D",
            lineHeight: 1.6,
          }}
        >
          The page you&apos;re looking for doesn&apos;t exist or may have been moved.
        </p>

        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            padding: "0.625rem 1.375rem",
            borderRadius: "0.625rem",
            background: "#B8944E",
            color: "#fff",
            textDecoration: "none",
            fontSize: "0.875rem",
            fontWeight: 600,
            letterSpacing: "-0.01em",
          }}
        >
          ← Back to dashboard
        </Link>
      </div>
    </div>
  );
}

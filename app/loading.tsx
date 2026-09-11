import { ReqlyLogoMark } from "@/components/brand/StoryBoardLogo";

export default function Loading() {
  return (
    <>
      <style>{`
        /* ── Entrance animations ── */
        @keyframes rq-fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Logo icon soft glow pulse */
        @keyframes rq-glow-pulse {
          0%, 100% { box-shadow: 0 0 0 0   rgba(184,148,78,0.00); }
          50%       { box-shadow: 0 0 0 10px rgba(184,148,78,0.13); }
        }

        /* Three-dot shimmer wave */
        @keyframes rq-dot-wave {
          0%, 80%, 100% { transform: translateY(0);   opacity: 0.35; }
          40%            { transform: translateY(-5px); opacity: 1; }
        }

        /* Slim progress bar — indeterminate sweep */
        @keyframes rq-bar-sweep {
          0%   { left: -40%; width: 40%; }
          50%  { left: 60%;  width: 40%; }
          100% { left: 100%; width: 40%; }
        }

        /* Staggered fade-up utility classes */
        .rq-1 { animation: rq-fade-up 0.55s cubic-bezier(.22,.68,0,1.2) 0.05s both; }
        .rq-2 { animation: rq-fade-up 0.55s cubic-bezier(.22,.68,0,1.2) 0.18s both; }
        .rq-3 { animation: rq-fade-up 0.55s cubic-bezier(.22,.68,0,1.2) 0.30s both; }
        .rq-4 { animation: rq-fade-up 0.55s cubic-bezier(.22,.68,0,1.2) 0.42s both; }

        .rq-glow {
          border-radius: 14px;
          animation: rq-glow-pulse 2.4s ease-in-out infinite;
        }

        /* Dots */
        .rq-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #B8944E;
          display: inline-block;
          animation: rq-dot-wave 1.4s ease-in-out infinite;
        }
        .rq-dot:nth-child(1) { animation-delay: 0s;    }
        .rq-dot:nth-child(2) { animation-delay: 0.15s; }
        .rq-dot:nth-child(3) { animation-delay: 0.30s; }

        /* Progress bar track */
        .rq-bar-track {
          position: fixed;
          bottom: 0; left: 0;
          width: 100%; height: 2px;
          background: rgba(184,148,78,0.12);
          overflow: hidden;
          z-index: 9999;
        }
        .rq-bar-fill {
          position: absolute;
          top: 0; height: 100%;
          background: linear-gradient(90deg, transparent, #B8944E, #E2C17C, #B8944E, transparent);
          animation: rq-bar-sweep 1.6s ease-in-out infinite;
        }

        /* Divider line */
        .rq-divider {
          width: 32px; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(184,148,78,0.40), transparent);
          margin: 0 auto;
        }
      `}</style>

      {/* Slim progress bar at bottom */}
      <div className="rq-bar-track" aria-hidden="true">
        <div className="rq-bar-fill" />
      </div>

      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F5F2F7",
          backgroundImage:
            "radial-gradient(ellipse at 20% 10%, rgba(210,193,235,0.28) 0%, transparent 50%), " +
            "radial-gradient(ellipse at 80% 90%, rgba(202,220,240,0.20) 0%, transparent 50%)",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "28px" }}>

          {/* Logo icon with glow ring */}
          <div className="rq-1" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="rq-glow">
              <ReqlyLogoMark size={56} />
            </div>
          </div>

          {/* Wordmark + tagline */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
            <p
              className="rq-2"
              style={{
                margin: 0,
                fontSize: "22px",
                fontWeight: 700,
                letterSpacing: "-0.04em",
                lineHeight: 1,
                color: "#252331",
              }}
            >
              REQ<span style={{ color: "#B8944E" }}>ly</span>
            </p>

            <div className="rq-3 rq-divider" />

            <p
              className="rq-4"
              style={{
                margin: 0,
                fontSize: "11px",
                fontWeight: 500,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#9994A5",
              }}
            >
              From requirements to delivery
            </p>
          </div>

          {/* Three-dot wave loader */}
          <div
            className="rq-4"
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
            aria-label="Loading"
            role="status"
          >
            <span className="rq-dot" />
            <span className="rq-dot" />
            <span className="rq-dot" />
          </div>

        </div>
      </main>
    </>
  );
}

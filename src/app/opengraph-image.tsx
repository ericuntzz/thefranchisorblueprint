import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "The Franchisor Blueprint — The Smartest, Most Affordable Path to Becoming a Franchisor";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background:
            "linear-gradient(135deg, #0e1f3a 0%, #1e3a5f 60%, #2a4d7a 100%)",
          color: "#ffffff",
          fontFamily: "Inter, system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Subtle blueprint grid pattern */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            opacity: 0.6,
            display: "flex",
          }}
        />

        {/* Top: brand row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            position: "relative",
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#d4af37",
              borderBottom: "2px solid #d4af37",
              paddingBottom: 4,
            }}
          >
            The Franchisor Blueprint
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            position: "relative",
            maxWidth: "1000px",
          }}
        >
          <div
            style={{
              fontSize: 76,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
            }}
          >
            The Smartest, Most Affordable Path to Becoming a Franchisor
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 400,
              color: "rgba(255,255,255,0.78)",
              lineHeight: 1.4,
              maxWidth: "880px",
            }}
          >
            A complete franchise system + 6 months of 1:1 coaching — for a fraction of what big firms charge.
          </div>
        </div>

        {/* Bottom: badges */}
        <div
          style={{
            display: "flex",
            gap: "16px",
            position: "relative",
            flexWrap: "wrap",
          }}
        >
          {[
            "30+ Years in Franchising",
            "Coach-Led System",
            "Up to 89% Less than Big Firms",
            "Launch in 6 Months",
          ].map((b) => (
            <div
              key={b}
              style={{
                display: "flex",
                alignItems: "center",
                fontSize: 18,
                fontWeight: 700,
                color: "#0e1f3a",
                background: "#d4af37",
                padding: "10px 20px",
                borderRadius: 999,
                letterSpacing: "0.02em",
              }}
            >
              {b}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}

"use client";
import { useEffect } from "react";
import { track } from "@/lib/analytics";

const SCRIPT_SRC = "https://assets.calendly.com/assets/external/widget.js";
const STYLE_HREF = "https://assets.calendly.com/assets/external/widget.css";

/**
 * Map a Calendly event-type slug → a GA4-friendly event_type string.
 * Reads the slug from the URL's last path segment.
 *
 *   /team-thefranchisorblueprint/30-minute-discovery-call → "30-min-discovery"
 *   /team-thefranchisorblueprint/45-minute-builder-fit-call → "45-min-builder"
 *   /team-thefranchisorblueprint/60-minute-blueprint-onboarding → "60-min-blueprint-onboarding"
 *   anything else → the raw slug
 */
function calendlyEventType(url: string): string {
  try {
    const path = new URL(url).pathname.split("/").filter(Boolean);
    const slug = path[path.length - 1] ?? "unknown";
    if (slug.includes("discovery")) return "30-min-discovery";
    if (slug.includes("builder")) return "45-min-builder";
    if (slug.includes("blueprint-onboarding")) return "60-min-blueprint-onboarding";
    return slug;
  } catch {
    return "unknown";
  }
}

export function CalendlyEmbed({
  url,
  minHeight = 700,
}: {
  url: string;
  minHeight?: number;
}) {
  useEffect(() => {
    // Calendly's inline widget needs BOTH the script and the stylesheet.
    // Loading only the script renders the calendar as unstyled bare numbers.
    if (!document.querySelector(`link[href="${STYLE_HREF}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = STYLE_HREF;
      document.head.appendChild(link);
    }
    if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      document.body.appendChild(script);
    }

    // ─── Listen for booking events via postMessage ────────────────────────
    // Calendly fires events like "calendly.event_scheduled" when a booking
    // is confirmed. We map those into GA4 generate_lead events.
    function onMessage(e: MessageEvent) {
      if (typeof e.data !== "object" || e.data === null) return;
      const data = e.data as { event?: string };
      if (typeof data.event !== "string") return;
      if (!data.event.startsWith("calendly.")) return;

      const eventType = calendlyEventType(url);
      if (data.event === "calendly.event_scheduled") {
        track("generate_lead", {
          event_type: eventType,
          cta_location: "calendly_inline_embed",
        });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [url]);

  return (
    <div
      className="calendly-inline-widget rounded-xl overflow-hidden bg-white"
      data-url={url}
      // Calendly's iframe sets height="100%". A percentage resolves against
      // the parent's resolved `height`, not `min-height` — so we need an
      // explicit pixel height here, not min-height, or the iframe collapses
      // to its content (the spinner).
      style={{ minWidth: "320px", height: `${minHeight}px` }}
      aria-label="Calendly scheduling widget"
    />
  );
}

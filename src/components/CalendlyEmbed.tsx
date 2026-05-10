"use client";
import { useEffect, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import { track } from "@/lib/analytics";

const SCRIPT_SRC = "https://assets.calendly.com/assets/external/widget.js";
const STYLE_HREF = "https://assets.calendly.com/assets/external/widget.css";

/**
 * Map a Calendly event-type slug → a GA4-friendly event_type string.
 * Reads the slug from the URL's last path segment.
 *
 *   /team-thefranchisorblueprint/30-minute-discovery-call → "30-min-discovery"
 *   /team-thefranchisorblueprint/15-minute-discovery-call → "15-min-blueprint"
 *   /team-thefranchisorblueprint/45-minute-builder-fit-call → "45-min-builder"
 *   /team-thefranchisorblueprint/60-minute-blueprint-onboarding → "60-min-blueprint-onboarding"
 *   anything else → the raw slug
 */
function calendlyEventType(url: string): string {
  try {
    const path = new URL(url).pathname.split("/").filter(Boolean);
    const slug = path[path.length - 1] ?? "unknown";
    if (slug === "15-minute-discovery-call") return "15-min-blueprint";
    if (slug.includes("discovery")) return "30-min-discovery";
    if (slug.includes("builder")) return "45-min-builder";
    if (slug.includes("blueprint-onboarding")) return "60-min-blueprint-onboarding";
    return slug;
  } catch {
    return "unknown";
  }
}

/**
 * Inject the Calendly stylesheet and widget script into <head> once,
 * synchronously kicked off the first time any CalendlyEmbed mounts.
 * Subsequent mounts reuse the same tags. Hoisting this out of the
 * component's useEffect lets us also call it from a top-level
 * effect — reducing the gap between hydration and script-fetch.
 *
 * Also adds rel="preload" hints so the browser starts the network
 * fetch as soon as it sees these tags (high priority), beating the
 * regular <script>/<link> async fetch by 50-150ms in practice.
 */
let calendlyAssetsInjected = false;
function ensureCalendlyAssets() {
  if (calendlyAssetsInjected) return;
  calendlyAssetsInjected = true;

  if (!document.querySelector(`link[href="${STYLE_HREF}"]`)) {
    // Preload first — gives the browser a head-start on the fetch
    // even before the actual <link rel="stylesheet"> tag is parsed.
    const preloadCss = document.createElement("link");
    preloadCss.rel = "preload";
    preloadCss.as = "style";
    preloadCss.href = STYLE_HREF;
    document.head.appendChild(preloadCss);

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = STYLE_HREF;
    document.head.appendChild(link);
  }

  if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
    const preloadJs = document.createElement("link");
    preloadJs.rel = "preload";
    preloadJs.as = "script";
    preloadJs.href = SCRIPT_SRC;
    document.head.appendChild(preloadJs);

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    document.body.appendChild(script);
  }
}

export function CalendlyEmbed({
  url,
  minHeight = 700,
  onScheduled,
}: {
  url: string;
  minHeight?: number;
  /**
   * Optional callback when calendly.event_scheduled fires. Used by the
   * /portal/coaching/schedule page to fire `portal_coaching_book` in
   * addition to the standard `generate_lead` event the embed already
   * fires. Called AFTER the standard track() so analytics ordering is
   * predictable.
   */
  onScheduled?: () => void;
}) {
  // Skeleton state — hides itself once Calendly's iframe signals it has
  // rendered the event-type page. Falls back to a 4s timeout so we never
  // leave the user staring at a spinner if Calendly's postMessage event
  // doesn't fire (rare, but worth the safety net).
  const [ready, setReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ensureCalendlyAssets();

    // Hide the skeleton when Calendly says it's ready, OR after 4s
    // (whichever comes first). Calendly fires several event types as
    // it bootstraps; the first paint-ready signal is profile_page_viewed
    // or event_type_viewed, depending on the URL shape.
    const timeoutId = window.setTimeout(() => setReady(true), 4000);

    function onMessage(e: MessageEvent) {
      if (typeof e.data !== "object" || e.data === null) return;
      const data = e.data as { event?: string };
      if (typeof data.event !== "string") return;
      if (!data.event.startsWith("calendly.")) return;

      // Hide skeleton on first sign of life from the iframe
      if (
        data.event === "calendly.profile_page_viewed" ||
        data.event === "calendly.event_type_viewed" ||
        data.event === "calendly.date_and_time_selected"
      ) {
        setReady(true);
      }

      const eventType = calendlyEventType(url);
      if (data.event === "calendly.event_scheduled") {
        track("generate_lead", {
          event_type: eventType,
          cta_location: "calendly_inline_embed",
        });
        onScheduled?.();
      }
    }
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timeoutId);
    };
  }, [url, onScheduled]);

  return (
    <div className="relative" style={{ minHeight: `${minHeight}px` }}>
      {/* ===== Skeleton (visible until Calendly iframe signals ready) ===== */}
      <div
        className={`absolute inset-0 rounded-xl bg-white border border-navy/10 flex flex-col items-center justify-center gap-4 transition-opacity duration-300 pointer-events-none ${
          ready ? "opacity-0" : "opacity-100"
        }`}
        aria-hidden={ready}
      >
        <div className="flex items-center gap-2 text-navy">
          {/* Pulsing calendar icon — branded, on-color, suggests "scheduling" */}
          <Calendar size={22} className="text-gold animate-pulse" />
          <span className="text-sm font-semibold tracking-wide">
            Loading scheduler…
          </span>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-grey-3 text-xs hover:text-navy transition-colors underline-offset-4 hover:underline"
        >
          Or open the scheduler in a new tab →
        </a>
      </div>

      {/* ===== Actual embed mount point ===== */}
      <div
        ref={containerRef}
        className="calendly-inline-widget rounded-xl overflow-hidden bg-white"
        data-url={url}
        // Calendly's iframe sets height="100%". A percentage resolves against
        // the parent's resolved `height`, not `min-height` — so we need an
        // explicit pixel height here, not min-height, or the iframe collapses
        // to its content (the spinner).
        style={{ minWidth: "320px", height: `${minHeight}px` }}
        aria-label="Calendly scheduling widget"
      />
    </div>
  );
}

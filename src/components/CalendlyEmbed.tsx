"use client";
import { useEffect } from "react";

const SCRIPT_SRC = "https://assets.calendly.com/assets/external/widget.js";
const STYLE_HREF = "https://assets.calendly.com/assets/external/widget.css";

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
  }, []);

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

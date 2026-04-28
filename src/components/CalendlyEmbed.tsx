"use client";
import { useEffect } from "react";

const SCRIPT_SRC = "https://assets.calendly.com/assets/external/widget.js";

export function CalendlyEmbed({
  url,
  minHeight = 700,
}: {
  url: string;
  minHeight?: number;
}) {
  useEffect(() => {
    if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) return;
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return (
    <div
      className="calendly-inline-widget rounded-xl overflow-hidden bg-white"
      data-url={url}
      style={{ minWidth: "320px", minHeight: `${minHeight}px` }}
      aria-label="Calendly scheduling widget"
    />
  );
}

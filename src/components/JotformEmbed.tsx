"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Jotform inline embed.
 *
 * Loads the form via direct iframe (https://form.jotform.com/<formId>).
 * Listens for postMessage events from Jotform to auto-resize the iframe
 * to the form's actual content height (so we don't get an internal
 * scrollbar inside the iframe).
 */
export function JotformEmbed({
  formId,
  initialHeight = 900,
  title = "Franchise Readiness Assessment",
}: {
  formId: string;
  initialHeight?: number;
  title?: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(initialHeight);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (typeof e.data !== "string") return;
      // Jotform sends messages like "setHeight:<num>:<formId>"
      if (e.data.startsWith("setHeight:")) {
        const parts = e.data.split(":");
        const h = parseInt(parts[1], 10);
        if (!Number.isNaN(h) && h > 200) setHeight(h);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <iframe
      ref={iframeRef}
      title={title}
      src={`https://form.jotform.com/${formId}`}
      allow="geolocation; microphone; camera; payment"
      allowFullScreen
      className="w-full rounded-xl border-0 bg-white shadow-[0_10px_30px_rgba(30,58,95,0.10)]"
      style={{ minHeight: `${height}px` }}
    />
  );
}

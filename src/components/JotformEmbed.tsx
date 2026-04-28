"use client";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";

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
    let completed = false; // de-dup so we only fire assessment_complete once

    function onMessage(e: MessageEvent) {
      // ─── String-format messages (height, success, etc.) ───────────────
      if (typeof e.data === "string") {
        // Jotform sends "setHeight:<num>:<formId>"
        if (e.data.startsWith("setHeight:")) {
          const parts = e.data.split(":");
          const h = parseInt(parts[1], 10);
          if (!Number.isNaN(h) && h > 200) setHeight(h);
        }
        // Jotform fires "submission-completed" or "submitForm:..." on submit
        if (
          !completed &&
          (e.data.includes("submission-completed") ||
            e.data.startsWith("submitForm:") ||
            e.data === "form-submitted")
        ) {
          completed = true;
          track("assessment_complete", {});
        }
        return;
      }
      // ─── Object-format messages ───────────────────────────────────────
      if (typeof e.data === "object" && e.data !== null) {
        const data = e.data as { type?: string; action?: string };
        if (
          !completed &&
          (data.type === "submission-completed" || data.action === "submission-completed")
        ) {
          completed = true;
          track("assessment_complete", {});
        }
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

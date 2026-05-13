"use client";

/**
 * DeliverablePreviewModal — preview a deliverable as PDF in an iframe
 * before the customer commits to downloading it to their machine.
 *
 * UX: customer clicks "Download" on a deliverable card or the bundle
 * "Download N as bundle" button → this modal slides in with a PDF
 * preview rendered server-side (`/api/agent/export/[id]?format=pdf&
 * inline=1`). They can flip through pages in the browser's native PDF
 * viewer, then either click "Download .docx" / "Download .pdf" in the
 * footer to actually save it, or close out.
 *
 * Two modes:
 *   - `mode: "single"` — one deliverable, iframe shows its PDF.
 *   - `mode: "bundle"` — N deliverables; left rail lists them, click
 *     to swap the iframe to that doc's PDF. Footer button downloads
 *     the ZIP via the existing /api/agent/export/bundle endpoint.
 *
 * Accessibility: role="dialog", focus the close button on open, Esc
 * dismisses, backdrop click dismisses. We lean on the browser's
 * built-in PDF viewer for keyboard navigation inside the document.
 */

import { useEffect, useRef, useState } from "react";
import { Download, FileText, Loader2, X } from "lucide-react";
import type { DeliverableId } from "@/lib/export/types";
import { track } from "@/lib/analytics";

type DeliverableSummary = {
  id: DeliverableId;
  name: string;
  /** "doc" supports docx + pdf; "slides" supports pptx only (preview disabled). */
  kind: "doc" | "slides";
  /** % readiness, surfaced in the left rail when bundling. */
  readinessPct?: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
} & (
  | { mode: "single"; deliverable: DeliverableSummary }
  | {
      mode: "bundle";
      deliverables: DeliverableSummary[];
      /** ZIP download href — wired to the existing bundle endpoint with
       *  a POST body of selected ids. */
      onDownloadBundle: () => Promise<void> | void;
    }
);

export function DeliverablePreviewModal(props: Props) {
  const { open, onClose } = props;
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [activeId, setActiveId] = useState<DeliverableId | null>(
    props.mode === "single"
      ? props.deliverable.id
      : (props.deliverables[0]?.id ?? null),
  );
  const [downloadingBundle, setDownloadingBundle] = useState(false);

  // Reset active deliverable when the modal re-opens with a different shape.
  useEffect(() => {
    if (!open) return;
    setActiveId(
      props.mode === "single"
        ? props.deliverable.id
        : (props.deliverables[0]?.id ?? null),
    );
    setIframeLoading(true);
    // Focus the close button — keyboard users land on a known control.
    setTimeout(() => closeButtonRef.current?.focus(), 0);
  }, [open, props.mode === "single" ? props.deliverable.id : null]); // eslint-disable-line react-hooks/exhaustive-deps

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll while modal is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const activeDeliverable: DeliverableSummary | null =
    props.mode === "single"
      ? props.deliverable
      : (props.deliverables.find((d) => d.id === activeId) ?? null);

  // Slides previews aren't supported (PPTX doesn't render in iframes); fall
  // back to a "Download .pptx" only view.
  const isSlides = activeDeliverable?.kind === "slides";
  const previewSrc =
    activeDeliverable && !isSlides
      ? `/api/agent/export/${activeDeliverable.id}?format=pdf&inline=1`
      : null;
  const docxHref = activeDeliverable
    ? `/api/agent/export/${activeDeliverable.id}?format=${isSlides ? "pptx" : "docx"}`
    : "#";
  const pdfHref = activeDeliverable
    ? `/api/agent/export/${activeDeliverable.id}?format=pdf`
    : "#";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-navy/40 backdrop-blur-sm motion-safe:animate-[fadeIn_140ms_ease-out]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-[1100px] h-[min(86vh,920px)] bg-cream-soft rounded-2xl shadow-[0_24px_60px_rgba(30,58,95,0.25)] flex flex-col overflow-hidden border border-card-border">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-card-border bg-white">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.12em] text-grey-3 font-bold mb-0.5">
              {props.mode === "bundle" ? "Bundle preview" : "Document preview"}
            </div>
            <h2
              id="preview-modal-title"
              className="text-navy font-extrabold text-lg sm:text-xl truncate"
            >
              {props.mode === "bundle"
                ? `${props.deliverables.length} deliverables · review before download`
                : (props.deliverable.name ?? "Preview")}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close preview"
            className="flex-shrink-0 w-9 h-9 rounded-full hover:bg-cream flex items-center justify-center text-grey-3 hover:text-navy transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body — bundle mode has a left rail, single mode is just the iframe */}
        <div className="flex-1 flex min-h-0 bg-cream-soft">
          {props.mode === "bundle" && (
            <nav
              aria-label="Deliverables in this bundle"
              className="flex-shrink-0 w-[260px] border-r border-card-border overflow-y-auto bg-white"
            >
              <ul className="py-2">
                {props.deliverables.map((d) => {
                  const isActive = d.id === activeId;
                  return (
                    <li key={d.id}>
                      <button
                        onClick={() => {
                          setActiveId(d.id);
                          setIframeLoading(true);
                        }}
                        aria-pressed={isActive}
                        className={`w-full text-left px-4 py-2.5 flex items-start gap-2.5 transition-colors text-sm ${
                          isActive
                            ? "bg-cream-soft border-l-2 border-l-gold"
                            : "border-l-2 border-l-transparent hover:bg-cream-soft/60"
                        }`}
                      >
                        <FileText
                          size={14}
                          className={`mt-0.5 flex-shrink-0 ${isActive ? "text-gold" : "text-grey-3"}`}
                        />
                        <div className="min-w-0">
                          <div
                            className={`font-bold leading-snug ${isActive ? "text-navy" : "text-navy/80"}`}
                          >
                            {d.name}
                          </div>
                          {typeof d.readinessPct === "number" && (
                            <div className="text-[11px] text-grey-3 mt-0.5">
                              {d.readinessPct}% complete
                              {d.kind === "slides" && " · slides preview unavailable"}
                            </div>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}

          {/* Iframe / preview pane */}
          <div className="flex-1 relative min-h-0">
            {previewSrc ? (
              <>
                {iframeLoading && (
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-grey-3 bg-cream-soft"
                  >
                    <Loader2 size={22} className="animate-spin" />
                    <div className="text-sm">Building preview…</div>
                  </div>
                )}
                <iframe
                  key={activeDeliverable?.id /* force-reload on swap */}
                  src={previewSrc}
                  title={`Preview of ${activeDeliverable?.name}`}
                  className="w-full h-full border-0 bg-white"
                  onLoad={() => setIframeLoading(false)}
                />
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-grey-3 bg-cream-soft px-8 text-center">
                <FileText size={28} />
                <div className="text-sm max-w-sm">
                  Slide decks (.pptx) don&rsquo;t preview in the browser. Download
                  the file to view it in PowerPoint or Keynote.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer — primary action varies by mode */}
        <div className="flex items-center justify-between gap-3 px-6 py-3.5 border-t border-card-border bg-white">
          <button
            onClick={onClose}
            className="text-grey-3 hover:text-navy text-sm font-medium px-2 py-1 transition-colors"
          >
            Cancel
          </button>
          <div className="flex items-center gap-2">
            {activeDeliverable && !isSlides && (
              <a
                href={pdfHref}
                onClick={() =>
                  track("portal_export_request", {
                    deliverable: activeDeliverable.id,
                    format: "pdf",
                  })
                }
                className="inline-flex items-center gap-1.5 text-navy hover:bg-cream-soft text-xs uppercase tracking-[0.1em] font-bold px-3.5 py-2 rounded-full border border-card-border transition-colors"
              >
                <Download size={12} />
                Download .pdf
              </a>
            )}
            {props.mode === "single" && activeDeliverable && (
              <a
                href={docxHref}
                onClick={() =>
                  track("portal_export_request", {
                    deliverable: activeDeliverable.id,
                    format: isSlides ? "pptx" : "docx",
                  })
                }
                className="inline-flex items-center gap-1.5 bg-gold hover:bg-gold-dark text-navy text-xs uppercase tracking-[0.1em] font-bold px-4 py-2 rounded-full transition-colors"
              >
                <Download size={12} />
                Download .{isSlides ? "pptx" : "docx"}
              </a>
            )}
            {props.mode === "bundle" && (
              <button
                onClick={async () => {
                  track("portal_export_request", {
                    deliverable: "bundle",
                    format: "zip",
                  });
                  setDownloadingBundle(true);
                  try {
                    await props.onDownloadBundle();
                  } finally {
                    setDownloadingBundle(false);
                  }
                }}
                disabled={downloadingBundle}
                className="inline-flex items-center gap-1.5 bg-navy hover:bg-navy-light text-white text-xs uppercase tracking-[0.1em] font-bold px-4 py-2 rounded-full transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {downloadingBundle ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Download size={12} />
                )}
                Download {props.deliverables.length} as ZIP
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

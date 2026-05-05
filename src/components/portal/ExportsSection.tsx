"use client";

/**
 * ExportsSection — deliverable downloads on /portal.
 *
 * Lists every deliverable in the registry with:
 *   - readiness % (deliverable-level, NOT overall Memory)
 *   - 1-line description
 *   - "Review before export" link → /portal/exports/[id]
 *   - Direct "Download .docx" link → /api/agent/export/[id]?format=docx
 *   - Checkbox to add to a multi-select bundle
 *
 * Bundle download flow:
 *   - Customer ticks N boxes → "Download N as bundle" CTA appears
 *   - Click → POST /api/agent/export/bundle with selected ids
 *   - Browser receives a ZIP with all selected files + a _README.md
 *     listing each file's readiness.
 *
 * "Select all" / "Clear all" toggle the entire registry at once. The
 * UI starts unchecked because we'd rather force a deliberate choice
 * than have the customer accidentally request all 17 builds.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  PackageOpen,
} from "lucide-react";
import {
  DELIVERABLES,
  DELIVERABLE_DISPLAY_ORDER,
} from "@/lib/export/deliverables";
import type { DeliverableReview } from "@/lib/export/deliverable-readiness";
import type { DeliverableId } from "@/lib/export/types";

type Props = {
  /** Per-deliverable readiness, keyed by id. Computed server-side and
   *  passed in so the Command Center can render in one shot. */
  readiness: Record<DeliverableId, DeliverableReview>;
};

export function ExportsSection({ readiness }: Props) {
  const [selected, setSelected] = useState<Set<DeliverableId>>(new Set());
  const [bundling, setBundling] = useState(false);
  const [bundleErr, setBundleErr] = useState<string | null>(null);

  const allIds = DELIVERABLE_DISPLAY_ORDER;
  const allSelected = useMemo(
    () => allIds.length > 0 && allIds.every((id) => selected.has(id)),
    [allIds, selected],
  );
  const noneSelected = selected.size === 0;

  function toggle(id: DeliverableId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(allIds));
  }
  function clearAll() {
    setSelected(new Set());
  }

  async function downloadBundle() {
    if (selected.size === 0 || bundling) return;
    setBundling(true);
    setBundleErr(null);
    try {
      const res = await fetch("/api/agent/export/bundle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliverableIds: Array.from(selected),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(
          (j as { error?: string }).error ??
            `Bundle export failed (HTTP ${res.status})`,
        );
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const today = new Date().toISOString().slice(0, 10);
      a.download = `Franchisor-Blueprint-Bundle-${today}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setBundleErr(e instanceof Error ? e.message : "Bundle download failed");
    } finally {
      setBundling(false);
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-navy/10 p-5 sm:p-6 md:p-8">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <span className="text-[10px] uppercase tracking-[0.18em] text-gold-warm font-bold">
          Deliverables
        </span>
        <span className="text-[10px] uppercase tracking-[0.14em] text-grey-4 font-bold">
          {allIds.length} ready to assemble
        </span>
      </div>
      <h2 className="text-navy font-extrabold text-xl md:text-2xl mb-1">
        Download what you&apos;ve built
      </h2>
      <p className="text-grey-3 text-sm md:text-base leading-relaxed mb-5 max-w-[640px]">
        Every deliverable is generated live from your Blueprint. Tick the
        boxes you want, hit &quot;Download bundle&quot;, and you&apos;ll get a
        single ZIP with every selected file plus a cover README. Or click any
        single deliverable to download it on its own.
      </p>

      {/* Bundle action bar — sticky-style at the top so it's always
          visible while the customer scans the list. */}
      <div className="rounded-xl border border-navy/10 bg-cream/40 p-3 mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={allSelected ? clearAll : selectAll}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-navy hover:text-gold-warm transition-colors"
          >
            <input
              type="checkbox"
              checked={allSelected}
              readOnly
              className="w-4 h-4 accent-gold-warm cursor-pointer"
            />
            {allSelected ? "Clear all" : "Select all"}
          </button>
          <span className="text-[11px] text-grey-3">
            {selected.size > 0
              ? `${selected.size} of ${allIds.length} selected`
              : `${allIds.length} deliverables available`}
          </span>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => void downloadBundle()}
          disabled={noneSelected || bundling}
          className="inline-flex items-center gap-2 bg-navy text-cream hover:bg-navy-light disabled:opacity-40 disabled:cursor-not-allowed font-bold text-xs uppercase tracking-[0.1em] px-4 py-2.5 rounded-full transition-colors"
        >
          {bundling ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Building…
            </>
          ) : (
            <>
              <PackageOpen size={14} />
              {selected.size > 0
                ? `Download ${selected.size} as bundle`
                : "Download bundle"}
            </>
          )}
        </button>
      </div>

      {bundleErr && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800 mb-4">
          {bundleErr}
        </div>
      )}

      <div className="grid gap-3">
        {allIds.map((id) => {
          const def = DELIVERABLES[id];
          if (!def) return null;
          const review = readiness[id];
          if (!review) return null;
          const isSelected = selected.has(id);
          const isSlides = def.kind === "slides";
          const directDownloadHref = isSlides
            ? `/api/agent/export/${id}?format=pptx`
            : `/api/agent/export/${id}?format=docx`;
          const directDownloadLabel = isSlides
            ? "Download .pptx now"
            : "Download .docx now";
          return (
            <article
              key={id}
              className={`rounded-xl border p-4 sm:p-5 flex flex-wrap items-start gap-4 transition-colors ${
                isSelected
                  ? "border-gold bg-gold/5"
                  : "border-navy/10 bg-cream/50"
              }`}
            >
              {/* Checkbox column */}
              <label className="flex-shrink-0 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(id)}
                  className="w-5 h-5 accent-gold-warm cursor-pointer"
                  aria-label={`Add ${def.name} to bundle`}
                />
              </label>
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold">
                <FileText size={18} />
              </div>
              <div className="flex-1 min-w-[260px]">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
                  <h3 className="text-navy font-bold text-base">{def.name}</h3>
                  <ReadinessBadge pct={review.overallPct} gaps={review.totalGaps} />
                  {isSlides && (
                    <span className="text-[10px] uppercase tracking-wider font-bold text-grey-4 bg-grey-1/40 border border-navy/10 rounded-full px-2 py-0.5">
                      .pptx
                    </span>
                  )}
                </div>
                <p className="text-grey-3 text-sm leading-relaxed mb-3">
                  {def.description}
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                  <Link
                    href={`/portal/exports/${id}`}
                    className="inline-flex items-center gap-1.5 text-navy hover:text-navy-light font-bold uppercase tracking-[0.1em] py-1 transition-colors"
                  >
                    Review before export <ArrowRight size={12} />
                  </Link>
                  <a
                    href={directDownloadHref}
                    className="inline-flex items-center gap-1.5 text-grey-4 hover:text-navy font-semibold py-1 transition-colors"
                  >
                    <Download size={12} />
                    {directDownloadLabel}
                  </a>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ReadinessBadge({ pct, gaps }: { pct: number; gaps: number }) {
  if (pct >= 95) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
        <CheckCircle2 size={11} />
        Ready
      </span>
    );
  }
  if (pct >= 50) {
    return (
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
        {pct}% · {gaps} gap{gaps === 1 ? "" : "s"}
      </span>
    );
  }
  return (
    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-grey-4 bg-grey-1/50 border border-navy/10 rounded-full px-2 py-0.5">
      {pct}% complete
    </span>
  );
}

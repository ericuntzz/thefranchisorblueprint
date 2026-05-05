/**
 * ExportsSection — deliverable downloads on /portal.
 *
 * Lists every deliverable in the registry with:
 *   - readiness % (deliverable-level, NOT overall Memory)
 *   - 1-line description
 *   - "Review before export" link → /portal/exports/[id]
 *   - Direct "Download .docx" link → /api/agent/export/[id]?format=docx
 *
 * The dual-CTA is intentional. "Review" lands the customer on the
 * confidence-review screen where they can see what's missing and sign
 * off. "Download" is the impatient path — they get the doc immediately
 * with "—" in the gaps. Most customers will use Review first; power
 * users will skip it after the first time.
 */

import Link from "next/link";
import { ArrowRight, CheckCircle2, Download, FileText } from "lucide-react";
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
  return (
    <section className="bg-white rounded-2xl border border-navy/10 p-5 sm:p-6 md:p-8">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <span className="text-[10px] uppercase tracking-[0.18em] text-gold-warm font-bold">
          Deliverables
        </span>
        <span className="text-[10px] uppercase tracking-[0.14em] text-grey-4 font-bold">
          {DELIVERABLE_DISPLAY_ORDER.length} ready to assemble
        </span>
      </div>
      <h2 className="text-navy font-extrabold text-xl md:text-2xl mb-1">
        Download what you&apos;ve built
      </h2>
      <p className="text-grey-3 text-sm md:text-base leading-relaxed mb-5 max-w-[640px]">
        Every deliverable is generated live from your Blueprint. Review what&apos;s
        missing first, or download the current draft now — gaps render as &quot;—&quot;
        and your attorney can fill them by hand.
      </p>

      <div className="grid gap-3">
        {DELIVERABLE_DISPLAY_ORDER.map((id) => {
          const def = DELIVERABLES[id];
          const review = readiness[id];
          return (
            <article
              key={id}
              className="rounded-xl border border-navy/10 bg-cream/50 p-4 sm:p-5 flex flex-wrap items-start gap-4"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold">
                <FileText size={18} />
              </div>
              <div className="flex-1 min-w-[260px]">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
                  <h3 className="text-navy font-bold text-base">{def.name}</h3>
                  <ReadinessBadge pct={review.overallPct} gaps={review.totalGaps} />
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
                    href={`/api/agent/export/${id}?format=docx`}
                    className="inline-flex items-center gap-1.5 text-grey-4 hover:text-navy font-semibold py-1 transition-colors"
                  >
                    <Download size={12} />
                    Download .docx now
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

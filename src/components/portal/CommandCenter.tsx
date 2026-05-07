/**
 * CommandCenter — the new hero block on /portal.
 *
 * The product designer's recommendation: make the portal feel like
 * the dashboard of a guided franchising tax return, not the file
 * manager of an AI document workspace. This block answers the only
 * question the customer should have to ask on landing: *what do I do
 * next?*
 *
 * Layout:
 *   - Eyebrow: "Franchise Readiness"
 *   - Headline: "{firstName}'s Blueprint is X% complete" (or generic)
 *   - Next-up panel: phase + question label + estimated time + why it
 *     matters, anchored by a single primary CTA → /portal/lab/next
 *   - Secondary actions: View full Blueprint / Pre-fill from your site
 *
 * If the queue is empty (every required chapter answered), we swap to
 * a celebratory "you're caught up" state pointing at the Blueprint.
 */

import Link from "next/link";
import { ArrowRight, Globe, ListChecks, Sparkles } from "lucide-react";
import type { QueueSummary } from "@/lib/memory/queue";
import { phaseForSlug } from "@/lib/memory/phases";

type Props = {
  firstName: string | null;
  /** 0-100 weighted readiness across all chapters with a schema. */
  readinessPct: number;
  /** Queue summary used to surface the "next question" hero CTA. */
  queue: QueueSummary;
  /** How many minutes the queue is likely to take, end-to-end. */
  estimateMin: number;
};

export function CommandCenter({
  firstName,
  readinessPct,
  queue,
  estimateMin,
}: Props) {
  const next = queue.next;
  const allCaughtUp = queue.total === 0;

  return (
    <section className="rounded-2xl bg-navy text-cream p-5 sm:p-6 md:p-8 shadow-[0_12px_32px_rgba(30,58,95,0.18)]">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <span className="text-xs uppercase tracking-[0.16em] text-gold font-bold">
          Franchise Readiness
        </span>
        <span className="text-xs uppercase tracking-[0.12em] text-cream/80 font-bold">
          {readinessPct}% complete
        </span>
      </div>
      <h1 className="text-cream font-extrabold text-2xl md:text-4xl leading-tight mb-3">
        {firstName
          ? `${firstName}'s Blueprint is ${readinessPct}% complete`
          : `Your Blueprint is ${readinessPct}% complete`}
      </h1>

      {/* Progress bar — gold gradient pops against navy. */}
      <div className="h-2 rounded-full bg-cream/15 overflow-hidden mb-6">
        <div
          className="h-full bg-gradient-to-r from-gold to-gold-warm transition-all duration-500"
          style={{ width: `${readinessPct}%` }}
        />
      </div>

      {allCaughtUp || !next ? (
        <CaughtUpPanel />
      ) : (
        <NextStepPanel
          next={next}
          totalLeft={queue.total}
          requiredLeft={queue.totalRequired}
          estimateMin={estimateMin}
        />
      )}

      {/* Secondary actions — readable on navy. */}
      <div className="mt-5 pt-5 border-t border-cream/10 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <Link
          href="/portal/lab/blueprint"
          className="inline-flex items-center gap-1.5 text-cream/70 hover:text-gold font-semibold transition-colors py-1.5"
        >
          <ListChecks size={12} />
          View full Blueprint
        </Link>
        <Link
          href="/portal/lab/intake"
          className="inline-flex items-center gap-1.5 text-cream/70 hover:text-gold font-semibold transition-colors py-1.5"
        >
          <Globe size={12} />
          Pre-fill from your website
        </Link>
      </div>
    </section>
  );
}

function NextStepPanel({
  next,
  totalLeft,
  requiredLeft,
  estimateMin,
}: {
  next: NonNullable<QueueSummary["next"]>;
  totalLeft: number;
  requiredLeft: number;
  estimateMin: number;
}) {
  const phase = phaseForSlug(next.slug);
  return (
    <div className="rounded-xl bg-cream/10 border border-cream/15 p-4 sm:p-5">
      <div className="flex items-baseline gap-2 mb-2 text-xs uppercase tracking-[0.14em] font-bold">
        <span className="text-gold">Next up</span>
        {phase && (
          <span className="text-cream/70">· {phase.title} phase</span>
        )}
      </div>
      <div className="text-cream font-bold text-lg md:text-xl leading-tight mb-1.5">
        {next.fieldDef.label}
      </div>
      {next.fieldDef.helpText && (
        <p className="text-cream/70 text-sm leading-relaxed mb-3 max-w-[600px]">
          {next.fieldDef.helpText}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-cream/60 leading-relaxed">
          {totalLeft} {totalLeft === 1 ? "question" : "questions"} left ·{" "}
          {requiredLeft} required · ~{estimateMin} min total
        </div>
        <Link
          href="/portal/lab/next"
          className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-xs uppercase tracking-[0.1em] px-5 py-3 rounded-full hover:bg-gold-dark transition-colors"
        >
          <Sparkles size={13} />
          Continue building
          <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}

function CaughtUpPanel() {
  return (
    <div className="rounded-xl bg-emerald-500/15 border border-emerald-400/30 p-4 sm:p-5">
      <div className="text-xs uppercase tracking-[0.14em] font-bold text-emerald-300 mb-1.5">
        You&apos;re caught up
      </div>
      <p className="text-cream/85 text-sm leading-relaxed mb-4 max-w-[600px]">
        Every required question is answered. Time to redraft chapters with the
        new context, or open advanced questions if you want to dig deeper.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/portal/lab/blueprint"
          className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-xs uppercase tracking-[0.1em] px-5 py-3 rounded-full hover:bg-gold-dark transition-colors"
        >
          Open the Blueprint <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}

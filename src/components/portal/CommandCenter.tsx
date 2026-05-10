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
 *     matters, anchored by a single primary CTA → /portal/blueprint-builder
 *   - Secondary actions: View full Blueprint / Pre-fill from your site
 *
 * If the queue is empty (every required section answered), we swap to
 * a celebratory "you're caught up" state pointing at the Blueprint.
 */

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import type { QueueSummary } from "@/lib/memory/queue";
import { phaseForSlug } from "@/lib/memory/phases";

type Props = {
  firstName: string | null;
  /** 0-100 weighted readiness across all sections with a schema. */
  readinessPct: number;
  /** Queue summary used to surface the "next question" hero CTA. */
  queue: QueueSummary;
};

export function CommandCenter({
  firstName,
  readinessPct,
  queue,
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
        <NextStepPanel next={next} />
      )}

      {/* Secondary "View full Blueprint" / "Pre-fill from your website"
          links removed — both destinations are reachable from the
          left sidebar, and stripping them lets the next-question
          panel be the unambiguous primary action. */}
    </section>
  );
}

function NextStepPanel({
  next,
}: {
  next: NonNullable<QueueSummary["next"]>;
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
      {/* Title + description bumped a step up (text-lg → text-xl,
          text-sm → text-base) per Eric 2026-05-09 — at the dashboard's
          ~1100px content width these read too small at the prior size.
          The "X questions left · Y required · ~Z min total" stat row
          that used to sit between description and button was also
          removed; readiness % at the top of the card already conveys
          progress without the extra noise. */}
      <div className="text-cream font-bold text-xl md:text-2xl leading-tight mb-2">
        {next.fieldDef.label}
      </div>
      {next.fieldDef.helpText && (
        <p className="text-cream/70 text-base leading-relaxed mb-4 max-w-[600px]">
          {next.fieldDef.helpText}
        </p>
      )}
      <div className="flex justify-end">
        <Link
          href="/portal/blueprint-builder"
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
        Every required question is answered. Time to redraft sections with the
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

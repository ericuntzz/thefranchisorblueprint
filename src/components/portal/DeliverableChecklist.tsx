/**
 * DeliverableChecklist — phase-grouped readiness grid for the
 * Command Center.
 *
 * Sits below the hero on /portal. The customer scans the grid and
 * sees, at a glance, which sections are green/amber/red/gray. Click
 * any section card → jumps to that section on /portal/lab/blueprint.
 *
 * The grouping mirrors the Question Queue's phase order so the two
 * surfaces feel like the same product:
 *   Discover → Economics → Operations → People → Growth → Compliance
 *
 * What this is NOT:
 *   - Not a navigation surface for the queue (use the Continue
 *     Building CTA in the hero for that).
 *   - Not the section editor (that's /portal/lab/blueprint).
 *   - Not an export checklist (that ships with the export pipeline
 *     in Phase 2 proper).
 *
 * It's a status surface. The TurboTax parallel: the right-side panel
 * showing "Federal · State · Review · File" with check marks.
 */

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { SectionReadiness } from "@/lib/memory/readiness";
import type { MemoryFileSlug } from "@/lib/memory/files";
import { PHASES, type PhaseDef } from "@/lib/memory/phases";
import { MEMORY_FILE_TITLES } from "@/lib/memory/files";

type Props = {
  readiness: Record<MemoryFileSlug, SectionReadiness>;
};

const STATE_LABEL = {
  green: "Complete",
  // Both amber and red collapse to "In progress" — the customer
  // doesn't need a third color shouting at them. The underlying
  // state is preserved on each row's color tint, but the legend
  // only surfaces three categories.
  amber: "In progress",
  red: "In progress",
  gray: "Not started",
} as const;

const STATE_DOT = {
  green: "bg-emerald-500",
  amber: "bg-amber-400",
  // Red folds into amber visually — same dot, same row tint, same
  // "in progress" label. Underlying state preserved for analytics.
  red: "bg-amber-400",
  gray: "bg-grey-3/40",
} as const;

const STATE_ROW = {
  green:
    "bg-emerald-50 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400",
  amber:
    "bg-amber-50 border-amber-300 hover:bg-amber-100 hover:border-amber-400",
  red: "bg-amber-50 border-amber-300 hover:bg-amber-100 hover:border-amber-400",
  gray: "bg-white border-card-border hover:bg-cream-soft hover:border-navy/25",
} as const;

export function DeliverableChecklist({ readiness }: Props) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <span className="text-xs uppercase tracking-[0.14em] text-gold-text font-bold">
          Deliverable checklist
        </span>
        <Legend />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {PHASES.map((phase) => (
          <PhaseGroup key={phase.id} phase={phase} readiness={readiness} />
        ))}
      </div>
    </section>
  );
}

function Legend() {
  // Three categories total — green/amber/gray. Red folds into amber
  // visually so the customer reads one "in progress" bucket instead
  // of two competing yellows-and-reds.
  return (
    <div className="hidden md:flex items-center gap-3 text-xs uppercase tracking-[0.1em] font-bold text-grey-3">
      {(["green", "amber", "gray"] as const).map((s) => (
        <span key={s} className="inline-flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${STATE_DOT[s]}`} />
          {STATE_LABEL[s]}
        </span>
      ))}
    </div>
  );
}

function PhaseGroup({
  phase,
  readiness,
}: {
  phase: PhaseDef;
  readiness: Record<MemoryFileSlug, SectionReadiness>;
}) {
  // Per-phase summary: count states across the phase's sections.
  const states = phase.slugs
    .map((s) => readiness[s]?.state)
    .filter((s): s is SectionReadiness["state"] => !!s);
  const greenCount = states.filter((s) => s === "green").length;
  const totalCount = states.length;

  return (
    <div className="rounded-2xl border border-card-border bg-white p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <h3 className="text-navy font-extrabold text-base">
          {phase.title}
        </h3>
        <span className="text-xs text-grey-3 font-bold uppercase tracking-wider tabular-nums">
          {greenCount}/{totalCount}
        </span>
      </div>
      <p className="text-grey-3 text-xs leading-relaxed mb-3">
        {phase.subtitle}
      </p>
      <ul className="space-y-1.5">
        {phase.slugs.map((slug) => {
          const r = readiness[slug];
          if (!r) {
            // Schema-less sections (e.g. brand_voice today) still get
            // a row but render as "gray" + "no schema yet" — they
            // aren't ranked by the queue and the customer can't act
            // on them through this surface yet.
            return (
              <li key={slug}>
                <div className="flex items-center gap-2 rounded-lg border border-grey-3/30 bg-grey-1/60 px-3 py-2 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-grey-3/40 flex-shrink-0" />
                  <span className="font-semibold text-grey-3 flex-1 truncate">
                    {MEMORY_FILE_TITLES[slug]}
                  </span>
                  <span className="text-xs uppercase tracking-wider text-grey-3">
                    Coming soon
                  </span>
                </div>
              </li>
            );
          }
          return (
            <li key={slug}>
              <Link
                href={`/portal/section/${slug}`}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${STATE_ROW[r.state]}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATE_DOT[r.state]}`}
                />
                <span className="font-semibold text-navy flex-1 truncate">
                  {MEMORY_FILE_TITLES[slug]}
                </span>
                {r.totalRequired > 0 && r.state !== "green" && (
                  <span className="text-xs text-grey-3 tabular-nums">
                    {r.filledRequired}/{r.totalRequired}
                  </span>
                )}
                <ChevronRight
                  size={11}
                  className="text-grey-3 flex-shrink-0"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

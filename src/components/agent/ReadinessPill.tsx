"use client";

/**
 * ReadinessPill — the four-state status indicator used everywhere a
 * chapter's "where does this stand?" needs to be visible at a glance.
 *
 * The four states mirror the deliverable checklist on /portal:
 *
 *   green  — Verified. Customer has approved or every required field
 *            is filled + has prose.
 *   amber  — Inferred. Agent has done a pass; needs customer
 *            confirmation but isn't blocking.
 *   red    — Needs input. Started but missing required answers.
 *   gray   — Not started.
 *
 * Replaces the older `ConfidencePill` (which used the raw `confidence`
 * column directly). The new pill uses the computed `ReadinessState`
 * from `lib/memory/readiness.ts` so the same status reads the same
 * way on /portal, /portal/lab/blueprint, and any future surface.
 */

import type { ReadinessState } from "@/lib/memory/readiness";

const STYLE: Record<ReadinessState, string> = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-800 border-amber-200",
  red: "bg-red-50 text-red-700 border-red-200",
  gray: "bg-grey-1 text-grey-4 border-grey-3/30",
};

const LABEL: Record<ReadinessState, string> = {
  green: "Verified",
  amber: "Inferred",
  red: "Needs input",
  gray: "Not started",
};

const DOT: Record<ReadinessState, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-400",
  red: "bg-red-500",
  gray: "bg-grey-3/40",
};

export function ReadinessPill({
  state,
  withDot = false,
}: {
  state: ReadinessState;
  /** When true, prefixes the pill with a small color dot — useful
   *  when the pill sits next to other text that's already colored. */
  withDot?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full border ${STYLE[state]}`}
    >
      {withDot && (
        <span className={`w-1.5 h-1.5 rounded-full ${DOT[state]}`} />
      )}
      {LABEL[state]}
    </span>
  );
}

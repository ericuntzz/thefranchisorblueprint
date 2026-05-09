"use client";

/**
 * ReadinessPill — the four-state status indicator used everywhere a
 * section's "where does this stand?" needs to be visible at a glance.
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

// Solid-fill pill style: tinted bg + colored text reads as low-
// contrast on white cards (the colors all converge at near-white
// luminance). Solid bg + white text is the working-software pattern
// (Stripe, Linear) and stays legible at small sizes.
const STYLE: Record<ReadinessState, string> = {
  green: "bg-emerald-600 text-white shadow-sm",
  amber: "bg-amber-500 text-white shadow-sm",
  red: "bg-red-600 text-white shadow-sm",
  gray: "bg-grey-3 text-white shadow-sm",
};

const LABEL: Record<ReadinessState, string> = {
  green: "Verified",
  amber: "Inferred",
  red: "Needs input",
  gray: "Not started",
};

// Dot variant uses a lighter tone vs the solid pill so the dot
// reads against the white pill body — only used when withDot=true,
// which kicks the pill into "tinted bg" mode for inline contexts.
const DOT_STYLE: Record<ReadinessState, string> = {
  green: "bg-emerald-50 text-emerald-800 border border-emerald-300",
  amber: "bg-amber-50 text-amber-900 border border-amber-300",
  red: "bg-red-50 text-red-800 border border-red-300",
  gray: "bg-grey-1 text-grey-3 border border-card-border",
};

const DOT_COLOR: Record<ReadinessState, string> = {
  green: "bg-emerald-600",
  amber: "bg-amber-500",
  red: "bg-red-600",
  gray: "bg-grey-3",
};

export function ReadinessPill({
  state,
  withDot = false,
}: {
  state: ReadinessState;
  /** When true, prefixes the pill with a small color dot. The pill
   *  also switches to a lighter tinted treatment so the dot reads
   *  against it — solid pills don't need a dot. Use for inline
   *  contexts (tables, list rows) where a solid pill feels too heavy. */
  withDot?: boolean;
}) {
  if (withDot) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.06em] font-bold px-2 py-0.5 rounded-full ${DOT_STYLE[state]}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${DOT_COLOR[state]}`} />
        {LABEL[state]}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.06em] font-bold px-2 py-0.5 rounded-full ${STYLE[state]}`}
    >
      {LABEL[state]}
    </span>
  );
}

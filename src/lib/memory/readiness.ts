/**
 * Per-section readiness scoring for the Command Center on /portal.
 *
 * Maps each section to one of four states the customer can scan at a
 * glance:
 *
 *   green   — Verified by the customer. Either confidence === "verified"
 *             OR every required schema field is filled. This section
 *             is "attorney-ready" subject to a final review pass.
 *
 *   amber   — Inferred. Confidence === "inferred" (scrape / agent
 *             draft / extraction landed but the customer hasn't
 *             reviewed) OR confidence === "draft" with prose present.
 *             The agent's best guess; needs the customer to confirm.
 *
 *   red     — Has structured fields started but is blocking on
 *             required gaps. Confidence === "draft" or "empty" but
 *             the section has at least some content + still has
 *             required-empty fields. Or: no schema yet but the
 *             section sits in an active phase the customer is
 *             working through.
 *
 *   gray    — Untouched. No prose, no fields, no scrape. The
 *             section hasn't been started.
 *
 * The state per section is purely a *visualization*. The Question
 * Queue uses `queue.ts` to decide what to ask next; this module is
 * for the at-a-glance status indicator.
 */

import type {
  SectionAttachment,
  CustomerMemory,
} from "@/lib/supabase/types";
import type { MemoryFileSlug } from "./files";
import { SECTION_SCHEMAS } from "./schemas";
import type { MemoryFieldsMap } from "@/lib/calc";
import { hasCalc } from "@/lib/calc";

export type ReadinessState = "green" | "amber" | "red" | "gray";

export type SectionReadiness = {
  slug: MemoryFileSlug;
  state: ReadinessState;
  /** Required non-computed fields filled (numerator). */
  filledRequired: number;
  /** Required non-computed fields total (denominator). */
  totalRequired: number;
  /** All non-computed, non-advanced fields filled. */
  filledAll: number;
  /** All non-computed, non-advanced fields total. */
  totalAll: number;
  /** Has any prose body content. */
  hasProse: boolean;
  /** Confidence column from customer_memory if the row exists. */
  confidence: CustomerMemory["confidence"] | null;
};

/** Subset of CustomerMemory we need — read-shaped for the function. */
type MemoryRow = Pick<
  CustomerMemory,
  "file_slug" | "content_md" | "fields" | "confidence" | "attachments"
>;

/**
 * Compute readiness for every section in the schema set, given the
 * full per-user customer_memory rows. Always returns the entries —
 * a missing memory row maps to a `gray` state with zero counts.
 */
export function computeSectionReadiness(
  rowsBySlug: Map<MemoryFileSlug, MemoryRow>,
): Record<MemoryFileSlug, SectionReadiness> {
  const out: Partial<Record<MemoryFileSlug, SectionReadiness>> = {};
  const slugs = Object.keys(SECTION_SCHEMAS) as MemoryFileSlug[];

  for (const slug of slugs) {
    const schema = SECTION_SCHEMAS[slug];
    if (!schema) continue;
    const row = rowsBySlug.get(slug);

    const fields = (row?.fields ?? {}) as Record<string, unknown>;
    let filledRequired = 0;
    let totalRequired = 0;
    let filledAll = 0;
    let totalAll = 0;

    for (const fd of schema.fields) {
      if (fd.advanced) continue;
      if (hasCalc(slug, fd.name) || fd.computed) continue;
      totalAll += 1;
      if (fd.required) totalRequired += 1;
      if (isFilled(fields[fd.name])) {
        filledAll += 1;
        if (fd.required) filledRequired += 1;
      }
    }

    const hasProse = !!row?.content_md && row.content_md.trim().length >= 80;
    const confidence = row?.confidence ?? null;
    const allRequiredFilled =
      totalRequired > 0 && filledRequired === totalRequired;

    // State decision tree, in order:
    //   1. verified  → green (customer signed off, regardless of fill).
    //   2. nothing started → gray.
    //   3. everything required filled AND has prose → green
    //      (attorney-ready subject to verify pass).
    //   4. everything required filled (but no prose yet) → amber
    //      (ready to draft; no blockers).
    //   5. inferred OR (hasProse + some fields) → amber (agent did
    //      a pass; needs confirmation but isn't blocking).
    //   6. started but missing required inputs → red.
    //
    // Earlier version skipped case (4) — sections with all required
    // fields filled but no prose yet were rendering RED. That was
    // misleading: the customer had answered everything that's
    // actionable but the indicator screamed "blocking."
    let state: ReadinessState;
    if (confidence === "verified") {
      state = "green";
    } else if (filledAll === 0 && !hasProse) {
      state = "gray";
    } else if (allRequiredFilled && hasProse) {
      state = "green";
    } else if (allRequiredFilled) {
      state = "amber";
    } else if (confidence === "inferred" || (hasProse && filledAll > 0)) {
      state = "amber";
    } else {
      state = "red";
    }

    out[slug] = {
      slug,
      state,
      filledRequired,
      totalRequired,
      filledAll,
      totalAll,
      hasProse,
      confidence,
    };
  }

  return out as Record<MemoryFileSlug, SectionReadiness>;
}

/**
 * Roll up per-section readiness into a single 0-100 percentage for
 * the Command Center hero. We weight each section equally (any other
 * weighting feels arbitrary at this stage). State map:
 *   green  → 1.0
 *   amber  → 0.5
 *   red    → 0.25
 *   gray   → 0.0
 */
export function overallReadinessPct(
  readiness: Record<MemoryFileSlug, SectionReadiness>,
): number {
  const values = Object.values(readiness);
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, r) => {
    switch (r.state) {
      case "green":
        return acc + 1.0;
      case "amber":
        return acc + 0.5;
      case "red":
        return acc + 0.25;
      case "gray":
        return acc + 0;
    }
  }, 0);
  return Math.round((sum / values.length) * 100);
}

/** Build a Map<slug, MemoryRow> from a raw row array — convenience
 *  for callers that just queried customer_memory. */
export function indexMemoryRows(
  rows: Array<
    Pick<
      CustomerMemory,
      "file_slug" | "content_md" | "fields" | "confidence" | "attachments"
    >
  >,
): Map<MemoryFileSlug, MemoryRow> {
  const m = new Map<MemoryFileSlug, MemoryRow>();
  for (const r of rows) m.set(r.file_slug as MemoryFileSlug, r);
  return m;
}

function isFilled(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "boolean") return true;
  if (typeof v === "number") return Number.isFinite(v);
  return false;
}

/** Build a `MemoryFieldsMap` from indexed rows for use with the queue
 *  + calc lib. Tiny helper kept here so callers can do both reads
 *  in one spot. */
export function memoryFieldsFromRows(
  rowsBySlug: Map<MemoryFileSlug, MemoryRow>,
): MemoryFieldsMap {
  const out: MemoryFieldsMap = {};
  for (const [slug, row] of rowsBySlug) {
    out[slug] = (row.fields ?? {}) as Record<
      string,
      string | number | boolean | string[] | null
    >;
  }
  return out;
}

/** Read attachments out of a row. Returns []. */
export function attachmentsFor(
  rowsBySlug: Map<MemoryFileSlug, MemoryRow>,
  slug: MemoryFileSlug,
): SectionAttachment[] {
  return (rowsBySlug.get(slug)?.attachments ?? []) as SectionAttachment[];
}

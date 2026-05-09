/**
 * Deliverable-level readiness scoring.
 *
 * The section-level readiness in `lib/memory/readiness.ts` answers
 * "is this section ready for the agent to draft prose?" — useful for
 * the Question Queue and the Command Center.
 *
 * This module answers a different question: "is this DELIVERABLE
 * ready to export?" — which depends on the source sections being
 * filled in, not just on overall Memory completeness. The FDD draft
 * is meaningless without unit_economics + franchise_economics; the
 * Operations Manual is meaningless without operating_model.
 *
 * For each deliverable, this returns:
 *   - overall pct (0-100) — fill-rate weighted by required-field count
 *   - per-section status — green/amber/red/gray as the customer sees
 *   - gaps — required fields still empty, surfaced on the review screen
 *   - inferences — fields that are still confidence='inferred' from
 *     the scrape (not customer-confirmed)
 *
 * The pre-export review screen renders this so the customer can sign
 * off section-by-section before downloading. The API endpoint reads
 * the overall pct only as a soft warning — we still let the customer
 * download a partially-filled draft (the doc renders "—" for missing
 * values, which the customer + their attorney can fill in by hand).
 */

import { SECTION_SCHEMAS } from "@/lib/memory/schemas";
import { hasCalc } from "@/lib/calc";
import { MEMORY_FILE_TITLES, type MemoryFileSlug } from "@/lib/memory/files";
import type { BuildContext, DeliverableDef } from "./types";
import { isFilled } from "./format";

export type FieldGap = {
  sectionSlug: MemoryFileSlug;
  sectionTitle: string;
  fieldName: string;
  fieldLabel: string;
  required: boolean;
};

export type SectionReviewState = {
  slug: MemoryFileSlug;
  title: string;
  state: "green" | "amber" | "red" | "gray";
  /** Required fields filled (numerator). */
  filledRequired: number;
  /** Required fields total (denominator). */
  totalRequired: number;
  /** Section-level confidence from customer_memory. */
  confidence: "verified" | "inferred" | "draft" | null;
  gaps: FieldGap[];
};

export type DeliverableReview = {
  /** 0-100, weighted by required-field fill across the deliverable's source sections. */
  overallPct: number;
  /** Total required fields across all source sections. */
  totalRequired: number;
  /** Required fields still empty. */
  totalGaps: number;
  /** Per-section breakdown. */
  sections: SectionReviewState[];
  /** Whether the deliverable can be exported. We always return true —
   *  partial exports are valid; missing values render as "—" in the
   *  output. The UI surfaces the warning, not the gate. */
  canExport: boolean;
};

export function reviewDeliverable(
  def: DeliverableDef,
  ctx: BuildContext,
): DeliverableReview {
  let totalRequired = 0;
  let filledRequired = 0;
  const sections: SectionReviewState[] = [];

  for (const slug of def.sourceSections) {
    const schema = SECTION_SCHEMAS[slug];
    if (!schema) {
      // Section without a schema (rare, e.g. legacy slugs) — skip.
      sections.push({
        slug,
        title: MEMORY_FILE_TITLES[slug],
        state: "gray",
        filledRequired: 0,
        totalRequired: 0,
        confidence: null,
        gaps: [],
      });
      continue;
    }

    const section = ctx.memory[slug];
    const fields = section?.fields ?? {};

    let sectionRequired = 0;
    let sectionFilled = 0;
    const gaps: FieldGap[] = [];

    for (const fd of schema.fields) {
      // Skip computed fields — they're derived, not customer-typed.
      if (hasCalc(slug, fd.name) || fd.computed) continue;
      // Skip advanced fields from the required-fill calc (advanced
      // fields are intentionally optional — they won't ever block
      // export). They still render in the doc if filled.
      if (fd.advanced) continue;
      if (!fd.required) continue;

      sectionRequired += 1;
      totalRequired += 1;
      if (isFilled(fields[fd.name])) {
        sectionFilled += 1;
        filledRequired += 1;
      } else {
        gaps.push({
          sectionSlug: slug,
          sectionTitle: schema.title,
          fieldName: fd.name,
          fieldLabel: fd.label,
          required: true,
        });
      }
    }

    const confidence = section?.confidence ?? null;

    let state: SectionReviewState["state"];
    if (sectionRequired === 0) {
      state = section ? "amber" : "gray";
    } else if (sectionFilled === sectionRequired && confidence === "verified") {
      state = "green";
    } else if (sectionFilled === sectionRequired) {
      state = "amber"; // ready, but not verified
    } else if (sectionFilled === 0) {
      state = "gray";
    } else {
      state = "red";
    }

    sections.push({
      slug,
      title: schema.title,
      state,
      filledRequired: sectionFilled,
      totalRequired: sectionRequired,
      confidence,
      gaps,
    });
  }

  const overallPct = totalRequired === 0 ? 0 : Math.round((filledRequired / totalRequired) * 100);
  const totalGaps = totalRequired - filledRequired;

  return {
    overallPct,
    totalRequired,
    totalGaps,
    sections,
    canExport: true,
  };
}

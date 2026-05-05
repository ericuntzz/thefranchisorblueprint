/**
 * Deliverable-level readiness scoring.
 *
 * The chapter-level readiness in `lib/memory/readiness.ts` answers
 * "is this chapter ready for the agent to draft prose?" — useful for
 * the Question Queue and the Command Center.
 *
 * This module answers a different question: "is this DELIVERABLE
 * ready to export?" — which depends on the source chapters being
 * filled in, not just on overall Memory completeness. The FDD draft
 * is meaningless without unit_economics + franchise_economics; the
 * Operations Manual is meaningless without operating_model.
 *
 * For each deliverable, this returns:
 *   - overall pct (0-100) — fill-rate weighted by required-field count
 *   - per-chapter status — green/amber/red/gray as the customer sees
 *   - gaps — required fields still empty, surfaced on the review screen
 *   - inferences — fields that are still confidence='inferred' from
 *     the scrape (not customer-confirmed)
 *
 * The pre-export review screen renders this so the customer can sign
 * off chapter-by-chapter before downloading. The API endpoint reads
 * the overall pct only as a soft warning — we still let the customer
 * download a partially-filled draft (the doc renders "—" for missing
 * values, which the customer + their attorney can fill in by hand).
 */

import { CHAPTER_SCHEMAS } from "@/lib/memory/schemas";
import { hasCalc } from "@/lib/calc";
import { MEMORY_FILE_TITLES, type MemoryFileSlug } from "@/lib/memory/files";
import type { BuildContext, DeliverableDef } from "./types";
import { isFilled } from "./format";

export type FieldGap = {
  chapterSlug: MemoryFileSlug;
  chapterTitle: string;
  fieldName: string;
  fieldLabel: string;
  required: boolean;
};

export type ChapterReviewState = {
  slug: MemoryFileSlug;
  title: string;
  state: "green" | "amber" | "red" | "gray";
  /** Required fields filled (numerator). */
  filledRequired: number;
  /** Required fields total (denominator). */
  totalRequired: number;
  /** Chapter-level confidence from customer_memory. */
  confidence: "verified" | "inferred" | "draft" | null;
  gaps: FieldGap[];
};

export type DeliverableReview = {
  /** 0-100, weighted by required-field fill across the deliverable's source chapters. */
  overallPct: number;
  /** Total required fields across all source chapters. */
  totalRequired: number;
  /** Required fields still empty. */
  totalGaps: number;
  /** Per-chapter breakdown. */
  chapters: ChapterReviewState[];
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
  const chapters: ChapterReviewState[] = [];

  for (const slug of def.sourceChapters) {
    const schema = CHAPTER_SCHEMAS[slug];
    if (!schema) {
      // Chapter without a schema (rare, e.g. legacy slugs) — skip.
      chapters.push({
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

    const chapter = ctx.memory[slug];
    const fields = chapter?.fields ?? {};

    let chapterRequired = 0;
    let chapterFilled = 0;
    const gaps: FieldGap[] = [];

    for (const fd of schema.fields) {
      // Skip computed fields — they're derived, not customer-typed.
      if (hasCalc(slug, fd.name) || fd.computed) continue;
      // Skip advanced fields from the required-fill calc (advanced
      // fields are intentionally optional — they won't ever block
      // export). They still render in the doc if filled.
      if (fd.advanced) continue;
      if (!fd.required) continue;

      chapterRequired += 1;
      totalRequired += 1;
      if (isFilled(fields[fd.name])) {
        chapterFilled += 1;
        filledRequired += 1;
      } else {
        gaps.push({
          chapterSlug: slug,
          chapterTitle: schema.title,
          fieldName: fd.name,
          fieldLabel: fd.label,
          required: true,
        });
      }
    }

    const confidence = chapter?.confidence ?? null;

    let state: ChapterReviewState["state"];
    if (chapterRequired === 0) {
      state = chapter ? "amber" : "gray";
    } else if (chapterFilled === chapterRequired && confidence === "verified") {
      state = "green";
    } else if (chapterFilled === chapterRequired) {
      state = "amber"; // ready, but not verified
    } else if (chapterFilled === 0) {
      state = "gray";
    } else {
      state = "red";
    }

    chapters.push({
      slug,
      title: schema.title,
      state,
      filledRequired: chapterFilled,
      totalRequired: chapterRequired,
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
    chapters,
    canExport: true,
  };
}

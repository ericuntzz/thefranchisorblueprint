/**
 * The Question Queue.
 *
 * Given the customer's full Memory state + every chapter schema, walk
 * the schemas and surface the next set of structured-field questions
 * the customer should answer. This is the engine behind the guided
 * `/portal/lab/next` surface.
 *
 * Prioritization, in order:
 *   1. Phase order. Discover → Economics → Operations → People →
 *      Growth → Compliance. Don't ask about marketing fund governance
 *      before we know what the business does.
 *   2. Within a phase: chapter order, then field order within a chapter.
 *      Schemas are ordered intentionally; respect that.
 *   3. Required-but-empty first. Optional fields can wait.
 *   4. Skip:
 *        - Computed fields (calc-lib derives them).
 *        - Advanced fields (90% of customers won't touch them).
 *        - Already-filled fields (any non-empty value counts).
 *        - Fields whose `suggestedFrom: industry_lookup` source isn't
 *          resolvable yet (e.g. need industry_category set first —
 *          chicken-egg). The lookup tables themselves don't ship in
 *          this commit, so we just don't surface them as questions.
 *
 * The queue is recomputed on every page load. Cheap — pure JS over
 * already-loaded Memory. Sub-millisecond at the chapter scale we care
 * about.
 */

import type { MemoryFileSlug } from "./files";
import {
  CHAPTER_SCHEMAS,
  type FieldDef,
} from "./schemas";
import type { MemoryFieldsMap } from "@/lib/calc";
import { hasCalc } from "@/lib/calc";
import { PHASES, type PhaseDef, phaseForSlug } from "./phases";
import { MEMORY_FILE_TITLES } from "./files";

export type QueueItem = {
  /** Stable identifier — used as a React key + URL fragment. */
  id: string;
  phase: PhaseDef;
  slug: MemoryFileSlug;
  chapterTitle: string;
  fieldDef: FieldDef;
  /** True if this field is a `required: true` schema field (vs.
   *  optional). Required fields lead the queue; optional fields fall
   *  to the bottom of their phase. */
  isRequired: boolean;
};

/**
 * Compute the queue from the customer's current Memory state. Returns
 * the items in display order — the UI iterates start-to-finish.
 */
export function computeQuestionQueue(
  memory: MemoryFieldsMap,
): QueueItem[] {
  const required: QueueItem[] = [];
  const optional: QueueItem[] = [];

  for (const phase of PHASES) {
    for (const slug of phase.slugs) {
      const schema = CHAPTER_SCHEMAS[slug];
      if (!schema) continue; // brand_voice etc. — no schema yet
      const filled = memory[slug] ?? {};
      for (const fd of schema.fields) {
        if (fd.advanced) continue;
        if (hasCalc(slug, fd.name)) continue;
        if (fd.computed) continue;
        // Fields that depend on an industry-lookup table get skipped
        // until those tables ship — they'd return "—" right now and
        // confuse the customer.
        if (fd.suggestedFrom?.kind === "industry_lookup") continue;

        const v = filled[fd.name];
        if (isFieldFilled(v)) continue;

        const item: QueueItem = {
          id: `${slug}.${fd.name}`,
          phase,
          slug,
          chapterTitle: MEMORY_FILE_TITLES[slug],
          fieldDef: fd,
          isRequired: !!fd.required,
        };
        if (fd.required) required.push(item);
        else optional.push(item);
      }
    }
  }

  // Required first (in phase order), then optional (also phase order).
  return [...required, ...optional];
}

/** Total queue summary for the Command Center hero. */
export type QueueSummary = {
  total: number;
  totalRequired: number;
  totalOptional: number;
  /** The first item in the queue, if any — i.e. the customer's "next
   *  best step". Used to render the "Next: ..." hero CTA. */
  next: QueueItem | null;
  /** Per-phase counts for the deliverable checklist. */
  byPhase: Array<{
    phase: PhaseDef;
    questionsLeft: number;
    requiredLeft: number;
  }>;
};

export function summarizeQueue(items: QueueItem[]): QueueSummary {
  const byPhaseMap = new Map<
    string,
    { phase: PhaseDef; questionsLeft: number; requiredLeft: number }
  >();
  for (const phase of PHASES) {
    byPhaseMap.set(phase.id, { phase, questionsLeft: 0, requiredLeft: 0 });
  }
  for (const it of items) {
    const bucket = byPhaseMap.get(it.phase.id);
    if (!bucket) continue;
    bucket.questionsLeft += 1;
    if (it.isRequired) bucket.requiredLeft += 1;
  }

  return {
    total: items.length,
    totalRequired: items.filter((i) => i.isRequired).length,
    totalOptional: items.filter((i) => !i.isRequired).length,
    next: items[0] ?? null,
    byPhase: [...byPhaseMap.values()],
  };
}

/**
 * Best-effort estimate of how long the queue will take to clear, in
 * minutes. Naive: 60 seconds per textarea/markdown field, 25 seconds
 * everything else. Surfaces in the Command Center hero ("7 min").
 *
 * Intentionally optimistic — we want the customer to start. Once they
 * start they'll keep going, and the actual time is bounded by their
 * willingness to dig up answers, not by typing speed.
 */
export function estimateMinutes(items: QueueItem[]): number {
  let seconds = 0;
  for (const it of items) {
    const t = it.fieldDef.type;
    if (t === "textarea" || t === "markdown" || t === "list_long") {
      seconds += 60;
    } else if (t === "list_short") {
      seconds += 40;
    } else {
      seconds += 25;
    }
  }
  return Math.max(1, Math.round(seconds / 60));
}

/** True if a stored field value should be considered "filled". */
function isFieldFilled(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "boolean") return true; // false is still "answered"
  if (typeof v === "number") return Number.isFinite(v);
  return false;
}

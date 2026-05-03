/**
 * Per-chapter draft readiness — the gate for proactive Jason.
 *
 * When the customer hits "Draft with Jason" on a chapter that's
 * missing half its required inputs, the resulting draft is just
 * `[NEEDS INPUT]` placeholders dressed up as prose — the same
 * problem we've already designed against (sufficiency check at the
 * route, the InsufficientContextPanel routing CTA). This module is
 * the per-chapter sibling: instead of refusing to draft, it surfaces
 * *exactly which questions* would unblock a credible draft, so the
 * pre-draft modal can show them inline.
 *
 * The flow:
 *   1. Customer clicks Draft with Jason on, say, `unit_economics`.
 *   2. Modal opens, fetches `/api/agent/draft-readiness?slug=unit_economics`.
 *   3. If score >= MIN_DRAFTABLE_SCORE → modal renders the existing
 *      "notes for Jason + attachments" view; click Start Drafting.
 *   4. If score < MIN_DRAFTABLE_SCORE → modal swaps to a "Jason
 *      can draft, but it'll be weak unless we answer these:"
 *      view with inline inputs for the top blockers. Save inline,
 *      then Draft.
 *
 * Score formula: percentage of required fields filled, weighted
 * 100% on required and 0% on optional. If a chapter has zero
 * required fields (rare — most foundational chapters declare
 * several), we fall back to filledAll / totalAll so the score still
 * means something.
 */

import "server-only";
import {
  CHAPTER_SCHEMAS,
  type FieldDef,
} from "@/lib/memory/schemas";
import { hasCalc } from "@/lib/calc";
import type { MemoryFileSlug } from "@/lib/memory/files";
import { readMemoryFields } from "@/lib/memory";

/** Below this score we'll surface blockers in the pre-draft modal. */
export const MIN_DRAFTABLE_SCORE = 60;

/** Maximum number of blockers we surface inline. More than this and
 *  the modal becomes a form, defeating the point. The customer can
 *  always cycle through the full Question Queue if they want more. */
export const MAX_BLOCKERS = 5;

export type DraftBlocker = {
  /** The field's technical name on the chapter schema. */
  fieldName: string;
  /** Subset of the FieldDef the client renderer needs. We don't
   *  serialize the whole schema across the wire — just the bits the
   *  inline blocker UI actually uses. */
  fieldDef: FieldDef;
};

export type DraftReadiness = {
  slug: MemoryFileSlug;
  /** 0-100. >= MIN_DRAFTABLE_SCORE = ready, < = surface blockers. */
  score: number;
  filledRequired: number;
  totalRequired: number;
  filledAll: number;
  totalAll: number;
  /** Top blockers in schema order. Empty when the chapter is ready
   *  OR when the chapter has no schema (Phase 1.5b chapters). */
  blockers: DraftBlocker[];
};

/**
 * Compute readiness for one chapter. Pulls Memory fields fresh — this
 * is called from a route, so we want canonical state, not whatever
 * the client thinks Memory looks like.
 */
export async function assessDraftReadiness(args: {
  userId: string;
  slug: MemoryFileSlug;
}): Promise<DraftReadiness> {
  const schema = CHAPTER_SCHEMAS[args.slug];
  // No schema yet → can't assess; return a "ready" score so the modal
  // proceeds normally. This lets prose-only chapters (brand_voice)
  // continue to work the way they did before.
  if (!schema) {
    return {
      slug: args.slug,
      score: 100,
      filledRequired: 0,
      totalRequired: 0,
      filledAll: 0,
      totalAll: 0,
      blockers: [],
    };
  }

  const memRow = await readMemoryFields(args.userId, args.slug);
  const fields = (memRow?.fields ?? {}) as Record<string, unknown>;

  let filledRequired = 0;
  let totalRequired = 0;
  let filledAll = 0;
  let totalAll = 0;
  const unfilledRequired: FieldDef[] = [];

  for (const fd of schema.fields) {
    if (fd.advanced) continue;
    if (hasCalc(args.slug, fd.name) || fd.computed) continue;
    totalAll += 1;
    if (fd.required) totalRequired += 1;
    const v = fields[fd.name];
    if (isFilled(v)) {
      filledAll += 1;
      if (fd.required) filledRequired += 1;
    } else if (fd.required) {
      unfilledRequired.push(fd);
    }
  }

  const score =
    totalRequired > 0
      ? Math.round((filledRequired / totalRequired) * 100)
      : totalAll > 0
        ? Math.round((filledAll / totalAll) * 100)
        : 100;

  return {
    slug: args.slug,
    score,
    filledRequired,
    totalRequired,
    filledAll,
    totalAll,
    blockers: unfilledRequired.slice(0, MAX_BLOCKERS).map((fd) => ({
      fieldName: fd.name,
      fieldDef: fd,
    })),
  };
}

function isFilled(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "boolean") return true;
  if (typeof v === "number") return Number.isFinite(v);
  return false;
}

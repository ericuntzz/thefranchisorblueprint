/**
 * Deterministic math library for computed and derived fields.
 *
 * The schemas in `src/lib/memory/schemas.ts` declare which fields are
 * `computed` (read-only, fully derived) or `suggestedFrom: { kind:
 * "derived" }` (default value the customer can override). This module
 * implements the formulas behind those declarations.
 *
 * Why this lives in its own module:
 *   - The math is deterministic. Royalty math, EBITDA margin, and ramp
 *     curves should NEVER be done by an LLM — code is auditable and
 *     reproducible; an LLM can hallucinate. Per Eric's locked decision
 *     in Phase 0: "math should be code, not LLM probability."
 *   - It's used in three places: the editor UI (live-update computed
 *     fields as the customer edits inputs), the export pipeline (DOCX
 *     templates substitute computed values into FDD Items 7 and 19),
 *     and the agent's draft pipeline (Opus 4.7 reads computed values
 *     when writing section prose so the prose stays consistent with
 *     the math).
 *   - It's pure. No DB calls, no LLM calls, no async. Easy to test.
 *
 * The `runCalc` entry point evaluates a single computed-field formula
 * given the current Memory state. Callers pass:
 *   - `sectionFields`: the same-section fields jsonb.
 *   - `crossSection`: a map keyed by section slug for fields that
 *     reference fields in other sections (e.g.
 *     `franchisee_profile.minimum_liquid_capital_dollars` derives from
 *     `unit_economics.initial_investment_high_dollars`).
 *
 * If any required input is missing or non-numeric, the formula returns
 * `null`. The UI shows null computed fields as "—" until enough
 * dependencies are filled in.
 */

import type { MemoryFileSlug } from "@/lib/memory/files";

/** A field value as stored in customer_memory.fields. */
type FieldValue = string | number | boolean | string[] | null;

/** Convenience type for a section's full field bag. */
type SectionFields = Record<string, FieldValue>;

/** The full Memory state — all sections' fields keyed by slug. */
export type MemoryFieldsMap = Partial<Record<MemoryFileSlug, SectionFields>>;

/** Pull a numeric value or return null if missing/non-numeric. */
function num(fields: SectionFields, name: string): number | null {
  const v = fields[name];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

/** Pull a numeric from a different section, or null if missing. */
function crossNum(
  cross: MemoryFieldsMap,
  slug: MemoryFileSlug,
  name: string,
): number | null {
  const ch = cross[slug];
  if (!ch) return null;
  return num(ch, name);
}

// ---------------------------------------------------------------------------
// Formulas — keyed by `${section}.${field}` (matching the schema's namespace
// for cross-section references; same-section fields are aliased below).
// ---------------------------------------------------------------------------

type CalcCtx = {
  /** Same-section fields (the section being computed for). */
  fields: SectionFields;
  /** Cross-section access — keyed by slug. */
  cross: MemoryFieldsMap;
};

type CalcFn = (ctx: CalcCtx) => number | null;

/**
 * Operating profit margin (mature) = 100 − COGS% − Labor% − Occupancy%
 *                                       − Marketing% − Other opex%.
 *
 * Marketing and Other opex default to 0 if not set, since most concepts
 * lump them into Other or skip them. COGS / Labor / Occupancy are
 * required — return null if any of those is missing.
 */
const computeEbitdaMarginPct: CalcFn = ({ fields }) => {
  const cogs = num(fields, "cogs_pct");
  const labor = num(fields, "labor_pct");
  const occupancy = num(fields, "occupancy_pct");
  if (cogs == null || labor == null || occupancy == null) return null;
  const marketing = num(fields, "marketing_pct") ?? 0;
  const otherOpex = num(fields, "other_opex_pct") ?? 0;
  const margin = 100 - cogs - labor - occupancy - marketing - otherOpex;
  // Clamp to plausible range — negative margins are real but >100 is a
  // user error. Don't return >100; return null so the UI prompts to
  // recheck inputs.
  if (margin > 100) return null;
  return Math.round(margin * 10) / 10; // one decimal
};

/**
 * Payback period (months) =
 *   ((investment_low + investment_high) / 2)
 *      ÷ (AUV × EBITDA_margin% / 100)
 *      × 12
 *
 * Returns null if any required input is missing. Caps at 120 months
 * (10 years) — beyond that, the concept isn't franchisable on payback
 * alone, and we'd rather show "—" than a misleading 480-month figure.
 */
const computePaybackPeriodMonths: CalcFn = ({ fields }) => {
  const invLow = num(fields, "initial_investment_low_dollars");
  const invHigh = num(fields, "initial_investment_high_dollars");
  const auv = num(fields, "average_unit_volume_dollars");
  const ebitdaMargin = computeEbitdaMarginPct({ fields, cross: {} });
  if (invLow == null || invHigh == null || auv == null || ebitdaMargin == null)
    return null;
  if (ebitdaMargin <= 0) return null; // can't pay back at non-positive margin
  const avgInvestment = (invLow + invHigh) / 2;
  const annualProfit = auv * (ebitdaMargin / 100);
  if (annualProfit <= 0) return null;
  const months = (avgInvestment / annualProfit) * 12;
  if (months <= 0 || months > 120) return null;
  return Math.round(months);
};

/**
 * AUV year 1 = AUV × ramp_curve_year_1_pct / 100.
 * Suggested-default — customer can override if their actual data
 * differs. Returned in dollars (rounded to nearest $1,000).
 */
const computeAuvYear1Dollars: CalcFn = ({ fields }) => {
  const auv = num(fields, "average_unit_volume_dollars");
  const ramp = num(fields, "ramp_curve_year_1_pct");
  if (auv == null || ramp == null) return null;
  return Math.round((auv * ramp) / 100 / 1000) * 1000;
};

const computeAuvYear2Dollars: CalcFn = ({ fields }) => {
  const auv = num(fields, "average_unit_volume_dollars");
  const ramp = num(fields, "ramp_curve_year_2_pct");
  if (auv == null || ramp == null) return null;
  return Math.round((auv * ramp) / 100 / 1000) * 1000;
};

/**
 * Required liquid capital = 30% of high-end initial investment.
 * Cross-section — pulls from unit_economics. Suggested default; the
 * franchisor can set a different threshold based on their strategy.
 * Rounded to nearest $5,000 (typical franchise-marketing increment).
 */
const computeMinimumLiquidCapital: CalcFn = ({ cross }) => {
  const invHigh = crossNum(
    cross,
    "unit_economics",
    "initial_investment_high_dollars",
  );
  if (invHigh == null) return null;
  const value = invHigh * 0.3;
  return Math.round(value / 5000) * 5000;
};

/**
 * Required net worth = 3.5× minimum liquid capital. Industry standard
 * default. Rounded to nearest $25,000.
 */
const computeMinimumNetWorth: CalcFn = ({ fields, cross }) => {
  const liquid = num(fields, "minimum_liquid_capital_dollars") ??
    computeMinimumLiquidCapital({ fields, cross });
  if (liquid == null) return null;
  const value = liquid * 3.5;
  return Math.round(value / 25000) * 25000;
};

// ---------------------------------------------------------------------------
// Public registries — keyed by `${slug}.${fieldName}`.
//
// Two distinct registries because the schema has two distinct field
// archetypes that share math but differ in UX:
//
//   COMPUTED_FORMULAS — the field is fully derived; UI shows it as
//     read-only with a "Calculated" badge. The customer can NEVER
//     override (they edit the dependencies instead). Matches schema's
//     `computed:` declaration.
//
//   DERIVED_DEFAULTS — the field has a sensible computed default but
//     the customer can override. UI shows the input as editable; if
//     the customer hasn't typed anything, the suggested value appears
//     as a placeholder + a "Use suggested" affordance. Matches
//     schema's `suggestedFrom: { kind: "derived" }` declaration.
//
// Confusing the two leads to a UX bug where editable-with-default
// fields appear locked. Don't.
// ---------------------------------------------------------------------------

const COMPUTED_FORMULAS: Record<string, CalcFn> = {
  "unit_economics.ebitda_margin_pct": computeEbitdaMarginPct,
  "unit_economics.payback_period_months": computePaybackPeriodMonths,
};

const DERIVED_DEFAULTS: Record<string, CalcFn> = {
  "unit_economics.auv_year_1_dollars": computeAuvYear1Dollars,
  "unit_economics.auv_year_2_dollars": computeAuvYear2Dollars,
  "franchisee_profile.minimum_liquid_capital_dollars":
    computeMinimumLiquidCapital,
  "franchisee_profile.minimum_net_worth_dollars": computeMinimumNetWorth,
};

/** Returns true if the field is fully computed (read-only in the UI). */
export function hasCalc(slug: MemoryFileSlug, fieldName: string): boolean {
  return `${slug}.${fieldName}` in COMPUTED_FORMULAS;
}

/** Returns true if the field has a derived default (editable, suggested). */
export function hasDerivedDefault(
  slug: MemoryFileSlug,
  fieldName: string,
): boolean {
  return `${slug}.${fieldName}` in DERIVED_DEFAULTS;
}

/**
 * Compute a single field's value given the current Memory state.
 *
 * Looks across both registries. Callers usually want one or the other
 * (use `hasCalc` / `hasDerivedDefault` to disambiguate the field's UX
 * before calling this).
 *
 * Returns null if no formula is registered or any required dependency
 * is missing.
 */
export function runCalc(args: {
  slug: MemoryFileSlug;
  fieldName: string;
  fields: SectionFields;
  cross: MemoryFieldsMap;
}): number | null {
  const key = `${args.slug}.${args.fieldName}`;
  const fn = COMPUTED_FORMULAS[key] ?? DERIVED_DEFAULTS[key];
  if (!fn) return null;
  try {
    return fn({ fields: args.fields, cross: args.cross });
  } catch (err) {
    console.error(`[calc] formula ${key} threw:`, err);
    return null;
  }
}

/**
 * Compute every registered formula's current value given Memory state.
 * Returns same-shape MemoryFieldsMap with only the resolved (non-null)
 * values. Used by the editor for live display of computed fields AND
 * suggested defaults — the UI itself decides which to show as
 * read-only vs as a placeholder suggestion.
 */
export function computeAllFormulas(memory: MemoryFieldsMap): MemoryFieldsMap {
  const result: MemoryFieldsMap = {};
  const allKeys = [
    ...Object.keys(COMPUTED_FORMULAS),
    ...Object.keys(DERIVED_DEFAULTS),
  ];
  for (const key of allKeys) {
    const [slug, fieldName] = key.split(".") as [MemoryFileSlug, string];
    const fields = memory[slug] ?? {};
    const value = runCalc({ slug, fieldName, fields, cross: memory });
    if (value != null) {
      result[slug] = { ...(result[slug] ?? {}), [fieldName]: value };
    }
  }
  return result;
}

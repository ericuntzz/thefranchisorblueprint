/**
 * Phase grouping over the 16-section Memory layer.
 *
 * The sections are the deliverable structure (each compiles into
 * specific FDD items + manual sections). Phases are the navigation
 * structure shown to the customer — fewer, broader buckets that map to
 * how a founder actually thinks about franchising:
 *
 *   Discover  → "what is your business"
 *   Economics → "how does the money work"
 *   Operations→ "how do you run it day-to-day"
 *   People    → "who runs it"
 *   Growth    → "where + how to expand"
 *   Compliance→ "what regulators need"
 *
 * The Question Queue iterates through phases in order. The Command
 * Center renders the deliverable checklist grouped this way. Customers
 * never see "16 sections" as the front-line structure — they see the
 * six phases, with sections as the substructure.
 *
 * Why phase grouping lives here (not in schemas.ts): schemas describe
 * what each section *is*; phases describe how the customer *navigates*.
 * Two different audiences (Jason-the-SME vs. the customer-flow), kept
 * separate so we can reorder phases without touching the schema work.
 */

import type { MemoryFileSlug } from "./files";
import { MEMORY_FILE_TITLES } from "./files";

export type PhaseId =
  | "discover"
  | "economics"
  | "operations"
  | "people"
  | "growth"
  | "compliance";

export type PhaseDef = {
  id: PhaseId;
  /** Title shown in customer UI. Capitalized like a proper noun, not
   *  a system label. */
  title: string;
  /** One-sentence subtitle for the phase card. */
  subtitle: string;
  /** Section slugs that roll up into this phase, in display order. */
  slugs: MemoryFileSlug[];
};

/**
 * The canonical phase order. The Question Queue + Command Center both
 * iterate this list. Reorder here to change the customer's perceived
 * flow without touching anywhere else.
 */
export const PHASES: PhaseDef[] = [
  {
    id: "discover",
    title: "Discover",
    subtitle: "What you do, who you serve, why this scales.",
    slugs: [
      "business_overview",
      "brand_voice",
      "competitor_landscape",
      "market_strategy",
    ],
  },
  {
    id: "economics",
    title: "Economics",
    subtitle: "Unit economics + the franchisee's investment math.",
    slugs: ["unit_economics", "franchise_economics"],
  },
  {
    id: "operations",
    title: "Operations",
    subtitle: "How a single location runs, end to end.",
    slugs: ["operating_model", "recipes_and_menu", "vendor_supply_chain"],
  },
  {
    id: "people",
    title: "People",
    subtitle: "Who you franchise to and how you train them.",
    slugs: ["franchisee_profile", "training_program", "employee_handbook"],
  },
  {
    id: "growth",
    title: "Growth",
    subtitle: "Where you grow + how the marketing dollar gets spent.",
    slugs: ["territory_real_estate", "marketing_fund"],
  },
  {
    id: "compliance",
    title: "Compliance",
    subtitle: "Legal posture + the financial controls regulators look for.",
    slugs: ["compliance_legal", "reimbursement_policy"],
  },
];

/** Lookup: which phase does a given section belong to? Cached at module load. */
const PHASE_BY_SLUG = new Map<MemoryFileSlug, PhaseDef>();
for (const phase of PHASES) {
  for (const slug of phase.slugs) {
    PHASE_BY_SLUG.set(slug, phase);
  }
}

/** Phase containing this section, or null if the section is unphased. */
export function phaseForSlug(slug: MemoryFileSlug): PhaseDef | null {
  return PHASE_BY_SLUG.get(slug) ?? null;
}

/** Pretty title for one section — re-export for convenience so phase
 *  callers don't need to import MEMORY_FILE_TITLES separately. */
export function sectionTitle(slug: MemoryFileSlug): string {
  return MEMORY_FILE_TITLES[slug];
}

/**
 * Per-phase "anchor section" — the single section inside the phase
 * the customer is most likely to have a real document for. Used by
 * the Question Queue's phase-transition card to surface the right
 * doc-prompt at exactly the moment they cross into a new phase
 * (e.g., entering Economics → "Got a P&L?"). Picking one anchor
 * per phase (rather than all of them) keeps the transition card
 * focused on the highest-leverage upload — fan-out via auto-classify
 * spreads the doc across the rest of the phase's sections anyway.
 *
 * Choices reflect what's most-likely-to-already-exist in a real
 * operator's filing cabinet:
 *   - Discover    → business_overview   (pitch deck / About page)
 *   - Economics   → unit_economics      (P&L)
 *   - Operations  → operating_model     (ops manual)
 *   - People      → training_program    (training manual)
 *   - Growth      → marketing_fund      (marketing/ad-fund doc)
 *   - Compliance  → compliance_legal    (existing FDD / attorney letter)
 */
export const PHASE_DOC_ANCHOR: Record<PhaseId, MemoryFileSlug> = {
  discover: "business_overview",
  economics: "unit_economics",
  operations: "operating_model",
  people: "training_program",
  growth: "marketing_fund",
  compliance: "compliance_legal",
};

/**
 * Sanity check at module load — every section slug should belong to
 * exactly one phase. If we add a slug to MEMORY_FILES without
 * registering it here, the next dev-server restart logs a warning so
 * the omission gets caught fast.
 */
import { MEMORY_FILES } from "./files";
{
  const phasedSlugs = new Set<MemoryFileSlug>();
  for (const p of PHASES) for (const s of p.slugs) phasedSlugs.add(s);
  const missing = MEMORY_FILES.filter((s) => !phasedSlugs.has(s));
  if (missing.length > 0) {
    console.warn(
      `[memory/phases] These section slugs are not in any phase — they won't appear in the Question Queue or Command Center:`,
      missing,
    );
  }
}

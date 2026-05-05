/**
 * What-If scenario catalog.
 *
 * The franchise-specific edge cases an emerging franchisor doesn't
 * know to ask about — but Jason has seen play out a hundred times.
 * Each scenario surfaces a question the customer SHOULD be thinking
 * about, why it matters, and a 2-3 sentence Jason-voice take on it.
 *
 * Different from the schema-driven Question Queue: those are factual
 * gap-fills. These are JUDGMENT calls. The customer can't always
 * answer them in a single field — but reading them now beats
 * discovering them after a franchisee has signed.
 *
 * Adding scenarios: append below. Each scenario is filed under one
 * phase and (optionally) a related chapter for the deep-link.
 */

import type { MemoryFileSlug } from "@/lib/memory/files";
import type { PhaseId } from "@/lib/memory/phases";

export type ScenarioSeverity = "watch" | "important" | "critical";

export type ScenarioDef = {
  id: string;
  phase: PhaseId;
  /** The "what if?" question, customer-facing. */
  question: string;
  /** 2-3 sentence Jason-voice answer / framing. No exclamation marks. */
  answer: string;
  /** Why this matters in one short line. */
  why: string;
  /** Related chapter for the deep-link. */
  relatedChapter?: MemoryFileSlug;
  severity: ScenarioSeverity;
};

export const SCENARIOS: ScenarioDef[] = [
  // ── Discover phase ───────────────────────────────────────────────────
  {
    id: "concept_dependent_on_founder",
    phase: "discover",
    severity: "important",
    question: "What if the concept depends on YOU being there?",
    answer:
      "If the customer experience falls apart when you take a vacation, it falls apart when a franchisee opens 800 miles away. Before you franchise, document everything you do that the team thinks of as just \"how it works.\" The recipes, the greeting, the closing checklist. If you can't write it down, your franchisees can't replicate it.",
    why: "The single most common reason emerging brands fail to scale.",
    relatedChapter: "operating_model",
  },
  {
    id: "menu_too_complex",
    phase: "discover",
    severity: "watch",
    question: "What if your menu is too complex to franchise?",
    answer:
      "Franchisees can't run 60 SKUs the way you can. A focused menu of 25-35 items with clear prep steps trains faster, has lower waste, and produces more consistent food. Most franchisors trim before they franchise, not after.",
    why: "Menu complexity is the #1 driver of high franchisee labor cost.",
    relatedChapter: "recipes_and_menu",
  },

  // ── Economics phase ──────────────────────────────────────────────────
  {
    id: "unit_economics_in_one_market",
    phase: "economics",
    severity: "critical",
    question: "What if your unit economics only work in your home market?",
    answer:
      "Your existing locations probably benefit from local visibility, friend networks, or below-market rent. Before you franchise, model what the unit looks like in a market where nobody knows you. Higher CAC, market-rate rent, no walk-in friends — those numbers should still pencil. If they don't, you're not ready.",
    why: "A non-replicable model franchises poorly even when individual stores look great.",
    relatedChapter: "unit_economics",
  },
  {
    id: "royalty_underpriced",
    phase: "economics",
    severity: "critical",
    question: "What if your royalty is too low to fund support?",
    answer:
      "A 4% royalty sounds franchisee-friendly until you realize you need to fund field training, marketing, tech support, audit, legal — for every franchisee. Most emerging franchisors discover too late that 5-7% is the floor for a sustainable support org. Model your royalty against your fully-loaded support cost per franchisee, not against what makes the deal feel attractive.",
    why: "Underpriced royalty kills the franchisor before it kills the franchisees.",
    relatedChapter: "franchise_economics",
  },
  {
    id: "ramp_curve_optimism",
    phase: "economics",
    severity: "important",
    question: "What if franchisees take twice as long to ramp as you expect?",
    answer:
      "A 65% year-1 ramp is industry-typical. New owners with new staff in new markets often hit 45-55%. Run your franchisee-economics math at the lower number too — if the franchisee can't survive a slower ramp, you're going to have closures in years 2-3 and the FDD Item 20 disclosures will hurt recruitment.",
    why: "Optimistic ramp assumptions drive franchisee defaults.",
    relatedChapter: "unit_economics",
  },

  // ── Operations phase ─────────────────────────────────────────────────
  {
    id: "supplier_concentration",
    phase: "operations",
    severity: "important",
    question: "What if your primary supplier raises prices 20% next year?",
    answer:
      "Franchisees are locked into your approved-vendor list, so you absorb the brand-trust cost when they get squeezed. Keep at least one approved alternate per critical category. Negotiate volume rebates with the primary that include a price-increase ceiling. Document the alternate so franchisees can switch quickly if you tell them to.",
    why: "Supplier concentration is a hidden margin risk that compounds with franchise count.",
    relatedChapter: "vendor_supply_chain",
  },
  {
    id: "operations_software_lockin",
    phase: "operations",
    severity: "watch",
    question: "What if your required POS goes out of business?",
    answer:
      "Specifying a single mandatory POS in the FDD locks every franchisee into your choice. If the vendor folds or hikes pricing, you're rewriting the FDD and migrating dozens of franchisees. Consider specifying a class of POS (e.g. \"a cloud POS supporting these 4 integrations\") rather than a single brand, and disclose your right to change the spec.",
    why: "Vendor lock-in becomes a renegotiation event with every franchisee.",
    relatedChapter: "operating_model",
  },

  // ── People phase ─────────────────────────────────────────────────────
  {
    id: "wrong_franchisee_signed",
    phase: "people",
    severity: "critical",
    question: "What if you sign a franchisee who turns out to be wrong for the brand?",
    answer:
      "It happens — usually because the franchisor was hungry for the deal. The damage compounds: poor reviews, off-brand operations, complaints to the franchisor. Build in mandatory disqualifiers BEFORE Discovery Day, and use your scoring matrix as a hard gate, not a guideline. The cost of an empty territory is always less than the cost of the wrong franchisee.",
    why: "Wrong franchisees damage the brand for years longer than they own the unit.",
    relatedChapter: "franchisee_profile",
  },
  {
    id: "training_too_short",
    phase: "people",
    severity: "important",
    question: "What if your training is too short and franchisees fail?",
    answer:
      "5 days of training in a corporate location does not turn an experienced operator into a brand operator. Most successful emerging franchisors run 10-14 days for the owner-GM and supplement with 5-7 days on-site at the franchisee's location during opening week. Your training cost shows up in FDD Item 6; underinvesting here shows up in franchisee failure rate two years later.",
    why: "Training shortfalls predict 24-month franchisee failure.",
    relatedChapter: "training_program",
  },
  {
    id: "owner_operator_vs_absentee",
    phase: "people",
    severity: "important",
    question: "What if your franchisees want to run absentee but your model needs them on-site?",
    answer:
      "Owner-operator concepts struggle with semi-absentee buyers — quality drifts, manager turnover spikes, customer experience erodes. If you say \"flexible\" in your franchisee profile, expect mostly absentee buyers (they have more capital). If your concept needs hands-on owners, lock that requirement in writing and use your scoring matrix to disqualify investors-only candidates.",
    why: "Engagement-model mismatch creates structural underperformance.",
    relatedChapter: "franchisee_profile",
  },

  // ── Growth phase ─────────────────────────────────────────────────────
  {
    id: "ad_fund_underfunded",
    phase: "growth",
    severity: "important",
    question: "What if your ad fund can't move the needle until you have 50 units?",
    answer:
      "A 2% ad fund on $1M AUVs across 8 franchisees is $160K — enough for some local digital + a small content budget, not enough for meaningful brand-building. Set franchisee expectations early: the fund grows with you, and brand-level marketing accelerates after you cross unit-count thresholds. Consider a franchisor-funded \"seed\" budget for the first 2-3 years to bridge the gap.",
    why: "Ad-fund underperformance erodes franchisee-franchisor trust.",
    relatedChapter: "marketing_fund",
  },
  {
    id: "territory_too_big",
    phase: "growth",
    severity: "watch",
    question: "What if your protected territory is bigger than the unit can serve?",
    answer:
      "A 10-mile exclusive radius sounds franchisee-friendly until you have a unit pulling 80% of its sales from a 2-mile area, leaving 75% of the territory untapped. You can't add a unit without buying back the territory. Smaller, defensible territories with clear expansion rights protect both sides as the brand grows.",
    why: "Oversized territories cap your unit count without growing revenue.",
    relatedChapter: "territory_real_estate",
  },

  // ── Compliance phase ─────────────────────────────────────────────────
  {
    id: "fdd_state_choice_wrong",
    phase: "compliance",
    severity: "important",
    question: "What if you register in the wrong states first?",
    answer:
      "Registering in California or New York costs $5-15K and takes 60-120 days each — and if you have no franchisees there yet, you're paying to wait. Most emerging franchisors register first in non-registration states (TX, FL, GA, NC) where you can start selling as soon as the FDD is done, then add registration states as deals materialize. Your expansion strategy should drive your filing strategy, not the other way around.",
    why: "Premature registration ties up capital with no return.",
    relatedChapter: "compliance_legal",
  },
  {
    id: "item_19_too_aggressive",
    phase: "compliance",
    severity: "critical",
    question: "What if your Item 19 financial performance representation is too aggressive?",
    answer:
      "Every number in Item 19 must be substantiated under the reasonable-basis standard. If your AUV reflects 3 mature locations in your home market and you publish it as the franchise-wide expectation, you're inviting a misrepresentation claim the day a franchisee underperforms. Disclose narrowly, document your substantiation, and lean on \"these are the numbers we observed in OUR locations under THESE conditions.\"",
    why: "Item 19 mistakes are the single biggest source of franchisee litigation.",
    relatedChapter: "compliance_legal",
  },
  {
    id: "rebate_undisclosed",
    phase: "compliance",
    severity: "critical",
    question: "What if you have an undisclosed rebate from your supplier?",
    answer:
      "FDD Item 8 requires disclosure of any compensation the franchisor receives from required suppliers — including rebates, marketing allowances, and slotting fees. Failing to disclose is a regulatory violation that can void state registrations. If you have one, disclose it. If you're not sure whether something counts, your attorney will know.",
    why: "Undisclosed rebates are a fast path to losing state registrations.",
    relatedChapter: "vendor_supply_chain",
  },
];

/** Lookup by phase, ordered as listed. */
export function scenariosByPhase(phase: PhaseId): ScenarioDef[] {
  return SCENARIOS.filter((s) => s.phase === phase);
}

/** Total count, exposed so the UI can show "16 scenarios in your playbook". */
export const TOTAL_SCENARIOS = SCENARIOS.length;

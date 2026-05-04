/**
 * Industry lookup tables — the data backing every
 * `suggestedFrom: { kind: "industry_lookup" }` field declaration.
 *
 * Pattern is: customer types their industry once (in
 * `business_overview.industry_category`), and ~25 fields across
 * Memory get suggested defaults derived from that single answer.
 * NAICS code, typical royalty %, ad-fund %, term length, capital
 * thresholds — all the boilerplate a founder would otherwise have
 * to research. They're suggestions, not requirements; the customer
 * accepts or overrides per field.
 *
 * Source values are conservative midpoints from common franchise-
 * industry references (FDD comparison studies, IFA benchmarks,
 * NAICS official codes). The intent is to get a credible draft
 * out of Memory; the customer + their attorney refines later.
 *
 * Adding a new industry: extend INDUSTRY_PROFILES with the slug,
 * label, NAICS, and the relevant benchmark values. Anything not
 * present falls back to `null` — fields that depend on it just
 * won't surface a suggestion.
 *
 * Adding a new lookup type: extend IndustryProfile with the new
 * field, populate values for each profile, and update
 * `lookupIndustryValue` to switch on the new key.
 */

export type IndustrySlug =
  | "qsr_food"
  | "fast_casual_food"
  | "specialty_coffee"
  | "fitness_wellness"
  | "home_services"
  | "retail"
  | "health_beauty"
  | "education_tutoring"
  | "pet_services"
  | "automotive_services"
  | "other";

export type IndustryProfile = {
  slug: IndustrySlug;
  label: string;
  /** Free-text tokens we match the customer's typed
   *  `industry_category` against to auto-resolve a profile. Lower-
   *  cased substring search; first matching profile wins. */
  matchTokens: string[];
  /** Primary 6-digit NAICS code (US). */
  naicsCode: string;
  /** Typical initial franchise fee — single-unit franchisee. */
  initialFranchiseFee: number;
  /** Typical royalty rate as a percentage (0-100, not decimal). */
  royaltyPct: number;
  /** Typical ad fund / brand fund contribution rate (% of revenue). */
  adFundPct: number;
  /** Typical initial agreement term, in years. */
  agreementTermYears: number;
  /** Renewal term length, in years. */
  renewalTermYears: number;
  /** Typical liquid capital requirement, single unit ($). */
  liquidCapitalRequired: number;
  /** Typical minimum net worth, single unit ($). */
  netWorthRequired: number;
  /** Typical initial training duration, days. */
  trainingDays: number;
  /** Typical territorial protection radius, miles. Null when the
   *  category usually isn't territorialized. */
  protectedRadiusMiles: number | null;
};

export const INDUSTRY_PROFILES: IndustryProfile[] = [
  {
    slug: "qsr_food",
    label: "Quick-service restaurant (QSR)",
    matchTokens: ["qsr", "quick service", "quick-service", "fast food"],
    naicsCode: "722513",
    initialFranchiseFee: 35000,
    royaltyPct: 5.5,
    adFundPct: 2.5,
    agreementTermYears: 10,
    renewalTermYears: 10,
    liquidCapitalRequired: 200000,
    netWorthRequired: 750000,
    trainingDays: 21,
    protectedRadiusMiles: 1.5,
  },
  {
    slug: "fast_casual_food",
    label: "Fast-casual restaurant",
    matchTokens: ["fast casual", "fast-casual", "casual restaurant"],
    naicsCode: "722513",
    initialFranchiseFee: 40000,
    royaltyPct: 5,
    adFundPct: 2,
    agreementTermYears: 10,
    renewalTermYears: 10,
    liquidCapitalRequired: 250000,
    netWorthRequired: 1000000,
    trainingDays: 28,
    protectedRadiusMiles: 2,
  },
  {
    slug: "specialty_coffee",
    label: "Specialty coffee café",
    matchTokens: [
      "coffee",
      "café",
      "cafe",
      "espresso",
      "specialty coffee",
      "third wave",
      "third-wave",
    ],
    naicsCode: "722515",
    initialFranchiseFee: 30000,
    royaltyPct: 6,
    adFundPct: 2,
    agreementTermYears: 10,
    renewalTermYears: 5,
    liquidCapitalRequired: 150000,
    netWorthRequired: 500000,
    trainingDays: 21,
    protectedRadiusMiles: 1,
  },
  {
    slug: "fitness_wellness",
    label: "Fitness / wellness",
    matchTokens: [
      "fitness",
      "gym",
      "boutique fitness",
      "wellness",
      "yoga",
      "pilates",
      "spa",
    ],
    naicsCode: "713940",
    initialFranchiseFee: 45000,
    royaltyPct: 7,
    adFundPct: 2,
    agreementTermYears: 10,
    renewalTermYears: 10,
    liquidCapitalRequired: 100000,
    netWorthRequired: 350000,
    trainingDays: 14,
    protectedRadiusMiles: 3,
  },
  {
    slug: "home_services",
    label: "Home services (cleaning, repair, lawn)",
    matchTokens: [
      "home service",
      "home services",
      "cleaning",
      "lawn",
      "landscaping",
      "handyman",
      "pest",
      "plumbing",
      "hvac",
    ],
    naicsCode: "561720",
    initialFranchiseFee: 35000,
    royaltyPct: 6,
    adFundPct: 2,
    agreementTermYears: 10,
    renewalTermYears: 10,
    liquidCapitalRequired: 50000,
    netWorthRequired: 150000,
    trainingDays: 7,
    protectedRadiusMiles: 5,
  },
  {
    slug: "retail",
    label: "Retail store",
    matchTokens: ["retail", "store", "shop", "boutique"],
    naicsCode: "452990",
    initialFranchiseFee: 30000,
    royaltyPct: 6,
    adFundPct: 2,
    agreementTermYears: 10,
    renewalTermYears: 5,
    liquidCapitalRequired: 100000,
    netWorthRequired: 350000,
    trainingDays: 14,
    protectedRadiusMiles: 2,
  },
  {
    slug: "health_beauty",
    label: "Health & beauty",
    matchTokens: [
      "salon",
      "barbershop",
      "barber shop",
      "med spa",
      "medspa",
      "beauty",
      "esthetics",
      "nail",
    ],
    naicsCode: "812112",
    initialFranchiseFee: 40000,
    royaltyPct: 6.5,
    adFundPct: 2,
    agreementTermYears: 10,
    renewalTermYears: 10,
    liquidCapitalRequired: 100000,
    netWorthRequired: 350000,
    trainingDays: 14,
    protectedRadiusMiles: 2,
  },
  {
    slug: "education_tutoring",
    label: "Education / tutoring",
    matchTokens: [
      "tutoring",
      "tutor",
      "education",
      "learning center",
      "stem",
      "early childhood",
      "preschool",
      "daycare",
      "academy",
    ],
    naicsCode: "611699",
    initialFranchiseFee: 45000,
    royaltyPct: 8,
    adFundPct: 2,
    agreementTermYears: 10,
    renewalTermYears: 10,
    liquidCapitalRequired: 75000,
    netWorthRequired: 250000,
    trainingDays: 14,
    protectedRadiusMiles: 3,
  },
  {
    slug: "pet_services",
    label: "Pet services",
    matchTokens: [
      "pet",
      "pet store",
      "dog grooming",
      "dog daycare",
      "pet boarding",
      "veterinary",
    ],
    naicsCode: "812910",
    initialFranchiseFee: 40000,
    royaltyPct: 6,
    adFundPct: 2,
    agreementTermYears: 10,
    renewalTermYears: 10,
    liquidCapitalRequired: 100000,
    netWorthRequired: 350000,
    trainingDays: 14,
    protectedRadiusMiles: 3,
  },
  {
    slug: "automotive_services",
    label: "Automotive services",
    matchTokens: [
      "auto",
      "automotive",
      "car wash",
      "oil change",
      "tire",
      "auto repair",
      "detailing",
    ],
    naicsCode: "811111",
    initialFranchiseFee: 35000,
    royaltyPct: 6,
    adFundPct: 2,
    agreementTermYears: 10,
    renewalTermYears: 10,
    liquidCapitalRequired: 150000,
    netWorthRequired: 500000,
    trainingDays: 14,
    protectedRadiusMiles: 3,
  },
];

/**
 * Resolve a customer-typed industry string to an IndustryProfile.
 * Returns null when no token matches — the caller falls back to
 * "no suggestion available."
 *
 * Token match is case-insensitive substring. The customer's text
 * doesn't need to match exactly: "specialty coffee café" matches
 * the `specialty_coffee` profile via the "coffee" / "café" tokens.
 */
export function resolveIndustryProfile(
  industryCategory: string | null | undefined,
): IndustryProfile | null {
  if (!industryCategory) return null;
  const needle = industryCategory.toLowerCase();
  // Walk profiles in declaration order; first matching wins so we
  // can put more-specific entries (specialty_coffee) ahead of
  // their parent (qsr_food / fast_casual_food).
  for (const profile of INDUSTRY_PROFILES) {
    for (const token of profile.matchTokens) {
      if (needle.includes(token)) return profile;
    }
  }
  return null;
}

/**
 * Resolve a single field's industry-suggested value. Used by the
 * field editor to render a "Use suggested: X" affordance similar
 * to derived defaults.
 *
 * The mapping from FieldDef.name → IndustryProfile property is
 * declared here in one place (rather than scattered through the
 * schemas) so the lookup table stays reviewable on its own.
 *
 * Returns null if:
 *   - no industry has been resolved yet (chicken-egg)
 *   - the field doesn't map to a known lookup key
 *   - the profile has null for that key
 */
export function lookupIndustryValue(args: {
  industryCategory: string | null | undefined;
  fieldName: string;
}): string | number | null {
  const profile = resolveIndustryProfile(args.industryCategory);
  if (!profile) return null;
  switch (args.fieldName) {
    case "naics_code":
      return profile.naicsCode;
    case "initial_franchise_fee_dollars":
    case "initial_franchise_fee":
      return profile.initialFranchiseFee;
    case "royalty_pct":
      return profile.royaltyPct;
    case "ad_fund_pct":
    case "marketing_fund_pct":
    case "brand_fund_pct":
      return profile.adFundPct;
    case "agreement_term_years":
    case "initial_term_years":
      return profile.agreementTermYears;
    case "renewal_term_years":
      return profile.renewalTermYears;
    case "minimum_liquid_capital_dollars":
    case "liquid_capital_required_dollars":
      return profile.liquidCapitalRequired;
    case "minimum_net_worth_dollars":
    case "net_worth_required_dollars":
      return profile.netWorthRequired;
    case "initial_training_days":
    case "training_duration_days":
      return profile.trainingDays;
    case "protected_territory_radius_miles":
    case "territory_radius_miles":
      return profile.protectedRadiusMiles;
    default:
      return null;
  }
}

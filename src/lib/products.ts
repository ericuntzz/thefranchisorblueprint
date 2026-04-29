import type { Tier } from "@/lib/supabase/types";

/**
 * Catalog of every Stripe-purchasable product. The webhook routes incoming
 * checkout.session.completed events through this registry to decide what
 * to grant: tier access, coaching credits, or both.
 *
 * Source of truth for what each Stripe Price ID maps to in our world.
 */

export type ProductSlug =
  | "blueprint"           // Tier 1 — DIY ($2,997)
  | "blueprint-plus"      // Tier 1 + 4 coaching calls ($4,997)
  | "navigator"           // Tier 2 ($8,500) — purchased via consult, not portal
  | "builder"             // Tier 3 ($29,500) — purchased via consult, not portal
  | "sample-call"         // 1 coaching call ($97)
  | "phase-coaching"      // 6 coaching calls for one phase ($1,500)
  | "upgrade-1-2"         // Tier 1 → Tier 2 credit-forward upgrade ($5,503)
  | "upgrade-1-3"         // Tier 1 → Tier 3 credit-forward upgrade ($26,503)
  | "upgrade-2-3";        // Tier 2 → Tier 3 credit-forward upgrade ($21,000)

export type Product = {
  slug: ProductSlug;
  name: string;
  shortName: string;
  priceCents: number;
  /** Tier granted after purchase (or null for non-tier purchases like sample call). */
  grantsTier: Tier | null;
  /** Coaching calls added to profile.coaching_credits on purchase. */
  grantsCoachingCalls: number;
  /** Stripe Price ID env var name. The actual ID is loaded from process.env. */
  priceEnvVar: string;
  /**
   * Whether this product can be purchased directly (Buy Now buttons on
   * marketing pages or portal pages). Some products (Navigator/Builder) are
   * gated behind a consult call and not listed for direct purchase.
   */
  buyableDirectly: boolean;
  /** Marketing copy for the buy page / upgrade comparison cards. */
  description: string;
  /** Bullet-point inclusions shown on the buy page. */
  includes: string[];
};

export const PRODUCTS: Record<ProductSlug, Product> = {
  blueprint: {
    slug: "blueprint",
    name: "The Blueprint",
    shortName: "Blueprint",
    priceCents: 299700,
    grantsTier: 1,
    grantsCoachingCalls: 0,
    priceEnvVar: "STRIPE_PRICE_BLUEPRINT",
    buyableDirectly: true,
    description: "The complete franchisor operating system — nine production-ready frameworks. DIY pace.",
    includes: [
      "All 9 capability documents",
      "60-minute white-glove onboarding call",
      "30 days of email support",
      "Lifetime access to system updates",
    ],
  },
  "blueprint-plus": {
    slug: "blueprint-plus",
    name: "Blueprint Plus",
    shortName: "Blueprint Plus",
    priceCents: 499700,
    grantsTier: 1,
    grantsCoachingCalls: 4,
    priceEnvVar: "STRIPE_PRICE_BLUEPRINT_PLUS",
    buyableDirectly: true,
    description: "The Blueprint plus 4 group coaching calls — the middle path between fully DIY and full Navigator coaching.",
    includes: [
      "Everything in The Blueprint",
      "4 group coaching calls with Jason",
      "Slack-based Q&A access during your engagement",
    ],
  },
  navigator: {
    slug: "navigator",
    name: "Navigator",
    shortName: "Navigator",
    priceCents: 850000,
    grantsTier: 2,
    grantsCoachingCalls: 24,
    priceEnvVar: "STRIPE_PRICE_NAVIGATOR",
    buyableDirectly: false,
    description: "The system + 6 months of weekly 1:1 coaching with Jason and document review feedback.",
    includes: [
      "Everything in Blueprint Plus",
      "24 weekly 1:1 coaching calls",
      "Full document review + feedback",
      "Monthly milestone gates",
      "Attorney + CPA referral network",
      '"Franchise Ready" certification',
    ],
  },
  builder: {
    slug: "builder",
    name: "Builder",
    shortName: "Builder",
    priceCents: 2950000,
    grantsTier: 3,
    grantsCoachingCalls: 48,
    priceEnvVar: "STRIPE_PRICE_BUILDER",
    buyableDirectly: false,
    description: "Done-with-you franchise build. We do the heavy lifting; you stay in the captain's chair.",
    includes: [
      "Everything in Navigator",
      "Done-with-you build",
      "12-month engagement",
      "Vendor + attorney coordination",
      "First franchisee recruitment assist",
    ],
  },
  "sample-call": {
    slug: "sample-call",
    name: "Coaching Sample Call",
    shortName: "Sample Call",
    priceCents: 9700,
    grantsTier: null,
    grantsCoachingCalls: 1,
    priceEnvVar: "STRIPE_PRICE_SAMPLE_CALL",
    buyableDirectly: true,
    description: "One 60-minute coaching call with Jason. Try the coaching format risk-free; the $97 credits toward any future tier upgrade.",
    includes: [
      "1 × 60-min call with Jason",
      "Personalized session notes",
      "$97 credit toward any future upgrade",
    ],
  },
  "phase-coaching": {
    slug: "phase-coaching",
    name: "Phase Coaching Add-on",
    shortName: "Phase Coaching",
    priceCents: 150000,
    grantsTier: null,
    grantsCoachingCalls: 6,
    priceEnvVar: "STRIPE_PRICE_PHASE_COACHING",
    buyableDirectly: true,
    description: "6 focused coaching calls for the phase you most need help with — Discover, Architect, Activate, or Acquire.",
    includes: [
      "6 × 60-min calls with Jason",
      "Phase-specific work product reviews",
      "Slack support during the phase",
    ],
  },
  "upgrade-1-2": {
    slug: "upgrade-1-2",
    name: "Upgrade — Blueprint to Navigator",
    shortName: "Upgrade to Navigator",
    priceCents: 550300,
    grantsTier: 2,
    grantsCoachingCalls: 24,
    priceEnvVar: "STRIPE_PRICE_UPGRADE_1_2",
    buyableDirectly: false,
    description: "Credit-forward: Navigator ($8,500) − what you already paid ($2,997).",
    includes: [
      "Full Navigator access (24 weekly coaching calls)",
      "Document reviews + monthly milestones",
      "Slack support + attorney/CPA network",
    ],
  },
  "upgrade-1-3": {
    slug: "upgrade-1-3",
    name: "Upgrade — Blueprint to Builder",
    shortName: "Upgrade to Builder",
    priceCents: 2650300,
    grantsTier: 3,
    grantsCoachingCalls: 48,
    priceEnvVar: "STRIPE_PRICE_UPGRADE_1_3",
    buyableDirectly: false,
    description: "Credit-forward: Builder ($29,500) − what you already paid ($2,997).",
    includes: [
      "Full Builder access (done-with-you build)",
      "12-month engagement",
      "Vendor + attorney coordination",
      "First franchisee recruitment assist",
    ],
  },
  "upgrade-2-3": {
    slug: "upgrade-2-3",
    name: "Upgrade — Navigator to Builder",
    shortName: "Upgrade to Builder",
    priceCents: 2100000,
    grantsTier: 3,
    grantsCoachingCalls: 48,
    priceEnvVar: "STRIPE_PRICE_UPGRADE_2_3",
    buyableDirectly: false,
    description: "Credit-forward: Builder ($29,500) − what you already paid ($8,500).",
    includes: [
      "Full Builder access (done-with-you build)",
      "12-month engagement",
      "Vendor + attorney coordination",
    ],
  },
};

export function getProduct(slug: string): Product | undefined {
  if (slug in PRODUCTS) return PRODUCTS[slug as ProductSlug];
  return undefined;
}

export function priceIdFor(slug: ProductSlug): string {
  const value = process.env[PRODUCTS[slug].priceEnvVar];
  if (!value) {
    throw new Error(`Missing Stripe Price env var: ${PRODUCTS[slug].priceEnvVar}`);
  }
  return value;
}

/**
 * Maps a (current tier) → target tier to the relevant upgrade Product.
 * Returns null if no upgrade path applies (already at top tier, etc.).
 */
export function upgradeProductFor(currentTier: Tier, targetTier: Tier): Product | null {
  if (currentTier === 1 && targetTier === 2) return PRODUCTS["upgrade-1-2"];
  if (currentTier === 1 && targetTier === 3) return PRODUCTS["upgrade-1-3"];
  if (currentTier === 2 && targetTier === 3) return PRODUCTS["upgrade-2-3"];
  return null;
}

export const TIER_TO_PRODUCT: Record<Tier, ProductSlug> = {
  1: "blueprint",
  2: "navigator",
  3: "builder",
};

/**
 * Library catalog — vetted vendors, templates, and partner perks.
 *
 * Stripe-Atlas-style "more than you paid for" layer. Every paid
 * customer sees the library; some entries are gated to higher tiers
 * to reinforce the upgrade path without being aggressive about it.
 *
 * Categories:
 *   vendor    — service providers Jason has worked with on past
 *               engagements (FDD attorneys, fractional CFOs, training-
 *               video producers, lead-gen agencies, etc.)
 *   template  — downloadable / browseable starter documents (sample
 *               franchise agreement structure, sample manual TOC,
 *               sample discovery day deck outline)
 *   perk      — partner-supplied discount or benefit
 *
 * Adding entries: append below. New entries land in the customer UI
 * on next deploy. Tier-gating with `minTier` — Tier 1 sees Tier 1
 * entries; Tier 3 sees everything.
 *
 * IMPORTANT: vendor referrals must NOT include any rebate/kickback
 * unless disclosed in the customer's FDD Item 8. Default is "no rebate
 * received." If TFB earns referral revenue, it's disclosed in the
 * library card AND the customer's compliance_legal section is updated
 * to reflect it.
 */

import type { Tier } from "@/lib/supabase/types";

export type LibraryCategory = "vendor" | "template" | "perk";

export type LibraryEntry = {
  id: string;
  category: LibraryCategory;
  name: string;
  /** Tagline — 1 short line shown under the name. */
  tagline: string;
  /** 2-3 sentence description on the card. */
  description: string;
  /** Optional external link (vendor website, sample doc URL). */
  href?: string;
  /** Optional CTA label override (default: "Learn more"). */
  ctaLabel?: string;
  /** Region/country; for vendors only. */
  region?: string;
  /** Tier required to see this entry. Default 1 (visible to all). */
  minTier?: Tier;
  /** TFB earns a referral fee from this vendor — must be disclosed
   *  in the customer's FDD Item 8 if they engage. */
  hasReferralRelationship?: boolean;
};

export const LIBRARY_ENTRIES: LibraryEntry[] = [
  // ── Vendors — legal ──────────────────────────────────────────────────
  {
    id: "franchise-attorney-cooley",
    category: "vendor",
    name: "Cooley LLP — Franchise & Distribution",
    tagline: "Tier-1 franchise law firm with FDD + state-registration depth.",
    description:
      "National-scale franchise specialty group. Best fit if you have funded growth plans (Series A+) and need someone who can scale with you. Higher rates than boutique firms; deeper bench when state filings get complicated.",
    region: "U.S. — national",
    href: "https://www.cooley.com/services/practice/business/franchise-distribution",
  },
  {
    id: "franchise-attorney-cmkw",
    category: "vendor",
    name: "Cheng Cohen LLC",
    tagline: "Boutique franchise specialty firm. Strong for emerging brands.",
    description:
      "Specializes in emerging-franchisor work — your first FDD, state registrations, attorney handoff from TFB Blueprint. Lower hourly rates than the AmLaw 100 firms with comparable specialty depth.",
    region: "U.S. — national",
    href: "https://www.chengcohen.com/",
  },

  // ── Vendors — accounting / audit ─────────────────────────────────────
  {
    id: "audit-cohnreznick",
    category: "vendor",
    name: "CohnReznick — Franchise Audit Practice",
    tagline: "Item 21 audited financial statements for emerging franchisors.",
    description:
      "Mid-market accounting firm with a dedicated franchise practice. Familiar with the Item 21 disclosure requirements and the timing pressure of state-registration deadlines.",
    region: "U.S. — national",
    href: "https://www.cohnreznick.com/industries/franchising",
  },

  // ── Vendors — operations & training ──────────────────────────────────
  {
    id: "training-trainual",
    category: "vendor",
    name: "Trainual",
    tagline: "LMS for franchise training programs.",
    description:
      "Cloud LMS used widely in franchise systems. Build modules once, deploy to every franchisee location. Tracks completion + certification automatically.",
    href: "https://trainual.com",
  },

  // ── Vendors — recruitment ────────────────────────────────────────────
  {
    id: "recruitment-frandata",
    category: "vendor",
    name: "FRANdata",
    tagline: "Franchise industry data + lead generation.",
    description:
      "The reference data source for franchise industry benchmarks (royalty rates, ad-fund averages, ramp curves). Also offers candidate lead-gen services for emerging franchisors.",
    href: "https://www.frandata.com/",
    minTier: 2,
  },

  // ── Templates ────────────────────────────────────────────────────────
  {
    id: "template-fa-outline",
    category: "template",
    name: "Sample Franchise Agreement structure",
    tagline: "Section-by-section outline of a franchise agreement.",
    description:
      "What every section of a franchise agreement covers and why. Use as a checklist when reviewing the agreement your attorney drafts. Not a fill-in-the-blank template.",
    ctaLabel: "Outline coming soon",
  },
  {
    id: "template-ops-manual-toc",
    category: "template",
    name: "Operations Manual — table of contents",
    tagline: "The 18-section structure most franchise ops manuals use.",
    description:
      "Reference TOC for what an operations manual should cover. Use to compare against your current manual and identify what's missing. Generated dynamically from your Blueprint via the Operations Manual export.",
    ctaLabel: "Open Exports",
    href: "/portal#deliverables",
  },
  {
    id: "template-discovery-day",
    category: "template",
    name: "Discovery Day — agenda template",
    tagline: "Half-day Discovery Day flow used by emerging franchisors.",
    description:
      "Hour-by-hour agenda for a Discovery Day. Includes pre-qualification screen questions, presentation flow, and the close. Adapt to your concept and team.",
    ctaLabel: "Coming soon",
    minTier: 2,
  },
  {
    id: "template-marketing-fund-charter",
    category: "template",
    name: "Marketing Fund charter — sample language",
    tagline: "Sample governance language for your Marketing Fund Manual.",
    description:
      "Reference language for franchisor-controlled, advisory-board, and cooperative governance models. Use to draft the version your attorney files in Item 11.",
    ctaLabel: "Coming soon",
    minTier: 2,
  },

  // ── Perks ────────────────────────────────────────────────────────────
  {
    id: "perk-aws-credits",
    category: "perk",
    name: "AWS Activate — $5K cloud credits",
    tagline: "Cloud credits for franchisor tech stack.",
    description:
      "AWS Activate startup credits available to TFB customers operating an LLC or C-corp. Useful if you're building any custom franchisor-side tech (training portal, franchisee dashboard, internal tools).",
    href: "https://aws.amazon.com/activate/",
  },
  {
    id: "perk-stripe-fee-discount",
    category: "perk",
    name: "Stripe — payment processing onboarding",
    tagline: "Streamlined Stripe setup for franchise systems.",
    description:
      "Help configuring Stripe Connect for collecting royalties + ad-fund contributions from franchisees. TFB customers get expedited Connect onboarding through our Stripe contact.",
    href: "https://stripe.com/connect",
  },
  {
    id: "perk-jason-direct-coaching",
    category: "perk",
    name: "Direct Jason coaching session",
    tagline: "60-minute strategy call with Jason — Builder tier.",
    description:
      "Builder customers get monthly direct calls with Jason as part of the program. Schedule via the coaching tab; calls focus on FDD strategy, franchisee recruitment, or whatever's most pressing for your launch.",
    minTier: 3,
    ctaLabel: "Schedule via Coaching",
    href: "/portal/coaching",
  },
];

export function entriesByCategory(category: LibraryCategory, tier: Tier): LibraryEntry[] {
  return LIBRARY_ENTRIES.filter(
    (e) => e.category === category && (e.minTier ?? 1) <= tier,
  );
}

export function entriesLockedAboveTier(tier: Tier): LibraryEntry[] {
  return LIBRARY_ENTRIES.filter((e) => (e.minTier ?? 1) > tier);
}

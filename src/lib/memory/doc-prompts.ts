/**
 * Per-section document upload prompts.
 *
 * Customers usually have at least one document that maps cleanly to
 * each section — an operations manual, a P&L, brand guidelines, etc.
 * Uploading those docs lets Jason AI auto-fill structured fields,
 * inform draft prose, and skip a lot of question-typing. The
 * prompts below give the customer a short, contextual nudge at the
 * right surface (section page, question queue, etc.) instead of
 * relying on them to remember the References panel exists.
 *
 * Each entry is intentionally brief — the customer reads this in
 * the middle of trying to do something else, so the prompt has to
 * land in one breath. Examples are surfaced as small chips
 * underneath the prompt to anchor what kind of doc we're after,
 * without being prescriptive.
 *
 * Why these live in their own module: schemas describe the data;
 * doc-prompts describe the input ergonomics. Two different concerns
 * with two different audiences (the agent's SME context vs. the
 * customer-facing flow), and decoupling means we can iterate on
 * prompts without touching the schema work the agent reads from.
 */

import type { MemoryFileSlug } from "./files";

export type DocPrompt = {
  /** One-sentence prompt shown above the upload affordance.
   *  Operator-voice; second-person; ends in a period. */
  prompt: string;
  /** 3–5 short example doc names. Rendered as chips under the
   *  prompt so the customer can scan "yes, I have one of those"
   *  without us being prescriptive about file format. */
  examples: string[];
  /** Short label used in compact surfaces (queue card chip,
   *  Jason AI chat suggestion). Lowercase, no period. */
  shortLabel: string;
};

export const SECTION_DOC_PROMPTS: Partial<Record<MemoryFileSlug, DocPrompt>> = {
  business_overview: {
    prompt:
      "Got something that describes your business in your own words? Drop it here and Jason AI can pull the founder story + concept summary straight from it.",
    examples: ["pitch deck", "About Us page", "investor one-pager", "press release"],
    shortLabel: "pitch deck or About page",
  },
  brand_voice: {
    prompt:
      "Got brand guidelines or a style guide? Drop them here so Jason AI matches your colors, type, and tone exactly.",
    examples: ["brand guidelines", "style guide", "logo files", "tone-of-voice doc"],
    shortLabel: "brand guidelines or style guide",
  },
  competitor_landscape: {
    prompt:
      "Got notes on your competitors? Drop them here and Jason AI will turn them into a clean competitor brief.",
    examples: ["competitor analysis", "market research", "SWOT slides"],
    shortLabel: "competitor notes",
  },
  market_strategy: {
    prompt:
      "Got a marketing plan or go-to-market doc? Upload it and Jason AI will pull positioning + audience straight from it.",
    examples: ["marketing plan", "go-to-market doc", "marketing calendar"],
    shortLabel: "marketing plan",
  },
  unit_economics: {
    prompt:
      "Got financials? A P&L, a COGS breakdown, or an investment summary will let Jason AI fill in the unit economics without you re-typing the numbers.",
    examples: ["P&L", "COGS breakdown", "investment summary", "revenue model"],
    shortLabel: "P&L or COGS",
  },
  franchise_economics: {
    prompt:
      "Have you started an FDD, royalty schedule, or fee structure already? Drop it here and Jason AI can mirror it.",
    examples: ["existing FDD", "royalty schedule", "fee structure", "franchise sales deck"],
    shortLabel: "existing FDD or fee structure",
  },
  operating_model: {
    prompt:
      "Got an operations manual or opening checklist? Drop it here and Jason AI answers most of this section.",
    examples: [
      "operations manual",
      "opening checklist",
      "closing procedures",
      "shift handoff doc",
    ],
    shortLabel: "ops manual or checklist",
  },
  recipes_and_menu: {
    prompt:
      "Got your menu, product catalog, or recipe book? Upload it so Jason AI captures it as the official spec.",
    examples: ["menu PDF", "product catalog", "recipe book", "spec sheets"],
    shortLabel: "menu or product catalog",
  },
  vendor_supply_chain: {
    prompt:
      "Got an approved-supplier list or vendor roster? Drop it here and Jason AI will codify the supply chain.",
    examples: ["vendor list", "supplier agreements", "supply chain doc"],
    shortLabel: "vendor list",
  },
  training_program: {
    prompt:
      "Got a training manual, onboarding curriculum, or transcripts of your training videos? Drop them here and Jason AI builds a training program around them.",
    examples: ["training manual", "onboarding curriculum", "video transcripts", "LMS exports"],
    shortLabel: "training manual",
  },
  employee_handbook: {
    prompt:
      "Got an employee handbook or HR policies? Drop them here so Jason AI can codify the standards franchisees inherit.",
    examples: ["employee handbook", "HR policies", "code of conduct", "PTO policy"],
    shortLabel: "employee handbook",
  },
  franchisee_profile: {
    prompt:
      "Got an ideal-franchisee profile or applicant scorecard? Upload it and Jason AI will reflect your screening criteria exactly.",
    examples: ["applicant scorecard", "ideal franchisee profile", "interview questionnaire"],
    shortLabel: "applicant criteria",
  },
  territory_real_estate: {
    prompt:
      "Got site selection criteria or a real-estate playbook? Drop it here and Jason AI will build territory + site rules around it.",
    examples: ["site selection criteria", "real estate playbook", "territory map"],
    shortLabel: "site selection criteria",
  },
  marketing_fund: {
    prompt:
      "Got a marketing-fund agreement or ad-fund spend report? Drop it here so Jason AI mirrors the governance you already use.",
    examples: ["marketing fund agreement", "ad fund spend report", "co-op rules"],
    shortLabel: "marketing fund agreement",
  },
  compliance_legal: {
    prompt:
      "Got an existing FDD, a franchise agreement template, or letters from your attorney? Drop them here and Jason AI will mirror the legal posture.",
    examples: ["existing FDD", "franchise agreement", "attorney letter", "state registration"],
    shortLabel: "FDD or attorney letter",
  },
  reimbursement_policy: {
    prompt:
      "Got an existing reimbursement policy or expense doc? Drop it here so Jason AI can codify what franchisees can claim.",
    examples: ["reimbursement policy", "expense doc", "approved purchases list"],
    shortLabel: "reimbursement policy",
  },
};

/** Lookup helper. Returns null when there's no prompt configured for
 *  the section (every shipped section has one today, but we keep the
 *  null path in case future sections launch before their prompt). */
export function docPromptFor(slug: MemoryFileSlug): DocPrompt | null {
  return SECTION_DOC_PROMPTS[slug] ?? null;
}

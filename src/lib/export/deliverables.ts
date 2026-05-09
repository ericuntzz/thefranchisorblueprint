/**
 * Deliverable registry — central catalog of every exportable document.
 *
 * Adding a new deliverable: write a builder under `build/`, register
 * it here. The API route + UI both read this registry, so a new
 * deliverable lights up in /portal automatically once it's listed.
 */

import { buildBrandStandards } from "./build/brand-standards";
import { buildCompetitorLandscape } from "./build/competitor-landscape";
import { buildConceptAndStory } from "./build/concept-and-story";
import { buildDiscoveryDayDeck } from "./build/discovery-day-deck";
import { buildEmployeeHandbook } from "./build/employee-handbook";
import { buildFddDraft } from "./build/fdd-draft";
import { buildFinancialModel } from "./build/financial-model";
import { buildFranchiseAgreement } from "./build/franchise-agreement";
import { buildFranchiseeScoringMatrix } from "./build/franchisee-scoring";
import { buildMarketingFundManual } from "./build/marketing-fund-manual";
import { buildMarketStrategyReport } from "./build/market-strategy-report";
import { buildOperationsManual } from "./build/operations-manual";
import { buildQualifyMatrix } from "./build/qualify-matrix";
import { buildReimbursementPolicy } from "./build/reimbursement-policy";
import { buildSiteSelectionGuide } from "./build/site-selection-guide";
import { buildStateRegistrationMatrix } from "./build/state-registration-matrix";
import { buildTrainingProgram } from "./build/training-program";
import type { DeliverableDef, DeliverableId } from "./types";

export const DELIVERABLES: Record<DeliverableId, DeliverableDef> = {
  "fdd-draft": {
    kind: "doc",
    id: "fdd-draft",
    name: "FDD Draft (23 Items)",
    description:
      "23-item Franchise Disclosure Document scaffold from your Blueprint. Hand to your attorney as the starting point — they finalize the legal sections and prepare the financial statements (Item 21).",
    sourceChapters: [
      "business_overview",
      "unit_economics",
      "franchise_economics",
      "franchisee_profile",
      "vendor_supply_chain",
      "marketing_fund",
      "training_program",
      "territory_real_estate",
      "compliance_legal",
    ],
    formats: ["docx", "md", "pdf"],
    build: buildFddDraft,
    filenameStem: "FDD-Draft",
  },
  "operations-manual": {
    kind: "doc",
    id: "operations-manual",
    name: "Operations Manual",
    description:
      "Daily operations, product specs, vendor list, training, employee policy, and reimbursement standards. The manual every franchisee inherits.",
    sourceChapters: [
      "business_overview",
      "operating_model",
      "recipes_and_menu",
      "vendor_supply_chain",
      "training_program",
      "employee_handbook",
      "reimbursement_policy",
    ],
    formats: ["docx", "md", "pdf"],
    build: buildOperationsManual,
    filenameStem: "Operations-Manual",
  },
  "financial-model": {
    kind: "doc",
    id: "financial-model",
    name: "Financial Model Summary",
    description:
      "Headline unit economics + franchisor revenue per franchisee. The numbers a banker, investor, or candidate franchisee asks for in the first conversation.",
    sourceChapters: ["business_overview", "unit_economics", "franchise_economics"],
    formats: ["docx", "md", "pdf"],
    build: buildFinancialModel,
    filenameStem: "Financial-Model-Summary",
  },
  "franchisee-scoring-matrix": {
    kind: "doc",
    id: "franchisee-scoring-matrix",
    name: "Franchisee Scoring Matrix",
    description:
      "Discovery Day pre-qualification + ideal-candidate definition. Use to screen candidates before scheduling Discovery Day.",
    sourceChapters: ["business_overview", "franchisee_profile"],
    formats: ["docx", "md", "pdf"],
    build: buildFranchiseeScoringMatrix,
    filenameStem: "Franchisee-Scoring-Matrix",
  },
  "discovery-day-deck": {
    kind: "slides",
    id: "discovery-day-deck",
    name: "Discovery Day Deck",
    description:
      "20–25 slide presentation for Discovery Day. Concept, economics, training, and the path to opening — the deck the franchisor presents to qualified candidates.",
    sourceChapters: [
      "business_overview",
      "brand_voice",
      "franchise_economics",
      "unit_economics",
      "franchisee_profile",
      "training_program",
      "territory_real_estate",
      "operating_model",
    ],
    formats: ["pptx"],
    build: buildDiscoveryDayDeck,
    filenameStem: "Discovery-Day-Deck",
  },
  "marketing-fund-manual": {
    kind: "doc",
    id: "marketing-fund-manual",
    name: "Marketing Fund Manual",
    description:
      "Brand fund governance — contribution rates, board structure, approved uses, audits.",
    sourceChapters: ["marketing_fund", "business_overview", "franchise_economics"],
    formats: ["docx", "md", "pdf"],
    build: buildMarketingFundManual,
    filenameStem: "Marketing-Fund-Manual",
  },
  "employee-handbook": {
    kind: "doc",
    id: "employee-handbook",
    name: "Employee Handbook",
    description:
      "HR policies — code of conduct, scheduling, compensation, time off, and termination. State-level adaptation required before adoption.",
    sourceChapters: ["employee_handbook", "business_overview"],
    formats: ["docx", "md", "pdf"],
    build: buildEmployeeHandbook,
    filenameStem: "Employee-Handbook",
  },
  "reimbursement-policy": {
    kind: "doc",
    id: "reimbursement-policy",
    name: "Reimbursement Policy",
    description:
      "Approved expenses, mileage / per diem rates, thresholds, and submission process.",
    sourceChapters: ["reimbursement_policy", "business_overview"],
    formats: ["docx", "md", "pdf"],
    build: buildReimbursementPolicy,
    filenameStem: "Reimbursement-Policy",
  },
  "site-selection-guide": {
    kind: "doc",
    id: "site-selection-guide",
    name: "Site Selection Guide",
    description:
      "Demographic targets, footprint criteria, geographic focus, exclusion zones, and approval process.",
    sourceChapters: ["territory_real_estate", "franchise_economics", "business_overview"],
    formats: ["docx", "md", "pdf"],
    build: buildSiteSelectionGuide,
    filenameStem: "Site-Selection-Guide",
  },
  "brand-standards": {
    kind: "doc",
    id: "brand-standards",
    name: "Brand Standards",
    description:
      "Voice, visual identity, typography, color, things to avoid, and the approval process for new customer-facing material.",
    sourceChapters: ["brand_voice", "business_overview"],
    formats: ["docx", "md", "pdf"],
    build: buildBrandStandards,
    filenameStem: "Brand-Standards",
  },
  "qualify-matrix": {
    kind: "doc",
    id: "qualify-matrix",
    name: "Qualification Matrix",
    description:
      "Pre-Discovery Day candidate filter — financial floors, experience requirements, and pass/fail decision rubric.",
    sourceChapters: ["franchisee_profile", "business_overview"],
    formats: ["docx", "md", "pdf"],
    build: buildQualifyMatrix,
    filenameStem: "Qualification-Matrix",
  },
  "concept-and-story": {
    kind: "doc",
    id: "concept-and-story",
    name: "Concept & Story",
    description:
      "Founder origin, concept, brand voice, and what makes this different. The narrative anchor for every other deliverable.",
    sourceChapters: ["business_overview", "brand_voice"],
    formats: ["docx", "md", "pdf"],
    build: buildConceptAndStory,
    filenameStem: "Concept-And-Story",
  },
  "training-program": {
    kind: "doc",
    id: "training-program",
    name: "Training Program",
    description:
      "Initial certification curriculum, opening support, and ongoing training requirements for franchisees and their teams.",
    sourceChapters: ["training_program", "operating_model", "business_overview"],
    formats: ["docx", "md", "pdf"],
    build: buildTrainingProgram,
    filenameStem: "Training-Program",
  },
  "franchise-agreement": {
    kind: "doc",
    id: "franchise-agreement",
    name: "Franchise Agreement (Template)",
    description:
      "Structural scaffold for an attorney to finalize. Every clause marked [NEEDS ATTORNEY REVIEW]; saves your attorney 4–8 hours of boilerplate work per agreement.",
    sourceChapters: ["business_overview", "franchise_economics", "compliance_legal"],
    formats: ["docx", "md", "pdf"],
    build: buildFranchiseAgreement,
    filenameStem: "Franchise-Agreement-Template",
  },
  "state-registration-matrix": {
    kind: "doc",
    id: "state-registration-matrix",
    name: "State Registration Matrix",
    description:
      "Registration / filing-only / non-registration states with current fees + your filing status. The single most-asked-for document at launch.",
    sourceChapters: ["compliance_legal", "business_overview"],
    formats: ["docx", "md", "pdf"],
    build: buildStateRegistrationMatrix,
    filenameStem: "State-Registration-Matrix",
  },
  "market-strategy-report": {
    kind: "doc",
    id: "market-strategy-report",
    name: "Market Strategy Report",
    description:
      "Positioning, growth horizon, expansion sequencing, and competitive analysis. Higher tiers add Census + competitor research.",
    sourceChapters: ["market_strategy", "competitor_landscape", "business_overview"],
    formats: ["docx", "md", "pdf"],
    build: buildMarketStrategyReport,
    filenameStem: "Market-Strategy-Report",
  },
  "competitor-landscape": {
    kind: "doc",
    id: "competitor-landscape",
    name: "Competitor Landscape",
    description:
      "Direct + indirect competitors with comparative analysis. Higher tiers layer on Google Places density and live pricing intel.",
    sourceChapters: ["competitor_landscape", "business_overview"],
    formats: ["docx", "md", "pdf"],
    build: buildCompetitorLandscape,
    filenameStem: "Competitor-Landscape",
  },
};

export function getDeliverable(id: string): DeliverableDef | null {
  return (DELIVERABLES as Record<string, DeliverableDef>)[id] ?? null;
}

export function isValidDeliverableId(id: string): id is DeliverableId {
  return id in DELIVERABLES;
}

/** Stable display order for the exports section UI. */
export const DELIVERABLE_DISPLAY_ORDER: DeliverableId[] = [
  "concept-and-story",
  "fdd-draft",
  "franchise-agreement",
  "state-registration-matrix",
  "operations-manual",
  "training-program",
  "brand-standards",
  "marketing-fund-manual",
  "employee-handbook",
  "reimbursement-policy",
  "site-selection-guide",
  "financial-model",
  "qualify-matrix",
  "franchisee-scoring-matrix",
  "discovery-day-deck",
  "market-strategy-report",
  "competitor-landscape",
];

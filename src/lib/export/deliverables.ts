/**
 * Deliverable registry — central catalog of every exportable document.
 *
 * Adding a new deliverable: write a builder under `build/`, register
 * it here. The API route + UI both read this registry, so a new
 * deliverable lights up in /portal automatically once it's listed.
 */

import { buildFddDraft } from "./build/fdd-draft";
import { buildOperationsManual } from "./build/operations-manual";
import { buildFinancialModel } from "./build/financial-model";
import { buildFranchiseeScoringMatrix } from "./build/franchisee-scoring";
import type { DeliverableDef, DeliverableId } from "./types";

export const DELIVERABLES: Record<DeliverableId, DeliverableDef> = {
  "fdd-draft": {
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
    formats: ["docx", "md"],
    build: buildFddDraft,
    filenameStem: "FDD-Draft",
  },
  "operations-manual": {
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
    formats: ["docx", "md"],
    build: buildOperationsManual,
    filenameStem: "Operations-Manual",
  },
  "financial-model": {
    id: "financial-model",
    name: "Financial Model Summary",
    description:
      "Headline unit economics + franchisor revenue per franchisee. The numbers a banker, investor, or candidate franchisee asks for in the first conversation.",
    sourceChapters: ["business_overview", "unit_economics", "franchise_economics"],
    formats: ["docx", "md"],
    build: buildFinancialModel,
    filenameStem: "Financial-Model-Summary",
  },
  "franchisee-scoring-matrix": {
    id: "franchisee-scoring-matrix",
    name: "Franchisee Scoring Matrix",
    description:
      "Discovery Day pre-qualification + ideal-candidate definition. Use to screen candidates before scheduling Discovery Day.",
    sourceChapters: ["business_overview", "franchisee_profile"],
    formats: ["docx", "md"],
    build: buildFranchiseeScoringMatrix,
    filenameStem: "Franchisee-Scoring-Matrix",
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
  "fdd-draft",
  "operations-manual",
  "financial-model",
  "franchisee-scoring-matrix",
];

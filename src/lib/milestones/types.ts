/**
 * Regulatory milestone catalog.
 *
 * These are the EXTERNAL events a franchisor must complete to launch —
 * things that involve a regulator, a law firm, an audit firm, or an
 * insurance carrier. Distinct from section content (which is the
 * franchisor's own knowledge work).
 *
 * Sequenced loosely chronologically — entity formation comes before
 * EIN, EIN before audit-firm engagement, FDD draft before FDD filing.
 * The UI groups by `phase` for readability.
 *
 * Adding a new milestone: append to MILESTONES below. Old milestones
 * stay forever (existing customer rows reference them).
 */

import type { MemoryFileSlug } from "@/lib/memory/files";

export type MilestoneStatus = "pending" | "in_progress" | "complete" | "skipped";

export type MilestonePhase =
  | "entity"
  | "compliance"
  | "filings"
  | "operations";

export type MilestoneDef = {
  id: string;
  phase: MilestonePhase;
  /** Customer-facing label (sentence case). */
  label: string;
  /** One-sentence description for the row's secondary line. */
  description: string;
  /** Related Memory section (deep-link from the milestone row). */
  relatedSection?: MemoryFileSlug;
  /** Display order within the phase (lower is first). */
  order: number;
};

export const MILESTONES: MilestoneDef[] = [
  // ── Entity formation ─────────────────────────────────────────────────
  {
    id: "entity_formed",
    phase: "entity",
    label: "Entity formed",
    description: "LLC, S-corp, or C-corp registered with your state.",
    relatedSection: "compliance_legal",
    order: 1,
  },
  {
    id: "ein_obtained",
    phase: "entity",
    label: "EIN issued",
    description: "Employer Identification Number from the IRS.",
    relatedSection: "compliance_legal",
    order: 2,
  },
  {
    id: "trademark_filed",
    phase: "entity",
    label: "Trademark application filed",
    description: "USPTO filing for your brand name and primary marks.",
    relatedSection: "brand_voice",
    order: 3,
  },
  {
    id: "trademark_registered",
    phase: "entity",
    label: "Trademark registered",
    description: "USPTO registration certificate received.",
    relatedSection: "brand_voice",
    order: 4,
  },

  // ── Compliance & professional services ──────────────────────────────
  {
    id: "franchise_attorney_engaged",
    phase: "compliance",
    label: "Franchise attorney engaged",
    description: "Engagement letter signed with a franchise-specialist attorney.",
    relatedSection: "compliance_legal",
    order: 1,
  },
  {
    id: "audit_firm_engaged",
    phase: "compliance",
    label: "Audit firm engaged",
    description: "CPA firm engaged to prepare Item 21 audited financial statements.",
    relatedSection: "compliance_legal",
    order: 2,
  },
  {
    id: "general_liability_insurance",
    phase: "compliance",
    label: "General liability insurance bound",
    description: "Coverage that meets your franchisee minimum (usually $1M / $2M).",
    relatedSection: "compliance_legal",
    order: 3,
  },

  // ── FDD filings ──────────────────────────────────────────────────────
  {
    id: "fdd_drafted",
    phase: "filings",
    label: "FDD drafted",
    description: "Attorney-finalized FDD ready for state submissions.",
    relatedSection: "compliance_legal",
    order: 1,
  },
  {
    id: "fdd_filed_first_state",
    phase: "filings",
    label: "FDD filed in first state",
    description: "First registration or filing accepted by a state regulator.",
    relatedSection: "compliance_legal",
    order: 2,
  },
  {
    id: "first_franchisee_signed",
    phase: "filings",
    label: "First franchisee signed",
    description: "First Franchise Agreement executed with a qualified buyer.",
    relatedSection: "franchisee_profile",
    order: 3,
  },

  // ── Operations milestones ────────────────────────────────────────────
  {
    id: "operations_manual_finalized",
    phase: "operations",
    label: "Operations Manual finalized",
    description: "Brand-mandated daily operations + people standards locked in.",
    relatedSection: "operating_model",
    order: 1,
  },
  {
    id: "training_program_certified",
    phase: "operations",
    label: "Training program certified",
    description: "Initial training curriculum + certification exam in production.",
    relatedSection: "training_program",
    order: 2,
  },
];

export const PHASE_DEFS: Array<{ id: MilestonePhase; label: string; subtitle: string }> = [
  { id: "entity", label: "Entity & IP", subtitle: "Form the company, secure the marks." },
  { id: "compliance", label: "Compliance & Insurance", subtitle: "Engage your professionals." },
  { id: "filings", label: "FDD Filings", subtitle: "File and start signing franchisees." },
  { id: "operations", label: "Operations Readiness", subtitle: "Lock down the franchisee handoff." },
];

export function isValidMilestoneId(id: string): boolean {
  return MILESTONES.some((m) => m.id === id);
}

export function isValidStatus(s: string): s is MilestoneStatus {
  return s === "pending" || s === "in_progress" || s === "complete" || s === "skipped";
}

export type MilestoneState = {
  milestoneId: string;
  status: MilestoneStatus;
  targetDate: string | null;
  completedAt: string | null;
  notes: string | null;
  updatedAt: string;
};

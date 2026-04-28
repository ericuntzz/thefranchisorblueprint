import type { Tier } from "@/lib/supabase/types";

/**
 * The franchisor operating system — nine verb-first capabilities, grouped
 * into four phases that mirror the actual journey of becoming a franchisor.
 *
 * Phase ordering (Jason-blessed):
 *   1. DISCOVER  — Are you ready?           (Audit, Model)
 *   2. ARCHITECT — Design your system       (Build, Codify, Decode)
 *   3. ACTIVATE  — Get operational          (Train, Score)
 *   4. ACQUIRE   — Sign your first franchisees (Qualify, Close)
 *
 * `storagePath` is relative to the `deliverables` Supabase Storage bucket.
 * Server-side code generates a signed URL on demand for both viewing
 * (Office Online viewer iframe) and downloading.
 *
 * `videoUrl` is a Loom embed URL (or null until Jason records it).
 * `minTier` controls which tiers see this capability.
 */

export type CapabilityPhase = "discover" | "architect" | "activate" | "acquire";

export type Capability = {
  slug: string;
  number: number; // 1-9, journey ordinal
  verb: string;
  title: string;
  description: string;
  format: "Document" | "Spreadsheet" | "Slide deck" | "Checklist";
  phase: CapabilityPhase;
  phaseOrder: number; // 1-N within the phase
  minTier: Tier;
  storagePath: string | null; // null = "coming soon", no file yet
  storageExtension: "docx" | "pptx" | null;
  videoUrl: string | null; // Loom embed (e.g., https://www.loom.com/embed/XXXX)
};

export const PHASES: Record<
  CapabilityPhase,
  { label: string; tagline: string; number: number }
> = {
  discover: { number: 1, label: "Discover", tagline: "Are you ready to franchise?" },
  architect: { number: 2, label: "Architect", tagline: "Design your franchise system" },
  activate: { number: 3, label: "Activate", tagline: "Get your operation ready" },
  acquire: { number: 4, label: "Acquire", tagline: "Sign your first franchisees" },
};

export const CAPABILITIES: Capability[] = [
  {
    slug: "audit",
    number: 1,
    verb: "Audit",
    title: "Audit Your Business",
    description:
      "150+ point readiness checklist that maps your current operations against the franchise-ready bar.",
    format: "Checklist",
    phase: "discover",
    phaseOrder: 1,
    minTier: 1,
    storagePath: "audit/master.docx",
    storageExtension: "docx",
    videoUrl: null,
  },
  {
    slug: "model",
    number: 2,
    verb: "Model",
    title: "Model Your Unit Economics",
    description:
      "Pro forma templates for FDD Items 7 and 19 — investment range, financial performance representations, and unit-economics modeling.",
    format: "Document",
    phase: "discover",
    phaseOrder: 2,
    minTier: 1,
    storagePath: "model/master.docx",
    storageExtension: "docx",
    videoUrl: null,
  },
  {
    slug: "build",
    number: 3,
    verb: "Build",
    title: "Build Your 12-Month Roadmap",
    description:
      "Complete development Gantt chart with every milestone from FDD draft to first franchisee handoff.",
    format: "Document",
    phase: "architect",
    phaseOrder: 1,
    minTier: 1,
    storagePath: "build/master.docx",
    storageExtension: "docx",
    videoUrl: null,
  },
  {
    slug: "codify",
    number: 4,
    verb: "Codify",
    title: "Codify Your Operations",
    description:
      "17-chapter, 100+ page Operations Manual master template ready to be filled in with your specific systems.",
    format: "Document",
    phase: "architect",
    phaseOrder: 2,
    minTier: 1,
    storagePath: "codify/master.docx",
    storageExtension: "docx",
    videoUrl: null,
  },
  {
    slug: "decode",
    number: 5,
    verb: "Decode",
    title: "Decode the FDD",
    description:
      "All 23 federal disclosure items explained in plain English — walk into your franchise attorney prepared, not lost.",
    format: "Document",
    phase: "architect",
    phaseOrder: 3,
    minTier: 1,
    storagePath: "decode/master.docx",
    storageExtension: "docx",
    videoUrl: null,
  },
  {
    slug: "train",
    number: 6,
    verb: "Train",
    title: "Train Your Team to Replicate",
    description:
      "Staff training and certification modules so every location runs the system exactly the same way.",
    format: "Document",
    phase: "activate",
    phaseOrder: 1,
    minTier: 1,
    storagePath: null, // pending — Jason needs to create this
    storageExtension: null,
    videoUrl: null,
  },
  {
    slug: "score",
    number: 7,
    verb: "Score",
    title: "Score Real Estate Like a Franchisor",
    description:
      "Proprietary scoring system for evaluating any location objectively before you sign a lease.",
    format: "Document",
    phase: "activate",
    phaseOrder: 2,
    minTier: 1,
    storagePath: "score/master.docx",
    storageExtension: "docx",
    videoUrl: null,
  },
  {
    slug: "qualify",
    number: 8,
    verb: "Qualify",
    title: "Qualify Every Candidate",
    description:
      "Weighted franchisee scoring matrix — pick partners on data, not gut.",
    format: "Document",
    phase: "acquire",
    phaseOrder: 1,
    minTier: 1,
    storagePath: "qualify/master.docx",
    storageExtension: "docx",
    videoUrl: null,
  },
  {
    slug: "close",
    number: 9,
    verb: "Close",
    title: "Close Discovery Day",
    description:
      "29-slide sales presentation engineered to convert qualified candidates into signed franchisees.",
    format: "Slide deck",
    phase: "acquire",
    phaseOrder: 2,
    minTier: 1,
    storagePath: "close/master.pptx",
    storageExtension: "pptx",
    videoUrl: null,
  },
];

export function getCapability(slug: string): Capability | undefined {
  return CAPABILITIES.find((c) => c.slug === slug);
}

export function capabilitiesForTier(tier: Tier): Capability[] {
  return CAPABILITIES.filter((c) => c.minTier <= tier);
}

export function capabilitiesByPhase(tier: Tier): Record<CapabilityPhase, Capability[]> {
  const visible = capabilitiesForTier(tier);
  return {
    discover: visible.filter((c) => c.phase === "discover").sort((a, b) => a.phaseOrder - b.phaseOrder),
    architect: visible.filter((c) => c.phase === "architect").sort((a, b) => a.phaseOrder - b.phaseOrder),
    activate: visible.filter((c) => c.phase === "activate").sort((a, b) => a.phaseOrder - b.phaseOrder),
    acquire: visible.filter((c) => c.phase === "acquire").sort((a, b) => a.phaseOrder - b.phaseOrder),
  };
}

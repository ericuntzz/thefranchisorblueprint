import type { Tier } from "@/lib/supabase/types";

/**
 * The franchisor operating system — nine verb-first capabilities.
 *
 * `driveEmbedUrl` is a Google Drive preview iframe URL of the form
 *   https://drive.google.com/file/d/FILE_ID/preview
 * `driveDownloadUrl` is a direct download link of the form
 *   https://drive.google.com/uc?export=download&id=FILE_ID
 *
 * Both can be left as null while we wait for Eric to share the URLs;
 * the portal pages will render a friendly "coming soon" placeholder.
 *
 * `minTier` controls who sees the capability:
 *   1 = all buyers (Blueprint, Navigator, Builder)
 *   2 = Navigator + Builder only (coaching-tier additions later)
 *   3 = Builder only (concierge additions later)
 */
export type Capability = {
  slug: string;
  number: number;
  verb: string;
  title: string;
  description: string;
  format: "Document" | "Spreadsheet" | "Slide deck" | "Checklist";
  minTier: Tier;
  driveEmbedUrl: string | null;
  driveDownloadUrl: string | null;
};

export const CAPABILITIES: Capability[] = [
  {
    slug: "audit",
    number: 1,
    verb: "Audit",
    title: "Audit Your Business",
    description: "150+ point readiness checklist that maps your current operations against the franchise-ready bar.",
    format: "Checklist",
    minTier: 1,
    driveEmbedUrl: null,
    driveDownloadUrl: null,
  },
  {
    slug: "build",
    number: 2,
    verb: "Build",
    title: "Build Your 12-Month Roadmap",
    description: "Complete development Gantt chart with every milestone from FDD draft to first franchisee handoff.",
    format: "Document",
    minTier: 1,
    driveEmbedUrl: null,
    driveDownloadUrl: null,
  },
  {
    slug: "model",
    number: 3,
    verb: "Model",
    title: "Model Your Unit Economics",
    description: "Pro forma templates for FDD Items 7 and 19 — investment range, financial performance representations, and unit-economics modeling.",
    format: "Document",
    minTier: 1,
    driveEmbedUrl: null,
    driveDownloadUrl: null,
  },
  {
    slug: "codify",
    number: 4,
    verb: "Codify",
    title: "Codify Your Operations",
    description: "17-chapter, 100+ page Operations Manual master template ready to be filled in with your specific systems.",
    format: "Document",
    minTier: 1,
    driveEmbedUrl: null,
    driveDownloadUrl: null,
  },
  {
    slug: "train",
    number: 5,
    verb: "Train",
    title: "Train Your Team to Replicate",
    description: "Staff training and certification modules so every location runs the system exactly the same way.",
    format: "Document",
    minTier: 1,
    driveEmbedUrl: null,
    driveDownloadUrl: null,
  },
  {
    slug: "decode",
    number: 6,
    verb: "Decode",
    title: "Decode the FDD",
    description: "All 23 federal disclosure items explained in plain English — walk into your franchise attorney prepared, not lost.",
    format: "Document",
    minTier: 1,
    driveEmbedUrl: null,
    driveDownloadUrl: null,
  },
  {
    slug: "score",
    number: 7,
    verb: "Score",
    title: "Score Real Estate Like a Franchisor",
    description: "Proprietary scoring system for evaluating any location objectively before you sign a lease.",
    format: "Document",
    minTier: 1,
    driveEmbedUrl: null,
    driveDownloadUrl: null,
  },
  {
    slug: "qualify",
    number: 8,
    verb: "Qualify",
    title: "Qualify Every Candidate",
    description: "Weighted franchisee scoring matrix — pick partners on data, not gut.",
    format: "Document",
    minTier: 1,
    driveEmbedUrl: null,
    driveDownloadUrl: null,
  },
  {
    slug: "close",
    number: 9,
    verb: "Close",
    title: "Close Discovery Day",
    description: "29-slide sales presentation engineered to convert qualified candidates into signed franchisees.",
    format: "Slide deck",
    minTier: 1,
    driveEmbedUrl: null,
    driveDownloadUrl: null,
  },
];

export function getCapability(slug: string): Capability | undefined {
  return CAPABILITIES.find((c) => c.slug === slug);
}

export function capabilitiesForTier(tier: Tier): Capability[] {
  return CAPABILITIES.filter((c) => c.minTier <= tier);
}

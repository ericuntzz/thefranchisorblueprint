/**
 * Export pipeline shared types.
 *
 * Each deliverable builder returns a `DeliverableDoc` — a renderer-
 * agnostic tree of titled sections containing typed blocks (paragraphs,
 * bullet lists, key/value tables, etc.). The renderer (`render-docx.ts`,
 * `render-pdf.tsx`) walks that tree and emits the format-specific
 * output. This separation means the same deliverable can be rendered
 * to multiple formats without each builder re-implementing format
 * details, and Jason can preview the doc in markdown before any
 * format-specific quirks creep in.
 *
 * Design goal: builders never import `docx` or `react-pdf`. They only
 * ever return `DeliverableDoc`.
 */

import type { MemoryFileSlug } from "@/lib/memory/files";

/**
 * One renderable block inside a section. Intentionally a small set —
 * extend by adding a discriminated variant + handling it in every
 * renderer. Don't reach for tables or images on day one; markdown-style
 * primitives carry 90% of an FDD draft.
 */
export type DocBlock =
  | { kind: "paragraph"; text: string; bold?: boolean; italic?: boolean }
  | { kind: "bullets"; items: string[] }
  | { kind: "numbered"; items: string[] }
  | {
      kind: "kvtable";
      /** Rendered as a 2-column table — first column bold label, second value. */
      rows: Array<{ label: string; value: string }>;
    }
  | { kind: "callout"; text: string; tone?: "neutral" | "warning" | "info" }
  | { kind: "spacer" }
  | { kind: "pagebreak" };

/**
 * One titled section in the document. Sections nest one level deep
 * (level 1 + level 2). Anything deeper should be expressed as a new
 * section in the parent's `subsections`, not as a third level — keeps
 * the rendered output flat and scannable.
 */
export type DocSection = {
  /** Display heading (e.g. "Item 1: The Franchisor"). */
  title: string;
  /** Heading level — 1 = Item / chapter, 2 = subsection. */
  level: 1 | 2;
  blocks: DocBlock[];
  /** Optional nested subsections; rendered after this section's blocks. */
  subsections?: DocSection[];
};

/**
 * Top-level renderable document.
 *
 * `coverFields` is rendered as the front-matter (cover page in DOCX,
 * first page in PDF). `sections` is the body. `disclaimer` is rendered
 * at the bottom of the front-matter — used to remind the customer
 * that this is a TFB-generated draft and not legal advice.
 */
export type DeliverableDoc = {
  title: string;
  subtitle?: string;
  /** Cover-page key/value pairs. Common: business name, founder, today's date,
   *  Blueprint readiness %, prepared by ("The Franchisor Blueprint"). */
  coverFields?: Array<{ label: string; value: string }>;
  disclaimer?: string;
  sections: DocSection[];
};

// ---------------------------------------------------------------------------
// Build context
// ---------------------------------------------------------------------------

/**
 * Everything a builder needs from the database to assemble the
 * deliverable. Loaded once per export request (see `loadBuildContext`)
 * and passed to every builder so we never re-query inside a builder.
 */
export type BuildContext = {
  userId: string;
  /** Per-chapter Memory rows, indexed by slug. Missing chapters return
   *  empty fields + empty content; builders MUST handle null chapters
   *  gracefully (most fields are optional). */
  memory: Partial<Record<MemoryFileSlug, ChapterContent>>;
  /** Cross-chapter computed fields (calc lib output). Builders read this
   *  for derived values like EBITDA margin instead of recomputing. */
  computed: Partial<Record<MemoryFileSlug, Record<string, number | null>>>;
  /** Customer profile snapshot — for cover page personalization. */
  profile: {
    fullName: string | null;
    email: string;
    websiteUrl: string | null;
  };
  /** ISO date the export was generated (used on the cover page). */
  generatedAt: string;
  /** 0-100 readiness score at time of export — disclaimed on the cover
   *  so the attorney/customer knows how complete the draft is. */
  readinessPct: number;
};

/** Memory row contents the builders actually read. */
export type ChapterContent = {
  slug: MemoryFileSlug;
  contentMd: string;
  fields: Record<string, string | number | boolean | string[] | null>;
  confidence: "verified" | "inferred" | "draft";
};

// ---------------------------------------------------------------------------
// Deliverable registry types
// ---------------------------------------------------------------------------

export type DeliverableFormat = "docx" | "pdf" | "md";

/** Stable ID used in URLs, registry keys, and customer-facing links. */
export type DeliverableId =
  | "fdd-draft"
  | "operations-manual"
  | "financial-model"
  | "franchisee-scoring-matrix";

export type DeliverableDef = {
  id: DeliverableId;
  /** Customer-facing name, sentence case ("FDD Draft", not "FDD DRAFT"). */
  name: string;
  /** One-sentence description for the export card. */
  description: string;
  /** What chapters this deliverable pulls from. Used for the readiness
   *  pre-flight check. */
  sourceChapters: MemoryFileSlug[];
  /** Which formats are supported. */
  formats: DeliverableFormat[];
  /** Build function — pure: takes context, returns a renderable doc. */
  build: (ctx: BuildContext) => DeliverableDoc;
  /** Filename stem for downloads (no extension). */
  filenameStem: string;
};

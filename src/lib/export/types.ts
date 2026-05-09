/**
 * Export pipeline shared types.
 *
 * Each deliverable builder returns either a `DeliverableDoc` (DOCX/MD/PDF
 * targets) or a `SlideDoc` (PPTX target). The corresponding renderer
 * walks that tree and emits the format-specific output. This separation
 * means the same deliverable can be rendered to multiple formats without
 * each builder re-implementing format details.
 *
 * Design goal: builders never import `docx` or `pptxgenjs`. They only
 * ever return a `DeliverableDoc` or a `SlideDoc`.
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
  | {
      kind: "table";
      /** Rendered as an N-column table with a header row. */
      headers: string[];
      rows: string[][];
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
// Slide deliverables (Discovery Day deck, etc.)
// ---------------------------------------------------------------------------

/**
 * One slide in a deck. Layout drives the rendering — `content` is a
 * normal title + body, `section` is a divider/section-break with no
 * body, `title` is the cover slide. Speaker notes appear in the
 * presenter view but not on the rendered slide.
 */
export type Slide =
  | {
      layout: "title";
      title: string;
      subtitle?: string;
      footer?: string;
    }
  | {
      layout: "section";
      /** Section-break slide — large heading, optional one-liner. */
      title: string;
      caption?: string;
    }
  | {
      layout: "content";
      title: string;
      body: SlideBody[];
      /** Speaker notes — visible in presenter view only. */
      notes?: string;
    }
  | {
      layout: "two-column";
      title: string;
      left: SlideBody[];
      right: SlideBody[];
      leftLabel?: string;
      rightLabel?: string;
      notes?: string;
    }
  | {
      layout: "stat";
      /** Big-number slide — single headline figure with a caption. */
      stat: string;
      caption: string;
      title?: string;
      notes?: string;
    };

/**
 * A block that goes inside a slide's body. Slides have less room than
 * documents so we keep the block set tight: paragraphs, bullets, and
 * key/value pairs cover ~95% of presentation content.
 */
export type SlideBody =
  | { kind: "paragraph"; text: string; bold?: boolean }
  | { kind: "bullets"; items: string[] }
  | { kind: "kvlist"; rows: Array<{ label: string; value: string }> }
  | { kind: "stat"; value: string; caption: string };

/**
 * Top-level slide deck. Companion to DeliverableDoc but for PPTX-target
 * deliverables. The `slides` array IS the deck in render order; the
 * first slide is conventionally a `title` layout.
 */
export type SlideDoc = {
  title: string;
  subtitle?: string;
  /** Cover-page value pairs surfaced in the title slide footer. */
  coverFields?: Array<{ label: string; value: string }>;
  /** Disclaimer rendered as a footer note on the title slide. */
  disclaimer?: string;
  slides: Slide[];
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

export type DeliverableFormat = "docx" | "pdf" | "md" | "pptx";

/** Stable ID used in URLs, registry keys, and customer-facing links. */
export type DeliverableId =
  | "fdd-draft"
  | "operations-manual"
  | "financial-model"
  | "franchisee-scoring-matrix"
  | "discovery-day-deck"
  | "marketing-fund-manual"
  | "employee-handbook"
  | "reimbursement-policy"
  | "site-selection-guide"
  | "brand-standards"
  | "qualify-matrix"
  | "concept-and-story"
  | "training-program"
  | "franchise-agreement"
  | "state-registration-matrix"
  | "market-strategy-report"
  | "competitor-landscape";

/**
 * Discriminated-union deliverable definition. `kind: "doc"` builders
 * return a DeliverableDoc and target DOCX/MD; `kind: "slides"` builders
 * return a SlideDoc and target PPTX.
 */
export type DocDeliverableDef = {
  kind: "doc";
  id: DeliverableId;
  name: string;
  description: string;
  sourceChapters: MemoryFileSlug[];
  formats: Array<"docx" | "md" | "pdf">;
  build: (ctx: BuildContext) => DeliverableDoc;
  filenameStem: string;
};

export type SlidesDeliverableDef = {
  kind: "slides";
  id: DeliverableId;
  name: string;
  description: string;
  sourceChapters: MemoryFileSlug[];
  formats: ["pptx"];
  build: (ctx: BuildContext) => SlideDoc;
  filenameStem: string;
};

export type DeliverableDef = DocDeliverableDef | SlidesDeliverableDef;

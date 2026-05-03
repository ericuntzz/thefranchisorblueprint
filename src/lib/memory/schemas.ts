/**
 * Per-chapter field schemas — Phase 1.5a.
 *
 * Each chapter of the customer's Franchisor Blueprint has a STRUCTURED
 * data layer (typed fields) alongside the existing narrative `content_md`
 * prose. The structured layer is what:
 *
 *   - The export pipeline (Phase 5) substitutes into DOCX/PPTX templates
 *     (`{{royalty_rate_pct}}` is clean; parsing "5–7% depending on tier"
 *     out of a paragraph is brittle).
 *   - The math library (`src/lib/calc/`) reads for FDD Item 7 totals,
 *     ramp curves, financial-model formulas (those need typed numbers).
 *   - The attorney-readiness scoring reads to compute "12 of 15 fields
 *     verified" — a sharper metric than "78% attorney-ready."
 *   - The customer-edits-inline UI is built around (Profound-style:
 *     click a labeled field, type a value, save).
 *   - The chat agent's `update_memory_field` tool targets, by name,
 *     when it learns something via voice intake or chat correction.
 *
 * The narrative `content_md` still exists alongside this — it's the
 * polished prose that gets compiled into the export. The agent's
 * drafting pipeline writes BOTH: it extracts structured field values
 * AND writes prose that references those fields. When a field changes,
 * the prose can stay or be regenerated explicitly (we do NOT auto-
 * regenerate prose on every field edit — would be jarring).
 *
 * THIS FILE IS THE ONLY SOURCE OF TRUTH for what fields a chapter has.
 * Eric and Jason should treat it as the product spec and edit here when
 * they want to add/remove/rename a field. Renames are destructive — see
 * the migration note at the bottom.
 *
 * Phase 1.5a status:
 *   ✅ Foundational chapters defined (brand_voice, business_overview,
 *      unit_economics, franchise_economics)
 *   ⏳ Remaining 12 chapters pending Eric+Jason review of these four
 *
 * See `docs/agentic-portal-buildout.md` §4 for the broader Memory
 * architecture and `src/lib/memory/files.ts` for the canonical chapter
 * slug list.
 */

import type { MemoryFileSlug } from "./files";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Field data types. Determines how the field is rendered in the UI,
 * what kind of input control it gets, and how the agent should fill it.
 *
 * - `text`         — single line, any text. Default.
 * - `textarea`     — multi-line plain text (no markdown). Use for short
 *                    paragraphs (mission statement, founder origin story).
 * - `markdown`     — multi-line markdown. Use only when the field is a
 *                    composed paragraph that benefits from formatting.
 *                    Most fields should use `textarea` to avoid letting
 *                    customers reach for headings/lists where prose
 *                    would do.
 * - `number`       — generic number, no unit
 * - `integer`      — whole numbers (counts: locations, employees, units)
 * - `currency`     — USD amount, formatted with `$1,234`
 * - `percentage`   — 0–100, formatted with `%`
 * - `year`         — 4-digit year (1900-current)
 * - `date`         — ISO date string (YYYY-MM-DD)
 * - `color`        — hex color (#RRGGBB)
 * - `url`          — absolute URL with scheme
 * - `email`        — email address
 * - `boolean`      — true/false toggle
 * - `select`       — single value from `options[]`
 * - `list_short`   — string[], each item ≤ ~80 chars (voice adjectives,
 *                    distinctive attributes, value props)
 * - `list_long`    — string[], each item can be a paragraph
 *                    (business history milestones, detailed ramp notes)
 */
export type FieldType =
  | "text"
  | "textarea"
  | "markdown"
  | "number"
  | "integer"
  | "currency"
  | "percentage"
  | "year"
  | "date"
  | "color"
  | "url"
  | "email"
  | "boolean"
  | "select"
  | "list_short"
  | "list_long";

/**
 * One typed field within a chapter.
 *
 * The `name` is the storage key inside `customer_memory.fields` (jsonb)
 * and must be a valid JS identifier — snake_case. Renaming a field
 * after launch is a destructive migration (existing customer data is
 * keyed by name); see "renaming" below.
 *
 * `category` is a soft grouping for the editor UI — we render fields
 * within the same category together with a small heading. Pick from a
 * short, stable set (Identity / Voice / Visual / Money / Operations /
 * Strategy / Legal). New categories add visual noise; reuse existing
 * ones unless a new one is genuinely warranted.
 *
 * `helpText` is shown on hover or in a tooltip — used to coach the
 * customer on what to put. Keep it under 200 chars.
 *
 * `placeholder` shows when the field is empty. For example fields, write
 * a real-looking value (e.g. "5.5" for royalty_rate_pct). For narrative
 * fields, write a short prompt ("In one sentence — what makes you
 * different from the next coffee shop on the corner?").
 */
export type FieldDef = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  category?: string;
  /** Only for `select` */
  options?: { value: string; label: string }[];
  /** For numeric types — soft validation hint, not enforced server-side. */
  min?: number;
  max?: number;
  /**
   * If true, hidden by default in the UI; revealed by an "Show advanced"
   * toggle. Use for fields that 90% of customers won't touch but that
   * matter when they do. Don't overuse — buried fields don't get filled.
   */
  advanced?: boolean;
};

/**
 * A chapter's complete field schema, plus a couple of metadata fields
 * the UI uses to render the chapter card header.
 */
export type ChapterSchema = {
  slug: MemoryFileSlug;
  /** Page-friendly title — also the H2 of the chapter card. */
  title: string;
  /** One-sentence description for the customer. Renders under the title in edit mode. */
  description: string;
  /**
   * What this chapter compiles into at export time. Use the actual
   * deliverable name(s) so the customer (and Jason) can trace the
   * lineage. e.g. "FDD Item 1, Operations Manual §1".
   */
  compilesInto: string;
  fields: FieldDef[];
};

// ---------------------------------------------------------------------------
// Foundational chapter schemas
// ---------------------------------------------------------------------------

/**
 * brand_voice — Brand Standards.
 *
 * This is the first chapter the website-scrape pipeline populates, so
 * almost every field here should be reachable from a typical
 * marketing-site scrape (with help from Sonnet 4.6 inference).
 *
 * Compiles into: Operations Manual §2 (Brand Standards), Marketing Fund
 * Manual cover sections, FDD Item 1 cover/branding.
 */
const BRAND_VOICE: ChapterSchema = {
  slug: "brand_voice",
  title: "Brand Standards",
  description:
    "How your brand identity shows up in the system — the version every franchisee will use.",
  compilesInto:
    "Operations Manual §2, Marketing Fund Manual cover, FDD Item 1 branding.",
  fields: [
    // ── Identity ────────────────────────────────────────────────────────────
    {
      name: "brand_name",
      label: "Brand name",
      type: "text",
      required: true,
      placeholder: "High Point Coffee",
      helpText:
        "The customer-facing name on signage, packaging, and marketing. Not the LLC.",
      category: "Identity",
    },
    {
      name: "legal_entity_name",
      label: "Legal franchisor entity",
      type: "text",
      placeholder: "High Point Coffee Franchising, LLC",
      helpText:
        "The legal entity that signs the franchise agreement. Often different from the brand name.",
      category: "Identity",
    },
    {
      name: "founding_year",
      label: "Founded in",
      type: "year",
      placeholder: "2017",
      category: "Identity",
    },
    {
      name: "tagline",
      label: "Tagline / slogan",
      type: "text",
      placeholder: "The smartest path to better coffee.",
      helpText:
        "Optional. Skip if you don't have one — better to leave blank than invent one for the FDD.",
      category: "Identity",
    },

    // ── Voice ───────────────────────────────────────────────────────────────
    {
      name: "mission_statement",
      label: "Mission",
      type: "textarea",
      placeholder:
        "We exist to make better coffee accessible to small towns the third-wave skipped over.",
      helpText:
        "1–2 sentences on why the business exists. Should be defensible to a franchisee asking 'what am I really selling?'",
      category: "Voice",
    },
    {
      name: "positioning_statement",
      label: "Positioning",
      type: "textarea",
      placeholder:
        "For locals who want a daily café experience without driving 40 miles to the city, High Point delivers third-wave coffee in a small-town-comfortable space.",
      helpText:
        "2–3 sentences. The 'for X who Y, we provide Z' shape. Forces clarity an attorney will appreciate.",
      category: "Voice",
    },
    {
      name: "voice_adjectives",
      label: "Voice — three to five words",
      type: "list_short",
      placeholder: "Warm, direct, operator-to-operator",
      helpText: "Three to five adjectives that describe how the brand speaks.",
      category: "Voice",
    },
    {
      name: "voice_description",
      label: "Voice — one-sentence description",
      type: "textarea",
      placeholder:
        "We talk to customers like neighbors who happen to know coffee. No barista jargon, no condescension.",
      helpText:
        "How those adjectives play out. Used in the operations manual to coach franchisees on copy and customer service language.",
      category: "Voice",
    },
    {
      name: "target_customer",
      label: "Target customer",
      type: "textarea",
      placeholder:
        "Locals 25–55 who used to drive to the city for good coffee and would rather stay closer to home if the quality holds up.",
      helpText: "Who this is built for. One paragraph.",
      category: "Voice",
    },
    {
      name: "distinctive_value_props",
      label: "What makes you distinctive",
      type: "list_short",
      placeholder: "Single-origin every week\nIn-house roasting\nNo Wi-Fi",
      helpText:
        "Three to five differentiators. Should each be a defensible claim, not marketing fluff.",
      category: "Voice",
    },

    // ── Visual ──────────────────────────────────────────────────────────────
    {
      name: "primary_color_hex",
      label: "Primary color",
      type: "color",
      placeholder: "#1E3A5F",
      helpText: "The single dominant brand color.",
      category: "Visual",
    },
    {
      name: "secondary_color_hex",
      label: "Secondary color",
      type: "color",
      placeholder: "#D4AF37",
      category: "Visual",
    },
    {
      name: "accent_color_hex",
      label: "Accent color",
      type: "color",
      placeholder: "#ECE9DF",
      category: "Visual",
      advanced: true,
    },
    {
      name: "typography_primary",
      label: "Primary typeface",
      type: "text",
      placeholder: "Inter",
      helpText: "The display / heading typeface.",
      category: "Visual",
    },
    {
      name: "typography_secondary",
      label: "Secondary typeface",
      type: "text",
      placeholder: "Source Serif Pro",
      helpText: "Optional. Body text or supporting use.",
      category: "Visual",
      advanced: true,
    },
    {
      name: "logo_url",
      label: "Logo URL",
      type: "url",
      placeholder: "https://yoursite.com/logo.svg",
      helpText: "Direct URL to your highest-resolution logo file.",
      category: "Visual",
    },

    // ── Web presence ────────────────────────────────────────────────────────
    {
      name: "website_url",
      label: "Website",
      type: "url",
      placeholder: "https://highpointcoffee.com",
      category: "Web presence",
    },
    {
      name: "instagram_handle",
      label: "Instagram",
      type: "text",
      placeholder: "@highpointcoffee",
      category: "Web presence",
      advanced: true,
    },
    {
      name: "linkedin_url",
      label: "LinkedIn",
      type: "url",
      category: "Web presence",
      advanced: true,
    },
    {
      name: "facebook_url",
      label: "Facebook",
      type: "url",
      category: "Web presence",
      advanced: true,
    },
  ],
};

/**
 * business_overview — Concept & Story.
 *
 * The narrative anchor for FDD Item 1 (the franchisor's identity and
 * concept) and the Operations Manual's opening chapter. The fields here
 * are the ones a franchise attorney will want documented — and the ones
 * Jason will want stress-tested in the readiness audit.
 *
 * Compiles into: FDD Item 1, Operations Manual §1, Discovery Day deck
 * opener, Concept Memo (the Day-1 wow artifact).
 */
const BUSINESS_OVERVIEW: ChapterSchema = {
  slug: "business_overview",
  title: "Concept & Story",
  description:
    "What the business is, why it exists, and what makes it franchisable. The cover story for the whole bundle.",
  compilesInto:
    "FDD Item 1, Operations Manual §1, Discovery Day deck opener.",
  fields: [
    // ── The concept ─────────────────────────────────────────────────────────
    {
      name: "concept_summary",
      label: "Concept summary",
      type: "textarea",
      required: true,
      placeholder:
        "High Point is a small-town third-wave coffee shop that roasts on-site, serves a locally-tuned menu, and treats every café as a community room rather than a transaction counter.",
      helpText:
        "2–3 sentences. The single paragraph an attorney reads first. Should be unmistakably about THIS business — not boilerplate.",
      category: "The concept",
    },
    {
      name: "core_offering",
      label: "What you sell",
      type: "textarea",
      placeholder:
        "Specialty coffee (single-origin pour-over, espresso drinks), in-house pastries, light savory menu, retail beans by the bag.",
      helpText:
        "What changes hands at the register. Specific enough that an FDD reviewer can classify the business.",
      category: "The concept",
    },
    {
      name: "industry_category",
      label: "Industry category",
      type: "text",
      placeholder: "Specialty coffee café (QSR coffee subcategory)",
      helpText: "Plain-English category, not a NAICS code.",
      category: "The concept",
    },
    {
      name: "naics_code",
      label: "NAICS code",
      type: "text",
      placeholder: "722515",
      helpText:
        "U.S. industry classification code. Required on most state franchise registration applications. Look up at naics.com if unsure.",
      category: "The concept",
      advanced: true,
    },

    // ── Founder ─────────────────────────────────────────────────────────────
    {
      name: "founder_name",
      label: "Founder",
      type: "text",
      required: true,
      placeholder: "Sarah Chen",
      helpText:
        "The person whose story anchors the brand. If multiple co-founders, the one who's the public face.",
      category: "Founder",
    },
    {
      name: "founder_background",
      label: "Founder background",
      type: "textarea",
      placeholder:
        "Sarah spent eight years as a barista and trainer at three Bay Area roasters before moving back home to Hattiesburg in 2017.",
      helpText:
        "1–2 sentences on relevant experience. Used to establish operator credibility for the FDD.",
      category: "Founder",
    },
    {
      name: "founder_origin_story",
      label: "Why this business exists",
      type: "markdown",
      placeholder:
        "I grew up here and I drove 40 miles each way for good coffee for years. When I moved back, I didn't want to keep doing that — and I figured my neighbors didn't either.",
      helpText:
        "1–2 paragraphs in the founder's voice. The most important narrative passage in the whole Blueprint — this is what an investor or franchisee remembers.",
      category: "Founder",
    },

    // ── Track record ────────────────────────────────────────────────────────
    {
      name: "founding_date",
      label: "First location opened",
      type: "date",
      placeholder: "2017-09-01",
      helpText: "Date the first revenue-generating location opened.",
      category: "Track record",
    },
    {
      name: "first_location_address",
      label: "First location address",
      type: "text",
      placeholder: "412 Main Street, Hattiesburg, MS 39401",
      category: "Track record",
      advanced: true,
    },
    {
      name: "current_location_count",
      label: "Current locations operating",
      type: "integer",
      placeholder: "3",
      helpText: "Open and revenue-generating, including franchised + corporate.",
      category: "Track record",
    },
    {
      name: "corporate_location_count",
      label: "Of which: corporate-owned",
      type: "integer",
      placeholder: "3",
      category: "Track record",
      advanced: true,
    },
    {
      name: "franchised_location_count",
      label: "Of which: already franchised",
      type: "integer",
      placeholder: "0",
      helpText: "Existing franchised units. Will be 0 for emerging franchisors pre-launch.",
      category: "Track record",
      advanced: true,
    },
    {
      name: "business_history_milestones",
      label: "Key milestones",
      type: "list_long",
      placeholder:
        "2017: opened first location\n2019: hit $850K AUV\n2021: opened second location, brought roasting in-house\n2023: third location, started developing the franchise model",
      helpText:
        "One short line per milestone. Used to establish a track record arc for the FDD and Discovery Day deck.",
      category: "Track record",
    },

    // ── Audience ────────────────────────────────────────────────────────────
    {
      name: "target_customer_persona",
      label: "Target customer persona",
      type: "textarea",
      placeholder:
        "Locals 25–55 with disposable income and either a remote-work setup or a kid in school. They have a coffee habit and they care about quality more than they admit.",
      helpText:
        "2–3 sentences on who walks through the door. Specific enough to inform site selection and marketing.",
      category: "Audience",
    },
    {
      name: "distinctive_attributes",
      label: "What makes you franchisable",
      type: "list_short",
      placeholder:
        "Codified menu (no chef-driven dependency)\nIn-house roasting + barista training program\nProven unit economics across 3 locations",
      helpText:
        "Three to five attributes that justify the franchise model. These should be defensible — what would Jason say if a franchisee asked 'why should I trust this is replicable?'",
      category: "Audience",
    },
  ],
};

/**
 * unit_economics — Unit Economics & Financial Model.
 *
 * The most data-dense chapter and the one with the highest stakes:
 * every numeric field here drives FDD Item 7 (initial investment),
 * Item 19 (financial performance representations), and the financial
 * model deliverable. Wrong numbers here are the difference between an
 * approved FDD and a rejected one.
 *
 * Note on field design: many of these fields are "advanced" by default
 * because the customer typically only needs the headline numbers
 * (AUV, COGS%, labor%, royalty rate, initial investment) to get a
 * draft. The deeper line-items (FF&E, working capital breakdown,
 * specific PoS systems) get filled in as the customer prepares for the
 * attorney handoff. Don't try to make a customer fill 28 fields in one
 * sitting.
 *
 * Compiles into: FDD Item 7, FDD Item 19, Financial Model deliverable,
 * Franchisee Scoring Matrix (liquidity + net worth requirements).
 */
const UNIT_ECONOMICS: ChapterSchema = {
  slug: "unit_economics",
  title: "Unit Economics & Financial Model",
  description:
    "The numbers that drive every dollar in the FDD and every projection in the model.",
  compilesInto:
    "FDD Item 7, FDD Item 19, Financial Model, Franchisee Scoring Matrix.",
  fields: [
    // ── Headline performance ────────────────────────────────────────────────
    {
      name: "average_unit_volume_dollars",
      label: "Average Unit Volume (mature)",
      type: "currency",
      required: true,
      placeholder: "1200000",
      helpText:
        "The annual gross revenue of a mature location (year 3+). The single most important number in the whole Blueprint.",
      category: "Headline performance",
    },
    {
      name: "auv_year_1_dollars",
      label: "Year 1 revenue (typical)",
      type: "currency",
      placeholder: "780000",
      helpText:
        "What a typical new location generates in its first 12 months.",
      category: "Headline performance",
    },
    {
      name: "auv_year_2_dollars",
      label: "Year 2 revenue (typical)",
      type: "currency",
      placeholder: "1000000",
      category: "Headline performance",
    },
    {
      name: "ebitda_margin_pct",
      label: "EBITDA margin (mature)",
      type: "percentage",
      required: true,
      placeholder: "18",
      helpText:
        "Operating profit before interest, taxes, depreciation, amortization — as a % of revenue. The number an investor cares about most.",
      category: "Headline performance",
      min: 0,
      max: 100,
    },
    {
      name: "payback_period_months",
      label: "Payback period (months)",
      type: "integer",
      placeholder: "30",
      helpText:
        "How long until a franchisee recovers their initial investment from operating cash flow.",
      category: "Headline performance",
    },

    // ── Cost structure (% of revenue) ───────────────────────────────────────
    {
      name: "cogs_pct",
      label: "Cost of goods sold (COGS %)",
      type: "percentage",
      required: true,
      placeholder: "32",
      helpText:
        "Variable cost of the product itself. For coffee: beans, milk, syrups, cups. NOT labor.",
      category: "Cost structure",
      min: 0,
      max: 100,
    },
    {
      name: "labor_pct",
      label: "Labor %",
      type: "percentage",
      required: true,
      placeholder: "28",
      helpText: "All wages, benefits, payroll taxes. As % of revenue.",
      category: "Cost structure",
      min: 0,
      max: 100,
    },
    {
      name: "occupancy_pct",
      label: "Occupancy %",
      type: "percentage",
      required: true,
      placeholder: "8",
      helpText: "Rent + CAM + utilities. As % of revenue.",
      category: "Cost structure",
      min: 0,
      max: 100,
    },
    {
      name: "marketing_pct",
      label: "Local marketing %",
      type: "percentage",
      placeholder: "2",
      helpText:
        "Local marketing spend (NOT the brand-level ad fund — that's in Royalty, Ad Fund & Fees).",
      category: "Cost structure",
      min: 0,
      max: 100,
    },
    {
      name: "other_opex_pct",
      label: "Other operating expenses %",
      type: "percentage",
      placeholder: "6",
      helpText:
        "Everything not in the above buckets: insurance, repairs, software, supplies, etc.",
      category: "Cost structure",
      min: 0,
      max: 100,
      advanced: true,
    },

    // ── Ramp curve ──────────────────────────────────────────────────────────
    {
      name: "ramp_curve_year_1_pct",
      label: "Year 1 ramp (% of mature AUV)",
      type: "percentage",
      placeholder: "65",
      helpText:
        "What % of mature AUV a new location hits in year 1. Drives Item 19 ranges and the financial model's revenue forecast.",
      category: "Ramp curve",
      min: 0,
      max: 100,
    },
    {
      name: "ramp_curve_year_2_pct",
      label: "Year 2 ramp",
      type: "percentage",
      placeholder: "85",
      category: "Ramp curve",
      min: 0,
      max: 100,
    },
    {
      name: "ramp_curve_year_3_pct",
      label: "Year 3 ramp",
      type: "percentage",
      placeholder: "100",
      helpText: "Defaults to 100% (year 3 = mature) for most concepts.",
      category: "Ramp curve",
      min: 0,
      max: 100,
      advanced: true,
    },

    // ── Initial investment (FDD Item 7) ─────────────────────────────────────
    {
      name: "initial_investment_low_dollars",
      label: "Initial investment — low estimate",
      type: "currency",
      required: true,
      placeholder: "275000",
      helpText:
        "The low end of what a franchisee will spend to open. Drives FDD Item 7 directly.",
      category: "Initial investment",
    },
    {
      name: "initial_investment_high_dollars",
      label: "Initial investment — high estimate",
      type: "currency",
      required: true,
      placeholder: "425000",
      category: "Initial investment",
    },
    {
      name: "buildout_cost_low_dollars",
      label: "Build-out cost — low",
      type: "currency",
      placeholder: "120000",
      helpText: "Construction + tenant improvements only. Excludes FF&E.",
      category: "Initial investment",
      advanced: true,
    },
    {
      name: "buildout_cost_high_dollars",
      label: "Build-out cost — high",
      type: "currency",
      placeholder: "200000",
      category: "Initial investment",
      advanced: true,
    },
    {
      name: "ff_e_cost_dollars",
      label: "FF&E cost (typical)",
      type: "currency",
      placeholder: "80000",
      helpText: "Furniture, fixtures, equipment.",
      category: "Initial investment",
      advanced: true,
    },
    {
      name: "working_capital_dollars",
      label: "Working capital",
      type: "currency",
      placeholder: "30000",
      helpText: "Operating cash to run the business through ramp.",
      category: "Initial investment",
      advanced: true,
    },

    // ── Franchisee qualifications ───────────────────────────────────────────
    {
      name: "liquidity_requirement_dollars",
      label: "Required liquid capital",
      type: "currency",
      required: true,
      placeholder: "100000",
      helpText:
        "How much liquid cash a franchisee must have. Drives the qualification screen.",
      category: "Franchisee qualifications",
    },
    {
      name: "net_worth_requirement_dollars",
      label: "Required net worth",
      type: "currency",
      required: true,
      placeholder: "500000",
      helpText: "Total net worth (liquid + illiquid) required to qualify.",
      category: "Franchisee qualifications",
    },

    // ── Systems ─────────────────────────────────────────────────────────────
    {
      name: "pos_system",
      label: "Point-of-sale system",
      type: "text",
      placeholder: "Square for Restaurants",
      category: "Systems",
      advanced: true,
    },
    {
      name: "accounting_system",
      label: "Accounting / bookkeeping system",
      type: "text",
      placeholder: "QuickBooks Online",
      category: "Systems",
      advanced: true,
    },

    // ── Assumptions narrative ───────────────────────────────────────────────
    {
      name: "key_assumptions",
      label: "Key assumptions in this model",
      type: "markdown",
      placeholder:
        "Numbers based on the three corporate locations (years 2017–2024). Assumes a 1,400–1,800 sqft footprint, urban or close-suburb location, and a household income median ≥ $55K within 5 miles. Does not assume drive-through revenue.",
      helpText:
        "Anything an attorney or franchisee should know to interpret these numbers. Used in the FDD Item 19 disclaimer paragraph.",
      category: "Assumptions",
    },
  ],
};

/**
 * franchise_economics — Royalty, Ad Fund & Fees.
 *
 * The franchisor business-model layer. These numbers define the
 * franchisor's revenue per franchisee, and they appear in FDD Items 5
 * (initial fees) and 6 (other fees), the franchise agreement itself,
 * and the marketing fund manual. Most are simple typed numbers; the
 * complexity is in the territory section where there's a real shape
 * decision (exclusive / non-exclusive / point-of-interest) that
 * triggers different downstream language.
 *
 * Compiles into: FDD Items 5+6, FDD Item 12 (territory), Marketing
 * Fund Manual, Franchise Agreement scaffolding.
 */
const FRANCHISE_ECONOMICS: ChapterSchema = {
  slug: "franchise_economics",
  title: "Royalty, Ad Fund & Fees",
  description:
    "The fee structure that defines the franchisor's revenue per franchisee.",
  compilesInto:
    "FDD Items 5+6, FDD Item 12 (territory), Marketing Fund Manual, Franchise Agreement scaffolding.",
  fields: [
    // ── Initial fee ─────────────────────────────────────────────────────────
    {
      name: "franchise_fee_dollars",
      label: "Initial franchise fee",
      type: "currency",
      required: true,
      placeholder: "45000",
      helpText:
        "One-time fee paid at signing. Industry typical for emerging franchisors: $25K–$50K.",
      category: "Initial fee",
    },
    {
      name: "franchise_fee_volume_discount",
      label: "Multi-unit discount (if any)",
      type: "textarea",
      placeholder:
        "$5,000 off each additional unit signed at the same time, up to 4 units.",
      helpText: "Optional — leave blank if you don't offer one.",
      category: "Initial fee",
      advanced: true,
    },

    // ── Royalty ─────────────────────────────────────────────────────────────
    {
      name: "royalty_rate_pct",
      label: "Royalty rate",
      type: "percentage",
      required: true,
      placeholder: "6",
      helpText:
        "% of gross sales the franchisee pays the franchisor. Industry typical: 4–8%.",
      category: "Royalty",
      min: 0,
      max: 25,
    },
    {
      name: "royalty_rate_basis",
      label: "Royalty basis",
      type: "select",
      placeholder: "gross sales",
      helpText: "What the royalty is calculated against.",
      options: [
        { value: "gross_sales", label: "Gross sales" },
        { value: "net_sales", label: "Net sales (gross minus refunds/comps)" },
        { value: "weekly_gross_sales", label: "Weekly gross sales" },
      ],
      category: "Royalty",
    },
    {
      name: "royalty_payment_frequency",
      label: "Royalty payment frequency",
      type: "select",
      options: [
        { value: "weekly", label: "Weekly" },
        { value: "biweekly", label: "Biweekly" },
        { value: "monthly", label: "Monthly" },
      ],
      category: "Royalty",
    },
    {
      name: "royalty_minimum_dollars",
      label: "Royalty minimum (monthly)",
      type: "currency",
      placeholder: "500",
      helpText:
        "Optional minimum royalty if % calculation comes out lower. Most concepts skip this.",
      category: "Royalty",
      advanced: true,
    },

    // ── Ad fund ─────────────────────────────────────────────────────────────
    {
      name: "ad_fund_pct",
      label: "Brand ad fund contribution",
      type: "percentage",
      required: true,
      placeholder: "2",
      helpText:
        "% of gross sales franchisees contribute to the brand-wide ad fund. Industry typical: 1–3%.",
      category: "Ad fund",
      min: 0,
      max: 10,
    },
    {
      name: "local_marketing_minimum_pct",
      label: "Local marketing minimum (% of sales)",
      type: "percentage",
      placeholder: "2",
      helpText:
        "What franchisees MUST spend on local marketing on top of the ad fund. Optional.",
      category: "Ad fund",
      advanced: true,
    },

    // ── Other recurring fees ────────────────────────────────────────────────
    {
      name: "technology_fee_dollars_per_month",
      label: "Technology fee (monthly)",
      type: "currency",
      placeholder: "350",
      helpText:
        "Monthly fee for required technology stack (POS, scheduling, etc.). Pass-through cost is fine here.",
      category: "Other fees",
      advanced: true,
    },
    {
      name: "transfer_fee_dollars",
      label: "Transfer fee",
      type: "currency",
      placeholder: "10000",
      helpText:
        "Fee when a franchisee sells/transfers their unit. Industry typical: $5K–$15K.",
      category: "Other fees",
      advanced: true,
    },
    {
      name: "renewal_fee_dollars",
      label: "Renewal fee",
      type: "currency",
      placeholder: "15000",
      helpText: "Charged when the franchisee renews the agreement at term end.",
      category: "Other fees",
      advanced: true,
    },
    {
      name: "training_fee_dollars",
      label: "Initial training fee",
      type: "currency",
      placeholder: "0",
      helpText:
        "Most concepts include training in the franchise fee — leave at 0 if so. Charge separately if you want a higher franchise fee + standalone training cost.",
      category: "Other fees",
      advanced: true,
    },

    // ── Term ────────────────────────────────────────────────────────────────
    {
      name: "term_years",
      label: "Initial term (years)",
      type: "integer",
      required: true,
      placeholder: "10",
      helpText: "Length of the initial franchise agreement. Industry typical: 10 years.",
      category: "Term",
      min: 1,
      max: 30,
    },
    {
      name: "renewal_term_years",
      label: "Renewal term (years)",
      type: "integer",
      placeholder: "5",
      helpText: "How long each renewal lasts. Industry typical: 5–10 years.",
      category: "Term",
      advanced: true,
    },
    {
      name: "renewal_count_allowed",
      label: "Number of renewals allowed",
      type: "integer",
      placeholder: "2",
      helpText: "How many times a franchisee can renew. 0 = no renewals; 99 = unlimited.",
      category: "Term",
      advanced: true,
    },

    // ── Territory ───────────────────────────────────────────────────────────
    {
      name: "territory_protection_type",
      label: "Territory protection type",
      type: "select",
      required: true,
      helpText:
        "How exclusive the franchisee's territory is. The biggest single decision in the franchise agreement.",
      options: [
        { value: "exclusive", label: "Exclusive — no other franchised or corporate units inside" },
        { value: "non_exclusive", label: "Non-exclusive — franchisor can place additional units" },
        {
          value: "protected",
          label: "Protected — franchisor can't place inside, but can grant outside",
        },
        {
          value: "point_of_interest",
          label: "Point-of-interest — franchisee gets a designated address only, no surrounding territory",
        },
      ],
      category: "Territory",
    },
    {
      name: "territory_radius_miles",
      label: "Territory radius (miles)",
      type: "number",
      placeholder: "3",
      helpText:
        "If territory is exclusive/protected, the radius around the unit. Often 1–5 miles for retail, larger for service-based concepts.",
      category: "Territory",
    },
    {
      name: "territory_population_count",
      label: "Territory population (alternative to radius)",
      type: "integer",
      placeholder: "50000",
      helpText:
        "Population-based territory: '1 unit per 50,000 residents' instead of a fixed radius. Skip if using radius.",
      category: "Territory",
      advanced: true,
    },

    // ── Multi-unit & development ────────────────────────────────────────────
    {
      name: "multi_unit_required",
      label: "Multi-unit deal required?",
      type: "boolean",
      helpText:
        "Some concepts only sell to multi-unit operators. Leave false if you accept single-unit franchisees.",
      category: "Multi-unit",
      advanced: true,
    },
    {
      name: "area_development_fee_dollars",
      label: "Area Development fee",
      type: "currency",
      placeholder: "20000",
      helpText:
        "Optional separate fee for area developers (multi-unit operators committing to a region). Skip if not offering ADAs.",
      category: "Multi-unit",
      advanced: true,
    },
    {
      name: "master_franchise_available",
      label: "Master franchise opportunities available?",
      type: "boolean",
      helpText: "Sub-franchising rights for international expansion. Most emerging franchisors say no.",
      category: "Multi-unit",
      advanced: true,
    },
  ],
};

// ---------------------------------------------------------------------------
// Registry & helpers
// ---------------------------------------------------------------------------

/**
 * Per-chapter schema registry. Add entries here as schemas are designed.
 * The remaining 12 chapters are pending Eric+Jason review of the
 * foundational four — we do NOT want to design them in parallel because
 * the conventions established here (field naming, category groupings,
 * advanced-flag philosophy, helpText voice) need to stick.
 */
export const CHAPTER_SCHEMAS: Partial<Record<MemoryFileSlug, ChapterSchema>> = {
  brand_voice: BRAND_VOICE,
  business_overview: BUSINESS_OVERVIEW,
  unit_economics: UNIT_ECONOMICS,
  franchise_economics: FRANCHISE_ECONOMICS,
};

/**
 * Returns the field schema for a chapter, or null if no schema exists yet
 * (the remaining 12 chapters until they're filled in). Callers should
 * fall back gracefully — the chapter still has a `content_md` blob and
 * can be drafted prose-only.
 */
export function getChapterSchema(slug: MemoryFileSlug): ChapterSchema | null {
  return CHAPTER_SCHEMAS[slug] ?? null;
}

/**
 * The shape of `customer_memory.fields` (jsonb) for a given chapter.
 *
 * Stored values are JSON-serializable: strings, numbers, booleans, and
 * `string[]` for lists. We store ISO-format strings for dates. Color
 * fields are stored as `#RRGGBB` strings.
 *
 * Empty/unknown values are stored as `null` (not `undefined`) so the
 * jsonb diff stays meaningful — a field set to null was deliberately
 * cleared; a missing key was never touched.
 */
export type FieldValue =
  | string
  | number
  | boolean
  | string[]
  | null;

export type ChapterFields = Record<string, FieldValue>;

/**
 * Per-field provenance metadata. Stored on `customer_memory.field_status`
 * as a parallel JSONB object keyed by field name.
 */
export type FieldStatus = {
  /** Where this value came from. */
  source:
    | "voice_session"
    | "upload"
    | "form"
    | "agent_inference"
    | "research"
    | "scraper"
    | "user_correction"
    | "user_typed";
  /** ISO timestamp of last write. */
  updated_at: string;
  /** Optional human-readable note. Used by the agent to record why it set a value. */
  note?: string;
};

export type ChapterFieldStatus = Record<string, FieldStatus>;

/**
 * Renaming a field in this file is a destructive migration. Existing
 * customer_memory.fields rows store values keyed by the old name. The
 * safe procedure:
 *
 *   1. Add the new field next to the old one.
 *   2. Ship a one-shot script that copies values: `fields[new_name] =
 *      fields[old_name]; delete fields[old_name]`.
 *   3. Remove the old field from this file.
 *
 * Better: avoid renames. Pick the right name the first time. That's
 * partly why this whole file exists for review before we touch the
 * remaining 12 chapters.
 */

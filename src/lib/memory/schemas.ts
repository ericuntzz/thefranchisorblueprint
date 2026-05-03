/**
 * Per-chapter field schemas — Phase 1.5a.
 *
 * Each chapter has a STRUCTURED data layer (typed fields) alongside the
 * existing narrative `content_md` prose. The structured layer is what:
 *
 *   - The export pipeline substitutes into DOCX/PPTX templates
 *     (`{{royalty_rate_pct}}` is clean; parsing "5–7% depending on tier"
 *     out of a paragraph is brittle).
 *   - The math library reads for FDD Item 7 totals, ramp curves,
 *     financial-model formulas (those need typed numbers).
 *   - The attorney-readiness scoring reads to compute "12 of 15 required
 *     fields filled" — a sharper metric than "78% attorney-ready."
 *   - The customer-edits-inline UI is built around (click a labeled
 *     field, type a value, save).
 *   - The chat agent's `update_memory_field` tool targets, by name, when
 *     it learns something via voice intake or chat correction.
 *
 * The narrative `content_md` still exists alongside this — it's the
 * polished prose that gets compiled into the export. The agent's
 * drafting pipeline writes BOTH: it extracts structured field values
 * AND writes prose that references those fields. When a field changes,
 * the prose can stay or be regenerated explicitly — we do NOT auto-
 * regenerate prose on every field edit (would be jarring).
 *
 * ─── THE THREE-BUCKET FRAMEWORK ────────────────────────────────────────
 *
 * Not every chapter wants to be heavily field-driven. Forcing structure
 * on inherently prose chapters makes them brittle and removes the
 * agent's ability to write fluid copy. Each chapter belongs to one of
 * three buckets:
 *
 *   1. HEAVY STRUCTURED (15–25 fields)
 *      Numbers + legal templating drive these. Field accuracy matters
 *      more than prose quality. Examples: unit_economics,
 *      franchise_economics, employee_handbook, compliance_legal.
 *
 *   2. LIGHT HYBRID (4–8 anchor fields + content_md)
 *      A handful of named anchors (founder name, founding year,
 *      concept summary) plus rich prose. The anchors are what the
 *      export references; the prose is what the customer reads.
 *      Examples: business_overview, brand_voice, operating_model,
 *      training_program.
 *
 *   3. AGENT-RESEARCH DRAFTED (2–3 anchors + research-driven prose)
 *      Mostly written by the agent from external research, with a
 *      handful of customer-confirmed anchors. Examples (Phase 3):
 *      market_strategy, competitor_landscape, territory_real_estate.
 *
 * If a chapter is creeping past 25 fields, the bucket is probably wrong.
 *
 * ─── THE OPERATOR-VOICE RULE ───────────────────────────────────────────
 *
 * Field labels, descriptions, and helpText all read to a $1M-$10M
 * business owner who is NOT a marketer. Avoid:
 *
 *   - "system", "identity", "platform", "ecosystem" (unless very specific)
 *   - "brand voice/tone/persona" without context
 *   - "drives" / "leverages" / "powers" (consultant verbs)
 *   - "chapter" — that's our internal language for the 16 Memory files,
 *     not what the customer calls them. They see them as labeled
 *     sections of their Blueprint. Use "section" or rephrase to avoid
 *     the meta-reference entirely.
 *   - Anything that sounds like a marketing-agency intake form
 *
 * Test phrase: "would Jason say this on a strategy call?" If not,
 * rewrite. Examples that pass:
 *   ✓ "What changes hands at the register."
 *   ✓ "The single most important number in the whole Blueprint."
 *   ✓ "Skip if you don't have one — better to leave blank than invent
 *     one for the FDD."
 * Examples that fail:
 *   ✗ "How your brand identity shows up in the system."
 *   ✗ "The cover story for the whole bundle."
 *   ✗ "The first chapter your attorney reads."
 *   ✗ "Defines the franchisor's revenue per franchisee."
 *
 * ─── THE LOOKUP-BURDEN PATTERN ─────────────────────────────────────────
 *
 * If a field requires the customer to GO LOOK SOMETHING UP that we
 * could resolve for them, the agent fills it by default. The customer
 * sees the resolved value with a "Verify" affordance and can override
 * if we got it wrong.
 *
 * Examples:
 *   - `naics_code` ← inferred from `industry_category` via lookup table
 *     + Sonnet 4.6 fallback. Customer never has to visit naics.com.
 *   - State franchise registration list (future) ← inferred from the
 *     states where the customer wants to operate.
 *   - Industry-typical royalty range (future) ← inferred from
 *     `industry_category` against published franchise-industry data.
 *
 * Implementation note: there's no `agentFillsAutomatically: true` flag
 * on FieldDef yet — the agent's draft pipeline knows which fields to
 * resolve via the prompt. We may add a declarative flag later if the
 * pattern proliferates, but for now it's fine to encode the behavior
 * in the agent's prompt template + a comment on the field itself.
 *
 * The customer-facing voice for these fields makes the agent's role
 * explicit: "We look this up from your industry category — you don't
 * have to find it yourself." Never make the customer feel like they
 * have homework we could have done.
 *
 * ─── STATUS ────────────────────────────────────────────────────────────
 *
 * ✅ Foundational chapters (4):
 *      business_overview      (light hybrid, 15 fields)
 *      unit_economics         (heavy structured, 22 fields)
 *      franchise_economics    (heavy structured, 21 fields)
 *      franchisee_profile     (heavy structured, ~20 fields)
 *
 * ⏳ Pending Eric+Jason review on the four above before designing the
 *    remaining 12.
 *
 * 🅿️ Deferred to Phase 1.5b (lighter footprint when designed):
 *      brand_voice — light hybrid, ~6-8 fields. The v1 was scoped too
 *      heavily (20 fields) anchored on a marketing-agency mental
 *      model. Operators don't need 20 brand fields; they need logo,
 *      2-3 colors, 1 sentence on voice — done. Coming back to this.
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
 * business_overview — Concept & Story.
 *
 * The narrative anchor for FDD Item 1 (the franchisor's identity and
 * concept) and the Operations Manual's opening chapter. The fields here
 * are the ones a franchise attorney will want documented — and the ones
 * Jason will stress-test in the readiness audit.
 *
 * Bucket: light hybrid (15 anchor fields + content_md prose). The
 * founder origin story and concept summary are mostly carried by the
 * prose; the anchors are what the export pipeline references.
 *
 * Compiles into: FDD Item 1, Operations Manual §1, Discovery Day deck
 * opener, Concept Memo (the Day-1 wow artifact).
 */
const BUSINESS_OVERVIEW: ChapterSchema = {
  slug: "business_overview",
  title: "Concept & Story",
  description:
    "What you do, who you do it for, and how you got here. The opening of your FDD — and what franchisees fall in love with.",
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
        "Cypress Lane is a small-town third-wave coffee shop that roasts on-site, serves a locally-tuned menu, and treats every café as a community room rather than a transaction counter.",
      helpText:
        "2–3 sentences. The first paragraph an attorney reads. Should be unmistakably about your business — not generic.",
      category: "The concept",
    },
    {
      name: "core_offering",
      label: "What you sell",
      type: "textarea",
      placeholder:
        "Specialty coffee (single-origin pour-over, espresso drinks), in-house pastries, light savory menu, retail beans by the bag.",
      helpText:
        "What changes hands at the register. Specific enough an attorney can classify the business.",
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
      // Agent-resolved by default — see "Lookup-burden pattern" in the
      // file's top comment block. Customer fills `industry_category` in
      // plain English; the agent infers the NAICS code from a lookup
      // table + Sonnet 4.6 fallback. Customer sees the resolved value
      // here with a "Verify" link to the official NAICS page; can
      // override if we got it wrong.
      name: "naics_code",
      label: "NAICS code",
      type: "text",
      placeholder: "722515",
      helpText:
        "We look this up from your industry category — you don't have to find it yourself. Verify it on the U.S. Census NAICS site if you want to double-check, and override here if we got it wrong.",
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
        "Sarah spent eight years as a barista and trainer at three Bay Area roasters before moving back home to Oxford in 2018.",
      helpText:
        "1–2 sentences on relevant experience. The credibility paragraph — what gives the founder the right to be running this.",
      category: "Founder",
    },
    {
      name: "founder_origin_story",
      label: "Why this business exists",
      type: "textarea",
      placeholder:
        "I grew up here and I drove 40 miles each way for good coffee for years. When I moved back, I didn't want to keep doing that — and I figured my neighbors didn't either.",
      helpText:
        "1–2 paragraphs in the founder's own voice. The single most important narrative passage in the whole Blueprint — this is what franchisees remember.",
      category: "Founder",
    },

    // ── Track record ────────────────────────────────────────────────────────
    {
      name: "founding_date",
      label: "First location opened",
      type: "date",
      placeholder: "2018-09-01",
      helpText: "Date the first revenue-generating location opened.",
      category: "Track record",
    },
    {
      name: "first_location_address",
      label: "First location address",
      type: "text",
      placeholder: "412 Main Street, Oxford, MS 38655",
      category: "Track record",
      advanced: true,
    },
    {
      name: "current_location_count",
      label: "Locations operating today",
      type: "integer",
      placeholder: "3",
      helpText: "Open and earning revenue, both your own and any already franchised.",
      category: "Track record",
    },
    {
      name: "corporate_location_count",
      label: "Of which: you own",
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
      helpText: "Most emerging franchisors are at 0 here when they start the FDD process.",
      category: "Track record",
      advanced: true,
    },
    {
      name: "business_history_milestones",
      label: "Key milestones",
      type: "list_long",
      placeholder:
        "2018: opened first location\n2020: hit $850K AUV\n2022: opened second location, brought roasting in-house\n2024: third location, started developing the franchise model",
      helpText:
        "One short line per milestone. The arc the FDD and Discovery Day deck both walk through.",
      category: "Track record",
    },

    // ── Audience ────────────────────────────────────────────────────────────
    {
      name: "target_customer_persona",
      label: "Who walks through the door",
      type: "textarea",
      placeholder:
        "Locals 25–55 with disposable income and either a remote-work setup or a kid in school. They have a coffee habit and they care about quality more than they admit.",
      helpText:
        "2–3 sentences on your typical customer. Specific enough to drive site selection and franchisee training.",
      category: "Audience",
    },
    {
      name: "distinctive_attributes",
      label: "Why this works as a franchise",
      type: "list_short",
      placeholder:
        "Codified menu (no chef-driven dependency)\nIn-house roasting + barista training program\nProven unit economics across 3 locations",
      helpText:
        "Three to five reasons this works as a franchise — not just as your business. Each should be a defensible claim, not marketing fluff.",
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
 * Bucket: heavy structured (~22 fields). Many flagged `advanced` so a
 * customer can get a usable draft from ~5-6 headline numbers (AUV,
 * COGS%, labor%, EBITDA margin, initial investment range), then fill
 * in the deeper line-items as they prepare for the attorney handoff.
 *
 * NOTE: franchisee qualification fields (required liquid capital,
 * required net worth) live on `franchisee_profile`, not here. They're
 * about WHO can buy in, not WHAT a unit costs to run.
 *
 * Compiles into: FDD Item 7, FDD Item 19, Financial Model deliverable.
 */
const UNIT_ECONOMICS: ChapterSchema = {
  slug: "unit_economics",
  title: "Unit Economics & Financial Model",
  description:
    "The money side. What a location earns, what it costs, and what it takes to open one. Every number here ends up in the FDD or the financial model your franchisees will look at.",
  compilesInto:
    "FDD Item 7, FDD Item 19, Financial Model.",
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
      label: "Operating profit margin (mature)",
      type: "percentage",
      required: true,
      placeholder: "18",
      helpText:
        "EBITDA as a % of revenue (operating profit before interest, taxes, depreciation, amortization). The number a banker or franchisee will look at first.",
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
        "What % of mature AUV a new location hits in year 1. Used to forecast year-1 revenue in the FDD and the financial model.",
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
      label: "Key assumptions behind these numbers",
      type: "textarea",
      placeholder:
        "Numbers based on the three corporate locations (years 2018–2025). Assumes a 1,400–1,800 sqft footprint, urban or close-suburb location, and a household income median ≥ $55K within 5 miles. Does not assume drive-through revenue.",
      helpText:
        "Anything an attorney or franchisee should know to read these numbers correctly. Becomes the FDD Item 19 disclaimer paragraph.",
      category: "Assumptions",
    },
  ],
};

/**
 * franchise_economics — Royalty, Ad Fund & Fees.
 *
 * The deal you're offering franchisees. These numbers define the
 * franchisor's revenue per franchisee, and they appear in FDD Items 5
 * (initial fees) and 6 (other fees), the franchise agreement itself,
 * and the marketing fund manual. Most are simple typed numbers; the
 * complexity is in the territory section where there's a real shape
 * decision (exclusive / non-exclusive / point-of-interest) that
 * triggers different downstream language.
 *
 * Bucket: heavy structured (~21 fields). Like unit_economics, many
 * fields are flagged `advanced` so the customer can get a usable draft
 * from the headline numbers (initial fee, royalty rate, ad fund pct,
 * term length, territory type) before working through the long tail.
 *
 * Compiles into: FDD Items 5+6, FDD Item 12 (territory), Marketing
 * Fund Manual, Franchise Agreement scaffolding.
 */
const FRANCHISE_ECONOMICS: ChapterSchema = {
  slug: "franchise_economics",
  title: "Royalty, Ad Fund & Fees",
  description:
    "The deal you're offering franchisees. Royalty, fees, territory, contract length. The math your franchise agreement is built on.",
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

/**
 * franchisee_profile — Who You Want as a Franchisee.
 *
 * The most important filter the franchisor controls. The right
 * franchisee profile compounds — wrong franchisees burn through cash,
 * generate complaints, and drag the brand down. This chapter is where
 * Jason's "we'd rather tell you not to franchise than sell you something
 * that won't work" trust line gets enforced: at who you let buy in.
 *
 * Bucket: heavy structured (~20 fields). The financial-qualification
 * fields drive the pre-screen funnel; the experience and lifestyle
 * fields drive Discovery Day questions; the disqualifiers list is what
 * Jason holds up when a candidate looks great on paper but smells off.
 *
 * Compiles into: FDD Item 20, the Franchisee Scoring Matrix
 * (a Jason-trademarked tool that weights candidates), Discovery Day
 * pre-qualification questions, marketing-funnel pre-screen.
 */
const FRANCHISEE_PROFILE: ChapterSchema = {
  slug: "franchisee_profile",
  title: "Who You Want as a Franchisee",
  description:
    "The kind of person who should own one of your locations. Their financial profile, what they've done before, how they'll run it, and — just as important — who they aren't.",
  compilesInto:
    "FDD Item 20, Franchisee Scoring Matrix, Discovery Day pre-qualification.",
  fields: [
    // ── Financial profile ──────────────────────────────────────────────────
    {
      name: "minimum_liquid_capital_dollars",
      label: "Required liquid capital",
      type: "currency",
      required: true,
      placeholder: "100000",
      helpText:
        "How much cash a candidate must have on hand. Industry rule of thumb: 25-40% of the high end of your initial investment range.",
      category: "Financial profile",
    },
    {
      name: "minimum_net_worth_dollars",
      label: "Required net worth",
      type: "currency",
      required: true,
      placeholder: "500000",
      helpText:
        "Total net worth (cash, investments, equity in real estate, etc.) required to qualify. Typically 3–4x liquid capital requirement.",
      category: "Financial profile",
    },
    {
      name: "minimum_credit_score",
      label: "Minimum credit score",
      type: "integer",
      placeholder: "680",
      helpText:
        "Most franchisors land at 680+. Lower scores can usually still get SBA financing but qualify for fewer banks.",
      category: "Financial profile",
      min: 300,
      max: 850,
      advanced: true,
    },
    {
      name: "accepts_sba_financed",
      label: "Open to SBA-financed candidates?",
      type: "boolean",
      helpText:
        "Most emerging franchisors say yes. Saying no narrows the candidate pool dramatically.",
      category: "Financial profile",
      advanced: true,
    },

    // ── Experience required ────────────────────────────────────────────────
    {
      name: "prior_business_ownership_required",
      label: "Must have owned a business before?",
      type: "boolean",
      helpText:
        "Selling only to experienced operators reduces failure rate but cuts the candidate pool by ~70%.",
      category: "Experience",
    },
    {
      name: "prior_industry_experience_required",
      label: "Must have industry experience?",
      type: "boolean",
      helpText:
        "Whether they need to have worked in your specific industry before. Most franchisors do NOT require this — operations training is what bridges the gap.",
      category: "Experience",
    },
    {
      name: "minimum_years_business_experience",
      label: "Minimum years running a business",
      type: "integer",
      placeholder: "3",
      helpText:
        "Optional. Skip if you don't require prior business ownership. Typical range: 3–7 years.",
      category: "Experience",
      advanced: true,
    },
    {
      name: "specific_experience_notes",
      label: "Specific experience that helps (optional)",
      type: "textarea",
      placeholder:
        "QSR, hospitality, or specialty retail backgrounds adapt fastest. Pure corporate finance backgrounds tend to struggle with the daily-ops side.",
      helpText:
        "Free-form notes for Discovery Day screeners. What kind of background actually transfers to running this concept well.",
      category: "Experience",
      advanced: true,
    },

    // ── How they'll run it ─────────────────────────────────────────────────
    {
      name: "engagement_model",
      label: "How they'll run their location",
      type: "select",
      required: true,
      helpText:
        "Drives nearly every other downstream qualification. Owner-operators show up daily; semi-absentees hire a manager; absentees hire a whole leadership team and visit monthly.",
      options: [
        { value: "owner_operator", label: "Owner-operator (full-time, on-site)" },
        { value: "semi_absentee", label: "Semi-absentee (10-25 hrs/week + GM)" },
        { value: "absentee", label: "Absentee (investor with operations team)" },
        { value: "flexible", label: "Flexible — any of the above" },
      ],
      category: "How they'll run it",
    },
    {
      name: "minimum_hours_per_week",
      label: "Minimum hours/week (owner-operator only)",
      type: "integer",
      placeholder: "40",
      helpText:
        "If you require owner-operators, how many hours per week minimum. Skip if you accept semi-absentee or absentee.",
      category: "How they'll run it",
      advanced: true,
    },
    {
      name: "relocation_required",
      label: "Must they live near the location?",
      type: "boolean",
      helpText:
        "True for most owner-operator concepts. False for semi-absentee or absentee.",
      category: "How they'll run it",
      advanced: true,
    },

    // ── Character & fit ────────────────────────────────────────────────────
    {
      name: "ideal_traits",
      label: "Traits that make a great franchisee",
      type: "list_short",
      placeholder:
        "Comfortable with structure and brand standards\nGenuinely likes serving customers daily\nHas savings to weather a slow ramp\nWants to own the business, not be owned by it",
      helpText:
        "Three to six traits. The ones a Jason-style strategy call would surface. Specific enough that a Discovery Day screener can ask about them.",
      category: "Character & fit",
    },
    {
      name: "common_disqualifiers",
      label: "What rules someone OUT",
      type: "list_short",
      placeholder:
        "Looking for a 'set it and forget it' investment\nExpects to renegotiate the franchise agreement\nHas been an absentee owner of a struggling business\nWants to modify the menu or branding",
      helpText:
        "The deal-killers. What separates a great-on-paper candidate from a fit. Critical for Discovery Day — these are the questions the franchisee answers in their own words.",
      category: "Character & fit",
    },
    {
      name: "candidate_persona_narrative",
      label: "The ideal franchisee, in your own words",
      type: "textarea",
      placeholder:
        "Mid-career operator, 35-55, who's been a GM or owner of a service business and wants something they can hand to their kids in 15 years. Not chasing a quick exit — building a portfolio.",
      helpText:
        "1-2 paragraphs describing your ideal candidate as a person, not a checklist. Used in marketing copy and the Discovery Day pre-qual.",
      category: "Character & fit",
    },

    // ── Recruitment ────────────────────────────────────────────────────────
    {
      name: "target_recruitment_channels",
      label: "Where you'll find them",
      type: "list_short",
      placeholder:
        "Franchise broker network\nIndustry trade shows\nReferrals from existing locations\nLinkedIn (mid-career operators)",
      helpText:
        "Three to five channels. Drives marketing-team focus in year 1.",
      category: "Recruitment",
      advanced: true,
    },
    {
      name: "typical_decision_timeline_days",
      label: "Days from first call to signed agreement",
      type: "integer",
      placeholder: "60",
      helpText:
        "Used for sales forecasting and capacity planning. Typical range: 45–120 days for emerging franchisors.",
      category: "Recruitment",
      advanced: true,
    },

    // ── Discovery Day & screening ──────────────────────────────────────────
    {
      name: "discovery_day_format",
      label: "Discovery Day format",
      type: "select",
      helpText:
        "How candidates meet you and the team before signing. In-person at HQ is the gold standard for emerging franchisors — it builds the trust that closes the deal.",
      options: [
        { value: "in_person_hq", label: "In-person at headquarters" },
        { value: "virtual", label: "Virtual / video" },
        { value: "hybrid", label: "Hybrid — virtual screen, in-person decision day" },
      ],
      category: "Discovery Day",
    },
    {
      name: "discovery_day_duration_hours",
      label: "Discovery Day duration (hours)",
      type: "integer",
      placeholder: "6",
      helpText: "Typical: 4–8 hours. Long enough to see how they react under fatigue.",
      category: "Discovery Day",
      advanced: true,
    },
    {
      name: "background_check_required",
      label: "Background check required?",
      type: "boolean",
      helpText:
        "Most franchisors say yes — protects the brand if a candidate has a criminal or fraud history.",
      category: "Discovery Day",
      advanced: true,
    },
    {
      name: "credit_check_required",
      label: "Credit check required?",
      type: "boolean",
      helpText: "Standard for any deal that requires SBA financing.",
      category: "Discovery Day",
      advanced: true,
    },
    {
      name: "references_required_count",
      label: "Personal/business references required",
      type: "integer",
      placeholder: "3",
      helpText:
        "How many references each candidate must provide. Typical: 3 personal + 2 business.",
      category: "Discovery Day",
      advanced: true,
    },
  ],
};

// ---------------------------------------------------------------------------
// Registry & helpers
// ---------------------------------------------------------------------------

/**
 * Per-chapter schema registry. Add entries here as schemas are designed.
 *
 * Currently registered (the four foundational chapters under
 * Eric+Jason review):
 *
 *   - business_overview     (light hybrid)
 *   - unit_economics        (heavy structured)
 *   - franchise_economics   (heavy structured)
 *   - franchisee_profile    (heavy structured)
 *
 * Deferred to Phase 1.5b (lighter footprint when designed):
 *
 *   - brand_voice — will be ~6-8 fields once we revisit. The v1 was
 *     scoped too heavily (20 fields anchored on a marketing-agency
 *     mental model). The chapter still exists in the Memory schema —
 *     it just has no field schema yet, so the editor renders prose-
 *     only and the agent drafts content_md without structured anchors.
 *
 * The remaining 11 chapters are pending Eric+Jason review of the four
 * foundational ones. We do NOT want to design them in parallel because
 * the conventions established here (field naming, category groupings,
 * advanced-flag philosophy, helpText voice) need to stick first.
 */
export const CHAPTER_SCHEMAS: Partial<Record<MemoryFileSlug, ChapterSchema>> = {
  business_overview: BUSINESS_OVERVIEW,
  unit_economics: UNIT_ECONOMICS,
  franchise_economics: FRANCHISE_ECONOMICS,
  franchisee_profile: FRANCHISEE_PROFILE,
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

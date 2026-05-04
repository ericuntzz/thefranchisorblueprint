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
 * ─── COMPUTATION, SUGGESTION, AND PRE-FILL ─────────────────────────────
 *
 * Don't ask the customer to do work the system can do. Three field
 * archetypes:
 *
 *   COMPUTED — fully derived from other fields. The customer sees a
 *   read-only value with a "calculated from X" tooltip. The value
 *   updates live as dependencies change.
 *     Example: `ebitda_margin_pct` = 100 - cogs - labor - occupancy -
 *     marketing - other_opex. The customer doesn't compute this;
 *     editing the inputs updates the output.
 *
 *   SUGGESTED — pre-filled by the system but EDITABLE. The customer
 *   sees the suggested value with a "Why this number?" affordance
 *   and can override when their reality differs. Four kinds:
 *
 *     1. industry_lookup — looked up from `industry_category` against
 *        a curated table or LLM fallback. Used for industry-typical
 *        defaults: NAICS code, royalty rate range, term length,
 *        credit score threshold.
 *
 *     2. derived — calculated from other fields with a sensible
 *        default formula but the customer can override. Used when
 *        there's a defensible math relationship but their actual
 *        number may differ (e.g. `minimum_liquid_capital` defaults to
 *        30% of `initial_investment_high` but a franchisor might want
 *        a tighter threshold).
 *
 *     3. from_assessment — pulled from the customer's pre-purchase
 *        assessment row. Saves them re-typing things they already
 *        gave us (business name, first name, website).
 *
 *     4. from_scrape — pulled from the website scrape pipeline. Same
 *        idea: don't ask them what we already learned.
 *
 *   PRIMITIVE — neither computed nor suggested; the customer types it.
 *   Default for any field not marked otherwise.
 *
 * Two principles drive this:
 *   1. NEVER MAKE THE CUSTOMER DOUBLE-ANSWER. If we have it from the
 *      assessment or scrape, pre-fill it with a `from_*` suggestion.
 *   2. NEVER MAKE THE CUSTOMER COMPUTE. EBITDA margin shouldn't be
 *      something they calculate — they enter the inputs (cogs %,
 *      labor %, etc.) and the output appears.
 *
 * Implementation note: the `computed` and `suggestedFrom` metadata
 * here is *intent only* — the actual computation logic lives in
 * `src/lib/calc/` (the math library, Phase 1.5a step 5) and the
 * agent's draft pipeline (which reads the schema and resolves
 * `industry_lookup` / `from_assessment` / `from_scrape` suggestions
 * against the customer's available data). The customer-facing voice
 * for any suggested field makes the system's role explicit: "We
 * suggested this from X — adjust if your reality differs."
 *
 * ─── DEFER TO TFB'S EXISTING DOCUMENTS ────────────────────────────────
 *
 * The schemas in this file should reflect what TFB *already says* a
 * franchisor needs to define — not what I (Claude) think they need.
 * Jason's 30 years of franchise experience is captured in the existing
 * deliverables: the original 9 capability documents, the High Point
 * Coffee bundle, any other reference documents Jason and his team
 * have used on past engagements.
 *
 * Two rules:
 *
 *   1. AUDIT BEFORE DESIGNING. When designing a chapter's schema, the
 *      first input is whatever existing TFB document maps to that
 *      chapter (e.g. for `unit_economics` → the financial model
 *      template; for `franchisee_profile` → the franchisee scoring
 *      matrix; for `business_overview` → the concept-and-positioning
 *      worksheet). Every prompt or section header in the source
 *      document should turn into a field. The schema is a *typed
 *      version* of the existing document, not a redesign.
 *
 *   2. DEFAULT TO INCLUDING, NOT CUTTING. If I see a field that
 *      doesn't obviously map to an FDD item or a customer-facing
 *      deliverable, that's not grounds to cut it — that's grounds to
 *      ASK whether the existing TFB framework already covers it. Many
 *      questions Jason asks have non-obvious downstream value (e.g.
 *      recruitment channel preferences feed into the marketing fund
 *      manual; decision-timeline data feeds into capacity planning
 *      that Jason coaches franchisors on). I don't have full
 *      visibility — I should bias toward inclusion and surface
 *      questions for review, not unilaterally cut.
 *
 * The earlier draft of this file had a stricter "purpose-test" that
 * said cut anything that doesn't move toward franchise ownership. That
 * was the wrong frame — I was making product calls Jason should make.
 * The current frame: every field is here because TFB's existing
 * framework asks the customer to define it (or Jason confirms it
 * should be here).
 *
 * NEXT AUDIT NEEDED: cross-check the four foundational schemas against
 * the High Point Coffee bundle and the original capability documents.
 * Anything in those that's NOT in the schemas should be added.
 * Anything in the schemas NOT in those documents should be flagged for
 * Jason's review before staying.
 *
 * ─── STATUS ────────────────────────────────────────────────────────────
 *
 * ✅ Schemas registered (15 of 16):
 *      Foundational (Eric+Jason aligned):
 *        business_overview      (light hybrid, 15 fields)
 *        unit_economics         (heavy structured, 22 fields)
 *        franchise_economics    (heavy structured, 21 fields)
 *        franchisee_profile     (heavy structured, ~20 fields)
 *      Remaining 11 (audit-pending — see each schema's comment header):
 *        vendor_supply_chain    (heavy structured, 13 fields)
 *        marketing_fund         (heavy structured, 15 fields)
 *        employee_handbook      (heavy structured, 17 fields)
 *        reimbursement_policy   (heavy structured, 10 fields)
 *        compliance_legal       (heavy structured, 12 fields)
 *        operating_model        (light hybrid, 7 fields)
 *        recipes_and_menu       (light hybrid, 7 fields)
 *        training_program       (light hybrid, 10 fields)
 *        territory_real_estate  (agent-research, 9 fields)
 *        market_strategy        (agent-research, 5 fields)
 *        competitor_landscape   (agent-research, 5 fields)
 *
 * 🅿️ Deferred to Phase 1.5b (lighter footprint when designed):
 *      brand_voice — light hybrid, ~6-8 fields. The v1 was scoped too
 *      heavily (20 fields) anchored on a marketing-agency mental
 *      model. Operators don't need 20 brand fields; they need logo,
 *      2-3 colors, 1 sentence on voice — done. Coming back to this.
 *
 * ⏳ Audit-pending: the 11 new schemas have NOT been cross-checked
 *    against the High Point Coffee bundle or original capability
 *    documents Jason wrote. Audit pass should add anything in those
 *    documents that's not in the schemas, and flag any schema fields
 *    that DON'T appear in those documents for Jason's review.
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
  | "color_list"
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
  /** For `date` type — when true, allow dates in the future. Default
   *  is false (date inputs cap at today). Useful for fields like
   *  "founding date" or "first location opened" where future is
   *  meaningless; opt out for fields like "planned launch date". */
  allowFutureDate?: boolean;
  /**
   * If true, hidden by default in the UI; revealed by an "Show advanced"
   * toggle. Use for fields that 90% of customers won't touch but that
   * matter when they do. Don't overuse — buried fields don't get filled.
   */
  advanced?: boolean;
  /**
   * If set, the field is fully derived from other fields and is
   * READ-ONLY in the UI. The customer sees the computed value with a
   * "calculated from X" tooltip. The actual computation function lives
   * in `src/lib/calc/` keyed by the field name.
   *
   * `deps` may reference fields in the same chapter by bare name
   * (e.g. `"cogs_pct"`) or in another chapter via `chapter.field`
   * syntax (e.g. `"unit_economics.initial_investment_high_dollars"`).
   *
   * `formula` is a human-readable description for the tooltip — it's
   * NOT executed; just shown.
   */
  computed?: {
    deps: string[];
    formula: string;
  };
  /**
   * If set, the system pre-fills this field but the customer can
   * override. They see the suggested value with a "Why this number?"
   * affordance. See the COMPUTATION, SUGGESTION, AND PRE-FILL section
   * at the top of this file for the four kinds.
   */
  suggestedFrom?:
    | {
        kind: "industry_lookup";
        /** What the lookup table is keyed on. Default: `industry_category`. */
        keyedOn?: string;
        /** Free-form description of where the data comes from, for the tooltip. */
        source: string;
      }
    | {
        kind: "derived";
        deps: string[];
        formula: string;
      }
    | {
        kind: "from_assessment";
        /** Field name on the assessment_sessions row. */
        field: string;
      }
    | {
        kind: "from_scrape";
        /** Field name in the structured scrape output. */
        field: string;
      };
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
      suggestedFrom: {
        kind: "from_scrape",
        field: "industry_category",
      },
    },
    {
      name: "naics_code",
      label: "NAICS code",
      type: "text",
      placeholder: "722515",
      helpText:
        "We look this up from your industry category — you don't have to find it yourself. Verify on the U.S. Census NAICS site if you want to double-check, and override here if we got it wrong.",
      category: "The concept",
      advanced: true,
      suggestedFrom: {
        kind: "industry_lookup",
        keyedOn: "industry_category",
        source: "U.S. Census NAICS table + Sonnet 4.6 fallback",
      },
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
      suggestedFrom: {
        kind: "from_assessment",
        field: "first_name",
      },
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
      suggestedFrom: {
        kind: "from_scrape",
        field: "founding_date",
      },
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
        "What a typical new location generates in its first 12 months. We suggest a starting number from your mature AUV × your year-1 ramp percentage; override if your real data says different.",
      category: "Headline performance",
      suggestedFrom: {
        kind: "derived",
        deps: ["average_unit_volume_dollars", "ramp_curve_year_1_pct"],
        formula: "average_unit_volume_dollars × (ramp_curve_year_1_pct / 100)",
      },
    },
    {
      name: "auv_year_2_dollars",
      label: "Year 2 revenue (typical)",
      type: "currency",
      placeholder: "1000000",
      category: "Headline performance",
      suggestedFrom: {
        kind: "derived",
        deps: ["average_unit_volume_dollars", "ramp_curve_year_2_pct"],
        formula: "average_unit_volume_dollars × (ramp_curve_year_2_pct / 100)",
      },
    },
    {
      name: "ebitda_margin_pct",
      label: "Operating profit margin (mature)",
      type: "percentage",
      required: true,
      placeholder: "18",
      helpText:
        "EBITDA as a % of revenue (operating profit before interest, taxes, depreciation, amortization). Calculated for you from the cost-structure inputs below — you don't need to compute this. The number a banker or franchisee will look at first.",
      category: "Headline performance",
      min: 0,
      max: 100,
      computed: {
        deps: [
          "cogs_pct",
          "labor_pct",
          "occupancy_pct",
          "marketing_pct",
          "other_opex_pct",
        ],
        formula:
          "100 − COGS% − Labor% − Occupancy% − Marketing% − Other opex%",
      },
    },
    {
      name: "payback_period_months",
      label: "Payback period (months)",
      type: "integer",
      placeholder: "30",
      helpText:
        "How long until a franchisee recovers their initial investment from operating cash flow. Calculated from the average initial investment and mature-unit profit dollars — you don't need to compute this.",
      category: "Headline performance",
      computed: {
        deps: [
          "initial_investment_low_dollars",
          "initial_investment_high_dollars",
          "average_unit_volume_dollars",
          "ebitda_margin_pct",
        ],
        formula:
          "((investment_low + investment_high) / 2) ÷ (AUV × EBITDA% ÷ 100) × 12",
      },
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
        "What % of mature AUV a new location hits in year 1. We suggest an industry-typical default for your concept; override if your existing locations have shown a different curve.",
      category: "Ramp curve",
      min: 0,
      max: 100,
      suggestedFrom: {
        kind: "industry_lookup",
        keyedOn: "industry_category",
        source: "FRANdata + IFA published ramp curves by concept type",
      },
    },
    {
      name: "ramp_curve_year_2_pct",
      label: "Year 2 ramp",
      type: "percentage",
      placeholder: "85",
      category: "Ramp curve",
      min: 0,
      max: 100,
      suggestedFrom: {
        kind: "industry_lookup",
        keyedOn: "industry_category",
        source: "FRANdata + IFA published ramp curves by concept type",
      },
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
        "One-time fee paid at signing. We'll suggest a number from your industry — adjust to match your strategy. Most emerging franchisors land between $25K and $50K.",
      category: "Initial fee",
      suggestedFrom: {
        kind: "industry_lookup",
        keyedOn: "industry_category",
        source: "FRANdata published franchise-fee benchmarks by concept type",
      },
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
        "% of gross sales the franchisee pays the franchisor. We'll suggest a number from your industry; adjust to match what your unit economics support. Industry typical: 4–8%.",
      category: "Royalty",
      min: 0,
      max: 25,
      suggestedFrom: {
        kind: "industry_lookup",
        keyedOn: "industry_category",
        source: "FRANdata + IFA published royalty benchmarks by concept type",
      },
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
        "% of gross sales franchisees contribute to the brand-wide ad fund. We'll suggest a number from your industry. Industry typical: 1–3%.",
      category: "Ad fund",
      min: 0,
      max: 10,
      suggestedFrom: {
        kind: "industry_lookup",
        keyedOn: "industry_category",
        source: "FRANdata + IFA published ad-fund benchmarks by concept type",
      },
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
      helpText: "Length of the initial franchise agreement. We default to 10 years — the franchise-industry standard. Adjust if your industry runs shorter (some service trades are 5-7).",
      category: "Term",
      min: 1,
      max: 30,
      suggestedFrom: {
        kind: "industry_lookup",
        keyedOn: "industry_category",
        source: "Standard term lengths by concept type (FRANdata)",
      },
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
        "How much cash a candidate must have on hand. We suggest 30% of the high end of your initial investment range — adjust if you want a tighter or looser threshold.",
      category: "Financial profile",
      suggestedFrom: {
        kind: "derived",
        deps: ["unit_economics.initial_investment_high_dollars"],
        formula: "0.30 × unit_economics.initial_investment_high_dollars",
      },
    },
    {
      name: "minimum_net_worth_dollars",
      label: "Required net worth",
      type: "currency",
      required: true,
      placeholder: "500000",
      helpText:
        "Total net worth (cash, investments, equity in real estate, etc.) required to qualify. We suggest 3.5× the liquid capital requirement — the franchise-industry default.",
      category: "Financial profile",
      suggestedFrom: {
        kind: "derived",
        deps: ["minimum_liquid_capital_dollars"],
        formula: "3.5 × minimum_liquid_capital_dollars",
      },
    },
    {
      name: "minimum_credit_score",
      label: "Minimum credit score",
      type: "integer",
      placeholder: "680",
      helpText:
        "We default to 680 — the franchise-industry standard for SBA-financed deals. Lower scores can usually still qualify with the right bank but narrow the candidate pool.",
      category: "Financial profile",
      min: 300,
      max: 850,
      advanced: true,
      suggestedFrom: {
        kind: "industry_lookup",
        keyedOn: "industry_category",
        source: "Standard credit-score thresholds for SBA-financed franchise deals",
      },
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

// ============================================================================
// REMAINING 11 CHAPTER SCHEMAS — Phase 1.5a step 3
//
// Designed in one pass after Eric+Jason aligned on the foundational four.
// Audit-pending: each schema notes whether it's been cross-checked against
// the High Point Coffee bundle / original capability documents. Most are
// designed from FDD requirements + general franchise practice — Jason
// should review for fields specific to TFB's framework that I've missed.
// ============================================================================

// ----------------------------------------------------------------------------
// HEAVY STRUCTURED — typed values + lists drive these chapters
// ----------------------------------------------------------------------------

/**
 * vendor_supply_chain — Approved Suppliers & Procurement.
 *
 * Bucket: heavy structured (~13 fields).
 * Audit status: not yet cross-checked against High Point bundle.
 *
 * Defines the supply chain franchisees inherit. Centralized purchasing
 * is one of the highest-leverage things a franchisor controls — it's
 * how unit-economics consistency holds up across 50+ locations. The
 * vendor list itself is intentionally `list_long` for v1 (each vendor
 * is a paragraph with name + contact + products + terms); we can
 * upgrade to a structured sub-schema if the editing UX needs it.
 *
 * Compiles into: Operations Manual §14 (Approved Suppliers), Build-Out
 * Manual procurement appendix, FDD Item 8 (restrictions on sources of
 * products and services).
 */
const VENDOR_SUPPLY_CHAIN: ChapterSchema = {
  slug: "vendor_supply_chain",
  title: "Approved Suppliers",
  description:
    "Who franchisees buy from. The vendor list is one of the franchisor's strongest levers — both for quality control and for negotiating better prices as you scale.",
  compilesInto:
    "Operations Manual §14, Build-Out Manual procurement appendix, FDD Item 8.",
  fields: [
    {
      name: "approved_vendors",
      label: "Approved vendors",
      type: "list_long",
      required: true,
      placeholder:
        "Royal Cup Coffee (green beans) — Birmingham, AL — net-30 terms, $3,200 minimum order, 5-day delivery\nKenco Restaurant Supply (paper goods) — net-30, free delivery over $250\nLavazza (espresso machines) — leasing only, $385/month with maintenance",
      helpText:
        "One per line: vendor name, what they supply, and the contract terms. The list every franchisee gets when they sign on.",
      category: "Vendors",
    },
    {
      name: "alternate_vendors",
      label: "Approved alternates (backup)",
      type: "list_long",
      placeholder:
        "S&D Coffee (green beans) — only for Royal Cup outages\nWebstaurantStore (paper goods) — for orders below the Kenco minimum",
      helpText:
        "Backup vendors franchisees can use when the primary is unavailable. Optional but recommended — every franchisor has at least one Royal-Cup-can't-deliver moment.",
      category: "Vendors",
      advanced: true,
    },
    {
      name: "exclusive_purchase_required_items",
      label: "Items franchisees must buy from approved vendors",
      type: "list_short",
      placeholder:
        "Coffee beans\nMilk and dairy\nBranded packaging and cups",
      helpText:
        "Items franchisees CAN'T source elsewhere. These are the brand-defining inputs. FDD Item 8 will list these explicitly.",
      category: "Procurement rules",
    },
    {
      name: "items_franchisee_can_source_locally",
      label: "Items franchisees can source themselves",
      type: "list_short",
      placeholder:
        "Cleaning supplies (must meet spec)\nFresh pastries (if from a local bakery you've vetted)\nNon-coffee retail beans",
      helpText:
        "Items where local sourcing is OK — usually because shipping cost > value. Spec must still be met.",
      category: "Procurement rules",
      advanced: true,
    },
    {
      name: "rebate_arrangements",
      label: "Rebate arrangements with vendors",
      type: "textarea",
      placeholder:
        "Royal Cup pays 1.5% rebate on franchisee purchases, paid quarterly to the franchisor. Disclosed in FDD Item 8.",
      helpText:
        "Most emerging franchisors don't have these yet. If you do, they MUST be disclosed in FDD Item 8 — failing to disclose is a serious compliance issue.",
      category: "Procurement rules",
      advanced: true,
    },
    {
      name: "minimum_order_frequency",
      label: "Minimum order frequency",
      type: "select",
      options: [
        { value: "weekly", label: "Weekly" },
        { value: "biweekly", label: "Biweekly" },
        { value: "monthly", label: "Monthly" },
        { value: "as_needed", label: "As needed (no minimum cadence)" },
      ],
      helpText:
        "How often franchisees must order. Drives inventory expectations and vendor pricing tiers.",
      category: "Procurement rules",
      advanced: true,
    },
    {
      name: "inventory_management_system",
      label: "Required inventory management system",
      type: "text",
      placeholder: "MarketMan",
      helpText:
        "If you require franchisees to use a specific tool. Skip if you don't mandate one.",
      category: "Procurement rules",
      advanced: true,
    },
    {
      name: "vendor_change_approval_process",
      label: "How vendor changes get approved",
      type: "textarea",
      placeholder:
        "Franchisees can propose alternate vendors via the franchisee portal. Franchisor reviews within 14 days; approval requires vendor meeting documented quality and food-safety standards.",
      helpText:
        "What a franchisee does when they want to use a vendor not on the approved list. Often more important than the list itself.",
      category: "Procurement rules",
      advanced: true,
    },
    {
      name: "quality_inspection_cadence",
      label: "Vendor quality inspections",
      type: "text",
      placeholder: "Annual on-site, plus quarterly product samples",
      helpText:
        "How often the franchisor (or third party) inspects approved vendors. Optional but signals operational maturity.",
      category: "Quality control",
      advanced: true,
    },
    {
      name: "spec_documents",
      label: "Product specs maintained",
      type: "boolean",
      helpText:
        "Do you have written specs for each approved product (e.g. \"single-origin Arabica, 18% screen size, certified organic\")? Required for any item with substitution flexibility.",
      category: "Quality control",
      advanced: true,
    },
    {
      name: "preferred_payment_terms",
      label: "Standard payment terms with vendors",
      type: "select",
      options: [
        { value: "net_15", label: "Net 15" },
        { value: "net_30", label: "Net 30" },
        { value: "net_60", label: "Net 60" },
        { value: "cod", label: "Cash on delivery" },
        { value: "varies", label: "Varies by vendor" },
      ],
      category: "Financial terms",
      advanced: true,
    },
    {
      name: "centralized_purchasing_required",
      label: "Centralized purchasing through franchisor?",
      type: "boolean",
      helpText:
        "Some franchisors have all orders flow through them (they buy + resell). Most have franchisees buy direct from approved vendors. Different FDD Item 8 disclosure.",
      category: "Financial terms",
      advanced: true,
    },
    {
      name: "supply_chain_assumptions_narrative",
      label: "Anything else about the supply chain",
      type: "textarea",
      placeholder:
        "Currently sourcing 80% of green beans from a single supplier. Diversifying to two roaster partners over 2025–2026 to reduce concentration risk.",
      helpText:
        "Free-form notes. Risks, planned changes, anything an attorney or franchisee should know.",
      category: "Notes",
      advanced: true,
    },
  ],
};

/**
 * marketing_fund — Marketing Fund Governance.
 *
 * Bucket: heavy structured (~15 fields).
 * Audit status: not yet cross-checked against the High Point Marketing
 * Fund Manual.
 *
 * The legal-structural details of how the brand-wide ad fund is
 * collected, governed, and spent. Different from the `ad_fund_pct`
 * field on franchise_economics — that's the rate; this is the
 * GOVERNANCE. FDD Item 11 disclosure depends heavily on what's
 * captured here.
 *
 * Compiles into: Marketing Fund Manual, FDD Item 11 (Franchisor's
 * Assistance, Advertising, Computer Systems, and Training).
 */
const MARKETING_FUND: ChapterSchema = {
  slug: "marketing_fund",
  title: "Marketing Fund Governance",
  description:
    "How the brand-wide marketing fund is collected, governed, and spent. The rules franchisees agree to when they sign on.",
  compilesInto: "Marketing Fund Manual, FDD Item 11.",
  fields: [
    // ── Structure ─────────────────────────────────────────────────────────
    {
      name: "fund_governance_model",
      label: "Who controls the fund",
      type: "select",
      required: true,
      helpText:
        "Three common shapes. Franchisor-controlled is simplest for emerging franchisors; advisory boards add legitimacy as you scale; cooperative funds are required in some states.",
      options: [
        {
          value: "franchisor_controlled",
          label: "Franchisor controls all decisions",
        },
        {
          value: "advisory_board",
          label: "Franchisee advisory board provides input; franchisor decides",
        },
        {
          value: "cooperative",
          label: "Franchisee cooperative votes on spending",
        },
      ],
      category: "Structure",
    },
    {
      name: "advisory_board_size",
      label: "Advisory board size",
      type: "integer",
      placeholder: "5",
      helpText:
        "Number of franchisees on the board. Optional unless you picked an advisory or cooperative model.",
      category: "Structure",
      advanced: true,
    },
    {
      name: "board_election_method",
      label: "How board members are selected",
      type: "textarea",
      placeholder:
        "Three seats elected by franchisees annually; two seats appointed by the franchisor.",
      helpText: "Optional. Skip if franchisor-controlled.",
      category: "Structure",
      advanced: true,
    },
    {
      name: "board_term_length_years",
      label: "Board term length (years)",
      type: "integer",
      placeholder: "2",
      category: "Structure",
      advanced: true,
    },

    // ── Spending rules ────────────────────────────────────────────────────
    {
      name: "approved_uses",
      label: "What the fund CAN be spent on",
      type: "list_short",
      required: true,
      placeholder:
        "National brand campaigns\nDigital media buys (paid social, search)\nCreative production for franchisee use\nMarket research\nPR and trade press",
      helpText:
        "Typically broad. The fund's purpose statement in your FDD will reference these.",
      category: "Spending rules",
    },
    {
      name: "excluded_uses",
      label: "What the fund CAN'T be spent on",
      type: "list_short",
      placeholder:
        "Franchisor's own salary or overhead\nLocal-market advertising for a single unit\nNew-franchisee recruitment marketing\nLitigation costs",
      helpText:
        "Typically: anything that benefits the franchisor more than the franchisees, or that's a single-unit local effort. Most attorneys will require explicit exclusions.",
      category: "Spending rules",
    },
    {
      name: "minimum_brand_spend_pct",
      label: "Minimum % spent on brand-building (vs admin)",
      type: "percentage",
      placeholder: "85",
      helpText:
        "What share of the fund must go to actual marketing vs administrative overhead. Industry standard: 80–90%.",
      category: "Spending rules",
      min: 0,
      max: 100,
      advanced: true,
    },

    // ── Reporting ─────────────────────────────────────────────────────────
    {
      name: "reporting_cadence",
      label: "Reporting cadence to franchisees",
      type: "select",
      options: [
        { value: "monthly", label: "Monthly" },
        { value: "quarterly", label: "Quarterly" },
        { value: "annually", label: "Annually only" },
      ],
      helpText:
        "How often franchisees see what the fund spent. Quarterly is the franchise-industry standard.",
      category: "Reporting & audit",
    },
    {
      name: "audit_required",
      label: "Independent audit required?",
      type: "boolean",
      helpText:
        "Most state franchise registrations require an annual independent audit of the fund. Says yes for almost every emerging franchisor.",
      category: "Reporting & audit",
    },
    {
      name: "audit_frequency",
      label: "Audit frequency",
      type: "select",
      options: [
        { value: "annual", label: "Annual" },
        { value: "biennial", label: "Biennial" },
      ],
      category: "Reporting & audit",
      advanced: true,
    },
    {
      name: "carryover_policy",
      label: "How unspent funds carry over year-to-year",
      type: "textarea",
      placeholder:
        "Unspent funds carry over to the following year and must be spent on approved uses within 24 months. After 24 months, unspent funds may be allocated to a brand-development reserve.",
      helpText:
        "Default: carry forward indefinitely. Some franchisors set a use-it-or-lose-it deadline. Disclosed in FDD Item 11.",
      category: "Reporting & audit",
      advanced: true,
    },

    // ── Local marketing ───────────────────────────────────────────────────
    {
      name: "local_marketing_spend_required",
      label: "Local marketing also required?",
      type: "boolean",
      helpText:
        "On TOP of the brand fund, do franchisees have a local-marketing minimum? See `franchise_economics.local_marketing_minimum_pct` for the percentage.",
      category: "Local marketing",
      advanced: true,
    },
    {
      name: "local_marketing_pre_approval_required",
      label: "Pre-approval required for franchisee-created local ads?",
      type: "boolean",
      helpText:
        "Most franchisors require franchisor approval of any creative that uses the brand. Protects against off-brand or non-compliant local ads.",
      category: "Local marketing",
      advanced: true,
    },

    // ── Initial campaign ──────────────────────────────────────────────────
    {
      name: "grand_opening_marketing_required",
      label: "Grand-opening marketing requirement",
      type: "textarea",
      placeholder:
        "Franchisees must spend a minimum of $5,000 on grand-opening marketing in the 30 days before and after opening, using franchisor-approved creative.",
      helpText:
        "Most franchisors mandate a minimum opening spend. The number lives in FDD Item 6 as a 'required expenditure.'",
      category: "Initial campaign",
      advanced: true,
    },
  ],
};

/**
 * employee_handbook — Employee Handbook for Franchisee Locations.
 *
 * Bucket: heavy structured (~17 fields).
 * Audit status: not yet cross-checked against the High Point Employee
 * Handbook deliverable.
 *
 * The HR template each franchisee inherits and adapts. Some fields
 * are franchisor-mandated (uniform requirements, customer service
 * standards) and some are franchisee-discretion (specific PTO
 * structure, benefits offered) — but the franchisor sets the floor.
 * State-specific employment law requirements (e.g. CA paid sick
 * leave) get layered on top by the franchisee's attorney.
 *
 * Compiles into: Employee Handbook deliverable, Operations Manual §
 * (people management), portions of FDD Item 11 (training).
 */
const EMPLOYEE_HANDBOOK: ChapterSchema = {
  slug: "employee_handbook",
  title: "Employee Handbook",
  description:
    "The HR template each location uses. What the franchisor mandates, what the franchisee can adapt, and what state law layers on top.",
  compilesInto: "Employee Handbook deliverable, Operations Manual people-management section.",
  fields: [
    // ── Hours & scheduling ───────────────────────────────────────────────
    {
      name: "standard_full_time_hours_per_week",
      label: "Standard full-time hours/week",
      type: "integer",
      placeholder: "32",
      helpText:
        "What counts as full-time at your locations. Drives benefits eligibility. Most franchisors set 30–35.",
      category: "Hours & scheduling",
    },
    {
      name: "minimum_shifts_per_week",
      label: "Minimum shifts/week to remain on payroll",
      type: "integer",
      placeholder: "2",
      helpText: "Below this, employees are reclassified or terminated. Optional.",
      category: "Hours & scheduling",
      advanced: true,
    },
    {
      name: "scheduling_software",
      label: "Required scheduling software",
      type: "text",
      placeholder: "When I Work",
      helpText: "If you mandate one. Skip if franchisees pick their own.",
      category: "Hours & scheduling",
      advanced: true,
    },

    // ── Compensation ─────────────────────────────────────────────────────
    {
      name: "minimum_starting_wage_dollars_per_hour",
      label: "Minimum starting wage ($/hour)",
      type: "currency",
      placeholder: "16",
      helpText:
        "Brand-wide floor. Franchisees can pay more but not less. Drives the labor % in unit economics.",
      category: "Compensation",
    },
    {
      name: "tip_pooling_policy",
      label: "Tip pooling policy",
      type: "select",
      options: [
        { value: "no_tip_pooling", label: "No tip pooling — individuals keep their own" },
        { value: "shift_pool", label: "Pooled by shift" },
        { value: "weekly_pool", label: "Pooled weekly across all employees" },
        { value: "no_tipping", label: "No tipping accepted" },
      ],
      helpText:
        "Has wage-and-hour-law implications — franchisees should also confirm against state law before applying.",
      category: "Compensation",
      advanced: true,
    },
    {
      name: "performance_review_cadence",
      label: "Performance review cadence",
      type: "select",
      options: [
        { value: "monthly", label: "Monthly" },
        { value: "quarterly", label: "Quarterly" },
        { value: "biannual", label: "Twice a year" },
        { value: "annual", label: "Annually" },
      ],
      category: "Compensation",
      advanced: true,
    },

    // ── Benefits ─────────────────────────────────────────────────────────
    {
      name: "pto_days_per_year",
      label: "PTO days per year (after 1st year)",
      type: "integer",
      placeholder: "10",
      helpText:
        "Floor that franchisees inherit. Some states (CA, MA, NY) require more for sick leave specifically.",
      category: "Benefits",
    },
    {
      name: "paid_sick_days_per_year",
      label: "Paid sick days per year",
      type: "integer",
      placeholder: "5",
      helpText:
        "Separate from PTO in most state laws. Required minimum in many states.",
      category: "Benefits",
      advanced: true,
    },
    {
      name: "paid_holidays",
      label: "Paid holidays observed",
      type: "list_short",
      placeholder:
        "New Year's Day\nMemorial Day\nIndependence Day\nLabor Day\nThanksgiving\nChristmas",
      category: "Benefits",
      advanced: true,
    },
    {
      name: "health_benefits_offered",
      label: "Health benefits offered to employees?",
      type: "boolean",
      helpText:
        "Whether each location is REQUIRED to offer health benefits to qualifying employees. Most franchisors leave this to the franchisee.",
      category: "Benefits",
      advanced: true,
    },
    {
      name: "retirement_benefits_offered",
      label: "Retirement plan offered?",
      type: "boolean",
      helpText:
        "Whether locations must offer a 401(k) or similar. SECURE Act state mandates may apply.",
      category: "Benefits",
      advanced: true,
    },

    // ── Conduct & culture ────────────────────────────────────────────────
    {
      name: "uniform_requirements",
      label: "Uniform requirements",
      type: "textarea",
      placeholder:
        "Branded apron + plain black or denim pants. Closed-toe non-slip shoes. Branded cap optional.",
      helpText:
        "Brand-mandated. Specific enough that franchisees know what to enforce.",
      category: "Conduct & culture",
    },
    {
      name: "customer_service_standards",
      label: "Customer service standards",
      type: "list_short",
      placeholder:
        "10-second greeting at the door\nFirst name when handing off the order\n4-minute maximum wait time at peak\nNo phone use behind the counter",
      helpText:
        "The brand-defining service moments. The Operations Manual will go deeper; this is the headline list.",
      category: "Conduct & culture",
    },
    {
      name: "social_media_policy",
      label: "Social media policy",
      type: "textarea",
      placeholder:
        "Employees may share branded content with #cypresslane. Personal accounts must clearly state 'opinions are my own.' No customer photos without consent. No discussion of internal operations.",
      category: "Conduct & culture",
      advanced: true,
    },
    {
      name: "non_compete_required",
      label: "Non-compete required at hire?",
      type: "boolean",
      helpText:
        "Most franchisors require this for managers but not hourly. Has serious enforceability variation by state — your attorney should review.",
      category: "Conduct & culture",
      advanced: true,
    },

    // ── Termination ──────────────────────────────────────────────────────
    {
      name: "at_will_employment_required",
      label: "At-will employment required?",
      type: "boolean",
      helpText:
        "Standard for most U.S. franchises (except Montana). Required language in your handbook template.",
      category: "Termination",
      advanced: true,
    },
    {
      name: "termination_appeal_process",
      label: "Termination appeal process",
      type: "textarea",
      placeholder:
        "Terminated employees may request a single review meeting with the franchisee owner within 7 days. Franchisor not involved in individual termination decisions.",
      helpText:
        "Optional. Most franchisors don't mandate one — leave to franchisee discretion.",
      category: "Termination",
      advanced: true,
    },
  ],
};

/**
 * reimbursement_policy — Expense Reimbursement Policy.
 *
 * Bucket: heavy structured (~10 fields).
 * Audit status: not yet cross-checked against the High Point
 * Reimbursement Policy deliverable.
 *
 * Defines what owner-operators (and any salaried managers) can expense
 * and at what rates. Mostly typed-number fields. Drives the financial
 * controls section of the Operations Manual and is referenced in the
 * franchisee's tax filings.
 *
 * Compiles into: Reimbursement Policy deliverable, Operations Manual
 * financial-controls section.
 */
const REIMBURSEMENT_POLICY: ChapterSchema = {
  slug: "reimbursement_policy",
  title: "Expense Reimbursement Policy",
  description:
    "What franchisees and their managers can expense, at what rates, and what's outside the policy entirely.",
  compilesInto: "Reimbursement Policy deliverable, Operations Manual financial-controls section.",
  fields: [
    // ── Travel ────────────────────────────────────────────────────────────
    {
      name: "mileage_rate_dollars_per_mile",
      label: "Mileage rate ($/mile)",
      type: "number",
      placeholder: "0.67",
      helpText:
        "We default to the current IRS standard rate. Most franchisors match it.",
      category: "Travel",
      suggestedFrom: {
        kind: "industry_lookup",
        keyedOn: "industry_category",
        source: "Current IRS standard mileage rate (refreshed annually)",
      },
    },
    {
      name: "meal_per_diem_dollars",
      label: "Meal per diem ($/day)",
      type: "currency",
      placeholder: "75",
      helpText: "Per-day cap on meal expenses while traveling. IRS standard: ~$75 for most U.S. cities.",
      category: "Travel",
    },
    {
      name: "lodging_per_diem_dollars",
      label: "Lodging per diem ($/night)",
      type: "currency",
      placeholder: "200",
      helpText:
        "Per-night cap on hotel expenses. Higher in major-metro travel.",
      category: "Travel",
    },
    {
      name: "airfare_class",
      label: "Airfare class allowed",
      type: "select",
      options: [
        { value: "economy_only", label: "Economy only" },
        { value: "economy_plus_for_long_flights", label: "Economy plus (for flights > 4 hours)" },
        { value: "business_at_owner_discretion", label: "Business class at owner's discretion" },
      ],
      category: "Travel",
      advanced: true,
    },

    // ── Approval thresholds ──────────────────────────────────────────────
    {
      name: "single_expense_approval_threshold_dollars",
      label: "Single-expense approval threshold ($)",
      type: "currency",
      placeholder: "500",
      helpText:
        "Above this dollar amount, a single expense needs pre-approval (from the owner or franchisor, depending on policy).",
      category: "Approval thresholds",
    },
    {
      name: "monthly_expense_cap_dollars",
      label: "Monthly expense cap per role ($)",
      type: "currency",
      placeholder: "2000",
      helpText: "Total monthly expense cap for managers / shift leads. Skip if no cap.",
      category: "Approval thresholds",
      advanced: true,
    },

    // ── What is NOT reimbursable ─────────────────────────────────────────
    {
      name: "non_reimbursable_categories",
      label: "Categories that are never reimbursable",
      type: "list_short",
      placeholder:
        "Personal entertainment\nAlcohol (except client meals)\nPersonal travel companion expenses\nGifts > $25 to a single recipient",
      category: "Exclusions",
    },

    // ── Process ───────────────────────────────────────────────────────────
    {
      name: "expense_reporting_software",
      label: "Required expense reporting tool",
      type: "text",
      placeholder: "Expensify",
      helpText: "If you mandate a tool. Skip if franchisees pick their own.",
      category: "Process",
      advanced: true,
    },
    {
      name: "receipt_required_threshold_dollars",
      label: "Receipt required above ($)",
      type: "currency",
      placeholder: "25",
      helpText: "IRS standard: $75. Some franchisors set a tighter floor.",
      category: "Process",
      advanced: true,
    },
    {
      name: "reimbursement_payment_schedule",
      label: "How often expenses are reimbursed",
      type: "select",
      options: [
        { value: "with_payroll", label: "With each payroll cycle" },
        { value: "monthly", label: "Monthly" },
        { value: "biweekly", label: "Biweekly" },
        { value: "ad_hoc", label: "Ad hoc (within 30 days)" },
      ],
      category: "Process",
      advanced: true,
    },
  ],
};

/**
 * compliance_legal — FDD Posture & State Strategy.
 *
 * Bucket: heavy structured (~12 fields).
 * Audit status: not yet cross-checked against the High Point FDD Guide
 * or LMF Comprehensive Fact-Finding Checklist.
 *
 * Captures the legal-strategy decisions a franchisor makes BEFORE the
 * attorney sits down with their FDD: which states to register in,
 * which to skip, exemption strategy, and the key contacts. The
 * attorney owns the actual FDD drafting; this chapter captures the
 * strategy that drives their work.
 *
 * Compiles into: Decode the FDD chapter, Franchise Agreement scaffolding,
 * attorney handoff packet.
 */
const COMPLIANCE_LEGAL: ChapterSchema = {
  slug: "compliance_legal",
  title: "FDD Posture & State Strategy",
  description:
    "Where you'll register, where you'll skip, who your attorney is, and how the FDD strategy fits your launch plan.",
  compilesInto: "Decode the FDD, Franchise Agreement scaffolding, attorney handoff packet.",
  fields: [
    // ── State strategy ───────────────────────────────────────────────────
    {
      name: "registration_states",
      label: "Registration states (priority)",
      type: "list_short",
      required: true,
      placeholder: "California\nNew York\nIllinois\nVirginia",
      helpText:
        "States where you'll register the FDD and pay the registration fee — usually the states where you want to actively recruit franchisees first. 14 states require registration; 13 are 'filing states' (just file, no review); the rest are non-registration.",
      category: "State strategy",
      suggestedFrom: {
        kind: "industry_lookup",
        keyedOn: "priority_geographic_markets",
        source:
          "Cross-reference of priority markets against FTC franchise registration requirements (registration states: CA, HI, IL, IN, MD, MI, MN, NY, ND, RI, SD, VA, WA, WI)",
      },
    },
    {
      name: "filing_only_states",
      label: "Filing-only states",
      type: "list_short",
      placeholder: "Connecticut\nKentucky\nNebraska",
      helpText:
        "States that require a franchise filing but no review. Cheaper and faster than registration states.",
      category: "State strategy",
      advanced: true,
    },
    {
      name: "non_registration_states",
      label: "Non-registration states (free zone)",
      type: "list_short",
      placeholder: "Texas\nFlorida\nGeorgia\nNorth Carolina",
      helpText:
        "States with no franchise-specific registration. You can sell here as soon as your FDD is complete. Most emerging franchisors prioritize these for early growth.",
      category: "State strategy",
      advanced: true,
    },
    {
      name: "exemption_strategy",
      label: "Exemption strategy",
      type: "textarea",
      placeholder:
        "Pursuing the large-franchisor exemption (CA Corp Code §31101) once we hit 25 franchisees and $5M minimum net worth. Until then, full registration in all 14 registration states.",
      helpText:
        "Optional now; matters more at scale. Federal and state exemptions can reduce ongoing registration burden.",
      category: "State strategy",
      advanced: true,
    },

    // ── Attorney ─────────────────────────────────────────────────────────
    {
      name: "attorney_name",
      label: "Franchise attorney",
      type: "text",
      placeholder: "Sarah Lee, Esq.",
      helpText:
        "The attorney drafting and filing your FDD. Required by every state registration application.",
      category: "Attorney",
    },
    {
      name: "attorney_firm",
      label: "Law firm",
      type: "text",
      placeholder: "Lee & Associates Franchise Law",
      category: "Attorney",
    },
    {
      name: "attorney_email",
      label: "Attorney email",
      type: "email",
      placeholder: "sarah@leefranchiselaw.com",
      category: "Attorney",
    },
    {
      name: "attorney_phone",
      label: "Attorney phone",
      type: "text",
      placeholder: "(555) 123-4567",
      category: "Attorney",
      advanced: true,
    },

    // ── Compliance dates ─────────────────────────────────────────────────
    {
      name: "fdd_target_completion_date",
      label: "Target FDD completion date",
      type: "date",
      helpText:
        "When you want the FDD ready for filing. Most emerging franchisors target 90–120 days after they finish the underlying chapters.",
      category: "Timeline",
    },
    {
      name: "first_franchisee_target_date",
      label: "Target date for first franchisee signed",
      type: "date",
      helpText:
        "Your goal date. Drives the marketing and Discovery Day cadence backward from here.",
      category: "Timeline",
      advanced: true,
    },

    // ── Insurance ────────────────────────────────────────────────────────
    {
      name: "general_liability_minimum_dollars",
      label: "General liability insurance minimum ($)",
      type: "currency",
      placeholder: "1000000",
      helpText:
        "Minimum general liability coverage franchisees must carry. Industry standard: $1M per occurrence / $2M aggregate.",
      category: "Insurance requirements",
      advanced: true,
    },
    {
      name: "additional_insurance_required",
      label: "Other required insurance",
      type: "list_short",
      placeholder:
        "Workers' comp (required by state)\nProperty insurance (full replacement)\nCyber liability ($500K minimum)\nFood-borne illness coverage",
      category: "Insurance requirements",
      advanced: true,
    },
  ],
};

// ----------------------------------------------------------------------------
// LIGHT HYBRID — anchor fields + content_md prose
// ----------------------------------------------------------------------------

/**
 * operating_model — Daily Operations.
 *
 * Bucket: light hybrid (~7 anchor fields + content_md).
 * Audit status: not yet cross-checked against the High Point Operations
 * Manual.
 *
 * The anchor numbers (hours, staffing, KPIs) drive the structured
 * deliverables. The narrative content_md carries the cultural
 * specifics — opening rituals, peak-hour playbooks, what makes "the
 * way we do it here" — which would be brittle to fully structure.
 *
 * Compiles into: Operations Manual §3-12 (daily operations chapters),
 * Discovery Day operations walkthrough.
 */
const OPERATING_MODEL: ChapterSchema = {
  slug: "operating_model",
  title: "Daily Operations",
  description:
    "How a location actually runs day-to-day. Hours, staffing, the rhythm a manager owns, and the specifics that make your concept work.",
  compilesInto: "Operations Manual §3-12, Discovery Day operations walkthrough.",
  fields: [
    {
      name: "standard_hours_of_operation",
      label: "Standard hours of operation",
      type: "textarea",
      placeholder:
        "Mon–Fri 6am–4pm\nSat–Sun 7am–4pm\nClosed: New Year's Day, Thanksgiving, Christmas",
      helpText:
        "The brand-mandated hours. Franchisees can extend with approval but can't open later or close earlier than these.",
      category: "Schedule",
    },
    {
      name: "peak_hours",
      label: "Peak hours (when staffing matters most)",
      type: "text",
      placeholder: "Weekday 7am–10am, Weekend 8am–11am",
      helpText:
        "When your locations get busiest. Drives staffing and throughput planning.",
      category: "Schedule",
      advanced: true,
    },
    {
      name: "staff_per_shift_typical",
      label: "Typical staff per shift",
      type: "integer",
      placeholder: "4",
      helpText:
        "Including the manager. Drives labor % in unit economics.",
      category: "Schedule",
    },
    {
      name: "staff_per_shift_peak",
      label: "Peak-hour staff per shift",
      type: "integer",
      placeholder: "6",
      category: "Schedule",
      advanced: true,
    },
    {
      name: "key_kpis_tracked_daily",
      label: "KPIs tracked daily",
      type: "list_short",
      placeholder:
        "Transaction count\nAverage ticket\nLabor as % of sales\nWaste $\nCustomer satisfaction (NPS)",
      helpText:
        "The numbers a franchisee owner watches every morning. Becomes the daily-report dashboard in the Operations Manual.",
      category: "Metrics",
    },
    {
      name: "daily_rituals",
      label: "Daily rituals (open and close)",
      type: "textarea",
      placeholder:
        "Open: temperature checks on equipment, brew calibration, first-shift briefing on specials.\nClose: deep clean of espresso machines, daily cash reconciliation, next-day prep.",
      helpText:
        "The repeatable cadence that makes the brand consistent across locations. The full checklists live in the Operations Manual; this is the headline summary.",
      category: "Cadence",
    },
    {
      name: "operations_software_required",
      label: "Required operations software",
      type: "list_short",
      placeholder:
        "Toast (POS)\nWhen I Work (scheduling)\nMarketMan (inventory)",
      helpText:
        "The tools franchisees must use. Each is also a recurring cost franchisees take on.",
      category: "Systems",
      advanced: true,
    },
  ],
};

/**
 * recipes_and_menu — Product & Service Specs.
 *
 * Bucket: light hybrid (~7 anchor fields + content_md).
 * Audit status: not yet cross-checked against High Point's product
 * spec deliverables.
 *
 * Anchors capture the headline menu numbers. The narrative content_md
 * carries the actual recipes and prep procedures — those are the IP
 * the franchisor most wants to protect, and they're inherently long-
 * form. For service businesses (non-restaurant), this chapter pivots
 * to "service offerings" — same structure, different content.
 *
 * Compiles into: Operations Manual §13 (Product Specs), Barista /
 * Operator Certification Program training materials.
 */
const RECIPES_AND_MENU: ChapterSchema = {
  slug: "recipes_and_menu",
  title: "Product & Service Specs",
  description:
    "What you sell, in detail. The menu (or service catalog), the signature items, and how they're made the same way every time.",
  compilesInto: "Operations Manual §13, certification program training materials.",
  fields: [
    {
      name: "menu_item_count",
      label: "Number of items on the menu",
      type: "integer",
      placeholder: "32",
      helpText:
        "Total SKUs or services on offer. Higher counts make training and inventory harder; many franchisors trim the menu before franchising.",
      category: "Scope",
    },
    {
      name: "signature_items",
      label: "Signature items (what you're known for)",
      type: "list_short",
      placeholder:
        "Cypress Lane single-origin pour-over\nThe Oxford Mocha\nButtermilk biscuit and gravy",
      helpText:
        "Three to five items the brand is identified by. Featured in marketing and Discovery Day.",
      category: "Scope",
    },
    {
      name: "price_range_low_dollars",
      label: "Price range — low",
      type: "currency",
      placeholder: "3.50",
      helpText:
        "Cheapest item on the menu. Drives perceived accessibility.",
      category: "Pricing",
    },
    {
      name: "price_range_high_dollars",
      label: "Price range — high",
      type: "currency",
      placeholder: "12.00",
      category: "Pricing",
    },
    {
      name: "average_ticket_dollars",
      label: "Average ticket size",
      type: "currency",
      placeholder: "8.50",
      helpText:
        "Average dollar amount per transaction. Drives the AUV math in unit economics.",
      category: "Pricing",
    },
    {
      name: "pricing_strategy",
      label: "Pricing strategy",
      type: "select",
      options: [
        { value: "uniform_brand_wide", label: "Uniform across all locations (brand-mandated)" },
        { value: "tiered_by_market", label: "Tiered by market (urban/suburban/rural)" },
        { value: "franchisee_discretion_within_band", label: "Franchisee discretion within a brand-set band" },
        { value: "fully_franchisee_set", label: "Franchisee fully sets local pricing" },
      ],
      helpText:
        "How franchisees are allowed to price. Note: federal antitrust law generally prohibits franchisors from FIXING resale prices — most concepts use 'suggested' pricing or banded floors/ceilings. Confirm with attorney.",
      category: "Pricing",
      advanced: true,
    },
    {
      name: "recipe_book_status",
      label: "Recipe / spec book status",
      type: "select",
      options: [
        { value: "complete", label: "Complete and tested at scale" },
        { value: "complete_untested", label: "Complete but only at corporate locations" },
        { value: "in_progress", label: "In progress" },
        { value: "not_started", label: "Not yet started" },
      ],
      required: true,
      helpText:
        "Drives readiness — Jason's smell test for whether a concept is franchisable. 'Not yet started' is a flag we'd want to address before recruiting franchisees.",
      category: "Documentation",
    },
  ],
};

/**
 * training_program — Training & Certification.
 *
 * Bucket: light hybrid (~10 anchor fields + content_md).
 * Audit status: not yet cross-checked against High Point's Barista
 * Certification Program deliverable.
 *
 * Defines how new franchisees and their teams get trained on the
 * system. The structured anchors drive FDD Item 11 (training)
 * disclosure. The narrative content_md carries the actual curriculum
 * design.
 *
 * Compiles into: Train Your Team chapter (currently empty in the
 * existing capability registry), FDD Item 11 (training section),
 * Operations Manual training appendix.
 */
const TRAINING_PROGRAM: ChapterSchema = {
  slug: "training_program",
  title: "Training & Certification",
  description:
    "How new franchisees and their teams learn the system. The first few weeks are the difference between a great franchisee and a struggling one.",
  compilesInto: "Train Your Team chapter, FDD Item 11 training section, Operations Manual training appendix.",
  fields: [
    // ── Initial training ─────────────────────────────────────────────────
    {
      name: "initial_training_duration_days",
      label: "Initial training duration (days)",
      type: "integer",
      required: true,
      placeholder: "10",
      helpText:
        "How long the franchisee owner / GM trains before opening. Industry typical: 5–14 days.",
      category: "Initial training",
    },
    {
      name: "initial_training_format",
      label: "Initial training format",
      type: "select",
      required: true,
      options: [
        { value: "in_person_corporate", label: "In-person at corporate HQ" },
        { value: "in_person_existing_unit", label: "In-person at an existing unit" },
        { value: "on_site_franchisee_location", label: "On-site at the franchisee's new location" },
        { value: "virtual", label: "Virtual / video" },
        { value: "hybrid", label: "Hybrid (some virtual, some in-person)" },
      ],
      helpText:
        "Where training happens. Drives FDD Item 6 (initial fees that include training travel) and Item 11 disclosure.",
      category: "Initial training",
    },
    {
      name: "initial_training_attendees",
      label: "Who must attend initial training",
      type: "list_short",
      placeholder:
        "Franchisee owner (required)\nGeneral manager (required)\nUp to 2 additional managers (optional)",
      category: "Initial training",
    },
    {
      name: "training_travel_at_franchisee_expense",
      label: "Travel paid by franchisee?",
      type: "boolean",
      helpText:
        "Almost always yes for emerging franchisors. Cost shows up in FDD Item 7 initial-investment estimate.",
      category: "Initial training",
      advanced: true,
    },

    // ── Opening support ──────────────────────────────────────────────────
    {
      name: "opening_support_days_on_site",
      label: "Days franchisor staff on-site at opening",
      type: "integer",
      placeholder: "5",
      helpText:
        "How long a franchisor representative is at the franchisee's location during opening week. Industry typical: 3-7 days.",
      category: "Opening support",
    },
    {
      name: "opening_support_team_size",
      label: "Franchisor team size on-site",
      type: "integer",
      placeholder: "2",
      category: "Opening support",
      advanced: true,
    },

    // ── Ongoing training ─────────────────────────────────────────────────
    {
      name: "ongoing_training_required",
      label: "Ongoing training required?",
      type: "boolean",
      helpText:
        "Whether franchisees must attend recurring training (annual conference, monthly webinars, etc.).",
      category: "Ongoing",
    },
    {
      name: "annual_conference_required",
      label: "Annual franchisee conference required?",
      type: "boolean",
      helpText:
        "Most concepts have one. Franchisee attendance is usually mandatory and at the franchisee's expense (disclosed in FDD Item 6).",
      category: "Ongoing",
      advanced: true,
    },

    // ── Certification ────────────────────────────────────────────────────
    {
      name: "certification_required",
      label: "Certification required to operate?",
      type: "boolean",
      helpText:
        "Whether franchisees and key staff must pass a certification exam before opening or being authorized to perform key functions.",
      category: "Certification",
    },
    {
      name: "certification_levels",
      label: "Certification levels",
      type: "list_short",
      placeholder:
        "Owner / GM (required to open)\nLead Barista (required to handle bar alone)\nShift Manager (required to manage a shift)",
      helpText:
        "If you have a tiered cert program, the levels. Each level usually has its own training + exam.",
      category: "Certification",
      advanced: true,
    },
  ],
};

// ----------------------------------------------------------------------------
// AGENT-RESEARCH DRAFTED — Phase 3 will populate via external research
// ----------------------------------------------------------------------------

/**
 * territory_real_estate — Site Selection & Territory Strategy.
 *
 * Bucket: agent-research drafted (~7 anchor fields + research-driven prose).
 * Audit status: not yet cross-checked against High Point's Site Selection
 * Build-Out Guide and Site Evaluation Report.
 *
 * Customer defines the *criteria* (target population, ideal income band,
 * footprint size) — agent does the trade-area research per market when
 * Phase 3 ships the demographic + real-estate APIs. Until then, the
 * narrative content_md carries the customer's site-selection rules of
 * thumb.
 *
 * Compiles into: Site Selection / Build-Out Manual, FDD Item 12 (territory),
 * trade-area reports per market.
 */
const TERRITORY_REAL_ESTATE: ChapterSchema = {
  slug: "territory_real_estate",
  title: "Site Selection & Territory",
  description:
    "What makes a good location for your concept. The criteria a franchisee uses to pick a site, and the rules that protect them once they sign.",
  compilesInto: "Site Selection / Build-Out Manual, FDD Item 12, per-market trade-area reports.",
  fields: [
    // ── Site criteria ────────────────────────────────────────────────────
    {
      name: "ideal_population_per_unit",
      label: "Target population per unit",
      type: "integer",
      placeholder: "50000",
      helpText:
        "Population within the trade area required to support a unit. We suggest a range from your industry — adjust based on your existing-location experience.",
      category: "Site criteria",
      suggestedFrom: {
        kind: "industry_lookup",
        keyedOn: "industry_category",
        source: "Industry-typical trade-area population thresholds",
      },
    },
    {
      name: "ideal_household_income_min_dollars",
      label: "Minimum median household income",
      type: "currency",
      placeholder: "55000",
      helpText:
        "Median household income in the trade area required to support your price point. Drives site selection in lower-income markets.",
      category: "Site criteria",
      suggestedFrom: {
        kind: "industry_lookup",
        keyedOn: "industry_category",
        source: "Industry-typical income thresholds for this concept type",
      },
    },
    {
      name: "target_square_footage_low",
      label: "Footprint — low (sqft)",
      type: "integer",
      placeholder: "1400",
      category: "Site criteria",
    },
    {
      name: "target_square_footage_high",
      label: "Footprint — high (sqft)",
      type: "integer",
      placeholder: "1800",
      category: "Site criteria",
    },
    {
      name: "site_type_preferences",
      label: "Site type preferences",
      type: "list_short",
      placeholder:
        "End-cap with patio access (preferred)\nMid-block with strong morning sun\nDrive-through capable (bonus, not required)",
      helpText:
        "Specific site types that work for your concept. Specific enough that a real-estate broker can prequalify a site before showing it.",
      category: "Site criteria",
    },

    // ── Priority markets ─────────────────────────────────────────────────
    {
      name: "priority_geographic_markets",
      label: "Priority markets for first 5 units",
      type: "list_short",
      required: true,
      placeholder:
        "Greater Oxford / North Mississippi corridor\nMemphis suburban ring\nBirmingham metro\nNashville (eastern suburbs)",
      helpText:
        "Where you want the first 5 franchisees. Drives FDD state-registration prioritization (see compliance_legal).",
      category: "Priority markets",
    },
    {
      name: "exclusion_zones",
      label: "Markets you won't operate in",
      type: "list_short",
      placeholder:
        "Major metros with > 5 existing third-wave competitors\nCollege towns with high seasonality\nCold-climate markets (winter < 25°F average)",
      helpText:
        "Where the model doesn't work. Saves franchisees the trouble of pitching markets you'd reject.",
      category: "Priority markets",
      advanced: true,
    },

    // ── Site approval process ───────────────────────────────────────────
    {
      name: "site_approval_required",
      label: "Site approval required from franchisor?",
      type: "boolean",
      helpText:
        "Almost always yes. Drives FDD Item 12 (territory) language.",
      category: "Approval process",
      advanced: true,
    },
    {
      name: "site_approval_timeline_days",
      label: "Site approval timeline (days)",
      type: "integer",
      placeholder: "14",
      helpText:
        "How long the franchisor takes to review a proposed site. Faster is friendlier — most franchisors target 7–21 days.",
      category: "Approval process",
      advanced: true,
    },
  ],
};

/**
 * market_strategy — Market Strategy & Positioning.
 *
 * Bucket: agent-research drafted (~5 anchor fields + research-driven prose).
 * Audit status: not yet cross-checked against High Point's Utah Market
 * Strategy Report.
 *
 * Mostly research-driven prose. The agent (Phase 3) does the market
 * sizing, demographic analysis, and competitive positioning research;
 * the customer confirms the priority markets and the target positioning.
 *
 * Compiles into: Market Strategy Report, Discovery Day market opportunity
 * deck, FDD market-context appendix.
 */
const MARKET_STRATEGY: ChapterSchema = {
  slug: "market_strategy",
  title: "Market Strategy & Positioning",
  description:
    "Where you'll grow first, why those markets, and how you'll position against alternatives. Mostly research the agent does — you confirm the priorities.",
  compilesInto: "Market Strategy Report, Discovery Day market-opportunity deck.",
  fields: [
    {
      name: "growth_horizon_years",
      label: "Growth horizon (years)",
      type: "integer",
      placeholder: "5",
      helpText:
        "How far out you're planning. Drives the market-rollout sequencing.",
      category: "Horizon",
    },
    {
      name: "target_unit_count_year_3",
      label: "Target franchised unit count by year 3",
      type: "integer",
      placeholder: "12",
      helpText:
        "How many franchisees you want signed and operating by the end of year 3. Realistic for emerging franchisors: 4–15 units.",
      category: "Horizon",
    },
    {
      name: "target_unit_count_year_5",
      label: "Target franchised unit count by year 5",
      type: "integer",
      placeholder: "30",
      category: "Horizon",
      advanced: true,
    },
    {
      name: "competitive_positioning_summary",
      label: "Competitive positioning",
      type: "textarea",
      placeholder:
        "Cypress Lane is positioned between regional independents (Stumptown-style, $5+ drinks, urban-only) and national chains (Starbucks-tier convenience, lower quality). We're the smartest middle path for small-town markets that have been overlooked by both ends.",
      helpText:
        "How you describe yourself relative to alternatives. The agent will sharpen this with research; your draft sets the direction.",
      category: "Positioning",
      suggestedFrom: {
        kind: "from_scrape",
        field: "positioning_summary",
      },
    },
    {
      name: "expansion_sequencing_strategy",
      label: "Expansion sequencing",
      type: "select",
      options: [
        { value: "concentric", label: "Concentric — expand outward from existing locations" },
        { value: "hub_and_spoke", label: "Hub and spoke — major metros first, then satellite markets" },
        { value: "opportunistic", label: "Opportunistic — wherever the right franchisee shows up" },
        { value: "regional_clusters", label: "Regional clusters — fill one region before opening another" },
      ],
      helpText:
        "The geographic strategy. Concentric reduces marketing and supply-chain costs; hub-and-spoke speeds revenue; opportunistic is risky for emerging brands.",
      category: "Sequencing",
      advanced: true,
    },
  ],
};

/**
 * competitor_landscape — Competitive Landscape.
 *
 * Bucket: agent-research drafted (~5 anchor fields + research-driven prose).
 * Audit status: not yet cross-checked against High Point's Competitor Maps
 * Appendix.
 *
 * The agent (Phase 3) builds the actual competitor analysis using web
 * search + Google Places + industry data. The customer's job is to
 * name the competitors they think matter — the agent fills in the rest.
 *
 * Compiles into: Competitor Maps Appendix, Discovery Day competitive
 * analysis section, Market Strategy Report supporting research.
 */
const COMPETITOR_LANDSCAPE: ChapterSchema = {
  slug: "competitor_landscape",
  title: "Competitive Landscape",
  description:
    "Who else is competing for your customer. You name the brands that matter; the agent does the comparison work.",
  compilesInto: "Competitor Maps Appendix, Discovery Day competitive analysis, Market Strategy Report supporting research.",
  fields: [
    {
      name: "direct_competitors",
      label: "Direct competitors (brands you compete with head-to-head)",
      type: "list_short",
      required: true,
      placeholder:
        "Stumptown Coffee Roasters\nIntelligentsia\nLocal Reverie Coffee (regional)",
      helpText:
        "Brands that target the same customer with a similar offering. The agent will research each — pricing, positioning, expansion footprint, what they do well, where they're weak.",
      category: "Competitors",
    },
    {
      name: "indirect_competitors",
      label: "Indirect competitors (different format, same customer)",
      type: "list_short",
      placeholder:
        "Starbucks (mass premium)\nDunkin' (commute convenience)\nLocal independent cafés\nGas-station coffee (bottom of the market)",
      helpText:
        "Brands or formats that win when your customer doesn't pick you. The agent fills in the broader landscape.",
      category: "Competitors",
      advanced: true,
    },
    {
      name: "competitive_advantages",
      label: "Where you win",
      type: "list_short",
      placeholder:
        "Coffee quality on par with urban third-wave at small-town prices\nIn-house roasting (vertical integration)\nCommunity-room positioning (Starbucks-Reverse)",
      helpText:
        "Why your customer picks you. Each should be a defensible claim — not marketing fluff.",
      category: "Differentiation",
    },
    {
      name: "competitive_vulnerabilities",
      label: "Where you're vulnerable",
      type: "list_short",
      placeholder:
        "Higher labor cost than Dunkin' (we have more skilled staff)\nNo drive-through (slower morning rush)\nSingle roast supplier (concentration risk)",
      helpText:
        "Honest assessment. The FDD attorney will appreciate this; investors definitely will.",
      category: "Differentiation",
      advanced: true,
    },
    {
      name: "competitive_research_notes",
      label: "Anything else about the competitive landscape",
      type: "textarea",
      placeholder:
        "Watching for Pour Five expansion into the Mid-South — they're testing the same small-town third-wave thesis we are. If they enter Mississippi before we franchise in volume, our market windows tighten.",
      helpText:
        "Open-ended notes. Agent will weave these into the Competitor Maps narrative.",
      category: "Research",
      advanced: true,
    },
  ],
};

// ---------------------------------------------------------------------------
// Registry & helpers
// ---------------------------------------------------------------------------

/**
 * Per-chapter schema registry. Now covers 15 of 16 chapters; only
 * `brand_voice` remains deferred (planned for Phase 1.5b at ~6-8
 * fields, lighter footprint than the v1 we cut).
 *
 * BUCKET LAYOUT:
 *
 *   Heavy structured (typed values + lists drive the chapter):
 *     - unit_economics
 *     - franchise_economics
 *     - franchisee_profile
 *     - vendor_supply_chain
 *     - marketing_fund
 *     - employee_handbook
 *     - reimbursement_policy
 *     - compliance_legal
 *
 *   Light hybrid (anchor fields + content_md prose):
 *     - business_overview
 *     - operating_model
 *     - recipes_and_menu
 *     - training_program
 *
 *   Agent-research drafted (Phase 3 will populate via external research):
 *     - territory_real_estate
 *     - market_strategy
 *     - competitor_landscape
 *
 *   Deferred to Phase 1.5b:
 *     - brand_voice (no schema; the chapter exists in Memory but
 *       renders prose-only until 1.5b)
 *
 * AUDIT STATUS: the 11 newly-added schemas have NOT been cross-checked
 * against the High Point Coffee bundle or original capability documents.
 * Each schema's comment header notes the audit gap. Jason should review
 * for fields specific to TFB's framework that I missed.
 */
// ---------------------------------------------------------------------------
// brand_voice — the deferred Phase 1.5b chapter, now landing.
//
// Light hybrid. Cypress Lane example values shown in placeholders
// follow the operator-voice rule: no marketing-speak ("brand
// equity", "value proposition", "tone of voice"); plain English
// the founder would use ("how your team talks", "your colors").
//
// The brand-voice content drives FDD Item 1 boilerplate, the
// operations manual's "How we sound" section, and the marketing
// playbook. It's also what the agent reads when adapting prose to
// the customer's voice on later chapter drafts — so even minimal
// inputs here meaningfully improve the rest.
// ---------------------------------------------------------------------------
const BRAND_VOICE: ChapterSchema = {
  slug: "brand_voice",
  title: "Brand Standards",
  description:
    "How your brand looks and sounds — the visual + verbal identity franchisees inherit and have to honor.",
  compilesInto: "FDD Item 1, Operations Manual §3 (Brand Standards), Marketing Playbook",
  fields: [
    {
      name: "brand_name",
      label: "Brand name",
      type: "text",
      required: true,
      category: "Identity",
      placeholder: "Cypress Lane Coffee",
      helpText:
        "The exact wording you want franchisees to use on every sign, package, and document.",
    },
    {
      name: "tagline",
      label: "Tagline or slogan",
      type: "text",
      category: "Identity",
      placeholder: "Slow coffee, small streets.",
      helpText:
        "Short. Memorable. The line you put on the side of the cup. Skip if you don't have one yet.",
    },
    {
      name: "voice_adjectives",
      label: "Voice in 3–5 words",
      type: "list_short",
      required: true,
      category: "Voice",
      placeholder: "Warm\nWelcoming\nCraft-honest\nNeighborly\nUn-corporate",
      helpText:
        "How your brand sounds when it talks. One word per line.",
    },
    {
      name: "voice_description",
      label: "Voice in a sentence or two",
      type: "textarea",
      required: true,
      category: "Voice",
      placeholder:
        "We sound like a friendly barista, not a corporate brochure. We use plain words, ask about the customer's day, and never pretend to be more than a good cup of coffee.",
      helpText:
        "How would you describe the way your brand talks to a writer who'd never met you?",
    },
    {
      name: "brand_colors",
      label: "Brand colors",
      type: "color_list",
      required: true,
      category: "Visual",
      placeholder: "#1F3D2C",
      helpText:
        "Your brand palette — primary, accent, neutrals, anything you use consistently. Pick a color or paste hex codes; add as many as you need.",
    },
    {
      name: "typography_pairing",
      label: "Typography",
      type: "text",
      category: "Visual",
      placeholder: "Tiempos Headline (display) / Inter (body)",
      helpText:
        "The fonts you use, in priority order. If you don't know the names, describe the vibe ('hand-drawn serif + simple sans').",
    },
    {
      name: "logo_url",
      label: "Logo file or URL",
      type: "url",
      category: "Visual",
      placeholder: "https://example.com/brand/logo.svg",
      helpText:
        "Public link to your primary logo (SVG/PNG preferred). You can also attach the file via the References panel.",
    },
    {
      name: "things_to_avoid",
      label: "Words / styles to avoid",
      type: "list_short",
      category: "Voice",
      advanced: true,
      placeholder:
        "Exclamation marks\n\"Synergy\"\nStock-photo lifestyle imagery\nAll-caps headlines",
      helpText:
        "Anything that's off-brand. Saves the agent from drafting copy you'll just have to rewrite.",
    },
  ],
};

export const CHAPTER_SCHEMAS: Partial<Record<MemoryFileSlug, ChapterSchema>> = {
  business_overview: BUSINESS_OVERVIEW,
  brand_voice: BRAND_VOICE,
  unit_economics: UNIT_ECONOMICS,
  franchise_economics: FRANCHISE_ECONOMICS,
  franchisee_profile: FRANCHISEE_PROFILE,
  vendor_supply_chain: VENDOR_SUPPLY_CHAIN,
  marketing_fund: MARKETING_FUND,
  employee_handbook: EMPLOYEE_HANDBOOK,
  reimbursement_policy: REIMBURSEMENT_POLICY,
  compliance_legal: COMPLIANCE_LEGAL,
  operating_model: OPERATING_MODEL,
  recipes_and_menu: RECIPES_AND_MENU,
  training_program: TRAINING_PROGRAM,
  territory_real_estate: TERRITORY_REAL_ESTATE,
  market_strategy: MARKET_STRATEGY,
  competitor_landscape: COMPETITOR_LANDSCAPE,
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

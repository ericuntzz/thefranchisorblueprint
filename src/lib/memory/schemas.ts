/**
 * Per-section field schemas — Phase 1.5a.
 *
 * Each section has a STRUCTURED data layer (typed fields) alongside the
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
 * Not every section wants to be heavily field-driven. Forcing structure
 * on inherently prose sections makes them brittle and removes the
 * agent's ability to write fluid copy. Each section belongs to one of
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
 * If a section is creeping past 25 fields, the bucket is probably wrong.
 *
 * ─── THE OPERATOR-VOICE RULE ───────────────────────────────────────────
 *
 * Field labels, descriptions, and helpText all read to a $1M-$10M
 * business owner who is NOT a marketer. Avoid:
 *
 *   - "system", "identity", "platform", "ecosystem" (unless very specific)
 *   - "brand voice/tone/persona" without context
 *   - "drives" / "leverages" / "powers" (consultant verbs)
 *   - "section" — that's our internal language for the 16 Memory files,
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
 *   ✗ "The first section your attorney reads."
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
 *   1. AUDIT BEFORE DESIGNING. When designing a section's schema, the
 *      first input is whatever existing TFB document maps to that
 *      section (e.g. for `unit_economics` → the financial model
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
 * architecture and `src/lib/memory/files.ts` for the canonical section
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
 * One typed field within a section.
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
   * `deps` may reference fields in the same section by bare name
   * (e.g. `"cogs_pct"`) or in another section via `section.field`
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
 * A section's complete field schema, plus a couple of metadata fields
 * the UI uses to render the section card header.
 */
export type SectionSchema = {
  slug: MemoryFileSlug;
  /** Page-friendly title — also the H2 of the section card. */
  title: string;
  /** One-sentence description for the customer. Renders under the title in edit mode. */
  description: string;
  /**
   * What this section compiles into at export time. Use the actual
   * deliverable name(s) so the customer (and Jason) can trace the
   * lineage. e.g. "FDD Item 1, Operations Manual §1".
   */
  compilesInto: string;
  fields: FieldDef[];
};

// ---------------------------------------------------------------------------
// Foundational section schemas
// ---------------------------------------------------------------------------

/**
 * business_overview — Concept & Story.
 *
 * The narrative anchor for FDD Item 1 (the franchisor's identity and
 * concept) and the Operations Manual's opening section. The fields here
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
const BUSINESS_OVERVIEW: SectionSchema = {
  slug: "business_overview",
  title: "Concept & Story",
  description:
    "What you do, who you do it for, and how you got here. This is the opening of your FDD, and it's what franchisees fall in love with.",
  compilesInto:
    "FDD Item 1, Operations Manual §1, Discovery Day deck opener.",
  fields: [
    // ── The concept ─────────────────────────────────────────────────────────
    {
      name: "concept_summary",
      label: "How would you describe your concept in two or three sentences?",
      type: "textarea",
      required: true,
      placeholder:
        "Cypress Lane is a small-town third-wave coffee shop that roasts on-site, serves a locally-tuned menu, and treats every café as a community room rather than a transaction counter.",
      helpText:
        "Write two or three sentences that an attorney can use as the opening paragraph of your FDD. It should sound unmistakably like your business, not a generic description that could apply to any company.",
      category: "The concept",
    },
    {
      name: "core_offering",
      label: "What do you sell?",
      type: "textarea",
      placeholder:
        "Specialty coffee (single-origin pour-over, espresso drinks), in-house pastries, light savory menu, retail beans by the bag.",
      helpText:
        "Tell us what your customers actually buy when they walk in. Be specific enough that an attorney can classify the kind of business you run.",
      category: "The concept",
    },
    {
      name: "industry_category",
      label: "What industry category does your business fall into?",
      type: "text",
      placeholder: "Specialty coffee café (QSR coffee subcategory)",
      helpText: "Describe the category in plain English rather than using a NAICS code.",
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
        "We look this up from your industry category, so you don't have to find it yourself. If you want to double-check, you can verify it on the U.S. Census NAICS site and override the value here if we got it wrong.",
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
      label: "Who's the founder?",
      type: "text",
      required: true,
      placeholder: "Sarah Chen",
      helpText:
        "This is the person whose story anchors the brand. If you have multiple co-founders, list the one who's the public face of the business.",
      category: "Founder",
      suggestedFrom: {
        kind: "from_assessment",
        field: "first_name",
      },
    },
    {
      name: "founder_background",
      label: "What's the founder's background?",
      type: "textarea",
      placeholder:
        "Sarah spent eight years as a barista and trainer at three Bay Area roasters before moving back home to Oxford in 2018.",
      helpText:
        "Write one or two sentences about the relevant experience that gives the founder credibility to run this business.",
      category: "Founder",
    },
    {
      name: "founder_origin_story",
      label: "Why does your business exist?",
      type: "textarea",
      placeholder:
        "I grew up here and I drove 40 miles each way for good coffee for years. When I moved back, I didn't want to keep doing that, and I figured my neighbors didn't either.",
      helpText:
        "Write one or two paragraphs in the founder's own voice. This is the most important passage in the whole Blueprint, and it's what franchisees will remember about you.",
      category: "Founder",
    },

    // ── Track record ────────────────────────────────────────────────────────
    {
      name: "founding_date",
      label: "When did your first location open?",
      type: "date",
      placeholder: "2018-09-01",
      helpText: "The date your first location actually started generating revenue.",
      category: "Track record",
      suggestedFrom: {
        kind: "from_scrape",
        field: "founding_date",
      },
    },
    {
      name: "first_location_address",
      label: "What's the address of your first location?",
      type: "text",
      placeholder: "412 Main Street, Oxford, MS 38655",
      category: "Track record",
      advanced: true,
    },
    {
      name: "current_location_count",
      label: "How many locations are operating today?",
      type: "integer",
      placeholder: "3",
      helpText: "Count every location that's open and earning revenue, including the ones you own and any that have already been franchised.",
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
      helpText: "Most emerging franchisors are at zero here when they start the FDD process.",
      category: "Track record",
      advanced: true,
    },
    {
      name: "business_history_milestones",
      label: "What are the key milestones in your business history?",
      type: "list_long",
      placeholder:
        "2018: opened first location\n2020: hit $850K AUV\n2022: opened second location, brought roasting in-house\n2024: third location, started developing the franchise model",
      helpText:
        "Add one short line per milestone. This is the arc that both your FDD and your Discovery Day deck will walk through.",
      category: "Track record",
    },

    // ── Audience ────────────────────────────────────────────────────────────
    {
      name: "target_customer_persona",
      label: "Who walks through your door?",
      type: "textarea",
      placeholder:
        "Locals 25–55 with disposable income and either a remote-work setup or a kid in school. They have a coffee habit and they care about quality more than they admit.",
      helpText:
        "Describe your typical customer in two or three sentences. Be specific enough that the description can guide site selection and franchisee training.",
      category: "Audience",
    },
    {
      name: "distinctive_attributes",
      label: "Why does your concept work as a franchise?",
      type: "list_short",
      placeholder:
        "Codified menu (no chef-driven dependency)\nIn-house roasting + barista training program\nProven unit economics across 3 locations",
      helpText:
        "Give us three to five reasons this works as a franchise, not just as your business. Each one should be a defensible claim rather than marketing fluff.",
      category: "Audience",
    },
  ],
};

/**
 * unit_economics — Unit Economics & Financial Model.
 *
 * The most data-dense section and the one with the highest stakes:
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
const UNIT_ECONOMICS: SectionSchema = {
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
      label: "What's the average annual revenue of a mature location?",
      type: "currency",
      required: true,
      placeholder: "1200000",
      helpText:
        "This is the annual gross revenue of a location that's been open for three or more years. It's the single most important number in your whole Blueprint.",
      category: "Headline performance",
    },
    {
      name: "auv_year_1_dollars",
      label: "What does a typical new location earn in year one?",
      type: "currency",
      placeholder: "780000",
      helpText:
        "This is what a typical new location generates in its first 12 months. We'll suggest a starting number based on your mature AUV multiplied by your year-one ramp percentage, and you can override it if your real data says something different.",
      category: "Headline performance",
      suggestedFrom: {
        kind: "derived",
        deps: ["average_unit_volume_dollars", "ramp_curve_year_1_pct"],
        formula: "Mature AUV × Year-1 ramp %",
      },
    },
    {
      name: "auv_year_2_dollars",
      label: "What does a typical location earn in year two?",
      type: "currency",
      placeholder: "1000000",
      category: "Headline performance",
      suggestedFrom: {
        kind: "derived",
        deps: ["average_unit_volume_dollars", "ramp_curve_year_2_pct"],
        formula: "Mature AUV × Year-2 ramp %",
      },
    },
    {
      name: "ebitda_margin_pct",
      label: "What's your operating profit margin at a mature location?",
      type: "percentage",
      required: true,
      placeholder: "18",
      helpText:
        "This is EBITDA as a percentage of revenue (operating profit before interest, taxes, depreciation, and amortization). We calculate it for you from the cost-structure inputs below, so you don't need to compute it yourself. It's the number a banker or franchisee will look at first.",
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
        "This is how long it takes a franchisee to recover their initial investment from operating cash flow. We calculate it from the average initial investment and mature-unit profit dollars, so you don't need to compute it.",
      category: "Headline performance",
      computed: {
        deps: [
          "initial_investment_low_dollars",
          "initial_investment_high_dollars",
          "average_unit_volume_dollars",
          "ebitda_margin_pct",
        ],
        formula:
          "Average initial investment ÷ annual EBITDA × 12",
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
        "This is the variable cost of the product itself. For a coffee shop, that's beans, milk, syrups, and cups. Don't include labor in this number.",
      category: "Cost structure",
      min: 0,
      max: 100,
    },
    {
      name: "labor_pct",
      label: "What's your labor cost as a percentage of revenue?",
      type: "percentage",
      required: true,
      placeholder: "28",
      helpText: "Include all wages, benefits, and payroll taxes as a percentage of your revenue.",
      category: "Cost structure",
      min: 0,
      max: 100,
    },
    {
      name: "occupancy_pct",
      label: "What's your occupancy cost as a percentage of revenue?",
      type: "percentage",
      required: true,
      placeholder: "8",
      helpText: "Include rent, CAM, and utilities as a percentage of your revenue.",
      category: "Cost structure",
      min: 0,
      max: 100,
    },
    {
      name: "marketing_pct",
      label: "What percentage of revenue goes to local marketing?",
      type: "percentage",
      placeholder: "2",
      helpText:
        "This is the local marketing spend at each location. The brand-level ad fund is separate and lives in the Royalty, Ad Fund & Fees section.",
      category: "Cost structure",
      min: 0,
      max: 100,
    },
    {
      name: "other_opex_pct",
      label: "What percentage of revenue covers other operating expenses?",
      type: "percentage",
      placeholder: "6",
      helpText:
        "This covers everything that doesn't fit in the buckets above, like insurance, repairs, software, and supplies.",
      category: "Cost structure",
      min: 0,
      max: 100,
      advanced: true,
    },

    // ── Ramp curve ──────────────────────────────────────────────────────────
    {
      name: "ramp_curve_year_1_pct",
      label: "What percentage of mature AUV does a new location hit in year one?",
      type: "percentage",
      placeholder: "65",
      helpText:
        "This is the share of mature AUV a new location reaches in its first year. We suggest an industry-typical default for your concept, and you can override it if your existing locations have shown a different curve.",
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
      label: "What percentage of mature AUV does a location hit in year two?",
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
      label: "What percentage of mature AUV does a location hit in year three?",
      type: "percentage",
      placeholder: "100",
      helpText: "For most concepts this defaults to 100%, since year three is when a location is considered mature.",
      category: "Ramp curve",
      min: 0,
      max: 100,
      advanced: true,
    },

    // ── Initial investment (FDD Item 7) ─────────────────────────────────────
    {
      name: "initial_investment_low_dollars",
      label: "What's the low end of what a franchisee will spend to open?",
      type: "currency",
      required: true,
      placeholder: "275000",
      helpText:
        "This is the low end of what a franchisee will spend to open a location, and it feeds directly into FDD Item 7.",
      category: "Initial investment",
    },
    {
      name: "initial_investment_high_dollars",
      label: "What's the high end of what a franchisee will spend to open?",
      type: "currency",
      required: true,
      placeholder: "425000",
      category: "Initial investment",
    },
    {
      name: "buildout_cost_low_dollars",
      label: "What's the low end of build-out cost?",
      type: "currency",
      placeholder: "120000",
      helpText: "Include only construction and tenant improvements. Don't include furniture, fixtures, and equipment in this number.",
      category: "Initial investment",
      advanced: true,
    },
    {
      name: "buildout_cost_high_dollars",
      label: "What's the high end of build-out cost?",
      type: "currency",
      placeholder: "200000",
      category: "Initial investment",
      advanced: true,
    },
    {
      name: "ff_e_cost_dollars",
      label: "What's the typical cost of furniture, fixtures, and equipment?",
      type: "currency",
      placeholder: "80000",
      helpText: "Include the full cost of furniture, fixtures, and equipment a franchisee needs to open.",
      category: "Initial investment",
      advanced: true,
    },
    {
      name: "working_capital_dollars",
      label: "How much working capital does a franchisee need?",
      type: "currency",
      placeholder: "30000",
      helpText: "This is the operating cash a franchisee needs to keep the business running through the ramp period.",
      category: "Initial investment",
      advanced: true,
    },

    // ── Systems ─────────────────────────────────────────────────────────────
    {
      name: "pos_system",
      label: "What point-of-sale system do you use?",
      type: "text",
      placeholder: "Square for Restaurants",
      category: "Systems",
      advanced: true,
    },
    {
      name: "accounting_system",
      label: "What accounting or bookkeeping system do you use?",
      type: "text",
      placeholder: "QuickBooks Online",
      category: "Systems",
      advanced: true,
    },

    // ── Assumptions narrative ───────────────────────────────────────────────
    {
      name: "key_assumptions",
      label: "What assumptions are behind these numbers?",
      type: "textarea",
      placeholder:
        "Numbers based on the three corporate locations (years 2018–2025). Assumes a 1,400–1,800 sqft footprint, urban or close-suburb location, and a household income median of $55K or more within 5 miles. Does not assume drive-through revenue.",
      helpText:
        "Tell us anything an attorney or franchisee should know to read these numbers correctly. This becomes the disclaimer paragraph in FDD Item 19.",
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
const FRANCHISE_ECONOMICS: SectionSchema = {
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
      label: "What would you like your initial franchise fee to be?",
      type: "currency",
      required: true,
      placeholder: "45000",
      helpText:
        "This is the one-time fee a franchisee pays when they sign on. We'll suggest a typical number for your industry, and you can adjust it to fit your strategy. Most new franchisors set this somewhere between $25,000 and $50,000.",
      category: "Initial fee",
      suggestedFrom: {
        kind: "industry_lookup",
        keyedOn: "industry_category",
        source: "FRANdata published franchise-fee benchmarks by concept type",
      },
    },
    {
      name: "franchise_fee_volume_discount",
      label: "Do you offer a multi-unit discount?",
      type: "textarea",
      placeholder:
        "$5,000 off each additional unit signed at the same time, up to 4 units.",
      helpText: "This one is optional, so leave it blank if you don't offer a discount.",
      category: "Initial fee",
      advanced: true,
    },

    // ── Royalty ─────────────────────────────────────────────────────────────
    {
      name: "royalty_rate_pct",
      label: "What royalty rate do you want to charge?",
      type: "percentage",
      required: true,
      placeholder: "6",
      helpText:
        "This is the percentage of gross sales a franchisee pays the franchisor. We'll suggest a number from your industry, and you can adjust it to match what your unit economics support. The typical range is 4% to 8%.",
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
      label: "What's your royalty calculated against?",
      type: "select",
      placeholder: "gross sales",
      helpText: "Pick the figure your royalty rate gets applied to.",
      options: [
        { value: "gross_sales", label: "Gross sales" },
        { value: "net_sales", label: "Net sales (gross minus refunds/comps)" },
        { value: "weekly_gross_sales", label: "Weekly gross sales" },
      ],
      category: "Royalty",
    },
    {
      name: "royalty_payment_frequency",
      label: "How often do franchisees pay royalties?",
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
      label: "Do you set a minimum monthly royalty?",
      type: "currency",
      placeholder: "500",
      helpText:
        "If you want a floor when the percentage calculation comes out lower, set it here. Most concepts skip this.",
      category: "Royalty",
      advanced: true,
    },

    // ── Ad fund ─────────────────────────────────────────────────────────────
    {
      name: "ad_fund_pct",
      label: "What percentage of sales goes to the brand ad fund?",
      type: "percentage",
      required: true,
      placeholder: "2",
      helpText:
        "This is the percentage of gross sales franchisees contribute to the brand-wide ad fund. We'll suggest a number from your industry, and the typical range is 1% to 3%.",
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
      label: "What's the minimum percentage of sales franchisees must spend on local marketing?",
      type: "percentage",
      placeholder: "2",
      helpText:
        "This is what franchisees are required to spend on local marketing on top of the brand ad fund. It's optional, so leave it blank if you don't require one.",
      category: "Ad fund",
      advanced: true,
    },

    // ── Other recurring fees ────────────────────────────────────────────────
    {
      name: "technology_fee_dollars_per_month",
      label: "What's the monthly technology fee?",
      type: "currency",
      placeholder: "350",
      helpText:
        "This is the monthly fee for the required technology stack, like POS and scheduling tools. It's fine to use this as a pass-through cost.",
      category: "Other fees",
      advanced: true,
    },
    {
      name: "transfer_fee_dollars",
      label: "What's your transfer fee?",
      type: "currency",
      placeholder: "10000",
      helpText:
        "This is the fee a franchisee pays when they sell or transfer their unit. The industry-typical range is $5,000 to $15,000.",
      category: "Other fees",
      advanced: true,
    },
    {
      name: "renewal_fee_dollars",
      label: "What's your renewal fee?",
      type: "currency",
      placeholder: "15000",
      helpText: "This is what you charge a franchisee when they renew their agreement at the end of the term.",
      category: "Other fees",
      advanced: true,
    },
    {
      name: "training_fee_dollars",
      label: "What's your initial training fee?",
      type: "currency",
      placeholder: "0",
      helpText:
        "Most concepts include training in the franchise fee, so you can leave this at zero. Set a number here if you'd rather charge a higher franchise fee plus a separate training cost.",
      category: "Other fees",
      advanced: true,
    },

    // ── Term ────────────────────────────────────────────────────────────────
    {
      name: "term_years",
      label: "How long is your initial franchise term?",
      type: "integer",
      required: true,
      placeholder: "10",
      helpText: "This is the length of the initial franchise agreement. We default to 10 years, which is the franchise-industry standard, and you can adjust it if your industry runs shorter (some service trades are 5 to 7 years).",
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
      label: "How long does each renewal last?",
      type: "integer",
      placeholder: "5",
      helpText: "The industry-typical range is 5 to 10 years.",
      category: "Term",
      advanced: true,
    },
    {
      name: "renewal_count_allowed",
      label: "How many renewals can a franchisee do?",
      type: "integer",
      placeholder: "2",
      helpText: "Use zero if you don't allow renewals, or 99 for unlimited.",
      category: "Term",
      advanced: true,
    },

    // ── Territory ───────────────────────────────────────────────────────────
    {
      name: "territory_protection_type",
      label: "What kind of territory protection will you offer?",
      type: "select",
      required: true,
      helpText:
        "This sets how exclusive the franchisee's territory is, and it's the single biggest decision in your franchise agreement.",
      options: [
        { value: "exclusive", label: "Exclusive (no other franchised or corporate units inside)" },
        { value: "non_exclusive", label: "Non-exclusive (franchisor can place additional units)" },
        {
          value: "protected",
          label: "Protected (franchisor can't place inside, but can grant outside)",
        },
        {
          value: "point_of_interest",
          label: "Point-of-interest (franchisee gets a designated address only, no surrounding territory)",
        },
      ],
      category: "Territory",
    },
    {
      name: "territory_radius_miles",
      label: "How big is the territory around each unit?",
      type: "number",
      placeholder: "3",
      helpText:
        "If a territory is exclusive or protected, this is the radius around the unit in miles. Retail concepts are often 1 to 5 miles, and service-based concepts tend to be larger.",
      category: "Territory",
    },
    {
      name: "territory_population_count",
      label: "Do you define territory by population instead of radius?",
      type: "integer",
      placeholder: "50000",
      helpText:
        "Some franchisors define territory by population, like one unit per 50,000 residents, instead of a fixed radius. Skip this if you're using a radius.",
      category: "Territory",
      advanced: true,
    },

    // ── Multi-unit & development ────────────────────────────────────────────
    {
      name: "multi_unit_required",
      label: "Will you require multi-unit deals?",
      type: "boolean",
      helpText:
        "Some concepts only sell to multi-unit operators. Leave this false if you accept single-unit franchisees.",
      category: "Multi-unit",
      advanced: true,
    },
    {
      name: "area_development_fee_dollars",
      label: "Do you charge an area development fee?",
      type: "currency",
      placeholder: "20000",
      helpText:
        "This is an optional separate fee for area developers, who are multi-unit operators committing to a whole region. Skip it if you're not offering ADAs.",
      category: "Multi-unit",
      advanced: true,
    },
    {
      name: "master_franchise_available",
      label: "Will you offer master franchise opportunities?",
      type: "boolean",
      helpText: "These are sub-franchising rights for international expansion. Most emerging franchisors say no.",
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
 * generate complaints, and drag the brand down. This section is where
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
const FRANCHISEE_PROFILE: SectionSchema = {
  slug: "franchisee_profile",
  title: "Who You Want as a Franchisee",
  description:
    "The kind of person who should own one of your locations. Their financial profile, what they've done before, how they'll run it, and (just as important) who they aren't.",
  compilesInto:
    "FDD Item 20, Franchisee Scoring Matrix, Discovery Day pre-qualification.",
  fields: [
    // ── Financial profile ──────────────────────────────────────────────────
    {
      name: "minimum_liquid_capital_dollars",
      label: "How much liquid capital must a candidate have?",
      type: "currency",
      required: true,
      placeholder: "100000",
      helpText:
        "This is how much cash a candidate needs to have on hand. We suggest 30% of the high end of your initial investment range, and you can adjust it if you want a tighter or looser threshold.",
      category: "Financial profile",
      suggestedFrom: {
        kind: "derived",
        deps: ["unit_economics.initial_investment_high_dollars"],
        formula: "30% of the high end of your initial investment",
      },
    },
    {
      name: "minimum_net_worth_dollars",
      label: "What net worth must a candidate have?",
      type: "currency",
      required: true,
      placeholder: "500000",
      helpText:
        "This is the total net worth a candidate needs, including cash, investments, and equity in real estate. We suggest 3.5 times the liquid capital requirement, which is the franchise-industry default.",
      category: "Financial profile",
      suggestedFrom: {
        kind: "derived",
        deps: ["minimum_liquid_capital_dollars"],
        formula: "3.5× the required liquid capital",
      },
    },
    {
      name: "minimum_credit_score",
      label: "What's the minimum credit score you'll accept?",
      type: "integer",
      placeholder: "680",
      helpText:
        "We default to 680, which is the franchise-industry standard for SBA-financed deals. Lower scores can usually still qualify with the right bank, but they narrow the candidate pool.",
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
      label: "Are you open to SBA-financed candidates?",
      type: "boolean",
      helpText:
        "Most emerging franchisors say yes here, since saying no narrows the candidate pool dramatically.",
      category: "Financial profile",
      advanced: true,
    },

    // ── Experience required ────────────────────────────────────────────────
    {
      name: "prior_business_ownership_required",
      label: "Do candidates need to have owned a business before?",
      type: "boolean",
      helpText:
        "Selling only to experienced operators reduces the failure rate, but it also cuts the candidate pool by about 70%.",
      category: "Experience",
    },
    {
      name: "prior_industry_experience_required",
      label: "Do candidates need industry experience?",
      type: "boolean",
      helpText:
        "This is whether candidates need to have worked in your specific industry before. Most franchisors do not require this, since operations training is what bridges the gap.",
      category: "Experience",
    },
    {
      name: "minimum_years_business_experience",
      label: "How many years of business experience do you require?",
      type: "integer",
      placeholder: "3",
      helpText:
        "This one is optional, so skip it if you don't require prior business ownership. The typical range is 3 to 7 years.",
      category: "Experience",
      advanced: true,
    },
    {
      name: "specific_experience_notes",
      label: "What kind of background actually helps a candidate run this concept well?",
      type: "textarea",
      placeholder:
        "QSR, hospitality, or specialty retail backgrounds adapt fastest. Pure corporate finance backgrounds tend to struggle with the daily-ops side.",
      helpText:
        "Use this for free-form notes that Discovery Day screeners can reference. Tell us what kind of background actually transfers to running your concept well.",
      category: "Experience",
      advanced: true,
    },

    // ── How they'll run it ─────────────────────────────────────────────────
    {
      name: "engagement_model",
      label: "How will franchisees run their location?",
      type: "select",
      required: true,
      helpText:
        "This drives nearly every other qualification downstream. Owner-operators show up daily, semi-absentees hire a manager, and absentees hire a whole leadership team and visit monthly.",
      options: [
        { value: "owner_operator", label: "Owner-operator (full-time, on-site)" },
        { value: "semi_absentee", label: "Semi-absentee (10-25 hrs/week + GM)" },
        { value: "absentee", label: "Absentee (investor with operations team)" },
        { value: "flexible", label: "Flexible (any of the above)" },
      ],
      category: "How they'll run it",
    },
    {
      name: "minimum_hours_per_week",
      label: "How many hours per week does an owner-operator need to work?",
      type: "integer",
      placeholder: "40",
      helpText:
        "If you require owner-operators, set the minimum number of hours per week here. Skip this if you accept semi-absentee or absentee operators.",
      category: "How they'll run it",
      advanced: true,
    },
    {
      name: "relocation_required",
      label: "Do franchisees need to live near the location?",
      type: "boolean",
      helpText:
        "This is usually true for owner-operator concepts and false for semi-absentee or absentee setups.",
      category: "How they'll run it",
      advanced: true,
    },

    // ── Character & fit ────────────────────────────────────────────────────
    {
      name: "ideal_traits",
      label: "What traits make someone a great franchisee?",
      type: "list_short",
      placeholder:
        "Comfortable with structure and brand standards\nGenuinely likes serving customers daily\nHas savings to weather a slow ramp\nWants to own the business, not be owned by it",
      helpText:
        "List three to six traits, the kind that would surface on a Jason-style strategy call. Be specific enough that a Discovery Day screener can ask about each one.",
      category: "Character & fit",
    },
    {
      name: "common_disqualifiers",
      label: "What rules someone out?",
      type: "list_short",
      placeholder:
        "Looking for a 'set it and forget it' investment\nExpects to renegotiate the franchise agreement\nHas been an absentee owner of a struggling business\nWants to modify the menu or branding",
      helpText:
        "These are the deal-killers that separate a great-on-paper candidate from a real fit. They're critical for Discovery Day, since these are the questions a franchisee will answer in their own words.",
      category: "Character & fit",
    },
    {
      name: "candidate_persona_narrative",
      label: "How would you describe your ideal franchisee in your own words?",
      type: "textarea",
      placeholder:
        "Mid-career operator, 35-55, who's been a GM or owner of a service business and wants something they can hand to their kids in 15 years. Not chasing a quick exit, but building a portfolio.",
      helpText:
        "Write one or two paragraphs describing your ideal candidate as a person rather than a checklist. We use this in marketing copy and the Discovery Day pre-qual.",
      category: "Character & fit",
    },

    // ── Recruitment ────────────────────────────────────────────────────────
    {
      name: "target_recruitment_channels",
      label: "Where will you find your franchisees?",
      type: "list_short",
      placeholder:
        "Franchise broker network\nIndustry trade shows\nReferrals from existing locations\nLinkedIn (mid-career operators)",
      helpText:
        "List three to five channels. This drives where the marketing team focuses in year one.",
      category: "Recruitment",
      advanced: true,
    },
    {
      name: "typical_decision_timeline_days",
      label: "How many days does it take to go from first call to signed agreement?",
      type: "integer",
      placeholder: "60",
      helpText:
        "We use this for sales forecasting and capacity planning. The typical range for emerging franchisors is 45 to 120 days.",
      category: "Recruitment",
      advanced: true,
    },

    // ── Discovery Day & screening ──────────────────────────────────────────
    {
      name: "discovery_day_format",
      label: "What format will your Discovery Day take?",
      type: "select",
      helpText:
        "This is how candidates meet you and the team before signing. In-person at HQ is the gold standard for emerging franchisors, since it builds the trust that closes the deal.",
      options: [
        { value: "in_person_hq", label: "In-person at headquarters" },
        { value: "virtual", label: "Virtual / video" },
        { value: "hybrid", label: "Hybrid (virtual screen, in-person decision day)" },
      ],
      category: "Discovery Day",
    },
    {
      name: "discovery_day_duration_hours",
      label: "How long will Discovery Day run?",
      type: "integer",
      placeholder: "6",
      helpText: "The typical range is 4 to 8 hours, which is long enough to see how candidates react under fatigue.",
      category: "Discovery Day",
      advanced: true,
    },
    {
      name: "background_check_required",
      label: "Will you require a background check?",
      type: "boolean",
      helpText:
        "Most franchisors say yes here, since it protects the brand if a candidate has a criminal or fraud history.",
      category: "Discovery Day",
      advanced: true,
    },
    {
      name: "credit_check_required",
      label: "Will you require a credit check?",
      type: "boolean",
      helpText: "This is standard for any deal that requires SBA financing.",
      category: "Discovery Day",
      advanced: true,
    },
    {
      name: "references_required_count",
      label: "How many references must each candidate provide?",
      type: "integer",
      placeholder: "3",
      helpText:
        "A typical setup is 3 personal references plus 2 business references.",
      category: "Discovery Day",
      advanced: true,
    },
  ],
};

// ============================================================================
// REMAINING 11 SECTION SCHEMAS — Phase 1.5a step 3
//
// Designed in one pass after Eric+Jason aligned on the foundational four.
// Audit-pending: each schema notes whether it's been cross-checked against
// the High Point Coffee bundle / original capability documents. Most are
// designed from FDD requirements + general franchise practice — Jason
// should review for fields specific to TFB's framework that I've missed.
// ============================================================================

// ----------------------------------------------------------------------------
// HEAVY STRUCTURED — typed values + lists drive these sections
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
const VENDOR_SUPPLY_CHAIN: SectionSchema = {
  slug: "vendor_supply_chain",
  title: "Approved Suppliers",
  description:
    "Who franchisees buy from. The vendor list is one of the franchisor's strongest levers, both for quality control and for negotiating better prices as you scale.",
  compilesInto:
    "Operations Manual §14, Build-Out Manual procurement appendix, FDD Item 8.",
  fields: [
    {
      name: "approved_vendors",
      label: "Who are your approved vendors?",
      type: "list_long",
      required: true,
      placeholder:
        "Royal Cup Coffee (green beans) — Birmingham, AL — net-30 terms, $3,200 minimum order, 5-day delivery\nKenco Restaurant Supply (paper goods) — net-30, free delivery over $250\nLavazza (espresso machines) — leasing only, $385/month with maintenance",
      helpText:
        "Add one vendor per line, including the name, what they supply, and the contract terms. This is the list every franchisee gets when they sign on.",
      category: "Vendors",
    },
    {
      name: "alternate_vendors",
      label: "Who are your backup vendors?",
      type: "list_long",
      placeholder:
        "S&D Coffee (green beans) — only for Royal Cup outages\nWebstaurantStore (paper goods) — for orders below the Kenco minimum",
      helpText:
        "These are the backup vendors franchisees can use when the primary one is unavailable. They're optional but worth having, since every franchisor eventually has a moment where the primary vendor can't deliver.",
      category: "Vendors",
      advanced: true,
    },
    {
      name: "exclusive_purchase_required_items",
      label: "What items must franchisees buy from your approved vendors?",
      type: "list_short",
      placeholder:
        "Coffee beans\nMilk and dairy\nBranded packaging and cups",
      helpText:
        "These are the items franchisees can't source anywhere else. They're the brand-defining inputs, and FDD Item 8 will list each of them explicitly.",
      category: "Procurement rules",
    },
    {
      name: "items_franchisee_can_source_locally",
      label: "What items can franchisees source themselves?",
      type: "list_short",
      placeholder:
        "Cleaning supplies (must meet spec)\nFresh pastries (if from a local bakery you've vetted)\nNon-coffee retail beans",
      helpText:
        "These are items where local sourcing is fine, usually because the shipping cost outweighs the value. The spec still has to be met.",
      category: "Procurement rules",
      advanced: true,
    },
    {
      name: "rebate_arrangements",
      label: "Do you have rebate arrangements with any vendors?",
      type: "textarea",
      placeholder:
        "Royal Cup pays 1.5% rebate on franchisee purchases, paid quarterly to the franchisor. Disclosed in FDD Item 8.",
      helpText:
        "Most emerging franchisors don't have these yet. If you do, they have to be disclosed in FDD Item 8, since failing to disclose them is a serious compliance issue.",
      category: "Procurement rules",
      advanced: true,
    },
    {
      name: "minimum_order_frequency",
      label: "How often must franchisees place orders?",
      type: "select",
      options: [
        { value: "weekly", label: "Weekly" },
        { value: "biweekly", label: "Biweekly" },
        { value: "monthly", label: "Monthly" },
        { value: "as_needed", label: "As needed (no minimum cadence)" },
      ],
      helpText:
        "This is how often franchisees have to order, and it drives both inventory expectations and vendor pricing tiers.",
      category: "Procurement rules",
      advanced: true,
    },
    {
      name: "inventory_management_system",
      label: "What inventory management system do franchisees use?",
      type: "text",
      placeholder: "MarketMan",
      helpText:
        "Set this if you require a specific tool. Skip it if you don't mandate one.",
      category: "Procurement rules",
      advanced: true,
    },
    {
      name: "vendor_change_approval_process",
      label: "How does a franchisee get a new vendor approved?",
      type: "textarea",
      placeholder:
        "Franchisees can propose alternate vendors via the franchisee portal. Franchisor reviews within 14 days, and approval requires the vendor to meet documented quality and food-safety standards.",
      helpText:
        "Describe what a franchisee has to do when they want to use a vendor that isn't on the approved list. This is often more important than the list itself.",
      category: "Procurement rules",
      advanced: true,
    },
    {
      name: "quality_inspection_cadence",
      label: "How often do you inspect your vendors for quality?",
      type: "text",
      placeholder: "Annual on-site, plus quarterly product samples",
      helpText:
        "This is how often you or a third party inspect approved vendors. It's optional, but having a clear cadence signals operational maturity.",
      category: "Quality control",
      advanced: true,
    },
    {
      name: "spec_documents",
      label: "Do you maintain written specs for each approved product?",
      type: "boolean",
      helpText:
        "Written specs look like \"single-origin Arabica, 18% screen size, certified organic.\" They're required for any item that has substitution flexibility.",
      category: "Quality control",
      advanced: true,
    },
    {
      name: "preferred_payment_terms",
      label: "What payment terms do you use with vendors?",
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
      label: "Do all orders flow through the franchisor?",
      type: "boolean",
      helpText:
        "Some franchisors have every order flow through them, where they buy and resell to franchisees. Most franchisors instead let franchisees buy directly from approved vendors. Each approach has its own FDD Item 8 disclosure.",
      category: "Financial terms",
      advanced: true,
    },
    {
      name: "supply_chain_assumptions_narrative",
      label: "Is there anything else about your supply chain we should know?",
      type: "textarea",
      placeholder:
        "Currently sourcing 80% of green beans from a single supplier. Diversifying to two roaster partners over 2025–2026 to reduce concentration risk.",
      helpText:
        "Use this for free-form notes about risks, planned changes, or anything else an attorney or franchisee should know.",
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
const MARKETING_FUND: SectionSchema = {
  slug: "marketing_fund",
  title: "Marketing Fund Governance",
  description:
    "How the brand-wide marketing fund is collected, governed, and spent. The rules franchisees agree to when they sign on.",
  compilesInto: "Marketing Fund Manual, FDD Item 11.",
  fields: [
    // ── Structure ─────────────────────────────────────────────────────────
    {
      name: "fund_governance_model",
      label: "Who controls the marketing fund?",
      type: "select",
      required: true,
      helpText:
        "There are three common shapes. Franchisor-controlled is simplest for emerging franchisors, advisory boards add legitimacy as you scale, and cooperative funds are required in some states.",
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
      label: "How many franchisees sit on the advisory board?",
      type: "integer",
      placeholder: "5",
      helpText:
        "This is optional unless you picked an advisory or cooperative model.",
      category: "Structure",
      advanced: true,
    },
    {
      name: "board_election_method",
      label: "How are board members selected?",
      type: "textarea",
      placeholder:
        "Three seats elected by franchisees annually, and two seats appointed by the franchisor.",
      helpText: "This is optional, so skip it if your fund is franchisor-controlled.",
      category: "Structure",
      advanced: true,
    },
    {
      name: "board_term_length_years",
      label: "How long is each board term?",
      type: "integer",
      placeholder: "2",
      category: "Structure",
      advanced: true,
    },

    // ── Spending rules ────────────────────────────────────────────────────
    {
      name: "approved_uses",
      label: "What can the fund be spent on?",
      type: "list_short",
      required: true,
      placeholder:
        "National brand campaigns\nDigital media buys (paid social, search)\nCreative production for franchisee use\nMarket research\nPR and trade press",
      helpText:
        "This list is typically broad, and the fund's purpose statement in your FDD will reference each item.",
      category: "Spending rules",
    },
    {
      name: "excluded_uses",
      label: "What can the fund NOT be spent on?",
      type: "list_short",
      placeholder:
        "Franchisor's own salary or overhead\nLocal-market advertising for a single unit\nNew-franchisee recruitment marketing\nLitigation costs",
      helpText:
        "Typical exclusions are anything that benefits the franchisor more than the franchisees, or that's a single-unit local effort. Most attorneys will require explicit exclusions like these.",
      category: "Spending rules",
    },
    {
      name: "minimum_brand_spend_pct",
      label: "What percentage of the fund must go to brand-building rather than admin?",
      type: "percentage",
      placeholder: "85",
      helpText:
        "This is the share of the fund that has to go to actual marketing instead of administrative overhead. The industry standard is 80% to 90%.",
      category: "Spending rules",
      min: 0,
      max: 100,
      advanced: true,
    },

    // ── Reporting ─────────────────────────────────────────────────────────
    {
      name: "reporting_cadence",
      label: "How often will you report fund activity to franchisees?",
      type: "select",
      options: [
        { value: "monthly", label: "Monthly" },
        { value: "quarterly", label: "Quarterly" },
        { value: "annually", label: "Annually only" },
      ],
      helpText:
        "This is how often franchisees get to see what the fund spent. Quarterly is the franchise-industry standard.",
      category: "Reporting & audit",
    },
    {
      name: "audit_required",
      label: "Will the fund get an independent audit?",
      type: "boolean",
      helpText:
        "Most state franchise registrations require an annual independent audit of the fund, so this is yes for almost every emerging franchisor.",
      category: "Reporting & audit",
    },
    {
      name: "audit_frequency",
      label: "How often will the audit happen?",
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
      label: "How do unspent funds carry over from year to year?",
      type: "textarea",
      placeholder:
        "Unspent funds carry over to the following year and must be spent on approved uses within 24 months. After 24 months, unspent funds may be allocated to a brand-development reserve.",
      helpText:
        "By default, unspent funds carry forward indefinitely. Some franchisors set a use-it-or-lose-it deadline instead. Whatever you choose has to be disclosed in FDD Item 11.",
      category: "Reporting & audit",
      advanced: true,
    },

    // ── Local marketing ───────────────────────────────────────────────────
    {
      name: "local_marketing_spend_required",
      label: "Will franchisees also be required to spend on local marketing?",
      type: "boolean",
      helpText:
        "This is whether franchisees have a local-marketing minimum on top of the brand fund. The percentage itself lives in `franchise_economics.local_marketing_minimum_pct`.",
      category: "Local marketing",
      advanced: true,
    },
    {
      name: "local_marketing_pre_approval_required",
      label: "Do franchisee-created local ads need pre-approval?",
      type: "boolean",
      helpText:
        "Most franchisors require approval of any creative that uses the brand, since it protects against off-brand or non-compliant local ads.",
      category: "Local marketing",
      advanced: true,
    },

    // ── Initial campaign ──────────────────────────────────────────────────
    {
      name: "grand_opening_marketing_required",
      label: "What's required for grand-opening marketing?",
      type: "textarea",
      placeholder:
        "Franchisees must spend a minimum of $5,000 on grand-opening marketing in the 30 days before and after opening, using franchisor-approved creative.",
      helpText:
        "Most franchisors mandate a minimum opening spend. Whatever you require shows up in FDD Item 6 as a required expenditure.",
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
const EMPLOYEE_HANDBOOK: SectionSchema = {
  slug: "employee_handbook",
  title: "Employee Handbook",
  description:
    "The HR template each location uses. What the franchisor mandates, what the franchisee can adapt, and what state law layers on top.",
  compilesInto: "Employee Handbook deliverable, Operations Manual people-management section.",
  fields: [
    // ── Hours & scheduling ───────────────────────────────────────────────
    {
      name: "standard_full_time_hours_per_week",
      label: "How many hours per week count as full-time?",
      type: "integer",
      placeholder: "32",
      helpText:
        "This sets what counts as full-time at your locations and drives benefits eligibility. Most franchisors set this between 30 and 35 hours.",
      category: "Hours & scheduling",
    },
    {
      name: "minimum_shifts_per_week",
      label: "How many shifts per week must employees work to stay on payroll?",
      type: "integer",
      placeholder: "2",
      helpText: "Below this number, employees are reclassified or terminated. This field is optional.",
      category: "Hours & scheduling",
      advanced: true,
    },
    {
      name: "scheduling_software",
      label: "What scheduling software do you require?",
      type: "text",
      placeholder: "When I Work",
      helpText: "Set this if you mandate a tool. Skip it if franchisees pick their own.",
      category: "Hours & scheduling",
      advanced: true,
    },

    // ── Compensation ─────────────────────────────────────────────────────
    {
      name: "minimum_starting_wage_dollars_per_hour",
      label: "What's the minimum starting wage per hour?",
      type: "currency",
      placeholder: "16",
      helpText:
        "This is the brand-wide floor. Franchisees can pay more but not less, and it drives the labor percentage in your unit economics.",
      category: "Compensation",
    },
    {
      name: "tip_pooling_policy",
      label: "What's your tip pooling policy?",
      type: "select",
      options: [
        { value: "no_tip_pooling", label: "No tip pooling (individuals keep their own)" },
        { value: "shift_pool", label: "Pooled by shift" },
        { value: "weekly_pool", label: "Pooled weekly across all employees" },
        { value: "no_tipping", label: "No tipping accepted" },
      ],
      helpText:
        "This has wage-and-hour-law implications, so franchisees should also confirm against state law before applying it.",
      category: "Compensation",
      advanced: true,
    },
    {
      name: "performance_review_cadence",
      label: "How often will employees get performance reviews?",
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
      label: "How many PTO days per year do employees get after their first year?",
      type: "integer",
      placeholder: "10",
      helpText:
        "This is the floor that franchisees inherit. Some states like California, Massachusetts, and New York require more, specifically for sick leave.",
      category: "Benefits",
    },
    {
      name: "paid_sick_days_per_year",
      label: "How many paid sick days per year do employees get?",
      type: "integer",
      placeholder: "5",
      helpText:
        "Most state laws treat this as separate from PTO, and many states require a minimum.",
      category: "Benefits",
      advanced: true,
    },
    {
      name: "paid_holidays",
      label: "Which paid holidays do you observe?",
      type: "list_short",
      placeholder:
        "New Year's Day\nMemorial Day\nIndependence Day\nLabor Day\nThanksgiving\nChristmas",
      category: "Benefits",
      advanced: true,
    },
    {
      name: "health_benefits_offered",
      label: "Will locations be required to offer health benefits?",
      type: "boolean",
      helpText:
        "This is whether each location has to offer health benefits to qualifying employees. Most franchisors leave this decision to the franchisee.",
      category: "Benefits",
      advanced: true,
    },
    {
      name: "retirement_benefits_offered",
      label: "Will locations be required to offer a retirement plan?",
      type: "boolean",
      helpText:
        "This covers whether locations have to offer a 401(k) or similar plan. SECURE Act state mandates may apply.",
      category: "Benefits",
      advanced: true,
    },

    // ── Conduct & culture ────────────────────────────────────────────────
    {
      name: "uniform_requirements",
      label: "What are your uniform requirements?",
      type: "textarea",
      placeholder:
        "Branded apron with plain black or denim pants. Closed-toe non-slip shoes. Branded cap optional.",
      helpText:
        "These are brand-mandated. Be specific enough that franchisees know exactly what to enforce.",
      category: "Conduct & culture",
    },
    {
      name: "customer_service_standards",
      label: "What are your customer service standards?",
      type: "list_short",
      placeholder:
        "10-second greeting at the door\nFirst name when handing off the order\n4-minute maximum wait time at peak\nNo phone use behind the counter",
      helpText:
        "These are the brand-defining service moments. The Operations Manual will go deeper, and this is your headline list.",
      category: "Conduct & culture",
    },
    {
      name: "social_media_policy",
      label: "What's your social media policy for employees?",
      type: "textarea",
      placeholder:
        "Employees may share branded content with #cypresslane. Personal accounts must clearly state 'opinions are my own.' No customer photos without consent. No discussion of internal operations.",
      category: "Conduct & culture",
      advanced: true,
    },
    {
      name: "non_compete_required",
      label: "Will employees sign a non-compete at hire?",
      type: "boolean",
      helpText:
        "Most franchisors require this for managers but not hourly employees. Enforceability varies a lot by state, so your attorney should review whatever you choose.",
      category: "Conduct & culture",
      advanced: true,
    },

    // ── Termination ──────────────────────────────────────────────────────
    {
      name: "at_will_employment_required",
      label: "Will at-will employment be required?",
      type: "boolean",
      helpText:
        "This is standard for most U.S. franchises (except in Montana), and it's required language in your handbook template.",
      category: "Termination",
      advanced: true,
    },
    {
      name: "termination_appeal_process",
      label: "What's the termination appeal process?",
      type: "textarea",
      placeholder:
        "Terminated employees may request a single review meeting with the franchisee owner within 7 days. Franchisor not involved in individual termination decisions.",
      helpText:
        "This one is optional. Most franchisors don't mandate a process and leave it to franchisee discretion.",
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
const REIMBURSEMENT_POLICY: SectionSchema = {
  slug: "reimbursement_policy",
  title: "Expense Reimbursement Policy",
  description:
    "What franchisees and their managers can expense, at what rates, and what's outside the policy entirely.",
  compilesInto: "Reimbursement Policy deliverable, Operations Manual financial-controls section.",
  fields: [
    // ── Travel ────────────────────────────────────────────────────────────
    {
      name: "mileage_rate_dollars_per_mile",
      label: "What's your mileage reimbursement rate per mile?",
      type: "number",
      placeholder: "0.67",
      helpText:
        "We default to the current IRS standard rate, and most franchisors match it.",
      category: "Travel",
      suggestedFrom: {
        kind: "industry_lookup",
        keyedOn: "industry_category",
        source: "Current IRS standard mileage rate (refreshed annually)",
      },
    },
    {
      name: "meal_per_diem_dollars",
      label: "What's the daily meal per diem?",
      type: "currency",
      placeholder: "75",
      helpText: "This is the per-day cap on meal expenses while traveling. The IRS standard is around $75 for most U.S. cities.",
      category: "Travel",
    },
    {
      name: "lodging_per_diem_dollars",
      label: "What's the nightly lodging per diem?",
      type: "currency",
      placeholder: "200",
      helpText:
        "This is the per-night cap on hotel expenses, and you'll want to set it higher for major-metro travel.",
      category: "Travel",
    },
    {
      name: "airfare_class",
      label: "What airfare class is allowed?",
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
      label: "Above what amount does a single expense need pre-approval?",
      type: "currency",
      placeholder: "500",
      helpText:
        "Anything above this dollar amount needs pre-approval, either from the owner or the franchisor depending on your policy.",
      category: "Approval thresholds",
    },
    {
      name: "monthly_expense_cap_dollars",
      label: "What's the monthly expense cap per role?",
      type: "currency",
      placeholder: "2000",
      helpText: "This is the total monthly expense cap for managers and shift leads. Skip it if you don't set a cap.",
      category: "Approval thresholds",
      advanced: true,
    },

    // ── What is NOT reimbursable ─────────────────────────────────────────
    {
      name: "non_reimbursable_categories",
      label: "What categories are never reimbursable?",
      type: "list_short",
      placeholder:
        "Personal entertainment\nAlcohol (except client meals)\nPersonal travel companion expenses\nGifts over $25 to a single recipient",
      category: "Exclusions",
    },

    // ── Process ───────────────────────────────────────────────────────────
    {
      name: "expense_reporting_software",
      label: "What expense reporting tool do you require?",
      type: "text",
      placeholder: "Expensify",
      helpText: "Set this if you mandate a tool. Skip it if franchisees pick their own.",
      category: "Process",
      advanced: true,
    },
    {
      name: "receipt_required_threshold_dollars",
      label: "Above what amount is a receipt required?",
      type: "currency",
      placeholder: "25",
      helpText: "The IRS standard is $75, but some franchisors set a tighter floor.",
      category: "Process",
      advanced: true,
    },
    {
      name: "reimbursement_payment_schedule",
      label: "How often will expenses be reimbursed?",
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
 * attorney owns the actual FDD drafting; this section captures the
 * strategy that drives their work.
 *
 * Compiles into: Decode the FDD section, Franchise Agreement scaffolding,
 * attorney handoff packet.
 */
const COMPLIANCE_LEGAL: SectionSchema = {
  slug: "compliance_legal",
  title: "FDD Posture & State Strategy",
  description:
    "Where you'll register, where you'll skip, who your attorney is, and how the FDD strategy fits your launch plan.",
  compilesInto: "Decode the FDD, Franchise Agreement scaffolding, attorney handoff packet.",
  fields: [
    // ── State strategy ───────────────────────────────────────────────────
    {
      name: "registration_states",
      label: "Which states will you register your FDD in first?",
      type: "list_short",
      required: true,
      placeholder: "California\nNew York\nIllinois\nVirginia",
      helpText:
        "These are the states where you'll register the FDD and pay the registration fee, usually the states where you want to actively recruit franchisees first. 14 states require full registration, 13 are filing states where you just file without a review, and the rest are non-registration.",
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
      label: "Which filing-only states will you target?",
      type: "list_short",
      placeholder: "Connecticut\nKentucky\nNebraska",
      helpText:
        "These are states that require a franchise filing but no review. They're cheaper and faster than full registration states.",
      category: "State strategy",
      advanced: true,
    },
    {
      name: "non_registration_states",
      label: "Which non-registration states will you target?",
      type: "list_short",
      placeholder: "Texas\nFlorida\nGeorgia\nNorth Carolina",
      helpText:
        "These states have no franchise-specific registration, so you can sell here as soon as your FDD is complete. Most emerging franchisors prioritize them for early growth.",
      category: "State strategy",
      advanced: true,
    },
    {
      name: "exemption_strategy",
      label: "What's your exemption strategy?",
      type: "textarea",
      placeholder:
        "Pursuing the large-franchisor exemption (CA Corp Code §31101) once we hit 25 franchisees and $5M minimum net worth. Until then, full registration in all 14 registration states.",
      helpText:
        "This is optional for now and matters more once you scale. Federal and state exemptions can reduce your ongoing registration burden.",
      category: "State strategy",
      advanced: true,
    },

    // ── Attorney ─────────────────────────────────────────────────────────
    {
      name: "attorney_name",
      label: "Who's your franchise attorney?",
      type: "text",
      placeholder: "Sarah Lee, Esq.",
      helpText:
        "This is the attorney drafting and filing your FDD. Their name is required by every state registration application.",
      category: "Attorney",
    },
    {
      name: "attorney_firm",
      label: "What's the name of their law firm?",
      type: "text",
      placeholder: "Lee & Associates Franchise Law",
      category: "Attorney",
    },
    {
      name: "attorney_email",
      label: "What's your attorney's email?",
      type: "email",
      placeholder: "sarah@leefranchiselaw.com",
      category: "Attorney",
    },
    {
      name: "attorney_phone",
      label: "What's your attorney's phone number?",
      type: "text",
      placeholder: "(555) 123-4567",
      category: "Attorney",
      advanced: true,
    },

    // ── Compliance dates ─────────────────────────────────────────────────
    {
      name: "fdd_target_completion_date",
      label: "When do you want your FDD ready for filing?",
      type: "date",
      helpText:
        "Most emerging franchisors target 90 to 120 days after they finish the underlying sections.",
      category: "Timeline",
    },
    {
      name: "first_franchisee_target_date",
      label: "When do you want your first franchisee signed?",
      type: "date",
      helpText:
        "This is your goal date, and it drives the marketing and Discovery Day cadence backward from here.",
      category: "Timeline",
      advanced: true,
    },

    // ── Insurance ────────────────────────────────────────────────────────
    {
      name: "general_liability_minimum_dollars",
      label: "What's the minimum general liability insurance franchisees must carry?",
      type: "currency",
      placeholder: "1000000",
      helpText:
        "This is the minimum general liability coverage franchisees have to carry. The industry standard is $1M per occurrence and $2M aggregate.",
      category: "Insurance requirements",
      advanced: true,
    },
    {
      name: "additional_insurance_required",
      label: "What other insurance do franchisees need?",
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
 * Compiles into: Operations Manual §3-12 (daily operations sections),
 * Discovery Day operations walkthrough.
 */
const OPERATING_MODEL: SectionSchema = {
  slug: "operating_model",
  title: "Daily Operations",
  description:
    "How a location actually runs day-to-day. Hours, staffing, the rhythm a manager owns, and the specifics that make your concept work.",
  compilesInto: "Operations Manual §3-12, Discovery Day operations walkthrough.",
  fields: [
    {
      name: "standard_hours_of_operation",
      label: "What are your standard hours of operation?",
      type: "textarea",
      placeholder:
        "Mon–Fri 6am–4pm\nSat–Sun 7am–4pm\nClosed: New Year's Day, Thanksgiving, Christmas",
      helpText:
        "These are the brand-mandated hours. Franchisees can extend them with approval but can't open later or close earlier than what you set here.",
      category: "Schedule",
    },
    {
      name: "peak_hours",
      label: "When are your peak hours?",
      type: "text",
      placeholder: "Weekday 7am–10am, Weekend 8am–11am",
      helpText:
        "These are the times when your locations get busiest. They drive staffing and throughput planning.",
      category: "Schedule",
      advanced: true,
    },
    {
      name: "staff_per_shift_typical",
      label: "How many staff are on a typical shift?",
      type: "integer",
      placeholder: "4",
      helpText:
        "Include the manager in this count. It drives the labor percentage in your unit economics.",
      category: "Schedule",
    },
    {
      name: "staff_per_shift_peak",
      label: "How many staff are on a peak-hour shift?",
      type: "integer",
      placeholder: "6",
      category: "Schedule",
      advanced: true,
    },
    {
      name: "key_kpis_tracked_daily",
      label: "What KPIs do you track daily?",
      type: "list_short",
      placeholder:
        "Transaction count\nAverage ticket\nLabor as % of sales\nWaste $\nCustomer satisfaction (NPS)",
      helpText:
        "These are the numbers a franchisee owner watches every morning. They become the daily-report dashboard in the Operations Manual.",
      category: "Metrics",
    },
    {
      name: "daily_rituals",
      label: "What are your daily open and close rituals?",
      type: "textarea",
      placeholder:
        "Open: temperature checks on equipment, brew calibration, first-shift briefing on specials.\nClose: deep clean of espresso machines, daily cash reconciliation, next-day prep.",
      helpText:
        "These are the repeatable rituals that make the brand consistent across locations. The full checklists live in the Operations Manual, and this is the headline summary.",
      category: "Cadence",
    },
    {
      name: "operations_software_required",
      label: "What operations software do you require?",
      type: "list_short",
      placeholder:
        "Toast (POS)\nWhen I Work (scheduling)\nMarketMan (inventory)",
      helpText:
        "These are the tools franchisees have to use, and each one is also a recurring cost they take on.",
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
 * form. For service businesses (non-restaurant), this section pivots
 * to "service offerings" — same structure, different content.
 *
 * Compiles into: Operations Manual §13 (Product Specs), Barista /
 * Operator Certification Program training materials.
 */
const RECIPES_AND_MENU: SectionSchema = {
  slug: "recipes_and_menu",
  title: "Product & Service Specs",
  description:
    "What you sell, in detail. The menu (or service catalog), the signature items, and how they're made the same way every time.",
  compilesInto: "Operations Manual §13, certification program training materials.",
  fields: [
    {
      name: "menu_item_count",
      label: "How many items are on your menu?",
      type: "integer",
      placeholder: "32",
      helpText:
        "Count the total SKUs or services you offer. Higher counts make training and inventory harder, and many franchisors trim the menu before they franchise.",
      category: "Scope",
    },
    {
      name: "signature_items",
      label: "What signature items are you known for?",
      type: "list_short",
      placeholder:
        "Cypress Lane single-origin pour-over\nThe Oxford Mocha\nButtermilk biscuit and gravy",
      helpText:
        "List three to five items that identify the brand. We feature them in marketing and Discovery Day.",
      category: "Scope",
    },
    {
      name: "price_range_low_dollars",
      label: "What's the price of your cheapest item?",
      type: "currency",
      placeholder: "3.50",
      helpText:
        "This is the cheapest item on your menu, and it shapes how accessible your concept feels.",
      category: "Pricing",
    },
    {
      name: "price_range_high_dollars",
      label: "What's the price of your most expensive item?",
      type: "currency",
      placeholder: "12.00",
      category: "Pricing",
    },
    {
      name: "average_ticket_dollars",
      label: "What's your average ticket size?",
      type: "currency",
      placeholder: "8.50",
      helpText:
        "This is the average dollar amount per transaction, and it drives the AUV math in your unit economics.",
      category: "Pricing",
    },
    {
      name: "pricing_strategy",
      label: "How will franchisees set their prices?",
      type: "select",
      options: [
        { value: "uniform_brand_wide", label: "Uniform across all locations (brand-mandated)" },
        { value: "tiered_by_market", label: "Tiered by market (urban/suburban/rural)" },
        { value: "franchisee_discretion_within_band", label: "Franchisee discretion within a brand-set band" },
        { value: "fully_franchisee_set", label: "Franchisee fully sets local pricing" },
      ],
      helpText:
        "This sets how franchisees are allowed to price. Federal antitrust law generally prohibits franchisors from fixing resale prices, so most concepts use suggested pricing or banded floors and ceilings. Confirm whatever you choose with your attorney.",
      category: "Pricing",
      advanced: true,
    },
    {
      name: "recipe_book_status",
      label: "What's the status of your recipe and spec book?",
      type: "select",
      options: [
        { value: "complete", label: "Complete and tested at scale" },
        { value: "complete_untested", label: "Complete but only at corporate locations" },
        { value: "in_progress", label: "In progress" },
        { value: "not_started", label: "Not yet started" },
      ],
      required: true,
      helpText:
        "This drives your readiness, and it's Jason's smell test for whether a concept is franchisable. If your answer is 'Not yet started,' that's a flag we'd want to address before recruiting franchisees.",
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
 * Compiles into: Train Your Team section (currently empty in the
 * existing capability registry), FDD Item 11 (training section),
 * Operations Manual training appendix.
 */
const TRAINING_PROGRAM: SectionSchema = {
  slug: "training_program",
  title: "Training & Certification",
  description:
    "How new franchisees and their teams learn the system. The first few weeks are the difference between a great franchisee and a struggling one.",
  compilesInto: "Train Your Team section, FDD Item 11 training section, Operations Manual training appendix.",
  fields: [
    // ── Initial training ─────────────────────────────────────────────────
    {
      name: "initial_training_duration_days",
      label: "How many days of initial training will franchisees go through?",
      type: "integer",
      required: true,
      placeholder: "10",
      helpText:
        "This is how long the franchisee owner or GM trains before opening. The industry-typical range is 5 to 14 days.",
      category: "Initial training",
    },
    {
      name: "initial_training_format",
      label: "What format will initial training take?",
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
        "This is where training happens. It drives the disclosures in FDD Item 6 (the initial fees that include training travel) and Item 11.",
      category: "Initial training",
    },
    {
      name: "initial_training_attendees",
      label: "Who must attend initial training?",
      type: "list_short",
      placeholder:
        "Franchisee owner (required)\nGeneral manager (required)\nUp to 2 additional managers (optional)",
      category: "Initial training",
    },
    {
      name: "training_travel_at_franchisee_expense",
      label: "Will franchisees pay their own travel costs for training?",
      type: "boolean",
      helpText:
        "This is almost always yes for emerging franchisors, and the cost shows up in the FDD Item 7 initial-investment estimate.",
      category: "Initial training",
      advanced: true,
    },

    // ── Opening support ──────────────────────────────────────────────────
    {
      name: "opening_support_days_on_site",
      label: "How many days will your team be on-site at opening?",
      type: "integer",
      placeholder: "5",
      helpText:
        "This is how long a franchisor representative is at the franchisee's location during opening week. The industry-typical range is 3 to 7 days.",
      category: "Opening support",
    },
    {
      name: "opening_support_team_size",
      label: "How many team members will you send on-site?",
      type: "integer",
      placeholder: "2",
      category: "Opening support",
      advanced: true,
    },

    // ── Ongoing training ─────────────────────────────────────────────────
    {
      name: "ongoing_training_required",
      label: "Will you require ongoing training?",
      type: "boolean",
      helpText:
        "This is whether franchisees have to attend recurring training, like an annual conference or monthly webinars.",
      category: "Ongoing",
    },
    {
      name: "annual_conference_required",
      label: "Will you require franchisees to attend an annual conference?",
      type: "boolean",
      helpText:
        "Most concepts have one. Franchisee attendance is usually mandatory and at the franchisee's expense, which gets disclosed in FDD Item 6.",
      category: "Ongoing",
      advanced: true,
    },

    // ── Certification ────────────────────────────────────────────────────
    {
      name: "certification_required",
      label: "Will you require certification to operate?",
      type: "boolean",
      helpText:
        "This covers whether franchisees and key staff have to pass a certification exam before opening or being authorized to perform key functions.",
      category: "Certification",
    },
    {
      name: "certification_levels",
      label: "What certification levels do you offer?",
      type: "list_short",
      placeholder:
        "Owner / GM (required to open)\nLead Barista (required to handle bar alone)\nShift Manager (required to manage a shift)",
      helpText:
        "If you run a tiered certification program, list the levels here. Each level usually has its own training and exam.",
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
const TERRITORY_REAL_ESTATE: SectionSchema = {
  slug: "territory_real_estate",
  title: "Site Selection & Territory",
  description:
    "What makes a good location for your concept. The criteria a franchisee uses to pick a site, and the rules that protect them once they sign.",
  compilesInto: "Site Selection / Build-Out Manual, FDD Item 12, per-market trade-area reports.",
  fields: [
    // ── Site criteria ────────────────────────────────────────────────────
    {
      name: "ideal_population_per_unit",
      label: "What's the ideal population per unit?",
      type: "integer",
      placeholder: "50000",
      helpText:
        "This is the population within the trade area needed to support a unit. We suggest a range from your industry, and you can adjust it based on your existing-location experience.",
      category: "Site criteria",
      suggestedFrom: {
        kind: "industry_lookup",
        keyedOn: "industry_category",
        source: "Industry-typical trade-area population thresholds",
      },
    },
    {
      name: "ideal_household_income_min_dollars",
      label: "What's the minimum median household income you need in a trade area?",
      type: "currency",
      placeholder: "55000",
      helpText:
        "This is the median household income needed in the trade area to support your price point, and it drives site selection in lower-income markets.",
      category: "Site criteria",
      suggestedFrom: {
        kind: "industry_lookup",
        keyedOn: "industry_category",
        source: "Industry-typical income thresholds for this concept type",
      },
    },
    {
      name: "target_square_footage_low",
      label: "What's the smallest footprint you'd accept?",
      type: "integer",
      placeholder: "1400",
      category: "Site criteria",
    },
    {
      name: "target_square_footage_high",
      label: "What's the largest footprint you'd accept?",
      type: "integer",
      placeholder: "1800",
      category: "Site criteria",
    },
    {
      name: "site_type_preferences",
      label: "What site types work for your concept?",
      type: "list_short",
      placeholder:
        "End-cap with patio access (preferred)\nMid-block with strong morning sun\nDrive-through capable (bonus, not required)",
      helpText:
        "List the specific site types that work for your concept, and be specific enough that a real-estate broker can prequalify a site before showing it.",
      category: "Site criteria",
    },

    // ── Priority markets ─────────────────────────────────────────────────
    {
      name: "priority_geographic_markets",
      label: "Where do you want your first five franchisees?",
      type: "list_short",
      required: true,
      placeholder:
        "Greater Oxford / North Mississippi corridor\nMemphis suburban ring\nBirmingham metro\nNashville (eastern suburbs)",
      helpText:
        "These are the markets where you want your first five franchisees. They drive how you prioritize FDD state registration (see the compliance_legal section).",
      category: "Priority markets",
    },
    {
      name: "exclusion_zones",
      label: "Which markets won't you operate in?",
      type: "list_short",
      placeholder:
        "Major metros with more than 5 existing third-wave competitors\nCollege towns with high seasonality\nCold-climate markets (winter under 25°F average)",
      helpText:
        "These are the places where your model doesn't work. Listing them saves franchisees the trouble of pitching markets you'd reject.",
      category: "Priority markets",
      advanced: true,
    },

    // ── Site approval process ───────────────────────────────────────────
    {
      name: "site_approval_required",
      label: "Will franchisees need your approval on each site?",
      type: "boolean",
      helpText:
        "This is almost always yes, and it drives the language in FDD Item 12 (territory).",
      category: "Approval process",
      advanced: true,
    },
    {
      name: "site_approval_timeline_days",
      label: "How long will site approval take?",
      type: "integer",
      placeholder: "14",
      helpText:
        "This is how long you take to review a proposed site. Faster is friendlier, and most franchisors target 7 to 21 days.",
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
const MARKET_STRATEGY: SectionSchema = {
  slug: "market_strategy",
  title: "Market Strategy & Positioning",
  description:
    "Where you'll grow first, why those markets, and how you'll position against alternatives. Most of this is research the agent does, and you confirm the priorities.",
  compilesInto: "Market Strategy Report, Discovery Day market-opportunity deck.",
  fields: [
    {
      name: "growth_horizon_years",
      label: "How far out are you planning?",
      type: "integer",
      placeholder: "5",
      helpText:
        "This is your planning horizon, and it drives how you sequence your market rollout.",
      category: "Horizon",
    },
    {
      name: "target_unit_count_year_3",
      label: "How many franchised units do you want by year three?",
      type: "integer",
      placeholder: "12",
      helpText:
        "This is how many franchisees you want signed and operating by the end of year three. A realistic range for emerging franchisors is 4 to 15 units.",
      category: "Horizon",
    },
    {
      name: "target_unit_count_year_5",
      label: "How many franchised units do you want by year five?",
      type: "integer",
      placeholder: "30",
      category: "Horizon",
      advanced: true,
    },
    {
      name: "competitive_positioning_summary",
      label: "How do you position yourself against the alternatives?",
      type: "textarea",
      placeholder:
        "Cypress Lane is positioned between regional independents (Stumptown-style, $5+ drinks, urban-only) and national chains (Starbucks-tier convenience, lower quality). We're the smartest middle path for small-town markets that have been overlooked by both ends.",
      helpText:
        "This is how you describe yourself relative to the alternatives. The agent will sharpen it with research, and your draft sets the direction.",
      category: "Positioning",
      suggestedFrom: {
        kind: "from_scrape",
        field: "positioning_summary",
      },
    },
    {
      name: "expansion_sequencing_strategy",
      label: "How will you sequence your expansion?",
      type: "select",
      options: [
        { value: "concentric", label: "Concentric (expand outward from existing locations)" },
        { value: "hub_and_spoke", label: "Hub and spoke (major metros first, then satellite markets)" },
        { value: "opportunistic", label: "Opportunistic (wherever the right franchisee shows up)" },
        { value: "regional_clusters", label: "Regional clusters (fill one region before opening another)" },
      ],
      helpText:
        "This is your geographic strategy. Concentric expansion reduces marketing and supply-chain costs, hub-and-spoke speeds up revenue, and opportunistic growth is risky for emerging brands.",
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
const COMPETITOR_LANDSCAPE: SectionSchema = {
  slug: "competitor_landscape",
  title: "Competitive Landscape",
  description:
    "Who else is competing for your customer. You name the brands that matter; the agent does the comparison work.",
  compilesInto: "Competitor Maps Appendix, Discovery Day competitive analysis, Market Strategy Report supporting research.",
  fields: [
    {
      name: "direct_competitors",
      label: "Which brands do you compete with head-to-head?",
      type: "list_short",
      required: true,
      placeholder:
        "Stumptown Coffee Roasters\nIntelligentsia\nLocal Reverie Coffee (regional)",
      helpText:
        "These are the brands that target the same customer with a similar offering. The agent will research each one, including pricing, positioning, expansion footprint, what they do well, and where they're weak.",
      category: "Competitors",
    },
    {
      name: "indirect_competitors",
      label: "Which different formats compete for the same customer?",
      type: "list_short",
      placeholder:
        "Starbucks (mass premium)\nDunkin' (commute convenience)\nLocal independent cafés\nGas-station coffee (bottom of the market)",
      helpText:
        "These are the brands or formats that win when your customer doesn't pick you. The agent will fill in the broader landscape from there.",
      category: "Competitors",
      advanced: true,
    },
    {
      name: "competitive_advantages",
      label: "Where do you win?",
      type: "list_short",
      placeholder:
        "Coffee quality on par with urban third-wave at small-town prices\nIn-house roasting (vertical integration)\nCommunity-room positioning (Starbucks-Reverse)",
      helpText:
        "Tell us why your customer picks you. Each one should be a defensible claim rather than marketing fluff.",
      category: "Differentiation",
    },
    {
      name: "competitive_vulnerabilities",
      label: "Where are you vulnerable?",
      type: "list_short",
      placeholder:
        "Higher labor cost than Dunkin' (we have more skilled staff)\nNo drive-through (slower morning rush)\nSingle roast supplier (concentration risk)",
      helpText:
        "Give us an honest assessment. Your FDD attorney will appreciate it, and investors definitely will.",
      category: "Differentiation",
      advanced: true,
    },
    {
      name: "competitive_research_notes",
      label: "Is there anything else about the competitive landscape we should know?",
      type: "textarea",
      placeholder:
        "Watching for Pour Five expansion into the Mid-South, since they're testing the same small-town third-wave thesis we are. If they enter Mississippi before we franchise in volume, our market windows tighten.",
      helpText:
        "Use this for open-ended notes. The agent will weave them into the Competitor Maps narrative.",
      category: "Research",
      advanced: true,
    },
  ],
};

// ---------------------------------------------------------------------------
// Registry & helpers
// ---------------------------------------------------------------------------

/**
 * Per-section schema registry. Now covers 15 of 16 sections; only
 * `brand_voice` remains deferred (planned for Phase 1.5b at ~6-8
 * fields, lighter footprint than the v1 we cut).
 *
 * BUCKET LAYOUT:
 *
 *   Heavy structured (typed values + lists drive the section):
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
 *     - brand_voice (no schema; the section exists in Memory but
 *       renders prose-only until 1.5b)
 *
 * AUDIT STATUS: the 11 newly-added schemas have NOT been cross-checked
 * against the High Point Coffee bundle or original capability documents.
 * Each schema's comment header notes the audit gap. Jason should review
 * for fields specific to TFB's framework that I missed.
 */
// ---------------------------------------------------------------------------
// brand_voice — the deferred Phase 1.5b section, now landing.
//
// Light hybrid. Cypress Lane example values shown in placeholders
// follow the operator-voice rule: no marketing-speak ("brand
// equity", "value proposition", "tone of voice"); plain English
// the founder would use ("how your team talks", "your colors").
//
// The brand-voice content drives FDD Item 1 boilerplate, the
// operations manual's "How we sound" section, and the marketing
// playbook. It's also what the agent reads when adapting prose to
// the customer's voice on later section drafts — so even minimal
// inputs here meaningfully improve the rest.
// ---------------------------------------------------------------------------
const BRAND_VOICE: SectionSchema = {
  slug: "brand_voice",
  title: "Brand Standards",
  description:
    "How your brand looks and sounds. This is the visual and verbal identity franchisees inherit and have to honor.",
  compilesInto: "FDD Item 1, Operations Manual §3 (Brand Standards), Marketing Playbook",
  fields: [
    {
      name: "brand_name",
      label: "What's your brand name?",
      type: "text",
      required: true,
      category: "Identity",
      placeholder: "Cypress Lane Coffee",
      helpText:
        "Use the exact wording you want franchisees to use on every sign, package, and document.",
    },
    {
      name: "tagline",
      label: "Do you have a tagline or slogan?",
      type: "text",
      category: "Identity",
      placeholder: "Slow coffee, small streets.",
      helpText:
        "This is the short, memorable line you'd put on the side of the cup. Skip it if you don't have one yet.",
    },
    {
      name: "voice_adjectives",
      label: "What three to five words describe your voice?",
      type: "list_short",
      required: true,
      category: "Voice",
      placeholder: "Warm\nWelcoming\nCraft-honest\nNeighborly\nUn-corporate",
      helpText:
        "Tell us how your brand sounds when it talks, one word per line.",
    },
    {
      name: "voice_description",
      label: "How would you describe your brand's voice in a sentence or two?",
      type: "textarea",
      required: true,
      category: "Voice",
      placeholder:
        "We sound like a friendly barista, not a corporate brochure. We use plain words, ask about the customer's day, and never pretend to be more than a good cup of coffee.",
      helpText:
        "Imagine you're describing the way your brand talks to a writer who's never met you.",
    },
    {
      name: "brand_colors",
      label: "What are your brand colors?",
      type: "color_list",
      required: true,
      category: "Visual",
      placeholder: "#1F3D2C",
      helpText:
        "Add your brand palette here, including primary, accent, neutral, and anything else you use consistently. You can pick a color or paste hex codes, and add as many as you need.",
    },
    {
      name: "typography_pairing",
      label: "What fonts do you use?",
      type: "text",
      category: "Visual",
      placeholder: "Tiempos Headline (display) / Inter (body)",
      helpText:
        "List the fonts you use in priority order. If you don't know the names, describe the vibe (something like 'hand-drawn serif plus simple sans').",
    },
    {
      name: "logo_url",
      label: "Where can we find your logo?",
      type: "url",
      category: "Visual",
      placeholder: "https://example.com/brand/logo.svg",
      helpText:
        "Paste a public link to your primary logo (SVG or PNG works best). You can also attach the file through the References panel.",
    },
    {
      name: "things_to_avoid",
      label: "What words or styles should we avoid?",
      type: "list_short",
      category: "Voice",
      advanced: true,
      placeholder:
        "Exclamation marks\n\"Synergy\"\nStock-photo lifestyle imagery\nAll-caps headlines",
      helpText:
        "List anything that's off-brand. It saves the agent from drafting copy you'd have to rewrite later.",
    },
  ],
};

export const SECTION_SCHEMAS: Partial<Record<MemoryFileSlug, SectionSchema>> = {
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
 * Returns the field schema for a section, or null if no schema exists yet
 * (the remaining 12 sections until they're filled in). Callers should
 * fall back gracefully — the section still has a `content_md` blob and
 * can be drafted prose-only.
 */
export function getSectionSchema(slug: MemoryFileSlug): SectionSchema | null {
  return SECTION_SCHEMAS[slug] ?? null;
}

/**
 * The shape of `customer_memory.fields` (jsonb) for a given section.
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

export type SectionFields = Record<string, FieldValue>;

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

export type SectionFieldStatus = Record<string, FieldStatus>;

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
 * remaining 12 sections.
 */

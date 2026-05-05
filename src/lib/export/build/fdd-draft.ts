/**
 * Franchise Disclosure Document (FDD) draft builder.
 *
 * Compiles the customer's Memory into a 23-item FDD scaffold an
 * attorney can use as a starting point. This is NOT a finished FDD —
 * the cover page and disclaimer make that clear, and several items
 * (3 Litigation, 4 Bankruptcy, 13 Trademarks, 14 Patents/Copyrights,
 * 16 Restrictions on Sales, 18 Public Figures, 21 Financial Statements,
 * 22 Contracts, 23 Receipts) are placeholder stubs the attorney fills
 * in with the franchisor's actual legal posture.
 *
 * What we DO produce:
 *   Item 1  — The Franchisor (from business_overview)
 *   Item 2  — Business Experience (from business_overview.founder_*)
 *   Item 5  — Initial Fees (from franchise_economics)
 *   Item 6  — Other Fees (from franchise_economics + marketing_fund)
 *   Item 7  — Estimated Initial Investment (from unit_economics)
 *   Item 8  — Restrictions on Sources (from vendor_supply_chain)
 *   Item 11 — Franchisor's Assistance, Advertising, Computer Systems,
 *             and Training (from training_program + marketing_fund)
 *   Item 12 — Territory (from franchise_economics + territory_real_estate)
 *   Item 15 — Obligation to Participate (from franchisee_profile.engagement_model)
 *   Item 17 — Renewal, Termination, etc. (from franchise_economics)
 *   Item 19 — Financial Performance Representations (from unit_economics
 *             + compliance_legal.item_19_strategy if present)
 *   Item 20 — Outlets and Franchisee Information (from business_overview
 *             current_location_count + franchisee_profile.discovery_*)
 *
 * What's stubbed (placeholder + Jason-tagged TODO):
 *   Items 3, 4, 9, 10, 13, 14, 16, 18, 21, 22, 23 — attorney-driven.
 */

import type { BuildContext, DeliverableDoc, DocBlock, DocSection } from "../types";
import { chapterFields, computedFields } from "../load";
import {
  fmtBool,
  fmtCurrency,
  fmtCurrencyRange,
  fmtInt,
  fmtList,
  fmtNumber,
  fmtPct,
  fmtSelect,
  fmtText,
  isFilled,
} from "../format";

export function buildFddDraft(ctx: BuildContext): DeliverableDoc {
  const businessOverview = chapterFields(ctx, "business_overview");
  const unitEcon = chapterFields(ctx, "unit_economics");
  const unitEconComputed = computedFields(ctx, "unit_economics");
  const franchiseEcon = chapterFields(ctx, "franchise_economics");
  const franchiseeProfile = chapterFields(ctx, "franchisee_profile");
  const franchiseeProfileComputed = computedFields(ctx, "franchisee_profile");
  const vendorSupply = chapterFields(ctx, "vendor_supply_chain");
  const marketingFund = chapterFields(ctx, "marketing_fund");
  const training = chapterFields(ctx, "training_program");
  const territory = chapterFields(ctx, "territory_real_estate");
  const compliance = chapterFields(ctx, "compliance_legal");

  const businessName =
    fmtText(businessOverview.concept_summary).split(".")[0]?.trim() ||
    "Your Franchise";

  return {
    title: `${businessName} — Franchise Disclosure Document (Draft)`,
    subtitle: "23-item scaffold prepared from your Blueprint",
    coverFields: [
      { label: "Franchisor", value: fmtText(businessOverview.concept_summary).split(".")[0] || "—" },
      { label: "Founder", value: fmtText(businessOverview.founder_name) },
      { label: "Generated", value: new Date(ctx.generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) },
      { label: "Blueprint readiness", value: `${ctx.readinessPct}%` },
      { label: "Attorney", value: fmtText(compliance.attorney_name) },
      { label: "Attorney firm", value: fmtText(compliance.attorney_firm) },
    ],
    disclaimer:
      "This is a working draft generated from your Franchisor Blueprint. It is NOT a filed FDD and is NOT legal advice. Your franchise attorney is responsible for the final document, all legal disclosures, state-specific addenda, and the financial statements (Item 21). Use this as a starting point for your attorney conversation.",
    sections: [
      // ── Item 1: The Franchisor ──────────────────────────────────────────
      {
        title: "Item 1: The Franchisor, Parents, Predecessors, and Affiliates",
        level: 1,
        blocks: [
          { kind: "paragraph", text: fmtText(businessOverview.concept_summary) },
          ...(isFilled(businessOverview.core_offering)
            ? ([
                { kind: "paragraph", text: `What we sell: ${fmtText(businessOverview.core_offering)}` },
              ] as DocBlock[])
            : []),
          {
            kind: "kvtable",
            rows: [
              { label: "Industry category", value: fmtText(businessOverview.industry_category) },
              { label: "NAICS code", value: fmtText(businessOverview.naics_code) },
              { label: "First location opened", value: fmtText(businessOverview.founding_date) },
              { label: "First location address", value: fmtText(businessOverview.first_location_address) },
              { label: "Locations operating today", value: fmtInt(businessOverview.current_location_count) },
              { label: "Of which: corporate-owned", value: fmtInt(businessOverview.corporate_location_count) },
              { label: "Of which: franchised", value: fmtInt(businessOverview.franchised_location_count) },
            ],
          },
          ...(fmtList(businessOverview.business_history_milestones).length > 0
            ? [
                { kind: "paragraph", text: "Key milestones:", bold: true } as DocBlock,
                { kind: "bullets", items: fmtList(businessOverview.business_history_milestones) } as DocBlock,
              ]
            : []),
        ],
      },

      // ── Item 2: Business Experience ─────────────────────────────────────
      {
        title: "Item 2: Business Experience",
        level: 1,
        blocks: [
          { kind: "paragraph", text: `Founder: ${fmtText(businessOverview.founder_name)}` },
          { kind: "paragraph", text: fmtText(businessOverview.founder_background) },
          { kind: "spacer" },
          { kind: "paragraph", text: "Why this business exists, in the founder's own words:", italic: true },
          { kind: "paragraph", text: fmtText(businessOverview.founder_origin_story) },
          { kind: "callout", text: "Attorney to add 5-year work history for each principal officer, director, and management person, per FTC Rule §436.5(b).", tone: "info" },
        ],
      },

      // ── Items 3 & 4: Litigation / Bankruptcy (attorney stub) ───────────
      stubItem(3, "Litigation", "Disclosure of pending and prior litigation per §436.5(c). Attorney to compile."),
      stubItem(4, "Bankruptcy", "Disclosure of bankruptcy proceedings per §436.5(d). Attorney to confirm."),

      // ── Item 5: Initial Fees ────────────────────────────────────────────
      {
        title: "Item 5: Initial Fees",
        level: 1,
        blocks: [
          {
            kind: "paragraph",
            text: `Initial franchise fee: ${fmtCurrency(franchiseEcon.franchise_fee_dollars)}, paid in full at signing.`,
          },
          ...(isFilled(franchiseEcon.franchise_fee_volume_discount)
            ? ([
                { kind: "paragraph", text: "Multi-unit discount:" },
                { kind: "paragraph", text: fmtText(franchiseEcon.franchise_fee_volume_discount) },
              ] as DocBlock[])
            : []),
          ...(isFilled(franchiseEcon.area_development_fee_dollars)
            ? ([
                {
                  kind: "paragraph",
                  text: `Area Development fee (for multi-unit operators): ${fmtCurrency(franchiseEcon.area_development_fee_dollars)}.`,
                },
              ] as DocBlock[])
            : []),
        ],
      },

      // ── Item 6: Other Fees ──────────────────────────────────────────────
      {
        title: "Item 6: Other Fees",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              {
                label: "Royalty",
                value: `${fmtPct(franchiseEcon.royalty_rate_pct)} of ${fmtSelect(franchiseEcon.royalty_rate_basis, [
                  { value: "gross_sales", label: "gross sales" },
                  { value: "net_sales", label: "net sales" },
                  { value: "weekly_gross_sales", label: "weekly gross sales" },
                ])}, paid ${fmtSelect(franchiseEcon.royalty_payment_frequency, [
                  { value: "weekly", label: "weekly" },
                  { value: "biweekly", label: "biweekly" },
                  { value: "monthly", label: "monthly" },
                ])}`,
              },
              { label: "Royalty minimum", value: isFilled(franchiseEcon.royalty_minimum_dollars) ? `${fmtCurrency(franchiseEcon.royalty_minimum_dollars)} per month` : "None" },
              { label: "Brand ad fund contribution", value: `${fmtPct(franchiseEcon.ad_fund_pct)} of gross sales` },
              { label: "Local marketing minimum", value: isFilled(franchiseEcon.local_marketing_minimum_pct) ? `${fmtPct(franchiseEcon.local_marketing_minimum_pct)} of gross sales` : "None" },
              { label: "Technology fee", value: isFilled(franchiseEcon.technology_fee_dollars_per_month) ? `${fmtCurrency(franchiseEcon.technology_fee_dollars_per_month)} per month` : "None" },
              { label: "Transfer fee", value: fmtCurrency(franchiseEcon.transfer_fee_dollars) },
              { label: "Renewal fee", value: fmtCurrency(franchiseEcon.renewal_fee_dollars) },
              { label: "Initial training fee", value: isFilled(franchiseEcon.training_fee_dollars) && Number(franchiseEcon.training_fee_dollars) > 0 ? fmtCurrency(franchiseEcon.training_fee_dollars) : "Included in initial franchise fee" },
              { label: "Grand-opening marketing", value: isFilled(marketingFund.grand_opening_marketing_required) ? fmtText(marketingFund.grand_opening_marketing_required) : "—" },
            ],
          },
          { kind: "callout", text: "Attorney to confirm fee disclosure complies with FTC Rule §436.5(f) and any state-specific addenda.", tone: "info" },
        ],
      },

      // ── Item 7: Estimated Initial Investment ────────────────────────────
      {
        title: "Item 7: Estimated Initial Investment",
        level: 1,
        blocks: [
          {
            kind: "paragraph",
            text: `Total estimated initial investment: ${fmtCurrencyRange(unitEcon.initial_investment_low_dollars, unitEcon.initial_investment_high_dollars)}.`,
          },
          {
            kind: "kvtable",
            rows: [
              { label: "Initial franchise fee", value: fmtCurrency(franchiseEcon.franchise_fee_dollars) },
              { label: "Build-out (construction + tenant improvements)", value: fmtCurrencyRange(unitEcon.buildout_cost_low_dollars, unitEcon.buildout_cost_high_dollars) },
              { label: "Furniture, fixtures, and equipment (FF&E)", value: fmtCurrency(unitEcon.ff_e_cost_dollars) },
              { label: "Working capital", value: fmtCurrency(unitEcon.working_capital_dollars) },
              { label: "Total initial investment", value: fmtCurrencyRange(unitEcon.initial_investment_low_dollars, unitEcon.initial_investment_high_dollars) },
            ],
          },
          { kind: "callout", text: "Attorney to add: estimated training travel + lodging, opening inventory, additional funds (3 months), insurance deposits, and any state-specific required line items.", tone: "info" },
        ],
      },

      // ── Item 8: Restrictions on Sources ─────────────────────────────────
      {
        title: "Item 8: Restrictions on Sources of Products and Services",
        level: 1,
        blocks: [
          ...(fmtList(vendorSupply.exclusive_purchase_required_items).length > 0
            ? ([
                { kind: "paragraph", text: "Items franchisees must purchase from approved suppliers:", bold: true },
                { kind: "bullets", items: fmtList(vendorSupply.exclusive_purchase_required_items) },
              ] as DocBlock[])
            : ([{ kind: "paragraph", text: "—" }] as DocBlock[])),
          ...(fmtList(vendorSupply.items_franchisee_can_source_locally).length > 0
            ? ([
                { kind: "paragraph", text: "Items franchisees may source locally (subject to spec):", bold: true },
                { kind: "bullets", items: fmtList(vendorSupply.items_franchisee_can_source_locally) },
              ] as DocBlock[])
            : []),
          ...(isFilled(vendorSupply.rebate_arrangements)
            ? ([
                { kind: "paragraph", text: "Rebate arrangements (disclosed per §436.5(h)):", bold: true },
                { kind: "paragraph", text: fmtText(vendorSupply.rebate_arrangements) },
              ] as DocBlock[])
            : ([
                { kind: "paragraph", text: "Rebate arrangements: none.", italic: true },
              ] as DocBlock[])),
          ...(isFilled(vendorSupply.centralized_purchasing_required)
            ? ([
                {
                  kind: "paragraph",
                  text: `Centralized purchasing through franchisor: ${fmtBool(vendorSupply.centralized_purchasing_required)}.`,
                },
              ] as DocBlock[])
            : []),
        ],
      },

      stubItem(9, "Franchisee's Obligations", "Cross-reference table linking franchisee obligations to their location in the Franchise Agreement. Attorney to compile."),
      stubItem(10, "Financing", "Disclosure of financing offered by the franchisor or any affiliate. Most emerging franchisors disclose 'None' here. Attorney to confirm."),

      // ── Item 11: Franchisor's Assistance + Training + Advertising ───────
      {
        title: "Item 11: Franchisor's Assistance, Advertising, Computer Systems, and Training",
        level: 1,
        blocks: [
          { kind: "paragraph", text: "Initial training program:", bold: true },
          {
            kind: "kvtable",
            rows: [
              { label: "Duration", value: isFilled(training.initial_training_duration_days) ? `${fmtInt(training.initial_training_duration_days)} days` : "—" },
              { label: "Format", value: fmtSelect(training.initial_training_format, [
                { value: "in_person_corporate", label: "In-person at corporate headquarters" },
                { value: "in_person_existing_unit", label: "In-person at an existing unit" },
                { value: "on_site_franchisee_location", label: "On-site at the franchisee's new location" },
                { value: "virtual", label: "Virtual / video" },
                { value: "hybrid", label: "Hybrid (some virtual, some in-person)" },
              ]) },
              { label: "Required attendees", value: fmtList(training.initial_training_attendees).join("; ") || "—" },
              { label: "Travel/lodging at franchisee expense?", value: fmtBool(training.training_travel_at_franchisee_expense) },
            ],
          },
          ...(isFilled(training.opening_support_days_on_site)
            ? ([
                {
                  kind: "paragraph",
                  text: `Opening support: franchisor team of ${fmtInt(training.opening_support_team_size)} on-site for ${fmtInt(training.opening_support_days_on_site)} days during opening week.`,
                },
              ] as DocBlock[])
            : []),
          ...(isFilled(training.ongoing_training_required)
            ? ([
                {
                  kind: "paragraph",
                  text: `Ongoing training is ${Boolean(training.ongoing_training_required) ? "required" : "not required"} after initial training.`,
                },
              ] as DocBlock[])
            : []),
          { kind: "spacer" },
          { kind: "paragraph", text: "Brand-wide advertising fund:", bold: true },
          {
            kind: "kvtable",
            rows: [
              { label: "Contribution rate", value: `${fmtPct(franchiseEcon.ad_fund_pct)} of gross sales` },
              { label: "Governance model", value: fmtSelect(marketingFund.fund_governance_model, [
                { value: "franchisor_controlled", label: "Franchisor controls all decisions" },
                { value: "advisory_board", label: "Franchisee advisory board provides input; franchisor decides" },
                { value: "cooperative", label: "Franchisee cooperative votes on spending" },
              ]) },
              { label: "Reporting cadence", value: fmtSelect(marketingFund.reporting_cadence, [
                { value: "monthly", label: "Monthly" },
                { value: "quarterly", label: "Quarterly" },
                { value: "annually", label: "Annually only" },
              ]) },
              { label: "Independent audit?", value: fmtBool(marketingFund.audit_required) },
              { label: "Carryover policy", value: fmtText(marketingFund.carryover_policy) },
            ],
          },
          ...(fmtList(marketingFund.approved_uses).length > 0
            ? ([
                { kind: "paragraph", text: "Approved uses of the fund:", bold: true },
                { kind: "bullets", items: fmtList(marketingFund.approved_uses) },
              ] as DocBlock[])
            : []),
          ...(fmtList(marketingFund.excluded_uses).length > 0
            ? ([
                { kind: "paragraph", text: "Excluded uses:", bold: true },
                { kind: "bullets", items: fmtList(marketingFund.excluded_uses) },
              ] as DocBlock[])
            : []),
          { kind: "callout", text: "Attorney to add required computer systems disclosure (POS, scheduling, inventory) and any required hardware purchases.", tone: "info" },
        ],
      },

      // ── Item 12: Territory ──────────────────────────────────────────────
      {
        title: "Item 12: Territory",
        level: 1,
        blocks: [
          {
            kind: "paragraph",
            text: `Territory protection: ${fmtSelect(franchiseEcon.territory_protection_type, [
              { value: "exclusive", label: "Exclusive — no other franchised or corporate units inside the territory" },
              { value: "non_exclusive", label: "Non-exclusive — franchisor reserves the right to place additional units" },
              { value: "protected", label: "Protected — franchisor cannot place units inside, but can grant outside" },
              { value: "point_of_interest", label: "Point-of-interest — franchisee gets a designated address only, no surrounding territory" },
            ])}.`,
          },
          {
            kind: "kvtable",
            rows: [
              { label: "Territory radius", value: isFilled(franchiseEcon.territory_radius_miles) ? `${fmtNumber(franchiseEcon.territory_radius_miles, 1)} miles` : "—" },
              { label: "Territory population (alternative)", value: isFilled(franchiseEcon.territory_population_count) ? `${fmtInt(franchiseEcon.territory_population_count)} residents` : "—" },
              { label: "Multi-unit deal required?", value: fmtBool(franchiseEcon.multi_unit_required) },
              { label: "Master franchise opportunities offered?", value: fmtBool(franchiseEcon.master_franchise_available) },
            ],
          },
          ...(fmtList(territory.priority_geographic_markets).length > 0
            ? ([
                { kind: "paragraph", text: "Priority geographic markets for first-wave development:", bold: true },
                { kind: "bullets", items: fmtList(territory.priority_geographic_markets) },
              ] as DocBlock[])
            : []),
          ...(isFilled(territory.site_approval_required)
            ? ([
                {
                  kind: "paragraph",
                  text: `Site approval by franchisor: ${fmtBool(territory.site_approval_required)}${
                    isFilled(territory.site_approval_timeline_days)
                      ? ` (target ${fmtInt(territory.site_approval_timeline_days)}-day review)`
                      : ""
                  }.`,
                },
              ] as DocBlock[])
            : []),
        ],
      },

      stubItem(13, "Trademarks", "Disclosure of franchisor's principal trademarks per §436.5(m). Attorney to confirm registration status."),
      stubItem(14, "Patents, Copyrights, and Proprietary Information", "Disclosure of patents, copyrights, and trade secrets per §436.5(n). Attorney to confirm."),

      // ── Item 15: Obligation to Participate ──────────────────────────────
      {
        title: "Item 15: Obligation to Participate in the Actual Operation of the Franchise Business",
        level: 1,
        blocks: [
          {
            kind: "paragraph",
            text: `Engagement model: ${fmtSelect(franchiseeProfile.engagement_model, [
              { value: "owner_operator", label: "Owner-operator (full-time, on-site)" },
              { value: "semi_absentee", label: "Semi-absentee (10–25 hrs/week + GM)" },
              { value: "absentee", label: "Absentee (investor with operations team)" },
              { value: "flexible", label: "Flexible — any of the above" },
            ])}.`,
          },
          ...(isFilled(franchiseeProfile.minimum_hours_per_week)
            ? ([
                {
                  kind: "paragraph",
                  text: `Minimum on-premises hours required (owner-operators): ${fmtInt(franchiseeProfile.minimum_hours_per_week)} hours per week.`,
                },
              ] as DocBlock[])
            : []),
          ...(isFilled(franchiseeProfile.relocation_required)
            ? ([
                {
                  kind: "paragraph",
                  text: `Franchisee residency near the location is ${Boolean(franchiseeProfile.relocation_required) ? "required" : "not required"}.`,
                },
              ] as DocBlock[])
            : []),
        ],
      },

      stubItem(16, "Restrictions on What the Franchisee May Sell", "Disclosure of menu/service-catalog restrictions per §436.5(p). Attorney to compile from operations manual."),

      // ── Item 17: Renewal, Termination, etc. ─────────────────────────────
      {
        title: "Item 17: Renewal, Termination, Transfer, and Dispute Resolution",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              { label: "Initial term", value: isFilled(franchiseEcon.term_years) ? `${fmtInt(franchiseEcon.term_years)} years` : "—" },
              { label: "Renewal term", value: isFilled(franchiseEcon.renewal_term_years) ? `${fmtInt(franchiseEcon.renewal_term_years)} years` : "—" },
              { label: "Number of renewals allowed", value: fmtInt(franchiseEcon.renewal_count_allowed) },
              { label: "Renewal fee", value: fmtCurrency(franchiseEcon.renewal_fee_dollars) },
              { label: "Transfer fee", value: fmtCurrency(franchiseEcon.transfer_fee_dollars) },
            ],
          },
          { kind: "callout", text: "Attorney to add full §436.5(q) table covering renewal conditions, termination by franchisee, termination by franchisor with/without cause, post-term obligations, and dispute-resolution forum + venue.", tone: "info" },
        ],
      },

      stubItem(18, "Public Figures", "Disclosure of any public figures used to promote the franchise per §436.5(r). Attorney to confirm."),

      // ── Item 19: Financial Performance Representations ──────────────────
      {
        title: "Item 19: Financial Performance Representations",
        level: 1,
        blocks: [
          ...(isFilled(unitEcon.average_unit_volume_dollars)
            ? ([
                {
                  kind: "paragraph",
                  text: `Mature-unit Average Unit Volume (AUV): ${fmtCurrency(unitEcon.average_unit_volume_dollars)} per year.`,
                },
                {
                  kind: "kvtable",
                  rows: [
                    { label: "Year 1 typical revenue", value: fmtCurrency(unitEcon.auv_year_1_dollars ?? unitEconComputed.auv_year_1_dollars) },
                    { label: "Year 2 typical revenue", value: fmtCurrency(unitEcon.auv_year_2_dollars ?? unitEconComputed.auv_year_2_dollars) },
                    { label: "Year 3 (mature) revenue", value: fmtCurrency(unitEcon.average_unit_volume_dollars) },
                    { label: "Operating profit margin (mature)", value: fmtPct(unitEcon.ebitda_margin_pct ?? unitEconComputed.ebitda_margin_pct) },
                    { label: "Estimated payback period", value: isFilled(unitEconComputed.payback_period_months) ? `${fmtInt(unitEconComputed.payback_period_months)} months` : "—" },
                  ],
                },
              ] as DocBlock[])
            : ([
                { kind: "paragraph", text: "No financial performance representation made at this time." },
              ] as DocBlock[])),
          ...(isFilled(unitEcon.key_assumptions)
            ? ([
                { kind: "paragraph", text: "Key assumptions:", bold: true },
                { kind: "paragraph", text: fmtText(unitEcon.key_assumptions) },
              ] as DocBlock[])
            : []),
          { kind: "callout", text: "Item 19 disclosures must include the substantiation methodology and the reasonable-basis standard. Attorney to wrap with the required preface and qualifying language. Confirm whether you intend full FPR, partial FPR, or no FPR — disclosed in compliance_legal.item_19_fpr_strategy when set.", tone: "warning" },
        ],
      },

      // ── Item 20: Outlets and Franchisee Information ─────────────────────
      {
        title: "Item 20: Outlets and Franchisee Information",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              { label: "Total operating locations today", value: fmtInt(businessOverview.current_location_count) },
              { label: "Franchisor-owned (corporate) locations", value: fmtInt(businessOverview.corporate_location_count) },
              { label: "Franchised locations", value: fmtInt(businessOverview.franchised_location_count) },
            ],
          },
          { kind: "spacer" },
          { kind: "paragraph", text: "Franchisee qualification floor:", bold: true },
          {
            kind: "kvtable",
            rows: [
              { label: "Required liquid capital", value: fmtCurrency(franchiseeProfile.minimum_liquid_capital_dollars ?? franchiseeProfileComputed.minimum_liquid_capital_dollars) },
              { label: "Required net worth", value: fmtCurrency(franchiseeProfile.minimum_net_worth_dollars ?? franchiseeProfileComputed.minimum_net_worth_dollars) },
              { label: "Minimum credit score", value: fmtInt(franchiseeProfile.minimum_credit_score) },
              { label: "SBA-financed candidates accepted?", value: fmtBool(franchiseeProfile.accepts_sba_financed) },
            ],
          },
          { kind: "callout", text: "Attorney to add: full table of opened/closed/transferred outlets per §436.5(t) Tables 1–5 covering the last three fiscal years; current franchisee contact list (Exhibit); confidentiality clause disclosure.", tone: "info" },
        ],
      },

      stubItem(21, "Financial Statements", "Audited financial statements per §436.5(u). Audit firm to prepare; attorney to attach as Exhibit."),
      stubItem(22, "Contracts", "Attached as exhibits: Franchise Agreement, Area Development Agreement (if used), all related side agreements."),
      stubItem(23, "Receipts", "Required acknowledgment receipts for prospective franchisees per §436.5(w). Attorney to format per state requirements."),
    ],
  };
}

function stubItem(num: number, name: string, note: string): DocSection {
  return {
    title: `Item ${num}: ${name}`,
    level: 1,
    blocks: [
      { kind: "callout", text: `Attorney-driven section. ${note}`, tone: "info" },
    ],
  };
}

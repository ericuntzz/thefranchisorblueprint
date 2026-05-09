/**
 * Financial Model summary builder.
 *
 * A compact one-document financial summary that compiles unit_economics
 * + franchise_economics into the numbers a banker, investor, or
 * candidate franchisee would ask for in a first conversation. Not a
 * full pro forma — that's a spreadsheet — but the headline numbers
 * with the assumptions and the unit-economics breakdown.
 */

import type { BuildContext, DeliverableDoc, DocBlock } from "../types";
import { sectionFields, computedFields } from "../context-helpers";
import { fmtCurrency, fmtCurrencyRange, fmtInt, fmtPct, fmtText, isFilled } from "../format";

export function buildFinancialModel(ctx: BuildContext): DeliverableDoc {
  const businessOverview = sectionFields(ctx, "business_overview");
  const unit = sectionFields(ctx, "unit_economics");
  const unitComputed = computedFields(ctx, "unit_economics");
  const franchise = sectionFields(ctx, "franchise_economics");

  const businessName =
    fmtText(businessOverview.concept_summary).split(".")[0]?.trim() || "Your Franchise";

  return {
    title: `${businessName} — Financial Model Summary`,
    subtitle: "Headline unit-economics + franchise revenue per location",
    coverFields: [
      { label: "Concept", value: fmtText(businessOverview.concept_summary).split(".")[0] || "—" },
      { label: "Generated", value: new Date(ctx.generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) },
      { label: "Operating locations today", value: fmtInt(businessOverview.current_location_count) },
    ],
    disclaimer:
      "Numbers reflect mature-unit performance based on the customer's structured Memory. These are NOT audited financials and do NOT constitute an Item 19 Financial Performance Representation under FTC Rule §436.5(s). Use this for internal planning, banker conversations, and franchisee economics discussions only.",
    sections: [
      {
        title: "1. Headline unit performance (mature)",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              { label: "Average Unit Volume (AUV) — mature", value: fmtCurrency(unit.average_unit_volume_dollars) },
              { label: "Year 1 typical revenue", value: fmtCurrency(unit.auv_year_1_dollars ?? unitComputed.auv_year_1_dollars) },
              { label: "Year 2 typical revenue", value: fmtCurrency(unit.auv_year_2_dollars ?? unitComputed.auv_year_2_dollars) },
              { label: "Operating profit margin (mature)", value: fmtPct(unit.ebitda_margin_pct ?? unitComputed.ebitda_margin_pct) },
              { label: "Estimated payback period", value: isFilled(unitComputed.payback_period_months) ? `${fmtInt(unitComputed.payback_period_months)} months` : "—" },
            ],
          },
        ],
      },
      {
        title: "2. Cost structure (% of revenue)",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              { label: "Cost of goods sold (COGS)", value: fmtPct(unit.cogs_pct) },
              { label: "Labor", value: fmtPct(unit.labor_pct) },
              { label: "Occupancy (rent + CAM + utilities)", value: fmtPct(unit.occupancy_pct) },
              { label: "Local marketing", value: fmtPct(unit.marketing_pct) },
              { label: "Other operating expenses", value: fmtPct(unit.other_opex_pct) },
              { label: "Total operating cost", value: fmtPct(
                  ((Number(unit.cogs_pct) || 0) +
                    (Number(unit.labor_pct) || 0) +
                    (Number(unit.occupancy_pct) || 0) +
                    (Number(unit.marketing_pct) || 0) +
                    (Number(unit.other_opex_pct) || 0)) || null,
                ) },
              { label: "Operating profit (residual)", value: fmtPct(unit.ebitda_margin_pct ?? unitComputed.ebitda_margin_pct) },
            ],
          },
        ],
      },
      {
        title: "3. Initial investment (per unit)",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              { label: "Initial franchise fee", value: fmtCurrency(franchise.franchise_fee_dollars) },
              { label: "Build-out (construction + tenant improvements)", value: fmtCurrencyRange(unit.buildout_cost_low_dollars, unit.buildout_cost_high_dollars) },
              { label: "Furniture, fixtures, and equipment (FF&E)", value: fmtCurrency(unit.ff_e_cost_dollars) },
              { label: "Working capital", value: fmtCurrency(unit.working_capital_dollars) },
              { label: "Total range", value: fmtCurrencyRange(unit.initial_investment_low_dollars, unit.initial_investment_high_dollars) },
            ],
          },
        ],
      },
      {
        title: "4. Franchisor revenue per franchisee per year (mature)",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              { label: "Royalty revenue", value: estimateAnnualFee(unit.average_unit_volume_dollars, franchise.royalty_rate_pct) },
              { label: "Ad fund contribution", value: estimateAnnualFee(unit.average_unit_volume_dollars, franchise.ad_fund_pct) },
              { label: "Technology fee (annualized)", value: isFilled(franchise.technology_fee_dollars_per_month) ? fmtCurrency(Number(franchise.technology_fee_dollars_per_month) * 12) : "—" },
            ],
          },
          { kind: "callout", text: "Revenue figures assume the franchisee hits mature AUV. Year-1 and year-2 royalty/ad-fund will be lower (apply ramp curve from unit_economics).", tone: "info" },
        ],
      },
      {
        title: "5. Key assumptions",
        level: 1,
        blocks: [
          ...(isFilled(unit.key_assumptions)
            ? ([{ kind: "paragraph", text: fmtText(unit.key_assumptions) }] as DocBlock[])
            : ([{ kind: "paragraph", text: "—" }] as DocBlock[])),
        ],
      },
    ],
  };
}

function estimateAnnualFee(auv: unknown, ratePct: unknown): string {
  const a = typeof auv === "number" ? auv : Number(auv);
  const r = typeof ratePct === "number" ? ratePct : Number(ratePct);
  if (!Number.isFinite(a) || !Number.isFinite(r)) return "—";
  return fmtCurrency((a * r) / 100);
}

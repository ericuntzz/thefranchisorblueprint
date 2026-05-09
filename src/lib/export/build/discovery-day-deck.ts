/**
 * Discovery Day deck builder.
 *
 * Pulls business_overview, brand_voice, franchise_economics, unit_economics,
 * franchisee_profile, training_program, and territory_real_estate into a
 * 20–25 slide deck the franchisor presents to qualified candidates on
 * Discovery Day.
 *
 * Customer can edit by re-drafting the underlying sections; this builder
 * just projects whatever's in Memory at export time.
 */

import type { BuildContext, Slide, SlideDoc } from "../types";
import { sectionFields } from "../context-helpers";
import {
  fmtCurrency,
  fmtCurrencyRange,
  fmtInt,
  fmtList,
  fmtPct,
  fmtText,
  isFilled,
} from "../format";

export function buildDiscoveryDayDeck(ctx: BuildContext): SlideDoc {
  const overview = sectionFields(ctx, "business_overview");
  const brand = sectionFields(ctx, "brand_voice");
  const franchise = sectionFields(ctx, "franchise_economics");
  const unit = sectionFields(ctx, "unit_economics");
  const profile = sectionFields(ctx, "franchisee_profile");
  const training = sectionFields(ctx, "training_program");
  const territory = sectionFields(ctx, "territory_real_estate");
  const ops = sectionFields(ctx, "operating_model");

  const businessName =
    fmtText(brand.brand_name).split(/[.\n]/)[0]?.trim() ||
    fmtText(overview.concept_summary).split(/[.\n]/)[0]?.trim() ||
    "Your Concept";

  const slides: Slide[] = [];

  // 1. Section opener
  slides.push({
    layout: "section",
    title: "The Opportunity",
    caption: "Why now, why us, why this market.",
  });

  // 2. Why we're here
  slides.push({
    layout: "content",
    title: "Why We're Here",
    body: [
      {
        kind: "paragraph",
        text: `Today is about answering one question — is ${businessName} the right franchise for you, and are you the right operator for ${businessName}?`,
      },
      {
        kind: "bullets",
        items: [
          "We'll walk you through the concept, the numbers, and how a unit runs",
          "You'll meet the team and ask anything you want",
          "If we're a fit, we'll talk about next steps before you leave",
          "If we're not, we'll be honest about that too",
        ],
      },
    ],
    notes:
      "Discovery Day isn't a sales pitch — it's a mutual interview. Lead with the candidate's question, not yours.",
  });

  // 3. Market
  if (
    isFilled(overview.industry_category) ||
    isFilled(overview.current_location_count) ||
    isFilled(unit.average_unit_volume_dollars)
  ) {
    slides.push({
      layout: "content",
      title: "The Market Opportunity",
      body: [
        {
          kind: "kvlist",
          rows: [
            ...(isFilled(overview.industry_category)
              ? [{ label: "Industry", value: fmtText(overview.industry_category) }]
              : []),
            ...(isFilled(overview.current_location_count)
              ? [
                  {
                    label: "Current footprint",
                    value: `${fmtInt(overview.current_location_count)} locations`,
                  },
                ]
              : []),
            ...(isFilled(unit.average_unit_volume_dollars)
              ? [
                  {
                    label: "Average unit volume",
                    value: fmtCurrency(unit.average_unit_volume_dollars),
                  },
                ]
              : []),
          ],
        },
      ],
    });
  }

  // 4. Concept
  slides.push({
    layout: "content",
    title: "The Concept",
    body: [
      { kind: "paragraph", text: fmtText(overview.concept_summary) },
      ...(isFilled(brand.voice_adjectives)
        ? ([
            { kind: "paragraph", text: "Brand voice:", bold: true },
            { kind: "paragraph", text: fmtList(brand.voice_adjectives).join(", ") },
          ] as const)
        : []),
    ],
  });

  // 5. Founder
  if (isFilled(overview.founder_name) || isFilled(overview.founder_origin_story)) {
    slides.push({
      layout: "content",
      title: "The Founder",
      body: [
        { kind: "paragraph", text: fmtText(overview.founder_name), bold: true },
        ...(isFilled(overview.founder_origin_story)
          ? ([{ kind: "paragraph", text: fmtText(overview.founder_origin_story) }] as const)
          : []),
      ],
    });
  }

  // 6. Section: Numbers
  slides.push({
    layout: "section",
    title: "The Numbers",
    caption: "What a typical unit produces, and what it costs to open one.",
  });

  // 7. AUV stat slide
  if (isFilled(unit.average_unit_volume_dollars)) {
    slides.push({
      layout: "stat",
      title: "Average Unit Volume",
      stat: fmtCurrency(unit.average_unit_volume_dollars),
      caption: "What a typical location targets per year.",
    });
  }

  // 8. Unit economics
  slides.push({
    layout: "content",
    title: "Unit Economics",
    body: [
      {
        kind: "kvlist",
        rows: [
          { label: "AUV", value: fmtCurrency(unit.average_unit_volume_dollars) },
          { label: "COGS %", value: fmtPct(unit.cogs_pct) },
          { label: "Labor %", value: fmtPct(unit.labor_pct) },
          { label: "Occupancy %", value: fmtPct(unit.occupancy_pct) },
          { label: "EBITDA margin", value: fmtPct(unit.ebitda_margin_pct) },
          {
            label: "Payback period",
            value: isFilled(unit.payback_period_months)
              ? `${fmtInt(unit.payback_period_months)} months`
              : "—",
          },
        ],
      },
    ],
    notes:
      "These are TARGET numbers — actual unit-level performance varies. Walk the candidate through Item 19 in the FDD if they want detail.",
  });

  // 9. Investment range
  slides.push({
    layout: "content",
    title: "Investment Range",
    body: [
      {
        kind: "kvlist",
        rows: [
          { label: "Initial franchise fee", value: fmtCurrency(franchise.franchise_fee_dollars) },
          {
            label: "Total initial investment",
            value: fmtCurrencyRange(
              unit.initial_investment_low_dollars,
              unit.initial_investment_high_dollars,
            ),
          },
          { label: "Royalty", value: fmtPct(franchise.royalty_rate_pct) },
          { label: "Brand fund / ad fund", value: fmtPct(franchise.ad_fund_pct) },
          {
            label: "Term length",
            value: isFilled(franchise.term_years)
              ? `${fmtInt(franchise.term_years)} years`
              : "—",
          },
        ],
      },
    ],
    notes:
      "Total initial investment is the all-in figure — fee + buildout + working capital. If a candidate balks here, they're not the right fit.",
  });

  // 10. Section: Operations
  slides.push({
    layout: "section",
    title: "How a Unit Runs",
    caption: "Operations, training, and the systems we hand you.",
  });

  // 11. Operations
  slides.push({
    layout: "two-column",
    title: "Operations Overview",
    leftLabel: "Daily Rhythm",
    rightLabel: "What You Get",
    left: [
      {
        kind: "kvlist",
        rows: [
          { label: "Hours", value: fmtText(ops.standard_hours_of_operation) },
          { label: "Typical staff/shift", value: fmtText(ops.staff_per_shift_typical) },
          { label: "Peak staff/shift", value: fmtText(ops.staff_per_shift_peak) },
        ],
      },
    ],
    right: [
      {
        kind: "bullets",
        items: [
          "Operations Manual (every system, every shift)",
          "Approved supplier list with pre-negotiated pricing",
          "Brand standards & marketing playbook",
          "Initial + ongoing training program",
        ],
      },
    ],
  });

  // 12. Training
  slides.push({
    layout: "content",
    title: "Training & Support",
    body: [
      {
        kind: "kvlist",
        rows: [
          {
            label: "Initial training",
            value: isFilled(training.initial_training_duration_days)
              ? `${fmtInt(training.initial_training_duration_days)} days`
              : "—",
          },
          { label: "Format", value: fmtText(training.initial_training_format) },
          {
            label: "Opening support",
            value: isFilled(training.opening_support_days_on_site)
              ? `${fmtInt(training.opening_support_days_on_site)} days on-site`
              : "—",
          },
          {
            label: "Annual conference",
            value:
              training.annual_conference_required === true
                ? "Yes — mandatory"
                : training.annual_conference_required === false
                  ? "Optional"
                  : "—",
          },
        ],
      },
    ],
  });

  // 13. Territory
  slides.push({
    layout: "content",
    title: "Territory & Site Selection",
    body: [
      {
        kind: "kvlist",
        rows: [
          {
            label: "Territory protection",
            value: fmtText(franchise.territory_protection_type),
          },
          {
            label: "Typical territory",
            value: isFilled(franchise.territory_radius_miles)
              ? `${fmtInt(franchise.territory_radius_miles)} mile radius`
              : isFilled(franchise.territory_population_count)
                ? `${fmtInt(franchise.territory_population_count)} population`
                : "—",
          },
          {
            label: "Target footprint",
            value:
              isFilled(territory.target_square_footage_low) && isFilled(territory.target_square_footage_high)
                ? `${fmtInt(territory.target_square_footage_low)}–${fmtInt(territory.target_square_footage_high)} sqft`
                : "—",
          },
          {
            label: "Site approval",
            value:
              territory.site_approval_required === true
                ? "Required (we approve every site)"
                : "—",
          },
        ],
      },
    ],
  });

  // 14. Section: fit
  slides.push({
    layout: "section",
    title: "The Right Fit",
    caption: "We don't sell to everyone. Here's who we look for.",
  });

  // 15. Ideal franchisee
  slides.push({
    layout: "content",
    title: "Who Thrives Here",
    body: [
      {
        kind: "kvlist",
        rows: [
          {
            label: "Min liquid capital",
            value: fmtCurrency(profile.minimum_liquid_capital_dollars),
          },
          {
            label: "Min net worth",
            value: fmtCurrency(profile.minimum_net_worth_dollars),
          },
          { label: "Engagement model", value: fmtText(profile.engagement_model) },
        ],
      },
      ...(isFilled(profile.ideal_traits)
        ? ([
            { kind: "paragraph", text: "Traits we look for:", bold: true },
            { kind: "bullets", items: fmtList(profile.ideal_traits) },
          ] as const)
        : []),
    ],
  });

  // 16. Path to opening
  slides.push({
    layout: "content",
    title: "Your Path to Opening",
    body: [
      {
        kind: "bullets",
        items: [
          "Today: Discovery Day — concept overview + mutual fit",
          "Within 1 week: Franchise Agreement signed, deposit collected",
          "Weeks 2–8: Site selection, lease negotiated",
          "Weeks 4–10: Buildout, equipment ordered",
          "Weeks 8–12: Training (yours + your team's)",
          "Week 12+: Soft open, hard open, ongoing support",
        ],
      },
    ],
  });

  // 17. Q&A
  slides.push({
    layout: "content",
    title: "Q&A",
    body: [
      {
        kind: "paragraph",
        text: "What questions do you have? Anything we didn't cover, anything that doesn't match what you imagined.",
        bold: true,
      },
      {
        kind: "paragraph",
        text: "Honest answers — even if they don't help us.",
      },
    ],
    notes: "Reserve at least 30 minutes for genuine Q&A.",
  });

  // 18. Next steps
  slides.push({
    layout: "content",
    title: "Next Steps",
    body: [
      {
        kind: "bullets",
        items: [
          "We'll send you the FDD within 24 hours",
          "14-day federal review period before you can sign",
          "Final Q&A call after you've reviewed",
          "Franchise Agreement signing + deposit",
          "We hand you the keys",
        ],
      },
    ],
  });

  return {
    title: `${businessName} — Discovery Day`,
    subtitle: "Concept, economics, and fit",
    coverFields: [
      {
        label: "Generated",
        value: new Date(ctx.generatedAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      },
      {
        label: "Version",
        value: `Draft v1 — ${ctx.readinessPct}% Blueprint complete`,
      },
    ],
    disclaimer:
      "Generated by The Franchisor Blueprint. Edit by updating the underlying sections; this deck regenerates from your live Memory.",
    slides,
  };
}

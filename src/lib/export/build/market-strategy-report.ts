/**
 * Market Strategy Report builder.
 *
 * Pulls market_strategy + competitor_landscape + business_overview into
 * the strategic overview document. Today this is text-only — pulled
 * straight from Memory. Phase 3 wires up Tavily / Census / Google
 * Places integrations to enrich this with live competitor data and
 * trade-area demographics.
 */

import type { BuildContext, DeliverableDoc, DocBlock } from "../types";
import { chapterFields } from "../load";
import { fmtInt, fmtList, fmtText, isFilled } from "../format";

export function buildMarketStrategyReport(ctx: BuildContext): DeliverableDoc {
  const market = chapterFields(ctx, "market_strategy");
  const competitors = chapterFields(ctx, "competitor_landscape");
  const overview = chapterFields(ctx, "business_overview");

  const businessName =
    fmtText(overview.concept_summary).split(/[.\n]/)[0]?.trim() || "Your Franchise";

  return {
    title: `${businessName} — Market Strategy Report`,
    subtitle: "Positioning, growth horizon, and expansion sequencing",
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
      "This report is generated from the strategic intent captured in your Memory. Higher-tier engagements layer on Census demographics and live competitor research; ask your account team about that data when you're ready.",
    sections: [
      {
        title: "1. Positioning",
        level: 1,
        blocks: [
          isFilled(market.competitive_positioning_summary)
            ? ({
                kind: "paragraph",
                text: fmtText(market.competitive_positioning_summary),
              } as DocBlock)
            : ({
                kind: "callout",
                text:
                  "Competitive positioning hasn't been captured. Add it to the market_strategy chapter — this is the one paragraph every candidate, banker, and journalist wants.",
                tone: "warning",
              } as DocBlock),
        ],
      },
      {
        title: "2. Growth Horizon",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              {
                label: "Planning horizon",
                value: isFilled(market.growth_horizon_years)
                  ? `${fmtInt(market.growth_horizon_years)} years`
                  : "—",
              },
              {
                label: "Year-3 unit target",
                value: fmtInt(market.target_unit_count_year_3),
              },
              {
                label: "Year-5 unit target",
                value: fmtInt(market.target_unit_count_year_5),
              },
            ],
          },
        ],
      },
      {
        title: "3. Expansion Sequencing",
        level: 1,
        blocks: [
          isFilled(market.expansion_sequencing_strategy)
            ? ({ kind: "paragraph", text: fmtText(market.expansion_sequencing_strategy) } as DocBlock)
            : ({
                kind: "paragraph",
                text:
                  "Expansion sequencing not yet documented. Common patterns: hub-and-spoke around home market, follow population centers, follow operator availability, lead with multi-unit operators.",
              } as DocBlock),
        ],
      },
      {
        title: "4. Competitive Advantages",
        level: 1,
        blocks: [
          isFilled(competitors.competitive_advantages)
            ? ({ kind: "bullets", items: fmtList(competitors.competitive_advantages) } as DocBlock)
            : ({
                kind: "paragraph",
                text:
                  "Competitive advantages not yet documented in the competitor_landscape chapter.",
              } as DocBlock),
        ],
      },
      {
        title: "5. Competitive Vulnerabilities",
        level: 1,
        blocks: [
          isFilled(competitors.competitive_vulnerabilities)
            ? ({ kind: "bullets", items: fmtList(competitors.competitive_vulnerabilities) } as DocBlock)
            : ({
                kind: "paragraph",
                text:
                  "Vulnerabilities not yet documented. Honest weaknesses are worth capturing here — they inform site selection criteria and product development priorities.",
              } as DocBlock),
        ],
      },
    ],
  };
}

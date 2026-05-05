/**
 * Competitor Landscape builder.
 *
 * Surface every direct + indirect competitor the customer has captured,
 * plus the comparative-advantage analysis. Like the market strategy
 * report, this is text-only today; Phase 3's Google Places / Tavily
 * tools enrich it with location density and current pricing data.
 */

import type { BuildContext, DeliverableDoc, DocBlock } from "../types";
import { chapterFields } from "../load";
import { fmtList, fmtText, isFilled } from "../format";

export function buildCompetitorLandscape(ctx: BuildContext): DeliverableDoc {
  const competitors = chapterFields(ctx, "competitor_landscape");
  const overview = chapterFields(ctx, "business_overview");

  const businessName =
    fmtText(overview.concept_summary).split(/[.\n]/)[0]?.trim() || "Your Franchise";

  return {
    title: `${businessName} — Competitor Landscape`,
    subtitle: "Direct competitors, indirect competitors, and comparative analysis",
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
      "Captured from your Memory. Higher tiers layer on real-time competitor research using Google Places, web search, and pricing intel.",
    sections: [
      {
        title: "1. Direct Competitors",
        level: 1,
        blocks: [
          isFilled(competitors.direct_competitors)
            ? ({ kind: "bullets", items: fmtList(competitors.direct_competitors) } as DocBlock)
            : ({
                kind: "callout",
                text:
                  "Direct competitors not yet captured. Add them to the competitor_landscape chapter — every candidate asks about them.",
                tone: "warning",
              } as DocBlock),
        ],
      },
      {
        title: "2. Indirect Competitors",
        level: 1,
        blocks: [
          isFilled(competitors.indirect_competitors)
            ? ({ kind: "bullets", items: fmtList(competitors.indirect_competitors) } as DocBlock)
            : ({
                kind: "paragraph",
                text:
                  "Indirect competitors are the alternatives a customer might choose instead — different categories that solve the same job. Capture them in the competitor_landscape chapter.",
              } as DocBlock),
        ],
      },
      {
        title: "3. Where We Win",
        level: 1,
        blocks: [
          isFilled(competitors.competitive_advantages)
            ? ({ kind: "bullets", items: fmtList(competitors.competitive_advantages) } as DocBlock)
            : ({
                kind: "paragraph",
                text: "Comparative advantages not yet documented.",
              } as DocBlock),
        ],
      },
      {
        title: "4. Where We're Vulnerable",
        level: 1,
        blocks: [
          isFilled(competitors.competitive_vulnerabilities)
            ? ({ kind: "bullets", items: fmtList(competitors.competitive_vulnerabilities) } as DocBlock)
            : ({
                kind: "paragraph",
                text: "Honest vulnerabilities not yet documented.",
              } as DocBlock),
        ],
      },
      {
        title: "5. Research Notes",
        level: 1,
        blocks: [
          isFilled(competitors.competitive_research_notes)
            ? ({ kind: "paragraph", text: fmtText(competitors.competitive_research_notes) } as DocBlock)
            : ({
                kind: "paragraph",
                text:
                  "Free-form research notes go in the competitor_landscape chapter — observations from store visits, mystery shops, articles, etc.",
              } as DocBlock),
        ],
      },
    ],
  };
}

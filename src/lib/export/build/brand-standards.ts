/**
 * Brand Standards builder.
 *
 * Visual + voice standards franchisees inherit. Pulls brand_voice +
 * pieces of business_overview into a manual that locks down what the
 * brand looks and sounds like. Every franchisee gets this; deviations
 * require approval.
 */

import type { BuildContext, DeliverableDoc, DocBlock } from "../types";
import { chapterFields } from "../load";
import { fmtList, fmtText, isFilled } from "../format";

export function buildBrandStandards(ctx: BuildContext): DeliverableDoc {
  const brand = chapterFields(ctx, "brand_voice");
  const overview = chapterFields(ctx, "business_overview");

  const businessName =
    fmtText(brand.brand_name).split(/[.\n]/)[0]?.trim() ||
    fmtText(overview.concept_summary).split(/[.\n]/)[0]?.trim() ||
    "Your Brand";

  return {
    title: `${businessName} — Brand Standards`,
    subtitle: "Voice, visual identity, and what to avoid",
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
      "These standards govern every customer-facing surface — store signage, packaging, marketing, social, voice scripts, hold music. Deviations require written approval from the franchisor.",
    sections: [
      {
        title: "1. Brand Identity",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              { label: "Brand name", value: fmtText(brand.brand_name) },
              { label: "Tagline", value: fmtText(brand.tagline) },
            ],
          },
        ],
      },
      {
        title: "2. Voice",
        level: 1,
        blocks: [
          ...(isFilled(brand.voice_adjectives)
            ? ([
                {
                  kind: "paragraph",
                  text: "Voice adjectives — every customer touchpoint should feel:",
                  bold: true,
                } as DocBlock,
                {
                  kind: "bullets",
                  items: fmtList(brand.voice_adjectives),
                } as DocBlock,
              ])
            : []),
          ...(isFilled(brand.voice_description)
            ? ([
                {
                  kind: "paragraph",
                  text: "How that sounds in practice:",
                  bold: true,
                } as DocBlock,
                {
                  kind: "paragraph",
                  text: fmtText(brand.voice_description),
                } as DocBlock,
              ])
            : []),
        ],
      },
      {
        title: "3. Visual Identity",
        level: 1,
        blocks: [
          ...(isFilled(brand.brand_colors)
            ? ([
                {
                  kind: "paragraph",
                  text: "Brand colors:",
                  bold: true,
                } as DocBlock,
                {
                  kind: "bullets",
                  items: fmtList(brand.brand_colors),
                } as DocBlock,
              ])
            : []),
          ...(isFilled(brand.typography_pairing)
            ? ([
                {
                  kind: "paragraph",
                  text: "Typography:",
                  bold: true,
                } as DocBlock,
                {
                  kind: "paragraph",
                  text: fmtText(brand.typography_pairing),
                } as DocBlock,
              ])
            : []),
          ...(isFilled(brand.logo_url)
            ? ([
                {
                  kind: "paragraph",
                  text: "Logo files:",
                  bold: true,
                } as DocBlock,
                {
                  kind: "paragraph",
                  text: fmtText(brand.logo_url),
                } as DocBlock,
              ])
            : []),
        ],
      },
      {
        title: "4. Things to Avoid",
        level: 1,
        blocks: [
          isFilled(brand.things_to_avoid)
            ? ({ kind: "bullets", items: fmtList(brand.things_to_avoid) } as DocBlock)
            : ({
                kind: "callout",
                text: "Things to avoid haven't been documented yet. The brand_voice chapter has a `things_to_avoid` field that should list common pitfalls (e.g. tones, words, visuals that don't fit the brand).",
                tone: "neutral",
              } as DocBlock),
        ],
      },
      {
        title: "5. Approval Process",
        level: 1,
        blocks: [
          {
            kind: "paragraph",
            text:
              "Any new customer-facing material (signage, packaging redesigns, paid ads, sponsorships, in-store promos beyond corporate-supplied templates) requires brand-team approval before going live. Submit via the brand portal at least 5 business days before the desired publish date.",
          },
        ],
      },
    ],
  };
}

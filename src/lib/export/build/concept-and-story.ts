/**
 * Concept & Story builder.
 *
 * The narrative document — the founder's story, the brand voice, the
 * concept summary, and the differentiation that anchors all the other
 * deliverables. Used by the franchisor in candidate conversations,
 * press, and pitch decks. NOT a duplicate of the FDD's Item 1: this
 * is the operator-voice version, where the FDD is the regulator-voice
 * version.
 */

import type { BuildContext, DeliverableDoc, DocBlock } from "../types";
import { sectionFields } from "../context-helpers";
import { fmtDate, fmtInt, fmtList, fmtText, isFilled } from "../format";

export function buildConceptAndStory(ctx: BuildContext): DeliverableDoc {
  const overview = sectionFields(ctx, "business_overview");
  const brand = sectionFields(ctx, "brand_voice");

  const businessName =
    fmtText(brand.brand_name).split(/[.\n]/)[0]?.trim() ||
    fmtText(overview.concept_summary).split(/[.\n]/)[0]?.trim() ||
    "Your Concept";

  return {
    title: `${businessName} — Concept & Story`,
    subtitle: "Founder origin, concept, and what makes this different",
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
      "This document carries the brand's voice. Edit the underlying sections to refine — the document regenerates from your live Memory.",
    sections: [
      {
        title: "1. The Concept",
        level: 1,
        blocks: [
          {
            kind: "paragraph",
            text: fmtText(overview.concept_summary),
          },
          ...(isFilled(overview.core_offering)
            ? ([
                {
                  kind: "paragraph",
                  text: "Core offering:",
                  bold: true,
                } as DocBlock,
                {
                  kind: "paragraph",
                  text: fmtText(overview.core_offering),
                } as DocBlock,
              ])
            : []),
        ],
      },
      {
        title: "2. The Founder",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              { label: "Name", value: fmtText(overview.founder_name) },
              { label: "Background", value: fmtText(overview.founder_background) },
              {
                label: "Founded",
                value: fmtDate(overview.founding_date),
              },
            ],
          },
          ...(isFilled(overview.founder_origin_story)
            ? ([
                {
                  kind: "paragraph",
                  text: "Origin story:",
                  bold: true,
                } as DocBlock,
                {
                  kind: "paragraph",
                  text: fmtText(overview.founder_origin_story),
                } as DocBlock,
              ])
            : []),
        ],
      },
      {
        title: "3. The First Location",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              {
                label: "First location",
                value: fmtText(overview.first_location_address),
              },
              {
                label: "Locations today",
                value: isFilled(overview.current_location_count)
                  ? `${fmtInt(overview.current_location_count)} (${fmtInt(overview.corporate_location_count)} corporate · ${fmtInt(overview.franchised_location_count)} franchised)`
                  : "—",
              },
            ],
          },
        ],
      },
      {
        title: "4. What Makes This Different",
        level: 1,
        blocks: [
          ...(isFilled(overview.distinctive_attributes)
            ? ([
                { kind: "bullets", items: fmtList(overview.distinctive_attributes) } as DocBlock,
              ])
            : []),
          ...(isFilled(overview.target_customer_persona)
            ? ([
                {
                  kind: "paragraph",
                  text: "Who we're for:",
                  bold: true,
                } as DocBlock,
                {
                  kind: "paragraph",
                  text: fmtText(overview.target_customer_persona),
                } as DocBlock,
              ])
            : []),
        ],
      },
      {
        title: "5. The Brand Voice",
        level: 1,
        blocks: [
          ...(isFilled(brand.voice_adjectives)
            ? ([
                {
                  kind: "bullets",
                  items: fmtList(brand.voice_adjectives),
                } as DocBlock,
              ])
            : []),
          ...(isFilled(brand.voice_description)
            ? ([
                { kind: "paragraph", text: fmtText(brand.voice_description) } as DocBlock,
              ])
            : []),
          ...(isFilled(brand.tagline)
            ? ([
                { kind: "paragraph", text: fmtText(brand.tagline), italic: true } as DocBlock,
              ])
            : []),
        ],
      },
      {
        title: "6. Milestones",
        level: 1,
        blocks: [
          isFilled(overview.business_history_milestones)
            ? ({ kind: "bullets", items: fmtList(overview.business_history_milestones) } as DocBlock)
            : ({
                kind: "paragraph",
                text: "Key milestones haven't been captured yet — add them to the business_overview section so this section reads as a real timeline.",
              } as DocBlock),
        ],
      },
    ],
  };
}

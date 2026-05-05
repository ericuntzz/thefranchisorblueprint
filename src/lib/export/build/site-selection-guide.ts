/**
 * Site Selection Guide builder.
 *
 * Pulls territory_real_estate + franchise_economics into the document
 * franchisees use to find, qualify, and submit a site for approval.
 * Distinct from the FDD's Item 12 disclosure (which describes territory
 * legally) — this is the operational workbook.
 */

import type { BuildContext, DeliverableDoc, DocBlock } from "../types";
import { chapterFields } from "../context-helpers";
import {
  fmtCurrency,
  fmtInt,
  fmtList,
  fmtSelect,
  fmtText,
  isFilled,
} from "../format";

export function buildSiteSelectionGuide(ctx: BuildContext): DeliverableDoc {
  const territory = chapterFields(ctx, "territory_real_estate");
  const franchise = chapterFields(ctx, "franchise_economics");
  const overview = chapterFields(ctx, "business_overview");

  const businessName =
    fmtText(overview.concept_summary).split(/[.\n]/)[0]?.trim() || "Your Franchise";

  return {
    title: `${businessName} — Site Selection Guide`,
    subtitle: "Demographic targets, site criteria, and approval process",
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
      "Use this as your franchisee-facing real estate workbook. Refine the demographic targets and exclusion zones as you accumulate operating data — site criteria that worked in year 1 often need updating in year 3.",
    sections: [
      {
        title: "1. Demographic Targets",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              {
                label: "Ideal population per unit",
                value: fmtInt(territory.ideal_population_per_unit),
              },
              {
                label: "Min household income",
                value: fmtCurrency(territory.ideal_household_income_min_dollars),
              },
            ],
          },
          {
            kind: "callout",
            text: "Demographic targets are guidelines, not hard floors. A site that misses one threshold but exceeds others (e.g. higher daytime population, less competition) can still be a strong fit.",
            tone: "info",
          },
        ],
      },
      {
        title: "2. Site Footprint",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              {
                label: "Target square footage (low)",
                value: isFilled(territory.target_square_footage_low)
                  ? `${fmtInt(territory.target_square_footage_low)} sqft`
                  : "—",
              },
              {
                label: "Target square footage (high)",
                value: isFilled(territory.target_square_footage_high)
                  ? `${fmtInt(territory.target_square_footage_high)} sqft`
                  : "—",
              },
              {
                label: "Site type preferences",
                value: fmtText(territory.site_type_preferences),
              },
            ],
          },
        ],
      },
      {
        title: "3. Geographic Focus",
        level: 1,
        blocks: [
          ...(isFilled(territory.priority_geographic_markets)
            ? ([
                {
                  kind: "paragraph",
                  text: "Priority markets:",
                  bold: true,
                } as DocBlock,
                {
                  kind: "bullets",
                  items: fmtList(territory.priority_geographic_markets),
                } as DocBlock,
              ])
            : []),
          ...(isFilled(territory.exclusion_zones)
            ? ([
                {
                  kind: "paragraph",
                  text: "Exclusion zones (we do not approve sites here):",
                  bold: true,
                } as DocBlock,
                {
                  kind: "bullets",
                  items: fmtList(territory.exclusion_zones),
                } as DocBlock,
              ])
            : []),
        ],
      },
      {
        title: "4. Territory Protection",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              {
                label: "Protection type",
                value: fmtSelect(franchise.territory_protection_type, [
                  { value: "exclusive", label: "Exclusive territory" },
                  { value: "non_exclusive", label: "Non-exclusive (no protection)" },
                  { value: "protected_radius", label: "Protected radius" },
                  { value: "designated_market_area", label: "Designated market area" },
                ]),
              },
              {
                label: "Territory radius",
                value: isFilled(franchise.territory_radius_miles)
                  ? `${fmtInt(franchise.territory_radius_miles)} miles`
                  : "—",
              },
              {
                label: "Population scope",
                value: isFilled(franchise.territory_population_count)
                  ? `${fmtInt(franchise.territory_population_count)} population`
                  : "—",
              },
            ],
          },
        ],
      },
      {
        title: "5. Site Approval Process",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              {
                label: "Approval required",
                value:
                  territory.site_approval_required === true
                    ? "Yes — every site must be approved by the franchisor before lease execution"
                    : "—",
              },
              {
                label: "Typical timeline",
                value: isFilled(territory.site_approval_timeline_days)
                  ? `${fmtInt(territory.site_approval_timeline_days)} days from submission`
                  : "—",
              },
            ],
          },
        ],
      },
      {
        title: "6. What to Submit",
        level: 1,
        blocks: [
          {
            kind: "bullets",
            items: [
              "Site address + property type (ground lease, end-cap, inline, etc.)",
              "Photos (exterior, interior, surrounding tenants/co-tenancy)",
              "Demographic report from a service like SitesUSA or Buxton",
              "Co-tenancy summary — what's around the site within 1 mile",
              "Traffic counts (front and side, AM and PM peak)",
              "Square footage, ceiling height, drive-thru / patio access if applicable",
              "Proposed rent + LOI summary if available",
            ],
          },
        ],
      },
    ],
  };
}

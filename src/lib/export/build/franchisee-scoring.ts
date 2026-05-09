/**
 * Franchisee Scoring Matrix builder.
 *
 * Compiles franchisee_profile into a Discovery Day pre-qualification
 * matrix — the document Jason's framework calls a "Franchisee Scoring
 * Matrix." Lists the financial floor, the experience requirements, the
 * engagement model, the ideal candidate traits, and the disqualifiers.
 *
 * This is the document a recruiter or franchise broker uses to screen
 * candidates BEFORE the franchisor wastes a Discovery Day on them.
 */

import type { BuildContext, DeliverableDoc, DocBlock } from "../types";
import { sectionFields, computedFields } from "../context-helpers";
import { fmtBool, fmtCurrency, fmtInt, fmtList, fmtSelect, fmtText, isFilled } from "../format";

export function buildFranchiseeScoringMatrix(ctx: BuildContext): DeliverableDoc {
  const businessOverview = sectionFields(ctx, "business_overview");
  const profile = sectionFields(ctx, "franchisee_profile");
  const profileComputed = computedFields(ctx, "franchisee_profile");

  const businessName =
    fmtText(businessOverview.concept_summary).split(".")[0]?.trim() || "Your Franchise";

  return {
    title: `${businessName} — Franchisee Scoring Matrix`,
    subtitle: "Discovery Day pre-qualification + ideal-candidate definition",
    coverFields: [
      { label: "Concept", value: fmtText(businessOverview.concept_summary).split(".")[0] || "—" },
      { label: "Generated", value: new Date(ctx.generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) },
    ],
    disclaimer:
      "Use this matrix to screen candidates before scheduling a Discovery Day. The financial floor is non-negotiable — anything below it does not get a meeting. The character traits and disqualifiers are the soft criteria that separate a great-on-paper candidate from a true fit.",
    sections: [
      {
        title: "1. Financial floor (non-negotiable)",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              { label: "Required liquid capital", value: fmtCurrency(profile.minimum_liquid_capital_dollars ?? profileComputed.minimum_liquid_capital_dollars) },
              { label: "Required net worth", value: fmtCurrency(profile.minimum_net_worth_dollars ?? profileComputed.minimum_net_worth_dollars) },
              { label: "Minimum credit score", value: fmtInt(profile.minimum_credit_score) },
              { label: "Open to SBA-financed candidates?", value: fmtBool(profile.accepts_sba_financed) },
            ],
          },
        ],
      },
      {
        title: "2. Experience requirements",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              { label: "Prior business ownership required?", value: fmtBool(profile.prior_business_ownership_required) },
              { label: "Prior industry experience required?", value: fmtBool(profile.prior_industry_experience_required) },
              { label: "Minimum years running a business", value: fmtInt(profile.minimum_years_business_experience) },
            ],
          },
          ...(isFilled(profile.specific_experience_notes)
            ? ([
                { kind: "paragraph", text: "Backgrounds that adapt fastest:", bold: true },
                { kind: "paragraph", text: fmtText(profile.specific_experience_notes) },
              ] as DocBlock[])
            : []),
        ],
      },
      {
        title: "3. Engagement model",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              { label: "How they'll run their location", value: fmtSelect(profile.engagement_model, [
                { value: "owner_operator", label: "Owner-operator (full-time, on-site)" },
                { value: "semi_absentee", label: "Semi-absentee (10–25 hrs/week + GM)" },
                { value: "absentee", label: "Absentee (investor with operations team)" },
                { value: "flexible", label: "Flexible — any of the above" },
              ]) },
              { label: "Minimum on-premises hours per week", value: fmtInt(profile.minimum_hours_per_week) },
              { label: "Must live near the location?", value: fmtBool(profile.relocation_required) },
            ],
          },
        ],
      },
      {
        title: "4. Ideal candidate (character & fit)",
        level: 1,
        blocks: [
          ...(isFilled(profile.candidate_persona_narrative)
            ? ([
                { kind: "paragraph", text: "The ideal candidate:", bold: true },
                { kind: "paragraph", text: fmtText(profile.candidate_persona_narrative) },
              ] as DocBlock[])
            : []),
          ...(fmtList(profile.ideal_traits).length > 0
            ? ([
                { kind: "paragraph", text: "Traits that signal a fit:", bold: true },
                { kind: "bullets", items: fmtList(profile.ideal_traits) },
              ] as DocBlock[])
            : []),
        ],
      },
      {
        title: "5. Disqualifiers (rules them out)",
        level: 1,
        blocks: [
          ...(fmtList(profile.common_disqualifiers).length > 0
            ? ([
                { kind: "bullets", items: fmtList(profile.common_disqualifiers) },
              ] as DocBlock[])
            : ([
                { kind: "paragraph", text: "—" },
              ] as DocBlock[])),
        ],
      },
      {
        title: "6. Discovery Day mechanics",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              { label: "Discovery Day format", value: fmtSelect(profile.discovery_day_format, [
                { value: "in_person_hq", label: "In-person at headquarters" },
                { value: "virtual", label: "Virtual / video" },
                { value: "hybrid", label: "Hybrid — virtual screen, in-person decision day" },
              ]) },
              { label: "Duration (hours)", value: fmtInt(profile.discovery_day_duration_hours) },
              { label: "Background check required?", value: fmtBool(profile.background_check_required) },
              { label: "Credit check required?", value: fmtBool(profile.credit_check_required) },
              { label: "References required (count)", value: fmtInt(profile.references_required_count) },
            ],
          },
        ],
      },
      {
        title: "7. Recruitment funnel",
        level: 1,
        blocks: [
          ...(fmtList(profile.target_recruitment_channels).length > 0
            ? ([
                { kind: "paragraph", text: "Where you'll find them:", bold: true },
                { kind: "bullets", items: fmtList(profile.target_recruitment_channels) },
              ] as DocBlock[])
            : []),
          ...(isFilled(profile.typical_decision_timeline_days)
            ? ([
                {
                  kind: "paragraph",
                  text: `Typical decision timeline (first call → signed agreement): ${fmtInt(profile.typical_decision_timeline_days)} days.`,
                },
              ] as DocBlock[])
            : []),
        ],
      },
    ],
  };
}

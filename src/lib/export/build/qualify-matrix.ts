/**
 * Qualify Matrix builder.
 *
 * The structured pre-Discovery Day candidate scorecard. Distinct from
 * the Franchisee Scoring Matrix (which is the deeper post-Discovery
 * evaluation rubric) — this one is the lightweight first-pass filter
 * the franchisor runs against every applicant to decide who gets a
 * Discovery Day invite at all.
 */

import type { BuildContext, DeliverableDoc, DocBlock } from "../types";
import { sectionFields } from "../context-helpers";
import { fmtBool, fmtCurrency, fmtInt, fmtList, fmtText, isFilled } from "../format";

export function buildQualifyMatrix(ctx: BuildContext): DeliverableDoc {
  const profile = sectionFields(ctx, "franchisee_profile");
  const overview = sectionFields(ctx, "business_overview");

  const businessName =
    fmtText(overview.concept_summary).split(/[.\n]/)[0]?.trim() || "Your Franchise";

  return {
    title: `${businessName} — Qualification Matrix`,
    subtitle: "Pre-Discovery Day candidate filter",
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
      "Run every applicant through this matrix BEFORE inviting them to Discovery Day. The single biggest predictor of failed franchise sales is bringing under-qualified candidates into the room — protect Discovery Day for genuine prospects.",
    sections: [
      {
        title: "1. Hard Financial Floors",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              {
                label: "Min liquid capital",
                value: fmtCurrency(profile.minimum_liquid_capital_dollars),
              },
              {
                label: "Min net worth",
                value: fmtCurrency(profile.minimum_net_worth_dollars),
              },
              {
                label: "Min credit score",
                value: fmtInt(profile.minimum_credit_score),
              },
              {
                label: "Accepts SBA financing",
                value: fmtBool(profile.accepts_sba_financed),
              },
            ],
          },
          {
            kind: "callout",
            text: "Applicants who fail any hard floor get a polite no — even if they're enthusiastic. The exception is when SBA financing closes the gap and the candidate is otherwise exceptional.",
            tone: "warning",
          },
        ],
      },
      {
        title: "2. Experience Requirements",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              {
                label: "Prior business ownership",
                value: fmtBool(profile.prior_business_ownership_required),
              },
              {
                label: "Prior industry experience",
                value: fmtBool(profile.prior_industry_experience_required),
              },
              {
                label: "Min years business experience",
                value: isFilled(profile.minimum_years_business_experience)
                  ? `${fmtInt(profile.minimum_years_business_experience)} years`
                  : "—",
              },
              {
                label: "Specific experience notes",
                value: fmtText(profile.specific_experience_notes),
              },
            ],
          },
        ],
      },
      {
        title: "3. Engagement Model",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              {
                label: "Engagement model",
                value: fmtText(profile.engagement_model),
              },
              {
                label: "Min hours/week from operator",
                value: isFilled(profile.minimum_hours_per_week)
                  ? `${fmtInt(profile.minimum_hours_per_week)}`
                  : "—",
              },
              {
                label: "Relocation required",
                value: fmtBool(profile.relocation_required),
              },
            ],
          },
        ],
      },
      {
        title: "4. Qualitative Filters",
        level: 1,
        blocks: [
          ...(isFilled(profile.ideal_traits)
            ? ([
                {
                  kind: "paragraph",
                  text: "Traits we look for:",
                  bold: true,
                } as DocBlock,
                {
                  kind: "bullets",
                  items: fmtList(profile.ideal_traits),
                } as DocBlock,
              ])
            : []),
          ...(isFilled(profile.common_disqualifiers)
            ? ([
                {
                  kind: "paragraph",
                  text: "Common disqualifiers:",
                  bold: true,
                } as DocBlock,
                {
                  kind: "bullets",
                  items: fmtList(profile.common_disqualifiers),
                } as DocBlock,
              ])
            : []),
        ],
      },
      {
        title: "5. The Filter (Pass / Fail)",
        level: 1,
        blocks: [
          {
            kind: "table",
            headers: ["Check", "Pass condition", "Status"],
            rows: [
              ["Liquid capital", `≥ ${fmtCurrency(profile.minimum_liquid_capital_dollars)}`, "[PASS / FAIL]"],
              ["Net worth", `≥ ${fmtCurrency(profile.minimum_net_worth_dollars)}`, "[PASS / FAIL]"],
              ["Credit score", `≥ ${fmtInt(profile.minimum_credit_score)}`, "[PASS / FAIL]"],
              ["Background check", "Clean", "[PASS / FAIL]"],
              ["Industry alignment", "Aligns with our concept", "[PASS / FAIL]"],
              ["Operator commitment", "Yes — full engagement", "[PASS / FAIL]"],
              ["Cultural fit", "Subjective — gut + interview", "[PASS / FAIL]"],
            ],
          },
          {
            kind: "callout",
            text: "Candidate must PASS every row to advance to Discovery Day. One borderline row is acceptable if the rest are unambiguous; two borderline rows = decline.",
            tone: "info",
          },
        ],
      },
      {
        title: "6. Background & Credit Checks",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              {
                label: "Background check required",
                value: fmtBool(profile.background_check_required),
              },
              {
                label: "Credit check required",
                value: fmtBool(profile.credit_check_required),
              },
            ],
          },
        ],
      },
      {
        title: "7. Recruitment Channels",
        level: 1,
        blocks: [
          isFilled(profile.target_recruitment_channels)
            ? ({ kind: "bullets", items: fmtList(profile.target_recruitment_channels) } as DocBlock)
            : ({
                kind: "paragraph",
                text: "No channels specified — capture in the franchisee_profile section so the marketing team knows where to focus spend.",
              } as DocBlock),
        ],
      },
    ],
  };
}

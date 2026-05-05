/**
 * Marketing Fund Manual builder.
 *
 * Compiles `marketing_fund` chapter into the governance document
 * franchisees receive describing how the brand fund is collected,
 * what it can be spent on, who decides, and how it's audited.
 * Distinct from the FDD (which discloses the fund) and the brand
 * standards manual (which prescribes how the brand is used) — this
 * is the operational governance.
 */

import type { BuildContext, DeliverableDoc, DocBlock } from "../types";
import { chapterFields } from "../context-helpers";
import {
  fmtBool,
  fmtCurrency,
  fmtInt,
  fmtList,
  fmtPct,
  fmtSelect,
  fmtText,
  isFilled,
} from "../format";

export function buildMarketingFundManual(ctx: BuildContext): DeliverableDoc {
  const fund = chapterFields(ctx, "marketing_fund");
  const overview = chapterFields(ctx, "business_overview");
  const franchise = chapterFields(ctx, "franchise_economics");

  const businessName =
    fmtText(overview.concept_summary).split(/[.\n]/)[0]?.trim() ||
    "Your Franchise";

  return {
    title: `${businessName} — Marketing Fund Manual`,
    subtitle: "Brand fund governance for franchisees",
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
      "This Marketing Fund Manual is generated from your Blueprint. Treat it as the governance document franchisees rely on; once finalized, changes flow through the advisory board (where applicable).",
    sections: [
      {
        title: "1. Purpose & Scope",
        level: 1,
        blocks: [
          {
            kind: "paragraph",
            text: `This manual describes how ${businessName}'s Brand Fund is collected, governed, spent, and reported. Every franchisee contributes per the franchise agreement; this document is how those dollars get put to work.`,
          },
        ],
      },
      {
        title: "2. Contribution Rates",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              {
                label: "Brand fund contribution",
                value: fmtPct(franchise.ad_fund_pct),
              },
              {
                label: "Local marketing minimum",
                value: fmtPct(franchise.local_marketing_minimum_pct),
              },
              {
                label: "Min spend on brand-approved channels",
                value: fmtPct(fund.minimum_brand_spend_pct),
              },
              {
                label: "Grand opening marketing required",
                value: fmtBool(fund.grand_opening_marketing_required),
              },
            ],
          },
        ],
      },
      {
        title: "3. Governance",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              {
                label: "Governance model",
                value: fmtSelect(fund.fund_governance_model, [
                  { value: "franchisor_controlled", label: "Franchisor controlled" },
                  { value: "advisory_board", label: "Advisory board" },
                  { value: "franchisee_elected_board", label: "Franchisee-elected board" },
                ]),
              },
              {
                label: "Advisory board size",
                value: isFilled(fund.advisory_board_size)
                  ? `${fmtInt(fund.advisory_board_size)} members`
                  : "—",
              },
              {
                label: "Election method",
                value: fmtText(fund.board_election_method),
              },
              {
                label: "Term length",
                value: isFilled(fund.board_term_length_years)
                  ? `${fmtInt(fund.board_term_length_years)} years`
                  : "—",
              },
            ],
          },
        ],
      },
      {
        title: "4. Approved Uses of Fund Dollars",
        level: 1,
        blocks: [
          ...(isFilled(fund.approved_uses)
            ? [{ kind: "bullets", items: fmtList(fund.approved_uses) } as DocBlock]
            : [
                {
                  kind: "callout",
                  text: "Approved uses haven't been documented yet. Add them to the marketing_fund chapter so this section reads with authority.",
                  tone: "warning",
                } as DocBlock,
              ]),
        ],
      },
      {
        title: "5. Excluded Uses",
        level: 1,
        blocks: [
          ...(isFilled(fund.excluded_uses)
            ? [{ kind: "bullets", items: fmtList(fund.excluded_uses) } as DocBlock]
            : [
                {
                  kind: "paragraph",
                  text: "Fund dollars cannot be used for any purpose not listed in section 4.",
                } as DocBlock,
              ]),
        ],
      },
      {
        title: "6. Reporting & Audits",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              {
                label: "Reporting cadence",
                value: fmtText(fund.reporting_cadence),
              },
              {
                label: "Audit required",
                value: fmtBool(fund.audit_required),
              },
              {
                label: "Audit frequency",
                value: fmtText(fund.audit_frequency),
              },
              {
                label: "Carryover policy",
                value: fmtText(fund.carryover_policy),
              },
            ],
          },
        ],
      },
      {
        title: "7. Local Marketing Obligations",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              {
                label: "Local marketing required",
                value: fmtBool(fund.local_marketing_spend_required),
              },
              {
                label: "Pre-approval required",
                value: fmtBool(fund.local_marketing_pre_approval_required),
              },
            ],
          },
        ],
      },
    ],
  };
}

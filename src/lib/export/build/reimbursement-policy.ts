/**
 * Reimbursement Policy builder.
 *
 * Standalone expense policy document. Tells franchisees and their
 * teams what's reimbursable, what isn't, and the dollar thresholds
 * + receipt requirements that gate every expense category.
 */

import type { BuildContext, DeliverableDoc } from "../types";
import { sectionFields } from "../context-helpers";
import {
  fmtCurrency,
  fmtList,
  fmtNumber,
  fmtSelect,
  fmtText,
  isFilled,
} from "../format";

export function buildReimbursementPolicy(ctx: BuildContext): DeliverableDoc {
  const reimburse = sectionFields(ctx, "reimbursement_policy");
  const overview = sectionFields(ctx, "business_overview");

  const businessName =
    fmtText(overview.concept_summary).split(/[.\n]/)[0]?.trim() || "Your Franchise";

  return {
    title: `${businessName} — Reimbursement Policy`,
    subtitle: "Approved expenses, thresholds, and receipt requirements",
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
      "This policy applies to corporate-paid expenses. Franchisees may adopt this as their own policy or set stricter terms. State labor law may impose additional requirements (especially around mileage and meal reimbursement) — verify with local counsel.",
    sections: [
      {
        title: "1. Mileage & Travel",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              {
                label: "Mileage rate",
                value: isFilled(reimburse.mileage_rate_dollars_per_mile)
                  ? `${fmtCurrency(reimburse.mileage_rate_dollars_per_mile)}/mile`
                  : "—",
              },
              {
                label: "Meal per diem",
                value: fmtCurrency(reimburse.meal_per_diem_dollars),
              },
              {
                label: "Lodging per diem",
                value: fmtCurrency(reimburse.lodging_per_diem_dollars),
              },
              {
                label: "Airfare class",
                value: fmtSelect(reimburse.airfare_class, [
                  { value: "economy", label: "Economy" },
                  { value: "economy_plus", label: "Economy Plus / Premium Economy" },
                  { value: "business", label: "Business" },
                ]),
              },
            ],
          },
        ],
      },
      {
        title: "2. Approval Thresholds",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              {
                label: "Single-expense approval threshold",
                value: fmtCurrency(reimburse.single_expense_approval_threshold_dollars),
              },
              {
                label: "Monthly cap per employee",
                value: fmtCurrency(reimburse.monthly_expense_cap_dollars),
              },
              {
                label: "Receipt required threshold",
                value: fmtCurrency(reimburse.receipt_required_threshold_dollars),
              },
            ],
          },
          {
            kind: "callout",
            text: "Expenses above the single-expense threshold require prior approval. Expenses without receipts above the receipt threshold are not reimbursable.",
            tone: "info",
          },
        ],
      },
      {
        title: "3. Non-Reimbursable Categories",
        level: 1,
        blocks: [
          isFilled(reimburse.non_reimbursable_categories)
            ? { kind: "bullets", items: fmtList(reimburse.non_reimbursable_categories) }
            : {
                kind: "paragraph",
                text: "Standard exclusions: alcohol unrelated to client entertainment, personal travel, fines/penalties, and any expense without a documented business purpose.",
              },
        ],
      },
      {
        title: "4. Submission & Payment",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              {
                label: "Expense reporting software",
                value: fmtText(reimburse.expense_reporting_software),
              },
              {
                label: "Payment schedule",
                value: fmtSelect(reimburse.reimbursement_payment_schedule, [
                  { value: "weekly", label: "Weekly" },
                  { value: "biweekly", label: "Biweekly" },
                  { value: "monthly", label: "Monthly" },
                  { value: "with_payroll", label: "With payroll" },
                ]),
              },
            ],
          },
        ],
      },
    ],
  };
}

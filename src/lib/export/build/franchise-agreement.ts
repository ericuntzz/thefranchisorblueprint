/**
 * Franchise Agreement TEMPLATE builder.
 *
 * IMPORTANT: This is a structural scaffold for an attorney to finalize.
 * Every clause is marked `[NEEDS ATTORNEY REVIEW]` and most legal
 * substance is intentionally placeholder. The point is to give an
 * attorney a starting point that already has the customer's
 * deal terms (royalty, fee, term, territory) injected from Memory —
 * saving them the boilerplate-extraction work that's typically
 * 4-8 billable hours per agreement.
 *
 * The customer must NOT use this document as-is. The exported file
 * is for handoff to a vetted franchise attorney who will:
 *   1. Confirm or replace every `[NEEDS ATTORNEY REVIEW]` clause
 *   2. Conform the agreement to the franchisor's home state
 *   3. Add jurisdiction-specific addenda (registration states require
 *      individualized riders)
 *   4. Coordinate with the FDD draft for consistency between Items 5/6
 *      and the underlying agreement
 */

import type { BuildContext, DeliverableDoc, DocBlock } from "../types";
import { chapterFields } from "../context-helpers";
import {
  fmtCurrency,
  fmtInt,
  fmtPct,
  fmtSelect,
  fmtText,
  isFilled,
} from "../format";

const REVIEW = "[NEEDS ATTORNEY REVIEW]";

export function buildFranchiseAgreement(ctx: BuildContext): DeliverableDoc {
  const overview = chapterFields(ctx, "business_overview");
  const franchise = chapterFields(ctx, "franchise_economics");
  const compliance = chapterFields(ctx, "compliance_legal");

  const businessName =
    fmtText(overview.concept_summary).split(/[.\n]/)[0]?.trim() || "Your Franchise";

  return {
    title: `${businessName} — Franchise Agreement`,
    subtitle: "Template for attorney review and finalization",
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
      {
        label: "Status",
        value: "TEMPLATE — NOT EXECUTABLE",
      },
    ],
    disclaimer:
      "THIS IS A TEMPLATE. Do NOT execute this agreement as-is. Every section marked [NEEDS ATTORNEY REVIEW] requires attorney finalization. Use this as the starting point in a conversation with a franchise attorney; The Franchisor Blueprint is not a law firm and this document is not legal advice.",
    sections: [
      {
        title: "Preamble & Recitals",
        level: 1,
        blocks: [
          {
            kind: "paragraph",
            text: `This Franchise Agreement ("Agreement") is entered into between [Franchisor Legal Entity Name] ("Franchisor"), a [STATE] [entity type], and [Franchisee Legal Name] ("Franchisee"), as of [DATE].`,
          },
          {
            kind: "paragraph",
            text: `WHEREAS, Franchisor owns and operates the ${businessName} system; and WHEREAS, Franchisee desires to operate one (1) ${businessName} location under the System; NOW, THEREFORE, the parties agree as follows.`,
          },
          { kind: "callout", text: REVIEW + " — confirm legal entity types and recitals match FDD Item 1.", tone: "warning" },
        ],
      },
      {
        title: "1. Grant of Franchise",
        level: 1,
        blocks: [
          {
            kind: "paragraph",
            text:
              "Franchisor grants to Franchisee a non-exclusive franchise to operate one (1) location at the Approved Site, using the System and the Marks, for the Term, subject to this Agreement.",
          },
          { kind: "callout", text: REVIEW, tone: "warning" },
        ],
      },
      {
        title: "2. Term & Renewal",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              {
                label: "Initial term",
                value: isFilled(franchise.term_years)
                  ? `${fmtInt(franchise.term_years)} years from the Effective Date`
                  : "[NEEDS ATTORNEY REVIEW] years",
              },
              {
                label: "Renewal term",
                value: isFilled(franchise.renewal_term_years)
                  ? `${fmtInt(franchise.renewal_term_years)} years per renewal`
                  : "[NEEDS ATTORNEY REVIEW] years",
              },
              {
                label: "Renewals allowed",
                value: isFilled(franchise.renewal_count_allowed)
                  ? `${fmtInt(franchise.renewal_count_allowed)}`
                  : "[NEEDS ATTORNEY REVIEW]",
              },
              {
                label: "Renewal fee",
                value: isFilled(franchise.renewal_fee_dollars)
                  ? fmtCurrency(franchise.renewal_fee_dollars)
                  : "[NEEDS ATTORNEY REVIEW]",
              },
            ],
          },
          {
            kind: "callout",
            text:
              REVIEW +
              " — confirm renewal conditions (notice window, refurbishment requirements, then-current FDD acceptance).",
            tone: "warning",
          },
        ],
      },
      {
        title: "3. Initial Franchise Fee & Payments",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              {
                label: "Initial franchise fee",
                value: fmtCurrency(franchise.franchise_fee_dollars),
              },
              {
                label: "Multi-unit / area dev. fee",
                value: fmtCurrency(franchise.area_development_fee_dollars),
              },
              {
                label: "Training fee",
                value: fmtCurrency(franchise.training_fee_dollars),
              },
              {
                label: "Transfer fee",
                value: fmtCurrency(franchise.transfer_fee_dollars),
              },
              {
                label: "Tech fee",
                value: isFilled(franchise.technology_fee_dollars_per_month)
                  ? `${fmtCurrency(franchise.technology_fee_dollars_per_month)}/month`
                  : "—",
              },
            ],
          },
          { kind: "callout", text: REVIEW + " — refundability and timing.", tone: "warning" },
        ],
      },
      {
        title: "4. Royalty",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              {
                label: "Royalty rate",
                value: fmtPct(franchise.royalty_rate_pct),
              },
              {
                label: "Calculation basis",
                value: fmtSelect(franchise.royalty_rate_basis, [
                  { value: "gross_sales", label: "Gross sales" },
                  { value: "net_sales", label: "Net sales" },
                  { value: "fixed_amount", label: "Fixed amount" },
                ]),
              },
              {
                label: "Payment frequency",
                value: fmtSelect(franchise.royalty_payment_frequency, [
                  { value: "weekly", label: "Weekly" },
                  { value: "biweekly", label: "Biweekly" },
                  { value: "monthly", label: "Monthly" },
                ]),
              },
              {
                label: "Royalty minimum",
                value: fmtCurrency(franchise.royalty_minimum_dollars),
              },
            ],
          },
          {
            kind: "callout",
            text: REVIEW + " — define gross/net sales precisely; specify reporting and audit cure periods.",
            tone: "warning",
          },
        ],
      },
      {
        title: "5. Brand Fund Contribution",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              {
                label: "Contribution rate",
                value: fmtPct(franchise.ad_fund_pct),
              },
              {
                label: "Local marketing minimum",
                value: fmtPct(franchise.local_marketing_minimum_pct),
              },
            ],
          },
          {
            kind: "callout",
            text:
              REVIEW + " — fund use limitations, accounting separation, audit rights.",
            tone: "warning",
          },
        ],
      },
      {
        title: "6. Territory",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              {
                label: "Protection type",
                value: fmtSelect(franchise.territory_protection_type, [
                  { value: "exclusive", label: "Exclusive" },
                  { value: "non_exclusive", label: "Non-exclusive" },
                  { value: "protected_radius", label: "Protected radius" },
                  { value: "designated_market_area", label: "DMA" },
                ]),
              },
              {
                label: "Radius",
                value: isFilled(franchise.territory_radius_miles)
                  ? `${fmtInt(franchise.territory_radius_miles)} miles`
                  : "—",
              },
              {
                label: "Population",
                value: isFilled(franchise.territory_population_count)
                  ? `${fmtInt(franchise.territory_population_count)}`
                  : "—",
              },
            ],
          },
          {
            kind: "callout",
            text:
              REVIEW +
              " — alternative channels reserved by Franchisor (online, catering, wholesale). Carve-outs must be explicit.",
            tone: "warning",
          },
        ],
      },
      {
        title: "7. Operations & System",
        level: 1,
        blocks: [
          {
            kind: "paragraph",
            text:
              "Franchisee shall operate the franchised business in strict accordance with the System, including the Operations Manual, brand standards, training curriculum, approved supplier list, and all written policies as updated from time to time.",
          },
          { kind: "callout", text: REVIEW + " — audit rights, modifications notice, manual updates.", tone: "warning" },
        ],
      },
      {
        title: "8. Training & Opening Assistance",
        level: 1,
        blocks: [
          { kind: "paragraph", text: "Franchisor shall provide initial training as set forth in the Operations Manual." },
          { kind: "callout", text: REVIEW + " — re-training fees, new manager certification.", tone: "warning" },
        ],
      },
      {
        title: "9. Reporting, Records, & Audit",
        level: 1,
        blocks: [
          { kind: "paragraph", text: "Franchisee shall maintain books and records in accordance with GAAP for [N] years and provide weekly POS-derived sales reports." },
          { kind: "callout", text: REVIEW + " — POS integration, electronic submission, surprise audit, cost-shift on >2% understatement.", tone: "warning" },
        ],
      },
      {
        title: "10. Insurance",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              {
                label: "General liability minimum",
                value: fmtCurrency(/* attempt to read from compliance_legal too */ compliance.general_liability_minimum_dollars),
              },
              {
                label: "Additional coverage",
                value: fmtText(compliance.additional_insurance_required),
              },
            ],
          },
          { kind: "callout", text: REVIEW + " — workers comp, cyber, EPLI, named-insured requirements.", tone: "warning" },
        ],
      },
      {
        title: "11. Transfer, Assignment, & Right of First Refusal",
        level: 1,
        blocks: [
          { kind: "paragraph", text: "Franchisee may not transfer this Agreement, the franchised business, or any equity interest in Franchisee without prior written consent of Franchisor." },
          { kind: "callout", text: REVIEW + " — ROFR mechanics, family transfer carve-outs, post-transfer training.", tone: "warning" },
        ],
      },
      {
        title: "12. Default & Termination",
        level: 1,
        blocks: [
          {
            kind: "bullets",
            items: [
              "Failure to pay royalty or brand fund (cure: [N] days)",
              "Failure to maintain insurance",
              "Material misrepresentation in application",
              "Repeated brand-standards violations",
              "Bankruptcy / insolvency",
              "Loss of liquor / health / occupancy permit (where applicable)",
            ],
          },
          { kind: "callout", text: REVIEW + " — non-curable defaults must be enumerated; cure periods state-specific.", tone: "warning" },
        ],
      },
      {
        title: "13. Post-Termination Obligations",
        level: 1,
        blocks: [
          { kind: "paragraph", text: "Upon termination or expiration, Franchisee shall: cease use of Marks; deliver Operations Manual and confidential information; assign telephone numbers and digital assets; comply with non-compete (subject to state law)." },
          { kind: "callout", text: REVIEW + " — non-compete enforceability varies by state; carve-out California, North Dakota, Oklahoma.", tone: "warning" },
        ],
      },
      {
        title: "14. Confidentiality & Intellectual Property",
        level: 1,
        blocks: [
          { kind: "paragraph", text: "All System materials, recipes, supplier relationships, and customer data are Franchisor's confidential information." },
          { kind: "callout", text: REVIEW + " — pre-existing IP carve-outs, IP indemnity.", tone: "warning" },
        ],
      },
      {
        title: "15. Indemnification & Limitation of Liability",
        level: 1,
        blocks: [
          { kind: "paragraph", text: "Franchisee indemnifies Franchisor against all claims arising from operation of the franchised business." },
          { kind: "callout", text: REVIEW + " — mutual indemnity, cap on damages, consequential damages waiver.", tone: "warning" },
        ],
      },
      {
        title: "16. Dispute Resolution",
        level: 1,
        blocks: [
          { kind: "paragraph", text: "Disputes shall be resolved by [mediation / arbitration / litigation] in [VENUE], applying the law of [STATE]." },
          { kind: "callout", text: REVIEW + " — class action waiver, jury trial waiver, attorney fee provisions, state anti-waiver statutes.", tone: "warning" },
        ],
      },
      {
        title: "17. State-Specific Addenda",
        level: 1,
        blocks: [
          { kind: "paragraph", text: "Registration states require individualized addenda. The State Registration Matrix lists each state where a separate addendum is required." },
          { kind: "callout", text: REVIEW + " — registration states (CA, HI, IL, IN, MD, MI, MN, NY, ND, RI, SD, VA, WA, WI) all need individual riders.", tone: "warning" },
        ],
      },
      {
        title: "18. Miscellaneous",
        level: 1,
        blocks: [
          { kind: "bullets", items: ["Notices", "Severability", "Entire agreement / merger", "Force majeure", "Assignment by Franchisor permitted"] },
          { kind: "callout", text: REVIEW, tone: "warning" },
        ],
      },
      {
        title: "Signature Page",
        level: 1,
        blocks: [
          { kind: "paragraph", text: "FRANCHISOR: _________________________  Title: _____________  Date: _____________" },
          { kind: "spacer" },
          { kind: "paragraph", text: "FRANCHISEE: _________________________  Title: _____________  Date: _____________" },
        ],
      },
    ],
  };
}

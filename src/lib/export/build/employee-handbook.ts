/**
 * Employee Handbook builder.
 *
 * Standalone HR policy doc franchisees can adopt directly or use as
 * a starting point for their state-specific handbook. Distinct from
 * the Operations Manual (which prescribes how the work is done) —
 * this is the rulebook for the people doing it.
 */

import type { BuildContext, DeliverableDoc, DocBlock } from "../types";
import { chapterFields } from "../load";
import {
  fmtBool,
  fmtCurrency,
  fmtInt,
  fmtList,
  fmtNumber,
  fmtSelect,
  fmtText,
  isFilled,
} from "../format";

export function buildEmployeeHandbook(ctx: BuildContext): DeliverableDoc {
  const handbook = chapterFields(ctx, "employee_handbook");
  const overview = chapterFields(ctx, "business_overview");

  const businessName =
    fmtText(overview.concept_summary).split(/[.\n]/)[0]?.trim() || "Your Franchise";

  return {
    title: `${businessName} — Employee Handbook`,
    subtitle: "Code of conduct, scheduling, compensation, and termination policies",
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
      "This handbook is a starting point. Each franchisee MUST adapt it for state-specific employment law (especially around at-will employment, non-compete enforceability, sick leave, and tip pooling) before distributing to staff. Have local counsel review before adoption.",
    sections: [
      {
        title: "1. Welcome & Code of Conduct",
        level: 1,
        blocks: [
          {
            kind: "paragraph",
            text: `Working at ${businessName} means representing the brand with every customer interaction. This handbook describes the standards we hold each other to, the benefits you've earned, and the policies that govern our workplace.`,
          },
          ...(isFilled(handbook.customer_service_standards)
            ? ([
                { kind: "paragraph", text: "Customer service standards:", bold: true } as DocBlock,
                { kind: "paragraph", text: fmtText(handbook.customer_service_standards) } as DocBlock,
              ])
            : []),
        ],
      },
      {
        title: "2. Scheduling & Hours",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              {
                label: "Standard full-time hours",
                value: isFilled(handbook.standard_full_time_hours_per_week)
                  ? `${fmtInt(handbook.standard_full_time_hours_per_week)} hrs/week`
                  : "—",
              },
              {
                label: "Minimum shifts/week",
                value: isFilled(handbook.minimum_shifts_per_week)
                  ? `${fmtInt(handbook.minimum_shifts_per_week)}`
                  : "—",
              },
              {
                label: "Scheduling software",
                value: fmtText(handbook.scheduling_software),
              },
            ],
          },
        ],
      },
      {
        title: "3. Compensation & Tips",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              {
                label: "Minimum starting wage",
                value: isFilled(handbook.minimum_starting_wage_dollars_per_hour)
                  ? `${fmtCurrency(handbook.minimum_starting_wage_dollars_per_hour)}/hr`
                  : "—",
              },
              {
                label: "Tip pooling policy",
                value: fmtSelect(handbook.tip_pooling_policy),
              },
              {
                label: "Performance review cadence",
                value: fmtText(handbook.performance_review_cadence),
              },
            ],
          },
          {
            kind: "callout",
            text: "Wage rates must meet or exceed state and local minimum wage. Tip pooling is regulated state-by-state — verify compliance with local counsel before implementing.",
            tone: "warning",
          },
        ],
      },
      {
        title: "4. Time Off & Benefits",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              {
                label: "PTO days/year",
                value: isFilled(handbook.pto_days_per_year)
                  ? `${fmtInt(handbook.pto_days_per_year)}`
                  : "—",
              },
              {
                label: "Paid sick days/year",
                value: isFilled(handbook.paid_sick_days_per_year)
                  ? `${fmtInt(handbook.paid_sick_days_per_year)}`
                  : "—",
              },
              {
                label: "Paid holidays",
                value: fmtText(handbook.paid_holidays),
              },
              {
                label: "Health benefits",
                value: fmtText(handbook.health_benefits_offered),
              },
              {
                label: "Retirement benefits",
                value: fmtText(handbook.retirement_benefits_offered),
              },
            ],
          },
        ],
      },
      {
        title: "5. Uniform & Brand Standards",
        level: 1,
        blocks: [
          isFilled(handbook.uniform_requirements)
            ? ({ kind: "paragraph", text: fmtText(handbook.uniform_requirements) } as DocBlock)
            : ({
                kind: "callout",
                text: "Uniform requirements not yet documented in the employee_handbook chapter.",
                tone: "neutral",
              } as DocBlock),
        ],
      },
      {
        title: "6. Social Media & Communications",
        level: 1,
        blocks: [
          isFilled(handbook.social_media_policy)
            ? ({ kind: "paragraph", text: fmtText(handbook.social_media_policy) } as DocBlock)
            : ({
                kind: "paragraph",
                text: "Employees are expected to represent the brand professionally on social media. Don't post about ongoing customer interactions or share confidential information.",
              } as DocBlock),
        ],
      },
      {
        title: "7. Employment Terms",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              {
                label: "At-will employment",
                value: fmtBool(handbook.at_will_employment_required),
              },
              {
                label: "Non-compete required",
                value: fmtBool(handbook.non_compete_required),
              },
              {
                label: "Termination appeal process",
                value: fmtText(handbook.termination_appeal_process),
              },
            ],
          },
          {
            kind: "callout",
            text: "Non-compete enforceability varies dramatically by state. California and several others restrict or ban them entirely. Verify with local counsel before requiring signature.",
            tone: "warning",
          },
        ],
      },
      {
        title: "8. Acknowledgment",
        level: 1,
        blocks: [
          {
            kind: "paragraph",
            text:
              "Employee signature acknowledging receipt of this handbook required before first shift. Maintain signed copies in personnel files for the duration of employment plus state retention period.",
            italic: true,
          },
        ],
      },
    ],
  };
}

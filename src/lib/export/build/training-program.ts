/**
 * Training Program builder.
 *
 * Pulls training_program + relevant operating_model fields into the
 * training curriculum doc franchisees inherit. Different from the
 * Operations Manual's training section: that's the *outline*; this
 * is the *curriculum*.
 */

import type { BuildContext, DeliverableDoc, DocBlock } from "../types";
import { chapterFields } from "../load";
import { fmtBool, fmtInt, fmtList, fmtText, isFilled } from "../format";

export function buildTrainingProgram(ctx: BuildContext): DeliverableDoc {
  const training = chapterFields(ctx, "training_program");
  const ops = chapterFields(ctx, "operating_model");
  const overview = chapterFields(ctx, "business_overview");

  const businessName =
    fmtText(overview.concept_summary).split(/[.\n]/)[0]?.trim() || "Your Franchise";

  return {
    title: `${businessName} — Training Program`,
    subtitle: "Initial certification, opening support, and ongoing training",
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
      "Training is the single biggest predictor of unit-level success. Treat this curriculum as the floor, not the ceiling — refine each module as you learn what new operators actually struggle with.",
    sections: [
      {
        title: "1. Initial Training",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              {
                label: "Duration",
                value: isFilled(training.initial_training_duration_days)
                  ? `${fmtInt(training.initial_training_duration_days)} days`
                  : "—",
              },
              {
                label: "Format",
                value: fmtText(training.initial_training_format),
              },
              {
                label: "Required attendees",
                value: fmtText(training.initial_training_attendees),
              },
              {
                label: "Travel at franchisee expense",
                value: fmtBool(training.training_travel_at_franchisee_expense),
              },
            ],
          },
          {
            kind: "callout",
            text: "All initial-training attendees must complete the full curriculum before the unit opens. No exceptions for absences during the training window.",
            tone: "info",
          },
        ],
      },
      {
        title: "2. Curriculum Modules",
        level: 1,
        blocks: [
          {
            kind: "paragraph",
            text:
              "The initial training curriculum spans the following module families. Each module includes lecture, hands-on practice, and a competency check before advancing.",
          },
          {
            kind: "bullets",
            items: [
              "Brand & Concept — what the brand stands for, how it sounds, common mistakes",
              "Operations Fundamentals — opening, closing, peak-hour staffing, daily checklists",
              "Product / Service Standards — recipe / spec adherence, quality control",
              "People Operations — hiring, onboarding, coaching, termination",
              "Financial Discipline — daily reconciliation, weekly P&L, COGS management",
              "Technology Stack — POS, scheduling, inventory, customer data",
              "Customer Experience — service standards, complaint resolution, escalation",
              "Compliance — health/safety, employment law basics, brand fund obligations",
            ],
          },
        ],
      },
      {
        title: "3. Opening Support",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              {
                label: "Days on-site",
                value: isFilled(training.opening_support_days_on_site)
                  ? `${fmtInt(training.opening_support_days_on_site)} days`
                  : "—",
              },
              {
                label: "Team size",
                value: isFilled(training.opening_support_team_size)
                  ? `${fmtInt(training.opening_support_team_size)} people`
                  : "—",
              },
            ],
          },
          {
            kind: "paragraph",
            text:
              "Opening support team is on-site through the soft-open period and the first week of full operations. After that, transitions to remote support unless the franchisee escalates.",
          },
        ],
      },
      {
        title: "4. Ongoing Training",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              {
                label: "Ongoing training required",
                value: fmtBool(training.ongoing_training_required),
              },
              {
                label: "Annual conference required",
                value: fmtBool(training.annual_conference_required),
              },
              {
                label: "Certification required",
                value: fmtBool(training.certification_required),
              },
            ],
          },
          ...(isFilled(training.certification_levels)
            ? ([
                {
                  kind: "paragraph",
                  text: "Certification levels:",
                  bold: true,
                } as DocBlock,
                {
                  kind: "bullets",
                  items: fmtList(training.certification_levels),
                } as DocBlock,
              ])
            : []),
        ],
      },
      {
        title: "5. Daily Operating Rituals (post-training)",
        level: 1,
        blocks: [
          isFilled(ops.daily_rituals)
            ? ({ kind: "bullets", items: fmtList(ops.daily_rituals) } as DocBlock)
            : ({
                kind: "paragraph",
                text:
                  "Daily rituals (pre-shift huddle, end-of-day reconciliation, etc.) haven't been captured. Document them in the operating_model chapter so the training program teaches them.",
              } as DocBlock),
        ],
      },
    ],
  };
}

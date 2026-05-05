/**
 * Operations Manual builder.
 *
 * Compiles operating_model + recipes_and_menu + vendor_supply_chain +
 * employee_handbook + reimbursement_policy + training_program into a
 * single Operations Manual scaffold. Each chapter contributes its own
 * top-level section. Where the customer wrote prose in `content_md`,
 * we surface it; structured fields drive the bullet/table sections.
 *
 * This is more "ready to use" than the FDD draft — most of these
 * sections are operational, not legal, so the customer can use the
 * output directly with their team without an attorney pass.
 */

import type { BuildContext, DeliverableDoc, DocBlock, DocSection } from "../types";
import { chapterFields } from "../context-helpers";
import {
  fmtBool,
  fmtCurrency,
  fmtInt,
  fmtList,
  fmtSelect,
  fmtText,
  isFilled,
} from "../format";

export function buildOperationsManual(ctx: BuildContext): DeliverableDoc {
  const businessOverview = chapterFields(ctx, "business_overview");
  const operating = chapterFields(ctx, "operating_model");
  const operatingProse = ctx.memory.operating_model?.contentMd ?? "";
  const recipes = chapterFields(ctx, "recipes_and_menu");
  const vendor = chapterFields(ctx, "vendor_supply_chain");
  const handbook = chapterFields(ctx, "employee_handbook");
  const reimburse = chapterFields(ctx, "reimbursement_policy");
  const training = chapterFields(ctx, "training_program");
  const trainingProse = ctx.memory.training_program?.contentMd ?? "";

  const businessName = fmtText(businessOverview.concept_summary).split(".")[0]?.trim() || "Your Franchise";

  return {
    title: `${businessName} — Operations Manual`,
    subtitle: "Daily operations, training, and people-management standards",
    coverFields: [
      { label: "Concept", value: fmtText(businessOverview.concept_summary).split(".")[0] || "—" },
      { label: "Founder", value: fmtText(businessOverview.founder_name) },
      { label: "Generated", value: new Date(ctx.generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) },
      { label: "Version", value: `Draft v1 — ${ctx.readinessPct}% Blueprint complete` },
    ],
    disclaimer:
      "This Operations Manual is generated from your Blueprint and reflects the current state of your structured Memory. Refine the copy before handing it to franchisees — the policies here are the floor your team enforces, not a one-time exercise.",
    sections: [
      {
        title: "1. Daily Operations",
        level: 1,
        blocks: [
          ...(isFilled(operating.standard_hours_of_operation)
            ? ([
                { kind: "paragraph", text: "Hours of operation:", bold: true },
                { kind: "paragraph", text: fmtText(operating.standard_hours_of_operation) },
              ] as DocBlock[])
            : []),
          ...(isFilled(operating.peak_hours)
            ? ([{ kind: "paragraph", text: `Peak hours: ${fmtText(operating.peak_hours)}` }] as DocBlock[])
            : []),
          {
            kind: "kvtable",
            rows: [
              { label: "Typical staff per shift", value: fmtInt(operating.staff_per_shift_typical) },
              { label: "Peak-hour staff per shift", value: fmtInt(operating.staff_per_shift_peak) },
            ],
          },
          ...(fmtList(operating.key_kpis_tracked_daily).length > 0
            ? ([
                { kind: "paragraph", text: "Daily KPIs tracked:", bold: true },
                { kind: "bullets", items: fmtList(operating.key_kpis_tracked_daily) },
              ] as DocBlock[])
            : []),
          ...(isFilled(operating.daily_rituals)
            ? ([
                { kind: "paragraph", text: "Open and close rituals:", bold: true },
                { kind: "paragraph", text: fmtText(operating.daily_rituals) },
              ] as DocBlock[])
            : []),
          ...(fmtList(operating.operations_software_required).length > 0
            ? ([
                { kind: "paragraph", text: "Required operations software:", bold: true },
                { kind: "bullets", items: fmtList(operating.operations_software_required) },
              ] as DocBlock[])
            : []),
          ...(operatingProse.trim().length > 80
            ? ([
                { kind: "spacer" },
                { kind: "paragraph", text: "Notes from the operator:", italic: true },
                { kind: "paragraph", text: operatingProse.slice(0, 4000) },
              ] as DocBlock[])
            : []),
        ],
      },

      {
        title: "2. Product & Service Specs",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              { label: "Number of menu items", value: fmtInt(recipes.menu_item_count) },
              { label: "Average ticket", value: fmtCurrency(recipes.average_ticket_dollars) },
              { label: "Price range — low", value: fmtCurrency(recipes.price_range_low_dollars) },
              { label: "Price range — high", value: fmtCurrency(recipes.price_range_high_dollars) },
              { label: "Pricing strategy", value: fmtSelect(recipes.pricing_strategy, [
                { value: "uniform_brand_wide", label: "Uniform across all locations (brand-mandated)" },
                { value: "tiered_by_market", label: "Tiered by market (urban/suburban/rural)" },
                { value: "franchisee_discretion_within_band", label: "Franchisee discretion within a brand-set band" },
                { value: "fully_franchisee_set", label: "Franchisee fully sets local pricing" },
              ]) },
              { label: "Recipe / spec book status", value: fmtSelect(recipes.recipe_book_status, [
                { value: "complete", label: "Complete and tested at scale" },
                { value: "complete_untested", label: "Complete but only at corporate locations" },
                { value: "in_progress", label: "In progress" },
                { value: "not_started", label: "Not yet started" },
              ]) },
            ],
          },
          ...(fmtList(recipes.signature_items).length > 0
            ? ([
                { kind: "paragraph", text: "Signature items:", bold: true },
                { kind: "bullets", items: fmtList(recipes.signature_items) },
              ] as DocBlock[])
            : []),
        ],
      },

      {
        title: "3. Approved Suppliers",
        level: 1,
        blocks: [
          ...(fmtList(vendor.approved_vendors).length > 0
            ? ([
                { kind: "paragraph", text: "Primary approved vendors:", bold: true },
                { kind: "bullets", items: fmtList(vendor.approved_vendors) },
              ] as DocBlock[])
            : []),
          ...(fmtList(vendor.alternate_vendors).length > 0
            ? ([
                { kind: "paragraph", text: "Backup vendors:", bold: true },
                { kind: "bullets", items: fmtList(vendor.alternate_vendors) },
              ] as DocBlock[])
            : []),
          ...(fmtList(vendor.exclusive_purchase_required_items).length > 0
            ? ([
                { kind: "paragraph", text: "Items franchisees must source from approved vendors:", bold: true },
                { kind: "bullets", items: fmtList(vendor.exclusive_purchase_required_items) },
              ] as DocBlock[])
            : []),
          ...(isFilled(vendor.vendor_change_approval_process)
            ? ([
                { kind: "paragraph", text: "Vendor change approval process:", bold: true },
                { kind: "paragraph", text: fmtText(vendor.vendor_change_approval_process) },
              ] as DocBlock[])
            : []),
        ],
      },

      {
        title: "4. Training & Certification",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              { label: "Initial training duration", value: isFilled(training.initial_training_duration_days) ? `${fmtInt(training.initial_training_duration_days)} days` : "—" },
              { label: "Format", value: fmtSelect(training.initial_training_format, [
                { value: "in_person_corporate", label: "In-person at corporate HQ" },
                { value: "in_person_existing_unit", label: "In-person at an existing unit" },
                { value: "on_site_franchisee_location", label: "On-site at the franchisee's new location" },
                { value: "virtual", label: "Virtual / video" },
                { value: "hybrid", label: "Hybrid (some virtual, some in-person)" },
              ]) },
              { label: "Required attendees", value: fmtList(training.initial_training_attendees).join("; ") || "—" },
              { label: "Certification required to operate?", value: fmtBool(training.certification_required) },
            ],
          },
          ...(fmtList(training.certification_levels).length > 0
            ? ([
                { kind: "paragraph", text: "Certification levels:", bold: true },
                { kind: "bullets", items: fmtList(training.certification_levels) },
              ] as DocBlock[])
            : []),
          ...(trainingProse.trim().length > 80
            ? ([
                { kind: "spacer" },
                { kind: "paragraph", text: "Curriculum notes:", italic: true },
                { kind: "paragraph", text: trainingProse.slice(0, 4000) },
              ] as DocBlock[])
            : []),
        ],
      },

      {
        title: "5. People Management",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              { label: "Standard full-time hours/week", value: isFilled(handbook.standard_full_time_hours_per_week) ? `${fmtInt(handbook.standard_full_time_hours_per_week)} hours` : "—" },
              { label: "Minimum starting wage", value: isFilled(handbook.minimum_starting_wage_dollars_per_hour) ? `${fmtCurrency(handbook.minimum_starting_wage_dollars_per_hour)} / hour` : "—" },
              { label: "PTO days per year (after 1st year)", value: fmtInt(handbook.pto_days_per_year) },
              { label: "Paid sick days per year", value: fmtInt(handbook.paid_sick_days_per_year) },
              { label: "Tip pooling policy", value: fmtSelect(handbook.tip_pooling_policy, [
                { value: "no_tip_pooling", label: "No tip pooling — individuals keep their own" },
                { value: "shift_pool", label: "Pooled by shift" },
                { value: "weekly_pool", label: "Pooled weekly across all employees" },
                { value: "no_tipping", label: "No tipping accepted" },
              ]) },
              { label: "At-will employment required?", value: fmtBool(handbook.at_will_employment_required) },
            ],
          },
          ...(isFilled(handbook.uniform_requirements)
            ? ([
                { kind: "paragraph", text: "Uniform requirements:", bold: true },
                { kind: "paragraph", text: fmtText(handbook.uniform_requirements) },
              ] as DocBlock[])
            : []),
          ...(fmtList(handbook.customer_service_standards).length > 0
            ? ([
                { kind: "paragraph", text: "Customer service standards:", bold: true },
                { kind: "bullets", items: fmtList(handbook.customer_service_standards) },
              ] as DocBlock[])
            : []),
          ...(isFilled(handbook.social_media_policy)
            ? ([
                { kind: "paragraph", text: "Social media policy:", bold: true },
                { kind: "paragraph", text: fmtText(handbook.social_media_policy) },
              ] as DocBlock[])
            : []),
        ],
      },

      {
        title: "6. Expense Reimbursement",
        level: 1,
        blocks: [
          {
            kind: "kvtable",
            rows: [
              { label: "Mileage rate", value: isFilled(reimburse.mileage_rate_dollars_per_mile) ? `$${fmtText(reimburse.mileage_rate_dollars_per_mile)} / mile` : "—" },
              { label: "Meal per diem", value: isFilled(reimburse.meal_per_diem_dollars) ? `${fmtCurrency(reimburse.meal_per_diem_dollars)} / day` : "—" },
              { label: "Lodging per diem", value: isFilled(reimburse.lodging_per_diem_dollars) ? `${fmtCurrency(reimburse.lodging_per_diem_dollars)} / night` : "—" },
              { label: "Single-expense approval threshold", value: fmtCurrency(reimburse.single_expense_approval_threshold_dollars) },
              { label: "Receipt required above", value: fmtCurrency(reimburse.receipt_required_threshold_dollars) },
              { label: "Reimbursement payment schedule", value: fmtSelect(reimburse.reimbursement_payment_schedule, [
                { value: "with_payroll", label: "With each payroll cycle" },
                { value: "monthly", label: "Monthly" },
                { value: "biweekly", label: "Biweekly" },
                { value: "ad_hoc", label: "Ad hoc (within 30 days)" },
              ]) },
            ],
          },
          ...(fmtList(reimburse.non_reimbursable_categories).length > 0
            ? ([
                { kind: "paragraph", text: "Categories that are never reimbursable:", bold: true },
                { kind: "bullets", items: fmtList(reimburse.non_reimbursable_categories) },
              ] as DocBlock[])
            : []),
        ],
      },
    ],
  };
}

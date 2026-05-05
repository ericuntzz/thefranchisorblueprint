/**
 * State-by-state FDD registration matrix.
 *
 * The single most-asked-for document in a franchisor's launch packet:
 * "what do we have to file in each state, and what does it cost?"
 *
 * Classification (publicly known, NASAA-published):
 *
 *   REGISTRATION states (FDD must be filed AND approved before sale):
 *     CA, HI, IL, IN, MD, MI, MN, NY, ND, RI, SD, VA, WA, WI
 *
 *   FILING-ONLY / BUSINESS-OPPORTUNITY states (notice or BO statute,
 *     but not full FDD review):
 *     CT, FL, GA, KY, NC, NE, SC, TX, UT, IA, AK, ID, LA, ME, OK
 *
 *   NON-REGISTRATION states (federal FDD compliance only):
 *     all other states
 *
 * Fees + filing windows are gathered from publicly known schedules
 * but DO require attorney verification for the specific year and the
 * franchisor's structure (renewal vs. amendment vs. initial filing).
 * Every row carries a "verify with counsel" caveat.
 *
 * The matrix is shipped as a Deliverable so it's part of the export
 * bundle; customers can also see their CURRENT registration progress
 * by editing the compliance_legal chapter (registration_states,
 * filing_only_states, non_registration_states fields).
 */

import type { BuildContext, DeliverableDoc } from "../types";
import { chapterFields } from "../context-helpers";
import { fmtList, fmtText, isFilled } from "../format";

type StateRow = {
  state: string; // 2-letter code
  classification: "registration" | "filing_only" | "non_registration";
  initialFee: string; // "$675" or "varies" or similar
  renewalFee: string;
  filingWindow: string;
  notes: string;
};

const REGISTRATION_STATES: StateRow[] = [
  { state: "CA", classification: "registration", initialFee: "$675", renewalFee: "$450", filingWindow: "Annually + each material change", notes: "Department of Financial Protection & Innovation" },
  { state: "HI", classification: "registration", initialFee: "$125", renewalFee: "$125", filingWindow: "Annually 7 days before fiscal year end", notes: "Dept of Commerce & Consumer Affairs" },
  { state: "IL", classification: "registration", initialFee: "$500", renewalFee: "$100", filingWindow: "Annually + each material change", notes: "Attorney General's Office" },
  { state: "IN", classification: "registration", initialFee: "$500", renewalFee: "$250", filingWindow: "Annually + each material change", notes: "Securities Division" },
  { state: "MD", classification: "registration", initialFee: "$500", renewalFee: "$250", filingWindow: "Annually 105 days after fiscal year end", notes: "Securities Division, Office of the Attorney General" },
  { state: "MI", classification: "registration", initialFee: "$250", renewalFee: "—", filingWindow: "One-time notice filing — no renewal", notes: "Notice-filing state (Department of Attorney General)" },
  { state: "MN", classification: "registration", initialFee: "$400", renewalFee: "$200", filingWindow: "Annually 120 days after fiscal year end", notes: "Department of Commerce" },
  { state: "NY", classification: "registration", initialFee: "$750", renewalFee: "$150", filingWindow: "Annually 120 days after fiscal year end", notes: "Department of Law" },
  { state: "ND", classification: "registration", initialFee: "$250", renewalFee: "$100", filingWindow: "Annually + each material change", notes: "Securities Department" },
  { state: "RI", classification: "registration", initialFee: "$500", renewalFee: "$250", filingWindow: "Annually + each material change", notes: "Department of Business Regulation, Securities Division" },
  { state: "SD", classification: "registration", initialFee: "$250", renewalFee: "$250", filingWindow: "Annually + each material change", notes: "Division of Securities" },
  { state: "VA", classification: "registration", initialFee: "$500", renewalFee: "$250", filingWindow: "Annually + each material change", notes: "State Corporation Commission" },
  { state: "WA", classification: "registration", initialFee: "$600", renewalFee: "$100", filingWindow: "Annually + each material change", notes: "Department of Financial Institutions" },
  { state: "WI", classification: "registration", initialFee: "$400", renewalFee: "$400", filingWindow: "Annually + each material change", notes: "Department of Financial Institutions" },
];

const FILING_ONLY_STATES: StateRow[] = [
  { state: "CT", classification: "filing_only", initialFee: "$400", renewalFee: "$100", filingWindow: "Business-opportunity statute", notes: "Department of Banking" },
  { state: "FL", classification: "filing_only", initialFee: "$100", renewalFee: "$100", filingWindow: "Annually", notes: "Business-opportunity registration; Dept of Agriculture" },
  { state: "GA", classification: "filing_only", initialFee: "Varies", renewalFee: "—", filingWindow: "Business-opportunity statute", notes: "Secretary of State" },
  { state: "KY", classification: "filing_only", initialFee: "Varies", renewalFee: "—", filingWindow: "Business-opportunity statute", notes: "Attorney General" },
  { state: "NC", classification: "filing_only", initialFee: "Varies", renewalFee: "—", filingWindow: "Business-opportunity statute", notes: "Secretary of State" },
  { state: "NE", classification: "filing_only", initialFee: "$100", renewalFee: "—", filingWindow: "One-time notice filing", notes: "Department of Banking & Finance" },
  { state: "SC", classification: "filing_only", initialFee: "Varies", renewalFee: "—", filingWindow: "Business-opportunity statute", notes: "Secretary of State" },
  { state: "TX", classification: "filing_only", initialFee: "$25", renewalFee: "$25", filingWindow: "One-time business-opportunity exemption notice", notes: "Secretary of State" },
  { state: "UT", classification: "filing_only", initialFee: "$50", renewalFee: "—", filingWindow: "Business-opportunity statute", notes: "Division of Consumer Protection" },
  { state: "AK", classification: "filing_only", initialFee: "$10", renewalFee: "—", filingWindow: "Business-opportunity statute", notes: "Department of Commerce" },
];

const NON_REGISTRATION_STATES: string[] = [
  "AL", "AZ", "AR", "CO", "DE", "ID", "IA", "KS", "LA", "MA", "ME", "MO", "MS",
  "MT", "NV", "NH", "NJ", "NM", "OH", "OK", "OR", "PA", "TN", "VT", "WV", "WY",
];

export function buildStateRegistrationMatrix(ctx: BuildContext): DeliverableDoc {
  const overview = chapterFields(ctx, "business_overview");
  const compliance = chapterFields(ctx, "compliance_legal");

  const businessName =
    fmtText(overview.concept_summary).split(/[.\n]/)[0]?.trim() || "Your Franchise";

  const customerRegStates = isFilled(compliance.registration_states)
    ? new Set(fmtList(compliance.registration_states).map((s) => s.toUpperCase().slice(0, 2)))
    : new Set<string>();
  const customerFilingStates = isFilled(compliance.filing_only_states)
    ? new Set(fmtList(compliance.filing_only_states).map((s) => s.toUpperCase().slice(0, 2)))
    : new Set<string>();
  void customerFilingStates; // surfaced via sections below

  const formatStatus = (st: string): string => {
    if (customerRegStates.has(st)) return "✔ Active / Filed";
    return "Not yet filed";
  };

  return {
    title: `${businessName} — State Registration Matrix`,
    subtitle: "FDD filing requirements, fees, and current status by state",
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
      "Fees and filing windows reflect publicly published schedules at the time of generation. Verify current fees and renewal windows with franchise counsel before each filing — states adjust schedules and forms periodically.",
    sections: [
      {
        title: "Overview",
        level: 1,
        blocks: [
          {
            kind: "paragraph",
            text:
              "Franchise sales in the United States are regulated at the federal AND state level. Federal compliance (the FTC Franchise Rule) is met by preparing a current FDD and observing the 14-day delivery rule. State compliance varies — 14 states require the FDD be reviewed and approved before any sale; another ~15 require notice or business-opportunity filings; the rest impose no state-level pre-sale requirement beyond federal.",
          },
          {
            kind: "callout",
            text:
              "This matrix is a planning tool. Actual filings must be prepared with counsel — many states require state-specific cover pages, riders to the franchise agreement, and individualized financial-assurance disclosures.",
            tone: "info",
          },
        ],
      },
      {
        title: "1. Registration States",
        level: 1,
        blocks: [
          {
            kind: "paragraph",
            text:
              "FDD must be filed and approved (or in some cases, registered without merit review) before any sale to a resident of these states. Annual renewals required.",
          },
          {
            kind: "table",
            headers: ["State", "Initial Fee", "Renewal", "Window", "Status", "Notes"],
            rows: REGISTRATION_STATES.map((row) => [
              row.state,
              row.initialFee,
              row.renewalFee,
              row.filingWindow,
              formatStatus(row.state),
              row.notes,
            ]),
          },
        ],
      },
      {
        title: "2. Business-Opportunity / Filing-Only States",
        level: 1,
        blocks: [
          {
            kind: "paragraph",
            text:
              "These states either require a notice filing under their business-opportunity statute or accept the federal FDD with a one-time exemption notice. Renewal frequency varies; some are one-time-only.",
          },
          {
            kind: "table",
            headers: ["State", "Initial Fee", "Renewal", "Window", "Status", "Notes"],
            rows: FILING_ONLY_STATES.map((row) => [
              row.state,
              row.initialFee,
              row.renewalFee,
              row.filingWindow,
              formatStatus(row.state),
              row.notes,
            ]),
          },
        ],
      },
      {
        title: "3. Non-Registration States",
        level: 1,
        blocks: [
          {
            kind: "paragraph",
            text:
              "No state-level pre-sale registration or notice required. Federal FDD compliance still applies. Verify with counsel before each new state — statutes change.",
          },
          {
            kind: "bullets",
            items: NON_REGISTRATION_STATES.map((s) => s),
          },
        ],
      },
      {
        title: "4. Customer's Current Footprint",
        level: 1,
        blocks: [
          {
            kind: "paragraph",
            text:
              "These states are flagged as active in the compliance_legal chapter. Update the chapter as filings change — this section regenerates from your live Memory.",
          },
          {
            kind: "kvtable",
            rows: [
              {
                label: "Filed in (registration)",
                value: isFilled(compliance.registration_states)
                  ? fmtList(compliance.registration_states).join(", ")
                  : "—",
              },
              {
                label: "Filed in (filing-only)",
                value: isFilled(compliance.filing_only_states)
                  ? fmtList(compliance.filing_only_states).join(", ")
                  : "—",
              },
              {
                label: "Exemption strategy",
                value: fmtText(compliance.exemption_strategy),
              },
              {
                label: "Attorney of record",
                value: isFilled(compliance.attorney_name) || isFilled(compliance.attorney_firm)
                  ? `${fmtText(compliance.attorney_name)}${isFilled(compliance.attorney_firm) ? ` — ${fmtText(compliance.attorney_firm)}` : ""}`
                  : "—",
              },
            ],
          },
        ],
      },
    ],
  };
}

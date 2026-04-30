/**
 * Canonical file slugs for the customer Memory directory.
 *
 * Every chapter of the customer's living Franchisor Blueprint is identified
 * by one of these slugs. The slug is also the row-key in `customer_memory`
 * (composite PK with user_id) and the directory name in any export bundle.
 *
 * IMPORTANT: do not rename a slug after it ships. Stored Memory rows are
 * keyed by it, and renaming would orphan customer data. Add new slugs by
 * appending; deprecate old ones by leaving them in place.
 *
 * See `docs/agentic-portal-buildout.md` §4 for the mapping from each
 * Memory file to the deliverables it compiles into.
 */

export const MEMORY_FILES = [
  // -- Foundational (drives the most cross-document data reuse) --
  "business_overview", // Concept & founding story → FDD Item 1, Ops Manual §1
  "brand_voice", // Brand standards → Ops Manual §2, Marketing Fund Manual

  // -- Operations & product --
  "operating_model", // Daily operations → Ops Manual §3-12
  "recipes_and_menu", // Product/service specs → Ops Manual §13
  "vendor_supply_chain", // Approved suppliers → Ops Manual §14

  // -- Money --
  "unit_economics", // FDD Item 7 + Item 19 + Financial Model
  "franchise_economics", // Royalty / ad fund / fees → FDD Items 5+6, Marketing Fund, Franchise Agreement
  "marketing_fund", // Ad-fund governance → Marketing Fund Manual

  // -- Real estate & growth --
  "territory_real_estate", // Site selection + territory → Site Guide, FDD Item 12
  "market_strategy", // Competitive positioning → Market Strategy Report (research-heavy)
  "competitor_landscape", // Direct/indirect competitors → Competitor Maps (research-heavy)

  // -- People --
  "training_program", // Training + certification → Train chapter
  "franchisee_profile", // Ideal franchisee → Qualify Matrix, Discovery Day deck
  "employee_handbook", // HR & employment → Employee Handbook
  "reimbursement_policy", // Expense reimbursement → Reimbursement Policy

  // -- Legal --
  "compliance_legal", // FDD posture + state strategy → Decode FDD, Franchise Agreement scaffolding
] as const;

export type MemoryFileSlug = (typeof MEMORY_FILES)[number];

/**
 * Human-readable chapter titles (for UI rendering and the agent's prompt
 * context). Keep these in sync with the slug list above.
 */
export const MEMORY_FILE_TITLES: Record<MemoryFileSlug, string> = {
  business_overview: "Concept & Story",
  brand_voice: "Brand Standards",
  operating_model: "Daily Operations",
  recipes_and_menu: "Product & Service Specs",
  vendor_supply_chain: "Approved Suppliers",
  unit_economics: "Unit Economics & Financial Model",
  franchise_economics: "Royalty, Ad Fund & Fees",
  marketing_fund: "Marketing Fund Governance",
  territory_real_estate: "Site Selection & Territory",
  market_strategy: "Competitive Positioning",
  competitor_landscape: "Competitor Landscape",
  training_program: "Training & Certification",
  franchisee_profile: "Ideal Franchisee",
  employee_handbook: "Employee Handbook",
  reimbursement_policy: "Expense Reimbursement",
  compliance_legal: "FDD Posture & State Strategy",
};

export function isValidMemoryFileSlug(slug: string): slug is MemoryFileSlug {
  return (MEMORY_FILES as readonly string[]).includes(slug);
}

/**
 * Franchise glossary: programmatic SEO collection at /glossary/[term].
 *
 * 30 terms covering the most-searched franchise concepts. Each entry has:
 *   - shortDef   — 1-sentence answer (~20-30 words). This is what AI Overviews,
 *                  ChatGPT, and Perplexity quote when answering "what is X."
 *   - longDef    — 3-5 paragraph explanation with context, examples, and
 *                  the real-world implications operators care about.
 *   - aka        — synonyms / alternate names (also rendered for SEO).
 *   - relatedTerms       — links to other glossary entries
 *   - relatedBlogSlugs   — links to long-form blog pillars
 *   - ftcCitation        — regulatory citation (when applicable)
 *   - jasonNote          — 1-sentence color, brand voice
 *
 * Terms grouped into 5 categories for the hub page:
 *   FDD & Legal · Financial · Sales & Discovery · Operations · Structure
 */

export type GlossaryCategory =
  | "FDD & Legal"
  | "Financial"
  | "Sales & Discovery"
  | "Operations"
  | "Structure";

export type FranchiseGlossaryTerm = {
  slug: string;
  term: string;
  aka?: string[];
  category: GlossaryCategory;
  shortDef: string; // The AEO answer — 1 sentence, ~20-30 words
  longDef: string; // 3-5 paragraph explanation
  relatedTerms?: string[]; // slug refs
  relatedBlogSlugs?: string[];
  ftcCitation?: string;
  jasonNote?: string;
};

export const allGlossaryTerms: FranchiseGlossaryTerm[] = [
  // ─── FDD & Legal ─────────────────────────────────────────────────────
  {
    slug: "franchise-disclosure-document",
    term: "Franchise Disclosure Document (FDD)",
    aka: ["FDD", "Franchise Offering Circular", "UFOC (legacy term)"],
    category: "FDD & Legal",
    shortDef:
      "A federally required legal document that a franchisor must give to every prospective franchisee at least 14 calendar days before signing — disclosing 23 specific items about the franchise system, fees, and obligations.",
    longDef: `The Franchise Disclosure Document is the foundational legal instrument of every U.S. franchise relationship. The FTC's Franchise Rule (16 CFR Part 436) requires every franchisor to deliver a current, compliant FDD to a prospective franchisee at least 14 calendar days before that franchisee signs the franchise agreement or pays any money.

The FDD contains 23 numbered items covering the franchisor's background (Items 1-4), the financial obligations (Items 5-7), the operating relationship (Items 8-17), territory and IP (Items 12-14), and historical performance data (Items 19-21). It is not the franchise agreement itself — the agreement is attached as an exhibit. The FDD is the package of facts that lets a candidate evaluate the deal with eyes open.

Fourteen U.S. states require franchisors to also register the FDD with a state regulator before selling franchises in that state. The remaining states operate under federal FTC rules alone, though many apply additional franchise relationship laws governing post-sale dynamics.

A first FDD typically takes 60-120 days for a franchise attorney to draft and file, and costs $5,000-$15,000 in legal fees alone. Multi-state registration adds another $150-$750 per state plus annual renewal fees.`,
    relatedTerms: [
      "ftc-franchise-rule",
      "fdd-item-7",
      "fdd-item-19",
      "franchise-registration-state",
    ],
    relatedBlogSlugs: ["franchise-disclosure-document-explained"],
    ftcCitation: "16 CFR Part 436",
    jasonNote:
      "The FDD isn't paperwork — it's the architecture of your franchise relationship. Founders who treat it as a one-time legal hurdle build systems that stall in year two.",
  },
  {
    slug: "ftc-franchise-rule",
    term: "FTC Franchise Rule",
    aka: ["Federal Trade Commission Franchise Rule", "16 CFR Part 436"],
    category: "FDD & Legal",
    shortDef:
      "The federal regulation that defines what counts as a franchise and requires every franchisor to deliver a Franchise Disclosure Document (FDD) to prospects at least 14 days before signing.",
    longDef: `The FTC Franchise Rule, codified at 16 CFR Part 436, is the federal regulation that governs franchise sales across the United States. Adopted in its modern form in 2007, the rule standardized franchise disclosure across all U.S. jurisdictions.

The rule defines a "franchise" as any commercial relationship that combines three elements: (1) a trademark license, (2) significant control or assistance from the franchisor, and (3) a required fee paid by the franchisee. If your business arrangement includes all three, the FTC Rule applies — regardless of what you call the arrangement.

Compliance has two parts. First, prepare a current FDD covering all 23 mandatory disclosure items. Second, deliver the FDD to every prospect at least 14 calendar days before they sign the franchise agreement or pay any money. Failure to deliver an FDD or providing materially false disclosures carries federal civil penalties and exposes the franchisor to private rescission claims by franchisees.

State franchise laws layer additional requirements on top of the federal rule, particularly in the 14 registration states that require pre-sale FDD filing with a state regulator.`,
    relatedTerms: [
      "franchise-disclosure-document",
      "franchise-registration-state",
      "franchise-relationship-law",
    ],
    relatedBlogSlugs: ["franchise-disclosure-document-explained", "franchise-vs-license-vs-company-owned"],
    ftcCitation: "16 CFR Part 436",
    jasonNote:
      "If your offer combines a trademark, operational control, and a fee, you're a franchise — even if your contract calls itself a 'license.' The FTC doesn't care what you call it.",
  },
  {
    slug: "fdd-item-5",
    term: "FDD Item 5 (Initial Fees)",
    aka: ["Item 5", "Initial Franchise Fee Disclosure"],
    category: "FDD & Legal",
    shortDef:
      "The FDD section that discloses the initial franchise fee and any other fees the franchisee pays before opening — including the amount, when each payment is due, and whether any portion is refundable.",
    longDef: `Item 5 of the FDD covers all upfront payments a franchisee makes to the franchisor before opening their unit. The most prominent line is the initial franchise fee — typically $20,000-$60,000 for service and retail franchises, $35,000-$75,000 for food service.

Beyond the initial fee, Item 5 also discloses any other pre-opening payments: training fees, technology setup fees, opening assistance fees, transfer fees from a prior franchisee, and similar one-time costs. Each must be itemized with the amount, payment timing, and any refund conditions.

Item 5 is paired with Item 6 (recurring/contingent fees) and Item 7 (total estimated initial investment, including third-party costs). Together these three items determine how a candidate evaluates the financial commitment.

A common Item 5 mistake is under-pricing the initial franchise fee out of nervousness. Setting the fee below your real onboarding cost signals a low-value system to serious operators while attracting under-capitalized candidates who fail in year two.`,
    relatedTerms: ["fdd-item-6", "fdd-item-7", "franchise-fee", "royalty"],
    relatedBlogSlugs: ["franchise-fee-vs-royalty", "franchise-disclosure-document-explained"],
    ftcCitation: "16 CFR 436.5(e)",
  },
  {
    slug: "fdd-item-6",
    term: "FDD Item 6 (Other Fees)",
    aka: ["Item 6", "Recurring Fees Disclosure"],
    category: "FDD & Legal",
    shortDef:
      "The FDD section that discloses every recurring or contingent fee a franchisee will or might pay during the franchise relationship — royalties, brand fund, technology, transfer, audit, late fees, and more.",
    longDef: `Item 6 is a required-format table that itemizes every recurring or contingent payment from franchisee to franchisor across the life of the relationship. The most prominent line is the royalty (typically 4-12% of gross revenue depending on sector). Other common entries: brand marketing fund contribution (1-4%), technology fees ($200-$500/month), transfer fees ($5,000-$10,000), renewal fees, late payment fees, and audit fees.

If a fee isn't disclosed in Item 6, the franchisor cannot legally charge it. Adding a fee mid-FDD-cycle requires a formal amendment, which is expensive and signals disorganization to candidates and regulators.

Item 6 footnotes are critical. They specify how each fee is calculated, when it's payable, and any conditions that trigger contingent fees. Vague footnotes ("franchisee may be charged additional fees as the franchisor deems appropriate") are flagged by registration-state regulators and undermine candidate trust.`,
    relatedTerms: ["fdd-item-5", "royalty", "brand-marketing-fund", "transfer-fee"],
    relatedBlogSlugs: ["franchise-fee-vs-royalty", "franchise-royalty-rate-benchmarks"],
    ftcCitation: "16 CFR 436.5(f)",
  },
  {
    slug: "fdd-item-7",
    term: "FDD Item 7 (Initial Investment)",
    aka: ["Item 7", "Initial Investment Range", "Estimated Initial Investment"],
    category: "FDD & Legal",
    shortDef:
      "The FDD section that discloses the franchisee's total estimated cost to open and operate a unit for the first three months — presented as a low-to-high range across roughly 12 specific cost categories.",
    longDef: `Item 7 is the number every franchise candidate scrolls to first. The FTC requires it to be presented as a low-and-high range across specific cost categories: initial franchise fee, training, real estate, leasehold improvements, equipment, signage, opening inventory, technology, licenses, insurance, professional fees, marketing, and "additional funds" for the first three months of operations.

The range should reflect real variation across markets you'd actually approve — not be artificially narrow ("$50K-$55K") or evasive ("$50K-$1.5M"). Defensible ranges anchor in real-world unit budgets across at least three different market types.

The "additional funds" line — operating capital reserve — is the most under-disclosed. The FTC's three-month minimum is a floor, not a goal. Most experienced franchise attorneys recommend disclosing six months for businesses with longer ramp-up periods.

A defensible Item 7 isn't just legal compliance — it's a sales conversion lever. SBA preferred lenders use Item 7 directly when underwriting franchisee loans, and serious operators self-select against the high end of the range plus a 25% safety margin.`,
    relatedTerms: ["fdd-item-5", "fdd-item-6", "fdd-item-19", "additional-funds"],
    relatedBlogSlugs: ["fdd-item-7-initial-investment", "the-real-cost-of-franchising-your-business"],
    ftcCitation: "16 CFR 436.5(g)",
    jasonNote:
      "Item 7 is the spine of your franchise sales conversation. Get it right and the right candidates self-select in. Get it wrong and you either scare off serious operators or attract people who can't afford to succeed.",
  },
  {
    slug: "fdd-item-11",
    term: "FDD Item 11 (Franchisor Assistance, Training, Computer Systems)",
    aka: ["Item 11", "Training Disclosure"],
    category: "FDD & Legal",
    shortDef:
      "The FDD section disclosing what the franchisor provides — pre-opening (site selection help, lease review, training) and ongoing (field consulting, marketing, technology, supervision) — plus the training program subjects, hours, and instructor qualifications.",
    longDef: `Item 11 is the operations-side counterpart to Items 5-7's financial disclosures. It tells the candidate exactly what the franchisor delivers in exchange for the fees disclosed earlier in the document.

Pre-opening obligations covered in Item 11 include site selection assistance, lease review, equipment specifications, opening inventory guidance, and the initial training program. Ongoing obligations include field consulting visits, technology platforms, marketing fund management, and continuing supervision.

The training program subsection is rigorous: the rule requires disclosure of every subject taught, the hours of instruction in each, the instructor's qualifications, and where training takes place.

The most common Item 11 mistake is over-promising. "Comprehensive ongoing support" is a phrase that sounds reassuring and is legally unenforceable until you define it — at which point you've signed up to deliver whatever a future franchisee can argue is "comprehensive." Specificity protects both sides. A documented Operations Manual is what makes Item 11 honest and enforceable.`,
    relatedTerms: ["operations-manual", "field-consultant", "franchise-disclosure-document"],
    relatedBlogSlugs: [
      "how-to-write-franchise-operations-manual",
      "franchise-disclosure-document-explained",
    ],
    ftcCitation: "16 CFR 436.5(k)",
  },
  {
    slug: "fdd-item-12",
    term: "FDD Item 12 (Territory)",
    aka: ["Item 12", "Territory Disclosure"],
    category: "FDD & Legal",
    shortDef:
      "The FDD section that defines the franchisee's territorial rights — whether the territory is exclusive, protected, or open, and whether the franchisor or other franchisees can compete within it.",
    longDef: `Territory is one of the most negotiated items in franchise sales. Item 12 forces the franchisor to disclose, in plain terms: does the franchisee get an exclusive territory? A protected (non-encroachment) territory? Or an open arrangement where the franchisor can place additional units anywhere?

Item 12 also discloses whether franchisor-owned units can operate within the franchisee's territory, whether other franchisees can sell to customers inside the territory, and whether the franchisee can sell to customers outside it (including via the internet).

The trade-off is structural. Exclusive territories make the franchise easier to sell — candidates love the comfort of a protected market — but constrain the franchisor's ability to expand the system. Open territories preserve franchisor flexibility but make the offer less attractive to candidates with multi-unit ambitions.

Most emerging franchise systems land somewhere in the middle: a defined "protected" territory with explicit carve-outs for non-traditional venues (airports, sports stadiums, corporate campuses) and online sales.`,
    relatedTerms: ["exclusive-territory", "multi-unit-franchisee", "area-developer"],
    relatedBlogSlugs: ["franchise-disclosure-document-explained"],
    ftcCitation: "16 CFR 436.5(l)",
  },
  {
    slug: "fdd-item-19",
    term: "FDD Item 19 (Financial Performance Representations)",
    aka: ["Item 19", "FPR", "Earnings Claim"],
    category: "FDD & Legal",
    shortDef:
      "The only optional disclosure in the FDD — Item 19 is where franchisors can disclose actual financial performance data (revenue, gross profit, EBITDA) for franchised or company-owned units, supported by a reasonable basis and substantiated records.",
    longDef: `Item 19 is the single biggest sales conversion lever in the FDD. It's also the only optional item — a franchisor can choose to make no Financial Performance Representation at all.

But there's a trap. If you skip Item 19, you cannot legally make any earnings claim — anywhere. Sales calls, brochures, websites, Discovery Day, recorded webinars. Saying "our top units do over $1.2M" once outside Item 19 creates federal liability and gives the franchisee grounds to rescind. Most franchise systems that skip Item 19 effectively put their sales team under a federal gag order.

A strong Item 19 includes quartile or decile data (not just averages), specifies the cohort and time period, discloses material assumptions, and shows enough cost stack that candidates can model their own outcome. Even one or two company-owned units, properly disclosed, beats no Item 19.

The standard isn't a minimum unit count — it's a "reasonable basis" requirement. Industry data and our experience consistently show that franchise systems with strong Item 19s close at meaningfully higher rates than systems without one.`,
    relatedTerms: ["fdd-item-7", "unit-economics", "ebitda", "validation-call"],
    relatedBlogSlugs: ["fdd-item-19-financial-performance-representations"],
    ftcCitation: "16 CFR 436.5(s)",
    jasonNote:
      "A franchise without Item 19 is a franchise that's chosen to be harder to sell. Sometimes that choice makes sense. Most of the time, it doesn't.",
  },
  {
    slug: "fdd-item-20",
    term: "FDD Item 20 (Outlets and Franchisee Information)",
    aka: ["Item 20", "Outlet Tables"],
    category: "FDD & Legal",
    shortDef:
      "The FDD section showing tables of franchised and company-owned outlets — opened, transferred, terminated, ceased operations — by state for the past three years, plus contact information for current and recently-terminated franchisees.",
    longDef: `Item 20 forces transparency on system health. The required tables show, by state and by year for the trailing three years: how many franchise units opened, how many transferred between owners, how many were terminated, how many ceased operations, and how many are currently operating.

These tables are brutal for new franchisors with limited operating history — the numbers are simply small. There's nothing to do about it except accept that your first 5-10 sales are harder because Item 20 doesn't yet tell a strong narrative.

The franchisee contact information section is equally consequential. Item 20 requires you to list the names, addresses, and phone numbers of every current franchisee — and franchisees who left in the past year. Prospective candidates routinely call former franchisees during validation, and unhappy departures are the strongest single predictor of failed sales conversations downstream.

The strategic implication: treat franchisee retention as a sales tool. Every franchisee who fails or exits poorly damages your Item 20 numbers and gives the next prospect a reason to walk.`,
    relatedTerms: ["validation-call", "franchise-disclosure-document"],
    relatedBlogSlugs: [
      "franchise-disclosure-document-explained",
      "why-new-franchisors-stall-in-year-2",
    ],
    ftcCitation: "16 CFR 436.5(t)",
  },
  {
    slug: "franchise-registration-state",
    term: "Franchise Registration State",
    aka: ["Registration State", "Pre-Sale Filing State"],
    category: "FDD & Legal",
    shortDef:
      "One of 14 U.S. states that requires franchisors to file the FDD with a state regulator and obtain approval before offering or selling franchises in that state.",
    longDef: `The 14 franchise registration states are California, Hawaii, Illinois, Indiana, Maryland, Michigan (notice filing only — lighter than the others), Minnesota, New York, North Dakota, Rhode Island, South Dakota, Virginia, Washington, and Wisconsin. Each has its own regulator, filing fee, renewal cadence, and review timeline.

Initial filing fees range from $150 in lighter-touch states to $750 in California. Annual renewals typically run $100-$450 per state. Multi-state registration adds up: budget $3,000-$8,000/year if you want full national coverage once you're operating at scale.

First-cycle reviews vary substantially. South Dakota and North Dakota typically clear in 3-6 weeks. California and New York commonly run 8-16 weeks because their regulators issue multiple rounds of detailed comments on first-time FDDs.

The strategic decision: most emerging franchisors register in their home state plus 3-5 strategic expansion states first, then add states as their sales pipeline justifies them. There's no benefit to registering in a state where you have no realistic near-term sales activity.`,
    relatedTerms: [
      "franchise-disclosure-document",
      "ftc-franchise-rule",
      "franchise-relationship-law",
    ],
    relatedBlogSlugs: ["franchise-disclosure-document-explained"],
  },
  {
    slug: "franchise-relationship-law",
    term: "Franchise Relationship Law",
    aka: ["Franchise Relationship Statute", "Termination Law"],
    category: "FDD & Legal",
    shortDef:
      "A state statute that governs post-sale franchisor-franchisee dynamics — typically requiring good cause for termination, providing extended cure rights, or restricting non-renewal — without requiring pre-sale FDD registration.",
    longDef: `Approximately 19 U.S. states have franchise relationship laws (sometimes called "franchise practices acts" or "fair dealership laws") that apply to franchise relationships even when the state has no pre-sale registration requirement. New Jersey's Franchise Practices Act, Iowa's Franchise Act, and Wisconsin's Fair Dealership Law are among the most franchisee-protective.

These statutes typically restrict three things: termination (requiring "good cause" and a notice-and-cure process), non-renewal (requiring advance notice and limiting franchisor discretion), and transfer (typically restricting unreasonable refusal of franchisee transfer requests).

The practical effect: a franchise agreement that works fine under federal FTC rules can be unenforceable in a relationship state if its termination or transfer provisions don't account for the state-specific protections. This is why franchise attorneys with multi-state experience are essential — generic franchise agreement templates frequently fail when tested against relationship-state statutes.

Some non-registration states with notable franchise relationship laws include Arkansas, Connecticut, Hawaii, Iowa, Louisiana, Michigan, Minnesota, Mississippi, Nebraska, New Jersey, South Dakota, Virginia, Washington, and Wisconsin.`,
    relatedTerms: ["franchise-registration-state", "franchise-disclosure-document"],
    relatedBlogSlugs: ["franchise-disclosure-document-explained"],
  },

  // ─── Financial ───────────────────────────────────────────────────────
  {
    slug: "franchise-fee",
    term: "Initial Franchise Fee",
    aka: ["Franchise Fee", "Initial Fee"],
    category: "Financial",
    shortDef:
      "The one-time payment a franchisee makes to the franchisor at signing — typically $20,000-$75,000 depending on sector — that compensates the franchisor for granting franchise rights, reserving territory, and providing pre-opening training and onboarding.",
    longDef: `The initial franchise fee is the first economic commitment in the franchise relationship. It's paid at signing (or at a defined milestone soon after) and is generally non-refundable.

Typical 2026 ranges by sector:
- Service and retail franchises: $20,000-$60,000
- Food service franchises: $35,000-$75,000
- Premium concepts and complex categories: $75,000-$150,000

The fee should be set based on three inputs: your real onboarding cost (the floor — typically $15,000-$25,000 for emerging franchisors), competitor benchmarks pulled from comparable FDDs, and strategic positioning within the typical range.

The fee also functions as a candidate filter. A $50,000 franchise fee implies a candidate pool with at least $200,000 liquid net worth (using SBA's 4x rule of thumb). A $20,000 fee opens the pool to operators with around $100,000 liquid. This filtering effect is real and strategic — too low a fee attracts under-capitalized candidates who fail in year two.

Disclosure is in Item 5 of the FDD. Discounting opportunistically (offering a candidate "a deal just this once") creates legal exposure under state uniform-pricing requirements.`,
    relatedTerms: ["royalty", "fdd-item-5", "vetfran"],
    relatedBlogSlugs: ["franchise-fee-vs-royalty", "the-real-cost-of-franchising-your-business"],
    jasonNote:
      "Setting the franchise fee too low because it 'feels uncomfortable' to charge is the most common pricing mistake I see. Charge what your system is worth. The right candidates pay it.",
  },
  {
    slug: "royalty",
    term: "Franchise Royalty",
    aka: ["Royalty", "Royalty Fee", "Continuing Fee"],
    category: "Financial",
    shortDef:
      "The ongoing percentage of franchisee revenue (typically 4-12%) that the franchisee pays the franchisor for the continuing right to use the brand, technology, training, and support throughout the franchise term.",
    longDef: `The royalty is the recurring revenue engine of franchising. Most U.S. franchise systems charge royalties of 4-8% of gross franchisee revenue, with 5-6% being the most common range. Education and B2B services franchises run higher (8-12%), supported by their stronger gross margins.

Royalty rates vary substantially by sector:
- Quick-service restaurants: 4-6% (thin unit margins constrain the rate)
- Coffee and dessert: 5-7%
- Fitness, beauty, home services: 5-9%
- Education, B2B services: 6-12% (high gross margins support premium rates)
- Hotels: 4-6% (paired with reservation fees and brand fund contributions)

The defensible-royalty test: after the royalty plus brand marketing fund, the franchisee's EBITDA should still support a 15-30% return on their invested capital. Royalties heavy enough to crush franchisee ROIC below 12% kill the sales pipeline regardless of brand strength.

Royalties are typically calculated on gross franchisee revenue and paid weekly or monthly. Some systems use net revenue, flat fees, or tiered structures (higher rate at low volume, lower rate at scale). All variations must be disclosed in Item 6 of the FDD.`,
    relatedTerms: [
      "franchise-fee",
      "brand-marketing-fund",
      "fdd-item-6",
      "ebitda",
      "unit-economics",
    ],
    relatedBlogSlugs: ["franchise-royalty-rate-benchmarks", "franchise-fee-vs-royalty"],
    jasonNote:
      "The royalty number you set today determines whether your franchisor business compounds for the next 25 years or stalls in year four. Worth getting right.",
  },
  {
    slug: "brand-marketing-fund",
    term: "Brand Marketing Fund",
    aka: ["Brand Fund", "National Marketing Fund", "Advertising Fund", "Ad Fund"],
    category: "Financial",
    shortDef:
      "A separately-tracked franchisee contribution (typically 1-4% of gross revenue) reserved for system-level brand marketing — the franchisor's website, lead generation, national PR, and brand-building activities.",
    longDef: `The brand marketing fund is dedicated capital, contributed by all franchisees as a percentage of revenue, used for system-wide marketing initiatives. Typical ranges are 1-2% in service categories and 2-4% in food service.

The fund is contractually distinct from the royalty for a reason. Royalty revenue belongs to the franchisor — discretionary capital used to run the franchisor business (staff, R&D, technology). Brand fund contributions are restricted: they must be spent on marketing activities that benefit the system as a whole.

A common mistake is collapsing the royalty and brand fund into a single percentage ("we'll just call it 8%"). This is a strategic error. Mixing the two makes it harder to defend the marketing spend to franchisees, harder to commit dedicated capital to system-level lead generation, and harder to show franchisees that their fund contributions are being used for their benefit.

Strong franchise systems publish annual brand fund reports showing where the money was spent. Weak systems hide the spend behind general marketing reports — a recipe for franchisee distrust.`,
    relatedTerms: ["royalty", "fdd-item-6", "franchise-fee"],
    relatedBlogSlugs: ["franchise-fee-vs-royalty", "franchise-royalty-rate-benchmarks"],
    ftcCitation: "16 CFR 436.5(f)",
  },
  {
    slug: "unit-economics",
    term: "Unit Economics",
    category: "Financial",
    shortDef:
      "The financial performance of a single franchise unit — revenue, gross margin, operating expenses, and EBITDA — at typical operating volume. Strong unit economics are the precondition for a sustainable franchise system.",
    longDef: `Unit economics is the unit of analysis for franchise viability. Before you franchise, your single-unit business must generate enough EBITDA to absorb both a competitive franchisee return and a franchisor royalty — without bankrupting either party.

The threshold most experienced franchise consultants use: 18%+ unit-level EBITDA at typical operating volume. Below 18%, the math gets tight. Once you take 6-8% off the top for royalty plus brand fund, the franchisee is left with 10-12% EBITDA before debt service and owner-operator compensation — marginal returns that don't attract serious operators.

Unit economics also drives Item 19 disclosures. Franchisors with strong unit economics can show meaningful financial performance representations. Franchisors with thin margins often skip Item 19 — and watch their sales conversion crater.

The fix isn't to lower the royalty (which kills the franchisor business). It's to improve unit economics first. Faster prep times, higher average ticket, lower labor ratios, better real estate selection. Get your house in order at the unit level before franchising.`,
    relatedTerms: ["ebitda", "fdd-item-19", "royalty", "franchisee-roic"],
    relatedBlogSlugs: [
      "is-my-business-ready-to-franchise",
      "franchise-royalty-rate-benchmarks",
      "fdd-item-19-financial-performance-representations",
    ],
    jasonNote:
      "If your unit-level EBITDA is below 18%, fix it before franchising — not after. Nothing in the franchise system fixes weak unit economics.",
  },
  {
    slug: "ebitda",
    term: "EBITDA (Franchise Context)",
    aka: ["Earnings Before Interest, Taxes, Depreciation, and Amortization"],
    category: "Financial",
    shortDef:
      "A profitability metric calculated as revenue minus cost of goods sold and operating expenses (before interest, taxes, depreciation, and amortization). In franchising, unit-level EBITDA determines royalty room and franchise viability.",
    longDef: `EBITDA strips out financing structure (interest, taxes) and accounting choices (depreciation, amortization) to show operating profitability. In a franchise context, two EBITDA figures matter: unit-level EBITDA (how profitable a single franchise unit is) and franchisor-level EBITDA (how profitable the franchisor business itself is).

Typical unit-level EBITDA ranges by sector:
- Quick-service restaurants: 15-22%
- Casual dining: 10-18%
- Coffee, beauty, fitness: 18-28%
- Home services: 20-35%
- Education: 22-35%

The franchisor takes a percentage off this figure (royalty plus brand fund, typically 5-10% of revenue combined). What remains is the franchisee's EBITDA — and it needs to support a competitive return on the franchisee's invested capital.

Franchisor-level EBITDA is a different math. A 100-unit franchise system collecting 6% royalty on $800K average unit revenue produces $4.8M/year in royalty revenue — high-margin recurring income with substantial operating leverage as the system scales.`,
    relatedTerms: ["unit-economics", "royalty", "franchisee-roic", "fdd-item-19"],
    relatedBlogSlugs: ["franchise-royalty-rate-benchmarks", "is-my-business-ready-to-franchise"],
  },
  {
    slug: "franchisee-roic",
    term: "Franchisee Return on Invested Capital (ROIC)",
    aka: ["Franchisee ROI", "Franchisee Return"],
    category: "Financial",
    shortDef:
      "The annual EBITDA a franchisee generates divided by their total invested capital (Item 7) — typically 15-30% for healthy franchise opportunities. ROIC below 12% kills sales pipelines.",
    longDef: `Franchisee ROIC is the metric serious operator candidates use to evaluate a franchise opportunity against alternatives — buying an existing business, public market index funds, real estate, or starting an independent operation.

The calculation is straightforward: take the franchisee's annual EBITDA after paying royalty and brand fund, divide by the total invested capital (Item 7's high end). Healthy franchise opportunities deliver 15-30% ROIC at maturity. Below 12%, candidates pass — the math doesn't compete with simpler alternatives.

A franchisor's job is to design the fee structure so franchisee ROIC stays in that 15-30% range. Royalties too high crush ROIC. Item 7 ranges that don't reflect real costs understate the denominator and inflate apparent ROIC, which serious candidates catch in their own modeling.

The cleanest cross-check: build a year-2 P&L for a typical franchisee unit, subtract your proposed royalty plus brand fund, divide remaining EBITDA by Item 7's high. If the answer is 15-30%, your structure works. If it's below 12% or above 35%, something's miscalibrated.`,
    relatedTerms: ["unit-economics", "ebitda", "royalty", "fdd-item-7"],
    relatedBlogSlugs: ["franchise-royalty-rate-benchmarks"],
  },
  {
    slug: "transfer-fee",
    term: "Transfer Fee",
    category: "Financial",
    shortDef:
      "A fee paid to the franchisor when a franchisee sells their unit to a new owner — typically $5,000-$15,000 — covering the franchisor's cost of qualifying, training, and onboarding the new operator.",
    longDef: `Transfer fees compensate the franchisor for the operational work of approving and onboarding a new franchisee when an existing franchisee sells their unit. The fee is disclosed in Item 6 and typically runs $5,000-$15,000 in 2026 — covering candidate qualification, retraining, document preparation, and the franchisor's transfer-approval administrative cost.

Transfer fees also discourage casual ownership flipping. A franchisee who knows transferring out costs $10,000+ has more incentive to operate the unit seriously rather than treating it as a short-term asset.

Most franchise agreements also reserve the franchisor's right of first refusal — meaning the franchisor can match any third-party offer to acquire the franchisee's unit. This protects against transfers to operators who don't fit the system, and gives the franchisor the option to consolidate units when strategically valuable.

The transfer process is also a quality-control checkpoint. The new buyer must qualify under the same criteria as a brand-new franchisee, complete training, and accept current franchise agreement terms (which may have evolved since the original franchisee signed).`,
    relatedTerms: ["fdd-item-6", "right-of-first-refusal", "renewal-fee"],
    relatedBlogSlugs: ["franchise-disclosure-document-explained"],
  },
  {
    slug: "renewal-fee",
    term: "Renewal Fee",
    aka: ["Successor Fee"],
    category: "Financial",
    shortDef:
      "A fee paid by an existing franchisee to renew their franchise agreement at the end of its term — typically 25-50% of the then-current initial franchise fee.",
    longDef: `Most franchise agreements run a defined term, commonly 10 or 15 years. At expiration, the franchisee can typically renew for an additional term — but renewal isn't free, and isn't automatic.

The renewal fee is typically 25-50% of the franchisor's then-current initial franchise fee. So a franchisee who paid a $35,000 fee in 2014 renewing in 2024 might pay $20,000-$50,000 to renew — based on what the franchisor charges new franchisees in 2024, not 2014.

Renewal almost always requires the franchisee to sign the franchisor's then-current franchise agreement — which may have evolved meaningfully since the original signing. New royalty rates, new technology requirements, new operating standards. The renewal moment is the franchisor's chance to bring older franchisees onto current terms.

Renewal terms vary widely. Some franchisors offer multiple successor terms by right; others offer renewal at franchisor discretion. The specifics are disclosed in Item 17 of the FDD and govern one of the most important moments in any franchise relationship.`,
    relatedTerms: ["transfer-fee", "fdd-item-6", "fdd-item-17"],
    relatedBlogSlugs: ["franchise-disclosure-document-explained"],
  },

  // ─── Sales & Discovery ───────────────────────────────────────────────
  {
    slug: "discovery-day",
    term: "Discovery Day",
    aka: ["Mutual Evaluation Day", "Validation Day"],
    category: "Sales & Discovery",
    shortDef:
      "The structured in-person (or virtual) closing event in franchise sales — typically a 6-8 hour day where the franchisor walks a qualified candidate through the full system and the candidate decides whether to sign the franchise agreement.",
    longDef: `Discovery Day is the closing instrument of franchise sales. By the time a candidate arrives, they've already received the FDD (the 14-day clock has started), spoken with existing franchisees on validation calls, had their attorney review the franchise agreement, and done preliminary territory selection.

What's left at Discovery Day is the human conversation that converts a "yes on paper" into a "yes I'm signing." Well-run Discovery Days convert at 50-70%. Tours convert at 20-30%. The difference is structure.

A typical 7-block Discovery Day agenda: brand story (45 min), unit economics walkthrough (90 min), operations walkthrough (90 min), team lunch (75 min), territory and site selection (60 min), Q&A (45 min), and a structured close (45 min) ending with three concrete options — sign today, set a sign-or-decline date within 14 days, or formally decline.

The unit economics block is where intelligent candidates close. Modeling the candidate's personal P&L live in front of them — with their projected revenue, real expenses, and clear take-home math — is more persuasive than any deck slide. Skipping this block is the single biggest closing mistake first-time franchisors make.`,
    relatedTerms: [
      "validation-call",
      "franchise-candidate-qualification",
      "fdd-item-19",
      "unit-economics",
    ],
    relatedBlogSlugs: ["discovery-day-playbook", "how-to-recruit-first-10-franchisees"],
    jasonNote:
      "Discovery Day is not a tour. It's a structured close. Every 30-minute block has a purpose. The close conversation is planned, not improvised.",
  },
  {
    slug: "validation-call",
    term: "Validation Call",
    aka: ["Franchisee Validation", "Reference Call"],
    category: "Sales & Discovery",
    shortDef:
      "A direct conversation between a prospective franchisee and one or more existing franchisees in the system — typically arranged by the franchisor — where the prospect asks candid questions about the franchisor relationship, unit economics, and operating reality.",
    longDef: `Validation calls are one of the most powerful conversion tools in franchise sales — and one of the most under-managed by first-time franchisors.

The mechanics: after a candidate has reviewed the FDD and progressed through preliminary qualification, the franchisor connects them with 2-3 existing franchisees. The candidate calls each (typically 30-60 minutes per call) and asks whatever they want — about unit revenue, franchisor support quality, operational frustrations, real day-to-day life as a franchisee.

The franchisor cannot script these calls. Item 20 of the FDD requires you to disclose contact information for current and recently-terminated franchisees, and the prospect can call anyone they choose. What the franchisor controls is which franchisees are likely to be most engaged in the validation process — and ensuring those franchisees feel like they're getting value from being part of the system.

Strong validation calls accelerate sales. Weak validation calls (where the existing franchisee is bitter, struggling, or unresponsive) kill them. Treating franchisee retention as a sales tool is one of the highest-ROI strategic moves a franchisor can make.`,
    relatedTerms: ["discovery-day", "fdd-item-20", "franchise-candidate-qualification"],
    relatedBlogSlugs: ["how-to-recruit-first-10-franchisees", "discovery-day-playbook"],
  },
  {
    slug: "franchise-candidate-qualification",
    term: "Franchise Candidate Qualification",
    aka: ["Candidate Qualification", "Lead Qualification"],
    category: "Sales & Discovery",
    shortDef:
      "The structured franchise sales screening process — typically a 20-30 minute call covering financial, operational, motivational, and cultural fit — used to disqualify wrong-fit candidates before investing further sales time.",
    longDef: `Effective franchise candidate qualification covers four dimensions:

**Financial qualification.** Does the candidate have the liquid capital required (typically 1.5x your franchise fee plus 25% of your Item 7 high)? What's their total net worth? Are they bankable for SBA financing if needed?

**Operational qualification.** Have they managed a team or run a small business? Do they have relevant industry experience? Are they planning to be an owner-operator or an absentee owner — and does your system support both?

**Motivational qualification.** Why this brand specifically? Why now? What does success look like to them five years out? Vague answers ("I want to be my own boss") often signal candidates who'll struggle when the work gets hard.

**Cultural qualification.** Are they comfortable following a documented system? How do they handle disagreement with policies?

Most candidates don't pass all four. The qualification call's primary job is graceful disqualification — disqualifying wrong-fit candidates before they consume Discovery Day time, FDD review cycles, and validation call slots. Selling to under-qualified candidates is the #1 cause of year-2 stall in new franchise systems.`,
    relatedTerms: ["discovery-day", "validation-call", "franchise-broker"],
    relatedBlogSlugs: [
      "how-to-recruit-first-10-franchisees",
      "why-new-franchisors-stall-in-year-2",
    ],
    jasonNote:
      "First-time franchisors are emotionally desperate to close their first sales. They lead with persuasion instead of qualification. Sell hard, but qualify harder.",
  },
  {
    slug: "franchise-broker",
    term: "Franchise Broker",
    aka: [
      "Franchise Consultant Network",
      "Franchise Development Network",
      "Franchise Sales Organization (FSO)",
    ],
    category: "Sales & Discovery",
    shortDef:
      "An independent third party who matches franchise candidates to franchise brands and earns commission (typically 40-50% of the initial franchise fee) on every signed deal — usually $15,000-$25,000 per franchisee.",
    longDef: `Franchise brokers — also called franchise consultant networks, FSOs, or development networks — work with thousands of pre-qualified candidates who've raised their hand looking to buy a franchise. The broker matches the candidate to suitable brands in their network and collects commission on closed deals.

Brokers make sense for emerging franchisors when:
- Your initial fee is high enough to absorb the commission and still leave franchisor margin
- You want to validate your franchise model fast (3-5 sales in 6-12 months) without building a marketing engine
- You don't yet have the team or budget to run direct lead generation

Brokers don't make sense when:
- Your initial fee is below $40,000 (commission economics don't work)
- You want to build a sustainable, founder-controlled funnel
- You're concerned about brand alignment (brokers prioritize commission per sale, not brand fit)

Most emerging franchisors I work with end up with a hybrid: some broker-sourced sales for speed early on, with direct lead generation building in parallel for sustainability. The broker channel accelerates initial sales but doesn't compound — direct lead generation does.`,
    relatedTerms: ["franchise-candidate-qualification", "discovery-day"],
    relatedBlogSlugs: ["how-to-recruit-first-10-franchisees"],
  },
  {
    slug: "vetfran",
    term: "VetFran Program",
    aka: ["Veterans Transition Franchise Initiative"],
    category: "Sales & Discovery",
    shortDef:
      "An International Franchise Association initiative that encourages franchisors to offer discounts on initial franchise fees (typically 10-25%) to qualified U.S. military veterans — a published, FDD-disclosed pricing program.",
    longDef: `VetFran is a long-running initiative of the International Franchise Association (IFA) that pairs U.S. military veterans with franchise opportunities. Participating franchisors publish a discount on their initial franchise fee — typically 10-25% — available to veterans who meet the program's eligibility criteria (typically honorable discharge, certain service duration thresholds).

Participation is voluntary but strategically valuable. Veterans tend to make excellent franchisees — operational discipline, comfort with documented systems, leadership experience, and often access to SBA Patriot Express financing. Many of the top-performing franchise units in established systems are veteran-owned.

The VetFran discount must be disclosed in Item 5 of the FDD as a published program (not an opportunistic discount). This makes it legally defensible as a uniform pricing exception under state franchise relationship laws.

Practical signal: a franchisor who participates in VetFran is publicly committing to a candidate pool that tends to outperform the average. It's also a marketing differentiator in metro areas with significant veteran populations (DC area, San Diego, Norfolk, Jacksonville, El Paso, Colorado Springs).`,
    relatedTerms: ["franchise-fee", "fdd-item-5", "franchise-candidate-qualification"],
  },

  // ─── Operations ──────────────────────────────────────────────────────
  {
    slug: "operations-manual",
    term: "Operations Manual",
    aka: ["Franchise Operations Manual", "Manual", "Operations Handbook"],
    category: "Operations",
    shortDef:
      "The comprehensive document that codifies every brand standard, operational procedure, and policy a franchisee must follow — incorporated by reference into the franchise agreement, making compliance contractually enforceable.",
    longDef: `The operations manual is the document that turns a great single-location business into a real franchise system. It does three jobs simultaneously: legal (incorporated by reference into the franchise agreement), training (the textbook for franchisees), and brand consistency (defining what it means to be a unit of your system).

Most manuals run 100-300 pages. Service franchises typically land near 100-150 pages; food service often exceeds 250 because of food-safety, recipe, and equipment-handling depth.

A defensible 17-chapter framework groups the manual into four sections:
- **Foundation** (chapters 1-4): brand story, identity standards, system overview, pre-opening checklist
- **Operations** (chapters 5-10): daily operations, customer experience, products/services, vendor management, inventory, equipment maintenance
- **People** (chapters 11-13): hiring, training and certification, performance management
- **Systems** (chapters 14-17): marketing, technology, financial management, compliance

Without an operations manual, your Item 11 disclosure is dishonest, your franchise agreement's quality-control provisions are unenforceable, and brand consistency collapses by unit number five. Building it is non-negotiable for any franchisor seriously preparing to scale.`,
    relatedTerms: ["fdd-item-11", "field-consultant", "franchise-disclosure-document"],
    relatedBlogSlugs: ["how-to-write-franchise-operations-manual"],
    jasonNote:
      "The operations manual is the difference between a franchise and a wish. Build it before you sell unit number five — not after.",
  },
  {
    slug: "field-consultant",
    term: "Field Consultant",
    aka: ["Field Support Manager", "Franchise Business Consultant", "FBC"],
    category: "Operations",
    shortDef:
      "A franchisor employee who visits franchisee units regularly to coach operations, score brand-standard compliance, and serve as the primary support relationship between the franchisor and the franchisee.",
    longDef: `Field consultants are the operational backbone of any franchise system at scale. Their job is to be the ongoing relationship between the franchisor and each franchisee — visiting units regularly (typically monthly to quarterly depending on the system), coaching the operator, scoring units against the operations manual standards, and surfacing issues before they become franchise relationship problems.

The right cadence depends on system maturity. New franchisees benefit from monthly visits in the first 12 months. Mature franchisees often shift to quarterly site visits with weekly check-in calls. Some categories (food service, healthcare) require more frequent visits because of compliance complexity.

Field consultants also serve as the early warning system for franchisor leadership. When a franchisee starts skipping standards, struggling with hiring, or showing signs of disengagement, the field consultant is the first to notice. A strong field-consulting program prevents the small problems that compound into Item 20 closures.

Hiring field consultants too late is one of the most common stall patterns in emerging franchise systems. Most successful franchisors hire their first field consultant before unit number five — not after.`,
    relatedTerms: ["operations-manual", "fdd-item-11", "franchise-relationship-law"],
    relatedBlogSlugs: [
      "how-to-write-franchise-operations-manual",
      "why-new-franchisors-stall-in-year-2",
    ],
  },
  {
    slug: "additional-funds",
    term: "Additional Funds (Item 7)",
    aka: ["Working Capital Reserve", "Operating Capital"],
    category: "Operations",
    shortDef:
      "The Item 7 line item reserving operating capital to cover the franchisee's expenses during the early operating period before the unit reaches cash-flow positive — minimum 3 months per FTC rule, typically 6 months recommended.",
    longDef: `The "additional funds" line in Item 7 is where new franchisors hurt themselves the most.

The FTC's minimum is three months of operating expenses. Three months is the floor, not the goal. Most experienced franchise attorneys recommend disclosing six months, particularly for businesses with longer ramp-up periods to cash-flow positive.

The math: take your projected monthly operating expense at a typical unit (rent, payroll, supplies, utilities, marketing, insurance — everything except cost of goods sold scaled to revenue). Multiply by the months you're disclosing. Footnote the underlying monthly figure so candidates understand the calculation.

A typical service franchise might disclose $15,000-$45,000 in additional funds. A typical restaurant franchise might disclose $50,000-$150,000. These numbers aren't arbitrary — they reflect how long your business actually takes to become cash-flow positive.

Why this matters: franchisees who undercapitalize fail. Their failure costs you a unit, damages Item 20's outlet table for years, and gives the next prospect's validation calls an unhappy former franchisee to talk to. A higher additional-funds line might make Item 7 look more expensive on paper, but it filters in candidates who can actually weather the first 18 months.`,
    relatedTerms: ["fdd-item-7", "unit-economics"],
    relatedBlogSlugs: ["fdd-item-7-initial-investment"],
  },

  // ─── Structure ───────────────────────────────────────────────────────
  {
    slug: "master-franchise",
    term: "Master Franchise",
    aka: ["Master Franchise Agreement", "Master Franchisor"],
    category: "Structure",
    shortDef:
      "A franchise structure where a master franchisor grants a master franchisee the right to develop and sub-franchise units within a defined territory — typically a country, region, or large state — collecting a share of fees and royalties on the sub-franchises.",
    longDef: `Master franchise structures are most common in international expansion and large-territory U.S. development. The master franchisor grants the master franchisee a defined territory and the right to recruit, sell to, and support sub-franchisees within it. The master franchisee pays a substantial upfront master franchise fee (often $250,000-$2,000,000) and shares ongoing royalties with the master franchisor (typical splits: 50/50 to 70/30 in the master franchisor's favor on royalties).

Master franchisees take on substantial responsibility — recruiting sub-franchisees, providing local field support, coordinating training, handling local marketing, and managing local regulatory compliance. In international markets, this includes adapting the system to local regulatory and cultural requirements.

The trade-off: master franchising accelerates geographic expansion (especially internationally) but reduces per-unit revenue capture for the master franchisor. It also creates a layer of management complexity — the master franchisor's relationship is now with the master franchisee, who in turn manages relationships with the actual unit operators.

Most U.S. emerging franchisors don't use master franchise structures domestically. They become relevant for international expansion or in geographically vast territories where direct franchisor support isn't economical.`,
    relatedTerms: ["area-developer", "sub-franchisor", "fdd-item-12"],
    relatedBlogSlugs: ["franchise-vs-license-vs-company-owned"],
  },
  {
    slug: "area-developer",
    term: "Area Developer",
    aka: ["Area Development Agreement", "Multi-Unit Development Agreement"],
    category: "Structure",
    shortDef:
      "A franchisee who commits to developing a defined number of units within a defined territory and timeline — typically paying upfront development fees in exchange for the exclusive right to open units in the territory.",
    longDef: `Area development is the most common multi-unit structure in U.S. franchising. Under an area development agreement, the franchisee commits to opening a specific number of units (e.g., five units in five years) in a defined territory. In exchange, the franchisor grants exclusive territorial rights — no other franchisee can open in that territory during the development period.

Economics typically work like this: the area developer pays an upfront development fee (often $50,000-$250,000+) plus the standard initial franchise fee for each unit they open. They receive exclusive territory rights and often a discount on subsequent unit franchise fees (typical: full price for unit one, 50% off for units two through five, in line with the development schedule).

The structure is mutually attractive. The franchisor secures committed expansion in a target market without doing direct sales work for each unit. The area developer locks in territory and pricing, then operates as a multi-unit franchisee at scale.

The risk: area developers who fall behind their development schedule. Most agreements include sunset provisions — if the developer doesn't hit their unit-opening targets by defined milestones, they lose exclusive territory rights and revert to single-unit franchisee status. Choose area developers carefully; the wrong choice locks up territory for years.`,
    relatedTerms: ["master-franchise", "multi-unit-franchisee", "fdd-item-12"],
    relatedBlogSlugs: ["franchise-vs-license-vs-company-owned"],
  },
  {
    slug: "multi-unit-franchisee",
    term: "Multi-Unit Franchisee",
    aka: ["Multi-Unit Operator", "Multi-Unit Owner"],
    category: "Structure",
    shortDef:
      "A franchisee who operates more than one unit of the same franchise system — typically the strongest operator profile in mature franchise systems, often holding 3-10+ units in a defined geography.",
    longDef: `Multi-unit franchisees are the operational engine of most established franchise systems. After 10-15 years of operating, many franchise systems have 60-80% of their units owned by multi-unit operators — single-unit owners are common for the first few years, then transition or sell to operators who scale.

The economics favor multi-unit operators in two ways. First, operating leverage: a single management overhead supports multiple units. Second, capital efficiency: a multi-unit operator can finance unit two against the proven cash flow of unit one, easier than a first-time franchisee can finance unit one against zero history.

Multi-unit operators also tend to be more sophisticated business owners — comfortable with documented systems, operational delegation, financial reporting, and long planning horizons. They're typically the most attractive candidates for area development agreements.

The strategic implication for franchisors: most franchise systems eventually evolve toward serving multi-unit operators rather than first-time franchisees. The recruiting motion, training program, and field support model all benefit from being designed with multi-unit franchisees in mind early — even when your first 10 sales are single-unit operators.`,
    relatedTerms: ["area-developer", "master-franchise", "owner-operator"],
    relatedBlogSlugs: ["how-to-recruit-first-10-franchisees"],
  },
  {
    slug: "owner-operator",
    term: "Owner-Operator",
    aka: ["Owner-Operator Franchisee"],
    category: "Structure",
    shortDef:
      "A franchisee who personally operates their unit day-to-day rather than hiring a manager to run it — common in food service, beauty, and home services categories.",
    longDef: `Owner-operator status is a structural decision that affects who buys your franchise. Some franchise systems require owner-operator commitment in the franchise agreement (Item 15 of the FDD discloses this). Others permit "designated manager" structures where a hired manager runs the unit while the franchisee is an absentee or semi-absentee owner.

Owner-operator-only systems attract operators — people who want to be hands-on in the business. The candidate pool skews toward career-changers from corporate management, military veterans, and trade professionals.

Absentee-permitted systems attract investors — people who want to add a franchise to their portfolio and hire someone to run it. The candidate pool skews toward existing multi-unit operators, real estate investors, and high-net-worth individuals using the franchise as one investment among many.

These are different sales motions. Owner-operator candidates value training quality, ongoing field support, and operational documentation. Investor candidates value Item 19 numbers, return on capital, and the franchisor's ability to provide turnkey operations.

Most emerging franchise systems start with owner-operator-only requirements (it forces operational engagement and reduces the risk of poorly managed early units), then permit absentee ownership as the system matures and operations are documented enough to run without daily owner attention.`,
    relatedTerms: ["multi-unit-franchisee", "franchise-candidate-qualification"],
    relatedBlogSlugs: ["how-to-recruit-first-10-franchisees"],
  },
  {
    slug: "exclusive-territory",
    term: "Exclusive Territory",
    aka: ["Protected Territory"],
    category: "Structure",
    shortDef:
      "A franchise territory in which no other franchisee or franchisor-owned unit can operate — typically defined by ZIP codes, counties, or radius — providing the franchisee with non-competition guarantees from the franchisor.",
    longDef: `Exclusive territory grants are one of the most negotiated provisions in any franchise agreement. The franchisee gets contractual assurance that the franchisor won't place a competing unit in their territory; the franchisor gives up the flexibility to densify markets where unit economics support multiple locations.

Territory definitions vary by sector. Food service franchises typically use radius-based definitions (e.g., 1.5 miles from the unit). Service franchises often use ZIP code or county definitions, since the unit doesn't have a fixed customer-visit location. Some categories use population-based definitions (e.g., 50,000 residents per territory) that reflect the natural service area.

The trade-off matters strategically. Generous exclusive territories make franchises easier to sell — candidates love the comfort of a protected market — but constrain franchisor expansion. Tight territories preserve flexibility but make the offer less attractive to candidates with multi-unit ambitions.

Modern franchise agreements often include carve-outs for non-traditional venues (airports, sports stadiums, corporate campuses, military bases) and online/internet sales — preserving franchisor flexibility while still giving the franchisee meaningful protection in their core territory.

Item 12 of the FDD discloses exactly what territory protections (if any) the franchise agreement provides.`,
    relatedTerms: ["fdd-item-12", "area-developer", "master-franchise"],
    relatedBlogSlugs: ["franchise-disclosure-document-explained"],
  },
  {
    slug: "right-of-first-refusal",
    term: "Right of First Refusal (ROFR)",
    aka: ["ROFR"],
    category: "Structure",
    shortDef:
      "A franchise agreement provision that lets the franchisor match any third-party offer to acquire a franchisee's unit — protecting the franchisor against transfers to operators who don't fit the system.",
    longDef: `Right of first refusal provisions appear in most franchise agreements as a safeguard against poorly-fit transfers. When a franchisee receives a bona fide offer to sell their unit, they must first present that offer to the franchisor, who has a defined window (typically 30-60 days) to match the offer's terms and acquire the unit themselves.

The franchisor benefits two ways. First, quality control: poorly-fit acquirers can be rejected by the franchisor matching the offer rather than approving the transfer. Second, strategic consolidation: when a franchisee exits, the franchisor has the option to buy back the unit and operate it as company-owned — useful for prime markets, brand-flagship locations, or as training units.

In practice, most franchisors don't exercise ROFR — operating a franchisee unit isn't always strategic — but the right exists as a check on transfers that would damage system quality.

ROFR is paired with the broader transfer-approval process disclosed in Item 17 of the FDD. Even when the franchisor declines to match a third-party offer, the proposed transferee must still pass franchisee qualification and complete training before the transfer is approved.`,
    relatedTerms: ["transfer-fee", "fdd-item-17"],
    relatedBlogSlugs: ["franchise-disclosure-document-explained"],
  },
];

/** Look up a glossary term by slug. */
export function getGlossaryTerm(slug: string): FranchiseGlossaryTerm {
  const t = allGlossaryTerms.find((x) => x.slug === slug);
  if (!t) throw new Error(`Glossary term not found: ${slug}`);
  return t;
}

/** Map of category to display order on the hub page. */
export const CATEGORY_ORDER: GlossaryCategory[] = [
  "FDD & Legal",
  "Financial",
  "Sales & Discovery",
  "Operations",
  "Structure",
];

/** Optional category-level tagline shown on the hub. */
export const CATEGORY_DESCRIPTION: Record<GlossaryCategory, string> = {
  "FDD & Legal":
    "The legal architecture of franchising — disclosure documents, FTC rules, registration states, and the items that make up the FDD itself.",
  Financial:
    "The economics of franchising — fees, royalties, unit-level returns, and the metrics that determine whether a franchise system actually works.",
  "Sales & Discovery":
    "The sales motion of franchising — how candidates are qualified, validated, and converted from leads into signed franchisees.",
  Operations:
    "The operational backbone of a franchise system — manuals, field support, and the structures that keep unit-level execution consistent.",
  Structure:
    "The structural variations of franchise systems — territory definitions, multi-unit ownership, and the contractual provisions that shape long-term franchisor-franchisee dynamics.",
};

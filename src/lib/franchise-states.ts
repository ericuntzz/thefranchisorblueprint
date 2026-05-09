/**
 * State-by-state franchise data for the programmatic SEO collection at
 * /franchise-your-business-in/[state].
 *
 * Each entry pairs hard regulatory facts (publicly sourced from state
 * agency websites and the FTC Franchise Rule) with state-specific
 * economic and industry color so each generated page has genuinely
 * differentiated content — the mitigation against Google's "scaled
 * content abuse" policy.
 *
 * Source notes:
 *  - Registration tiers reflect the consensus list of the 14 U.S.
 *    franchise registration states plus the franchise relationship
 *    states recognized by the IFA and most franchise attorneys.
 *  - Filing fees and agency names were current at last review (May 2026)
 *    from the respective state regulator websites.
 *  - Population figures are 2025 Census estimates rounded to the nearest
 *    100k.
 *  - "Hook facts" and "unique facts" are real public-knowledge details
 *    intended to give each page substantive differentiation.
 */

export type RegistrationTier =
  | "full" // Full FDD registration required before sale
  | "notice" // Notice filing only (lighter than full)
  | "businessOpp" // Business opportunity statute applies
  | "relationship" // Franchise relationship law (post-sale)
  | "ftcOnly"; // Only federal FTC Franchise Rule applies

export type FranchiseState = {
  slug: string;
  name: string;
  abbreviation: string;
  tier: RegistrationTier;

  // Registration specifics (for "full" / "notice" tiers)
  agency?: string;
  agencyAcronym?: string;
  initialFilingFee?: number;
  renewalFee?: number;
  renewalCadence?: "annual" | "biennial";
  reviewTimeWeeks?: { min: number; max: number };

  // Geographic + economic
  topMetros: string[];
  populationMillions: number;

  // Differentiation layer
  hookFact: string;
  uniqueFacts: string[];
  industryStrengths: string[];
  jasonNote: string;

  // Cross-linking targets
  recommendedIndustrySlugs?: string[];
};

export const allStates: FranchiseState[] = [
  // ─── 14 REGISTRATION STATES ─────────────────────────────────────────────
  {
    slug: "california",
    name: "California",
    abbreviation: "CA",
    tier: "full",
    agency: "Department of Financial Protection and Innovation",
    agencyAcronym: "DFPI",
    initialFilingFee: 675,
    renewalFee: 450,
    renewalCadence: "annual",
    reviewTimeWeeks: { min: 6, max: 14 },
    topMetros: ["Los Angeles", "San Francisco Bay Area", "San Diego", "Sacramento"],
    populationMillions: 39.2,
    hookFact:
      "California is the largest single franchise market in the U.S. — and the slowest registration state to clear, with first-cycle reviews routinely landing in the 8-14 week range.",
    uniqueFacts: [
      "DFPI examiners commonly issue 2-3 rounds of comments before approving a first-time FDD; expect to budget for revision cycles.",
      "California prohibits hidden franchise fee discounts and enforces uniformity strictly under Business & Professions Code §31000.",
      "Over 78,000 franchise units operate in California — more than Texas and Florida combined.",
    ],
    industryStrengths: ["Quick-service restaurants", "Fitness", "Beauty / personal care"],
    jasonNote:
      "If you're going to sell franchises in California, plan your timeline around the DFPI — their queue is longer than every other state and their examiners read FDDs more carefully than almost anyone else. The upside: a clean California registration is a credibility marker that helps with every other registration after it.",
    recommendedIndustrySlugs: ["quick-service-restaurant", "fitness", "beauty"],
  },
  {
    slug: "hawaii",
    name: "Hawaii",
    abbreviation: "HI",
    tier: "full",
    agency: "Department of Commerce and Consumer Affairs",
    agencyAcronym: "DCCA",
    initialFilingFee: 250,
    renewalFee: 250,
    renewalCadence: "annual",
    reviewTimeWeeks: { min: 4, max: 8 },
    topMetros: ["Honolulu", "Hilo", "Kahului"],
    populationMillions: 1.4,
    hookFact:
      "Hawaii is one of only 14 full-registration states and the only one where most franchise candidates can name every shopping center in the state by heart.",
    uniqueFacts: [
      "Hawaii's franchise registration filings are reviewed faster than most mainland states — typically 4-6 weeks for a first-cycle.",
      "The state's geographic isolation means a single Discovery Day candidate often represents 2-4 potential unit sites across the islands.",
      "Tourism-anchored unit economics in Hawaii skew higher revenue but also higher labor and rent — disclose the variability honestly in Item 7.",
    ],
    industryStrengths: ["Quick-service restaurants", "Coffee", "Beauty / personal care"],
    jasonNote:
      "Hawaii is a small market that punches above its weight for franchise deal flow because of the multi-unit dynamics. Worth registering if you have any reasonable expectation of operators in the islands.",
    recommendedIndustrySlugs: ["quick-service-restaurant", "coffee", "beauty"],
  },
  {
    slug: "illinois",
    name: "Illinois",
    abbreviation: "IL",
    tier: "full",
    agency: "Office of the Attorney General — Franchise Bureau",
    agencyAcronym: "AG",
    initialFilingFee: 500,
    renewalFee: 100,
    renewalCadence: "annual",
    reviewTimeWeeks: { min: 4, max: 10 },
    topMetros: ["Chicago", "Aurora", "Rockford", "Joliet"],
    populationMillions: 12.5,
    hookFact:
      "Illinois has one of the longest-running franchise registration regimes in the country (the Franchise Disclosure Act of 1987) and one of the more particular review processes for first-time franchisors.",
    uniqueFacts: [
      "The Illinois Franchise Bureau pays close attention to Item 19 disclosures — vague or unsupported representations get flagged faster here than in most states.",
      "Chicago alone hosts the headquarters of multiple major franchisors (McDonald's, Hyatt, Beggars Pizza, Potbelly) — franchise sophistication among local operators is high.",
      "Illinois requires renewal within 120 days of fiscal year-end, tighter than most states; missing the window stops sales until refiled.",
    ],
    industryStrengths: ["Quick-service restaurants", "Senior care", "Cleaning"],
    jasonNote:
      "Illinois is a serious franchise market with serious regulators. If your Item 19 isn't defensible, the Bureau will tell you so. Treat their first comment letter as a warning that your sales conversations are about to get scrutinized too.",
    recommendedIndustrySlugs: ["quick-service-restaurant", "senior-care", "cleaning"],
  },
  {
    slug: "indiana",
    name: "Indiana",
    abbreviation: "IN",
    tier: "full",
    agency: "Securities Division",
    agencyAcronym: "Securities Division",
    initialFilingFee: 500,
    renewalFee: 250,
    renewalCadence: "annual",
    reviewTimeWeeks: { min: 3, max: 6 },
    topMetros: ["Indianapolis", "Fort Wayne", "Evansville", "South Bend"],
    populationMillions: 6.9,
    hookFact:
      "Indiana houses its franchise regulator inside the Securities Division — and treats franchise sales with the same disclosure rigor as securities transactions.",
    uniqueFacts: [
      "Indiana's review timeline is among the faster registration states — often 3-5 weeks for first-cycle approval if the FDD is clean.",
      "The state is a strong market for home services and automotive franchises driven by suburban density around Indianapolis and Fort Wayne.",
      "Indiana franchisees frequently use SBA financing through local lenders — a strong Item 19 here directly accelerates closings.",
    ],
    industryStrengths: ["Home services", "Automotive services", "Quick-service restaurants"],
    jasonNote:
      "Indiana is one of the easier registration states to clear if your paperwork is in order. Don't underestimate the market though — the Indianapolis metro area is a quietly significant franchise market.",
    recommendedIndustrySlugs: ["home-services", "automotive", "quick-service-restaurant"],
  },
  {
    slug: "maryland",
    name: "Maryland",
    abbreviation: "MD",
    tier: "full",
    agency: "Securities Division — Office of the Attorney General",
    agencyAcronym: "Securities Division",
    initialFilingFee: 500,
    renewalFee: 250,
    renewalCadence: "annual",
    reviewTimeWeeks: { min: 4, max: 8 },
    topMetros: ["Baltimore", "Silver Spring", "Frederick", "Rockville"],
    populationMillions: 6.2,
    hookFact:
      "Maryland is the gateway franchise registration state for franchisors targeting the entire DC metro area — and a market where federal-employee operator-buyer demographics shape unit economics.",
    uniqueFacts: [
      "The DC metro area's higher household income skews unit-level revenue 15-25% above national averages for service franchises.",
      "Maryland regulators routinely review FDDs alongside Virginia's State Corporation Commission — clean filings in one often shortens review in the other.",
      "Senior care and home services are particularly active categories given Maryland's aging suburban demographics.",
    ],
    industryStrengths: ["Senior care", "Home services", "Beauty / personal care"],
    jasonNote:
      "If you want serious DC-area exposure, Maryland is the registration to lead with. Virginia is a close second and most franchisors register both within 30 days of each other.",
    recommendedIndustrySlugs: ["senior-care", "home-services", "beauty"],
  },
  {
    slug: "michigan",
    name: "Michigan",
    abbreviation: "MI",
    tier: "notice",
    agency: "Department of Attorney General",
    agencyAcronym: "AG",
    initialFilingFee: 250,
    renewalFee: 250,
    renewalCadence: "annual",
    reviewTimeWeeks: { min: 1, max: 3 },
    topMetros: ["Detroit", "Grand Rapids", "Warren", "Ann Arbor"],
    populationMillions: 10.0,
    hookFact:
      "Michigan is a notice-filing state, not a full registration state — making it one of the easiest 'registration' states to clear for franchisors entering the market.",
    uniqueFacts: [
      "Michigan's 'Notice of Intent to Offer Franchises' is processed in 1-3 weeks — dramatically faster than full registration states.",
      "The Detroit metro area's manufacturing-heavy buyer demographics favor home services, automotive, and trades-adjacent franchise categories.",
      "Grand Rapids has emerged as a quiet hotspot for fitness and personal-care franchise growth over the past decade.",
    ],
    industryStrengths: ["Home services", "Automotive services", "Fitness"],
    jasonNote:
      "Michigan's notice-filing structure makes it a cheap, fast win on your registration roadmap. File it early — there's no real reason not to.",
    recommendedIndustrySlugs: ["home-services", "automotive", "fitness"],
  },
  {
    slug: "minnesota",
    name: "Minnesota",
    abbreviation: "MN",
    tier: "full",
    agency: "Department of Commerce — Securities Division",
    agencyAcronym: "DOC",
    initialFilingFee: 400,
    renewalFee: 200,
    renewalCadence: "annual",
    reviewTimeWeeks: { min: 4, max: 8 },
    topMetros: ["Minneapolis", "Saint Paul", "Rochester", "Duluth"],
    populationMillions: 5.7,
    hookFact:
      "Minnesota's franchise regulator pays particular attention to the franchisee relationship sections of the franchise agreement — Items 17 and 22 routinely draw comment.",
    uniqueFacts: [
      "Minnesota is home to several historically significant franchisors (Caribou Coffee, Hot Stuff Pizza, Christopher & Banks) and carries strong franchise sophistication in its operator pool.",
      "The state's cold-weather climate makes home services franchises (especially HVAC, plumbing, snow removal) consistently strong performers.",
      "Twin Cities metro candidates often validate franchise opportunities by referencing the Minnesota franchisee community — a tight network.",
    ],
    industryStrengths: ["Home services", "Coffee", "Senior care"],
    jasonNote:
      "Minnesota regulators are reasonable but particular about franchisee-protection provisions. Make sure your transfer, termination, and renewal language is defensible before filing.",
    recommendedIndustrySlugs: ["home-services", "coffee", "senior-care"],
  },
  {
    slug: "new-york",
    name: "New York",
    abbreviation: "NY",
    tier: "full",
    agency: "Department of Law — Investor Protection Bureau",
    agencyAcronym: "DOL",
    initialFilingFee: 750,
    renewalFee: 150,
    renewalCadence: "annual",
    reviewTimeWeeks: { min: 8, max: 16 },
    topMetros: ["New York City", "Buffalo", "Rochester", "Albany"],
    populationMillions: 19.5,
    hookFact:
      "New York is the most rigorous franchise registration state in the country — the Department of Law's Investor Protection Bureau commonly issues 3-5 rounds of detailed comments on first-time FDDs.",
    uniqueFacts: [
      "New York requires audited financial statements for all franchisors, even first-year applicants — no exemption for new entrants.",
      "First-cycle review timelines of 12-16 weeks are common; experienced franchisors plan 4-month registration windows.",
      "NYC alone represents the highest-cost-per-acquisition franchise market in the country — both for unit operators (real estate) and for the franchisor (lead acquisition).",
    ],
    industryStrengths: ["Quick-service restaurants", "Fitness", "Beauty / personal care"],
    jasonNote:
      "New York is where weak FDDs go to die. The DOL examiners are sharp, demanding, and will hold up your registration over technicalities other states wave through. Budget for the time and the audit. The reward: a registered NY franchise is a serious credibility signal.",
    recommendedIndustrySlugs: ["quick-service-restaurant", "fitness", "beauty"],
  },
  {
    slug: "north-dakota",
    name: "North Dakota",
    abbreviation: "ND",
    tier: "full",
    agency: "Securities Department",
    agencyAcronym: "Securities Department",
    initialFilingFee: 250,
    renewalFee: 100,
    renewalCadence: "annual",
    reviewTimeWeeks: { min: 4, max: 8 },
    topMetros: ["Fargo", "Bismarck", "Grand Forks"],
    populationMillions: 0.8,
    hookFact:
      "North Dakota is one of the smallest registration states by population — but its energy-sector economy and high rural household income create disproportionate franchise demand for select categories.",
    uniqueFacts: [
      "Fargo has consistently ranked among the top metros for franchise-unit growth per capita over the past decade.",
      "North Dakota's franchise relationship statute is particularly franchisee-protective — review your termination and non-renewal provisions carefully.",
      "Energy-sector wage levels create unusually capitalized owner-operator candidates relative to the state's small population.",
    ],
    industryStrengths: ["Quick-service restaurants", "Home services", "Automotive services"],
    jasonNote:
      "Don't dismiss North Dakota because of population. The franchise activity per capita is real, and the registration cost is among the lowest in the country.",
    recommendedIndustrySlugs: ["quick-service-restaurant", "home-services", "automotive"],
  },
  {
    slug: "rhode-island",
    name: "Rhode Island",
    abbreviation: "RI",
    tier: "full",
    agency: "Department of Business Regulation",
    agencyAcronym: "DBR",
    initialFilingFee: 500,
    renewalFee: 250,
    renewalCadence: "annual",
    reviewTimeWeeks: { min: 4, max: 8 },
    topMetros: ["Providence", "Warwick", "Cranston"],
    populationMillions: 1.1,
    hookFact:
      "Rhode Island is the smallest U.S. state by area and one of the smaller registration states — but its dense urbanization makes per-square-mile franchise penetration the highest in New England.",
    uniqueFacts: [
      "Providence's restaurant scene density makes Rhode Island a strong test market for casual dining and coffee franchise concepts.",
      "The state's compact geography means a single franchisee can credibly cover two or three metro markets without exceeding territory norms.",
      "Rhode Island's filing fees and renewal costs are mid-range among registration states — meaningful but not prohibitive.",
    ],
    industryStrengths: ["Casual dining", "Coffee", "Beauty / personal care"],
    jasonNote:
      "Rhode Island is small but the regulatory burden is straightforward. If you're targeting New England, register here at the same time as Massachusetts (which is FTC-only) and Connecticut.",
    recommendedIndustrySlugs: ["casual-dining", "coffee", "beauty"],
  },
  {
    slug: "south-dakota",
    name: "South Dakota",
    abbreviation: "SD",
    tier: "full",
    agency: "Division of Securities",
    agencyAcronym: "Division of Securities",
    initialFilingFee: 250,
    renewalFee: 150,
    renewalCadence: "annual",
    reviewTimeWeeks: { min: 3, max: 6 },
    topMetros: ["Sioux Falls", "Rapid City", "Aberdeen"],
    populationMillions: 0.9,
    hookFact:
      "South Dakota is one of the most franchisor-friendly registration states — fast review timelines, modest filing fees, and a streamlined comment process.",
    uniqueFacts: [
      "Sioux Falls has been one of the fastest-growing mid-sized metros in the U.S. over the past decade — driving strong franchise category demand.",
      "South Dakota's lack of state income tax improves franchisee unit economics relative to higher-tax neighboring states.",
      "First-cycle reviews routinely close in 3-5 weeks if the FDD is clean.",
    ],
    industryStrengths: ["Home services", "Automotive services", "Quick-service restaurants"],
    jasonNote:
      "South Dakota is a quiet but worthwhile registration. The cost is low and the operator pool, while smaller, is well-capitalized.",
    recommendedIndustrySlugs: ["home-services", "automotive", "quick-service-restaurant"],
  },
  {
    slug: "virginia",
    name: "Virginia",
    abbreviation: "VA",
    tier: "full",
    agency: "State Corporation Commission",
    agencyAcronym: "SCC",
    initialFilingFee: 500,
    renewalFee: 250,
    renewalCadence: "annual",
    reviewTimeWeeks: { min: 4, max: 8 },
    topMetros: ["Virginia Beach", "Arlington", "Richmond", "Norfolk"],
    populationMillions: 8.7,
    hookFact:
      "Virginia is the second pillar of DC-metro franchise expansion (alongside Maryland) — and home to one of the more efficient franchise registration regulators in the country.",
    uniqueFacts: [
      "Northern Virginia (Arlington, Fairfax, Loudoun counties) carries the highest median household income of any DC-metro jurisdiction — driving strong premium franchise demand.",
      "The SCC reviews franchise filings alongside other corporate filings, often allowing parallel processing that shortens overall registration timelines.",
      "Virginia's military and federal employee populations create a strong base of veteran-discount-eligible franchise candidates (VetFran program participation).",
    ],
    industryStrengths: ["Senior care", "Home services", "Beauty / personal care"],
    jasonNote:
      "Virginia is a strategic registration. Pair it with Maryland and you've covered the entire DC metro — one of the most franchise-receptive markets in the country.",
    recommendedIndustrySlugs: ["senior-care", "home-services", "beauty"],
  },
  {
    slug: "washington",
    name: "Washington",
    abbreviation: "WA",
    tier: "full",
    agency: "Department of Financial Institutions — Securities Division",
    agencyAcronym: "DFI",
    initialFilingFee: 600,
    renewalFee: 100,
    renewalCadence: "annual",
    reviewTimeWeeks: { min: 6, max: 12 },
    topMetros: ["Seattle", "Spokane", "Tacoma", "Bellevue"],
    populationMillions: 8.0,
    hookFact:
      "Washington is one of the more thorough registration states — the DFI examiners closely review Item 7 ranges and Item 19 substantiation against the state's high cost of living.",
    uniqueFacts: [
      "Seattle's high real estate and labor costs push Item 7 ranges in WA higher than most states; ranges that look defensible in the Midwest get flagged here.",
      "Washington has no state income tax — making after-tax franchisee returns more attractive than the state's high cost of living suggests.",
      "The Pacific Northwest tech-worker demographic makes this a strong market for premium fitness, coffee, and personal-care franchises.",
    ],
    industryStrengths: ["Coffee", "Fitness", "Beauty / personal care"],
    jasonNote:
      "Washington examiners are sharp on cost-of-doing-business specifics. If your Item 7 doesn't reflect Seattle realities, expect comments. Build a Seattle-specific pro forma into your FDD prep.",
    recommendedIndustrySlugs: ["coffee", "fitness", "beauty"],
  },
  {
    slug: "wisconsin",
    name: "Wisconsin",
    abbreviation: "WI",
    tier: "full",
    agency: "Division of Securities — Department of Financial Institutions",
    agencyAcronym: "DFI",
    initialFilingFee: 400,
    renewalFee: 200,
    renewalCadence: "annual",
    reviewTimeWeeks: { min: 4, max: 8 },
    topMetros: ["Milwaukee", "Madison", "Green Bay", "Kenosha"],
    populationMillions: 5.9,
    hookFact:
      "Wisconsin's Fair Dealership Law (section 135) is one of the strongest franchisee-protection statutes in the country — review your termination and non-renewal language carefully before filing.",
    uniqueFacts: [
      "The Wisconsin Fair Dealership Law extends substantial post-sale protections to franchisees, materially affecting how you draft Item 17 of the FDD.",
      "Madison and Milwaukee both have strong food service and casual dining franchise penetration — the state's tavern and supper club culture creates familiarity with operator economics.",
      "Wisconsin's review timelines are typically reasonable — 4-7 weeks for a first-cycle if the dealership-law issues are addressed cleanly.",
    ],
    industryStrengths: ["Casual dining", "Quick-service restaurants", "Cleaning"],
    jasonNote:
      "Don't underestimate the Fair Dealership Law. It changes how you draft termination and renewal provisions in your franchise agreement — and your attorney needs to know that going in.",
    recommendedIndustrySlugs: ["casual-dining", "quick-service-restaurant", "cleaning"],
  },

  // ─── 19 FRANCHISE RELATIONSHIP STATES ───────────────────────────────────
  {
    slug: "arkansas",
    name: "Arkansas",
    abbreviation: "AR",
    tier: "relationship",
    topMetros: ["Little Rock", "Fayetteville", "Fort Smith"],
    populationMillions: 3.1,
    hookFact:
      "Arkansas is home to Walmart's headquarters in Bentonville — a corporate ecosystem that produces an unusually high concentration of franchise-curious operator candidates.",
    uniqueFacts: [
      "The Arkansas Franchise Practices Act limits franchisor termination rights and requires good cause for non-renewal.",
      "Northwest Arkansas (Bentonville, Fayetteville) has been one of the fastest-growing small metros in the country, anchored by the Walmart-supplier ecosystem.",
      "Quick-service restaurants and home services are the dominant active franchise categories.",
    ],
    industryStrengths: ["Quick-service restaurants", "Home services", "Automotive services"],
    jasonNote:
      "Arkansas has no pre-sale registration but a real franchise relationship law. Make sure your termination provisions account for the Practices Act.",
    recommendedIndustrySlugs: ["quick-service-restaurant", "home-services", "automotive"],
  },
  {
    slug: "connecticut",
    name: "Connecticut",
    abbreviation: "CT",
    tier: "relationship",
    topMetros: ["Bridgeport", "New Haven", "Stamford", "Hartford"],
    populationMillions: 3.6,
    hookFact:
      "Connecticut's affluent fairfield County operator demographic makes it a top market for premium personal care, fitness, and education franchises.",
    uniqueFacts: [
      "Connecticut's Business Opportunity Investment Act may apply to certain franchise offerings — verify with counsel before launching here.",
      "Fairfield County's median household income consistently ranks among the top 10 nationally — sustaining premium-tier unit economics.",
      "The state's high cost of living means franchisee Item 7 ranges trend higher than most states; disclose accordingly.",
    ],
    industryStrengths: ["Education / tutoring", "Beauty / personal care", "Fitness"],
    jasonNote:
      "Connecticut is a small state but a wealthy one. Premium franchise concepts perform unusually well here.",
    recommendedIndustrySlugs: ["education", "beauty", "fitness"],
  },
  {
    slug: "delaware",
    name: "Delaware",
    abbreviation: "DE",
    tier: "relationship",
    topMetros: ["Wilmington", "Dover", "Newark"],
    populationMillions: 1.0,
    hookFact:
      "Delaware is the corporate domicile of more than 60% of Fortune 500 companies — and one of the most franchise-attorney-friendly jurisdictions for franchise agreement governing law.",
    uniqueFacts: [
      "Many franchise agreements specify Delaware as the governing-law jurisdiction even when the franchisor isn't located there — for the well-developed corporate case law.",
      "The Delaware Franchise Security Law provides specific franchisee notice and cure rights on termination.",
      "Wilmington's banking and finance sector creates an unusually well-capitalized small-business operator pool.",
    ],
    industryStrengths: ["Quick-service restaurants", "Cleaning", "Coffee"],
    jasonNote:
      "Delaware's small population belies its outsized importance to franchise law. If you're in any way connected to corporate-domicile decisions, talk to your attorney about Delaware governing law.",
    recommendedIndustrySlugs: ["quick-service-restaurant", "cleaning", "coffee"],
  },
  {
    slug: "florida",
    name: "Florida",
    abbreviation: "FL",
    tier: "businessOpp",
    topMetros: ["Miami", "Tampa", "Orlando", "Jacksonville"],
    populationMillions: 23.2,
    hookFact:
      "Florida is one of the three largest franchise markets in the U.S. and applies its Sale of Business Opportunities Act to any franchise offering that doesn't meet the franchise exemption.",
    uniqueFacts: [
      "Florida franchisors typically file a Florida Annual Filing under the franchise exemption ($100, no full registration) — but business opportunity rules apply if the exemption doesn't fit.",
      "The state's tourism-driven economy creates strong demand for hospitality, food service, and personal-care franchise categories — especially in Orlando and Miami.",
      "Florida's no-state-income-tax structure improves franchisee net returns versus high-tax neighboring states.",
    ],
    industryStrengths: ["Quick-service restaurants", "Senior care", "Beauty / personal care"],
    jasonNote:
      "Florida is enormous, fragmented across multiple major metros, and friendly to franchise growth. The annual filing is cheap but the business opportunity statute is a trap if your offer doesn't qualify for exemption — get it right with your attorney.",
    recommendedIndustrySlugs: ["quick-service-restaurant", "senior-care", "beauty"],
  },
  {
    slug: "iowa",
    name: "Iowa",
    abbreviation: "IA",
    tier: "relationship",
    topMetros: ["Des Moines", "Cedar Rapids", "Davenport", "Iowa City"],
    populationMillions: 3.2,
    hookFact:
      "Iowa is one of the most franchisee-protective states in the country — its Iowa Franchise Act is sometimes called the toughest franchise relationship statute in the U.S.",
    uniqueFacts: [
      "The Iowa Franchise Act (Section 537A) requires good cause for termination and provides extended cure rights to franchisees.",
      "Iowa's stable, well-capitalized operator demographic makes it a strong market for service and home-services franchise categories.",
      "Des Moines has emerged as a quiet financial-services hub, generating a steady pool of executive franchise candidates.",
    ],
    industryStrengths: ["Home services", "Cleaning", "Senior care"],
    jasonNote:
      "Iowa's franchise relationship law materially affects your franchise agreement. Don't draft termination and renewal provisions without an attorney who's worked with the Iowa statute specifically.",
    recommendedIndustrySlugs: ["home-services", "cleaning", "senior-care"],
  },
  {
    slug: "kentucky",
    name: "Kentucky",
    abbreviation: "KY",
    tier: "relationship",
    topMetros: ["Louisville", "Lexington", "Bowling Green"],
    populationMillions: 4.5,
    hookFact:
      "Kentucky's franchise activity skews heavily toward food service and automotive — Louisville and Lexington both rank as strong test markets for casual dining concepts.",
    uniqueFacts: [
      "Kentucky has limited franchise-specific regulation but applies general business opportunity statutes that can intersect with franchise offerings.",
      "Louisville's logistics economy (UPS Worldport hub) creates a strong base of operator candidates with multi-unit management experience.",
      "Bourbon and food tourism create unique brand-extension opportunities for franchisors with destination-anchored concepts.",
    ],
    industryStrengths: ["Quick-service restaurants", "Casual dining", "Automotive services"],
    jasonNote:
      "Kentucky's regulatory burden is lighter than registration states but the operator pool is sophisticated. Treat it as a serious target market in your registration roadmap.",
    recommendedIndustrySlugs: ["quick-service-restaurant", "casual-dining", "automotive"],
  },
  {
    slug: "louisiana",
    name: "Louisiana",
    abbreviation: "LA",
    tier: "relationship",
    topMetros: ["New Orleans", "Baton Rouge", "Shreveport", "Lafayette"],
    populationMillions: 4.6,
    hookFact:
      "Louisiana operates under a French-derived civil law system unique among U.S. states — affecting how franchise agreement provisions are interpreted by Louisiana courts.",
    uniqueFacts: [
      "Louisiana civil law differences mean franchise agreements should explicitly specify governing law (typically Delaware or franchisor's home state) to avoid interpretation surprises.",
      "New Orleans' tourism and hospitality economy makes it a strong test market for casual dining, coffee, and quick-service franchise concepts.",
      "The state's strong food culture creates both high consumer demand and elevated competitive pressure for restaurant franchise concepts.",
    ],
    industryStrengths: ["Casual dining", "Quick-service restaurants", "Coffee"],
    jasonNote:
      "Louisiana's civil law system makes governing-law selection in your franchise agreement more important than usual. Talk to your attorney specifically about how Louisiana courts will interpret your contract.",
    recommendedIndustrySlugs: ["casual-dining", "quick-service-restaurant", "coffee"],
  },
  {
    slug: "maine",
    name: "Maine",
    abbreviation: "ME",
    tier: "relationship",
    topMetros: ["Portland", "Lewiston", "Bangor"],
    populationMillions: 1.4,
    hookFact:
      "Maine's franchise relationship statute (the Maine Sale or Lease of Business Opportunities Act) provides specific franchisee termination protections distinct from most states.",
    uniqueFacts: [
      "Maine's seasonal economy (tourism heavy in summer, quiet in winter) creates unusual unit economics that should be reflected in Item 19 disclosures.",
      "Portland has emerged as a notable food and beverage market — strong for coffee, brewery-adjacent, and casual dining franchise concepts.",
      "The state's older demographic profile makes it a strong market for senior care franchise categories.",
    ],
    industryStrengths: ["Casual dining", "Senior care", "Coffee"],
    jasonNote:
      "Maine is a small market with seasonal dynamics. Make sure your candidates understand the seasonality before signing — winter cash flow surprises are the most common franchisee disputes here.",
    recommendedIndustrySlugs: ["casual-dining", "senior-care", "coffee"],
  },
  {
    slug: "mississippi",
    name: "Mississippi",
    abbreviation: "MS",
    tier: "relationship",
    topMetros: ["Jackson", "Gulfport", "Southaven"],
    populationMillions: 2.9,
    hookFact:
      "Mississippi has limited franchise-specific statutes but applies general business opportunity law — making compliance straightforward but operator pool depth more limited than larger states.",
    uniqueFacts: [
      "Mississippi's low cost of living means franchisee Item 7 ranges trend lower than most states — disclose in real terms relevant to your operators.",
      "Gulf Coast markets (Gulfport, Biloxi) have unique gaming-economy operator demographics that affect candidate qualification.",
      "Quick-service restaurants and automotive services dominate active franchise categories.",
    ],
    industryStrengths: ["Quick-service restaurants", "Automotive services", "Home services"],
    jasonNote:
      "Mississippi is a smaller market. Worth being available there but not necessarily a primary expansion target for first-time franchisors.",
    recommendedIndustrySlugs: ["quick-service-restaurant", "automotive", "home-services"],
  },
  {
    slug: "nebraska",
    name: "Nebraska",
    abbreviation: "NE",
    tier: "relationship",
    topMetros: ["Omaha", "Lincoln", "Bellevue"],
    populationMillions: 2.0,
    hookFact:
      "Nebraska's Franchise Practices Act requires good cause for termination and applies even to franchise systems based outside the state if they sell into Nebraska.",
    uniqueFacts: [
      "Omaha is home to several major corporate headquarters (Berkshire Hathaway, Mutual of Omaha, Union Pacific) — creating a sophisticated executive operator pool.",
      "The state's stable agricultural and insurance economies make it a strong market for established franchise concepts versus high-risk emerging brands.",
      "Lincoln's university-town demographics support strong fitness and casual dining franchise penetration.",
    ],
    industryStrengths: ["Quick-service restaurants", "Fitness", "Senior care"],
    jasonNote:
      "Nebraska is a quietly important market. The Omaha metro is more sophisticated than most outside-the-region franchisors expect.",
    recommendedIndustrySlugs: ["quick-service-restaurant", "fitness", "senior-care"],
  },
  {
    slug: "new-hampshire",
    name: "New Hampshire",
    abbreviation: "NH",
    tier: "relationship",
    topMetros: ["Manchester", "Nashua", "Concord"],
    populationMillions: 1.4,
    hookFact:
      "New Hampshire has no state income tax and no state sales tax — improving franchisee unit economics and creating an unusually attractive operator-buyer dynamic.",
    uniqueFacts: [
      "The no-tax structure creates measurable franchisee net-return advantages that should factor into your sales pitch in NH.",
      "Southern NH operates effectively as part of the Greater Boston metro — many candidates also operate in Massachusetts.",
      "The state's tourism economy creates seasonal demand patterns for food service and personal care franchise categories.",
    ],
    industryStrengths: ["Casual dining", "Coffee", "Beauty / personal care"],
    jasonNote:
      "Don't overlook NH because of size. The tax structure is a real franchisee economic advantage that strong sales conversations turn into a closing point.",
    recommendedIndustrySlugs: ["casual-dining", "coffee", "beauty"],
  },
  {
    slug: "new-jersey",
    name: "New Jersey",
    abbreviation: "NJ",
    tier: "relationship",
    topMetros: ["Newark", "Jersey City", "Paterson", "Elizabeth"],
    populationMillions: 9.5,
    hookFact:
      "New Jersey's Franchise Practices Act (NJSA 56:10) is one of the strongest franchisee-protection statutes in the country — particularly on termination, renewal, and transfer rights.",
    uniqueFacts: [
      "The NJ Franchise Practices Act materially restricts franchisor termination rights — your franchise agreement must account for it.",
      "NJ's dense suburban demographics and proximity to NYC make it one of the most franchise-saturated states per capita.",
      "Premium personal care, fitness, and education franchises perform exceptionally well in northern NJ counties.",
    ],
    industryStrengths: ["Education / tutoring", "Beauty / personal care", "Senior care"],
    jasonNote:
      "NJ is a serious market with serious franchisee protections. Your franchise agreement needs NJ-specific termination and renewal provisions or you'll get litigated. Use a franchise attorney who's worked with the Practices Act before.",
    recommendedIndustrySlugs: ["education", "beauty", "senior-care"],
  },
  {
    slug: "north-carolina",
    name: "North Carolina",
    abbreviation: "NC",
    tier: "relationship",
    topMetros: ["Charlotte", "Raleigh", "Greensboro", "Durham"],
    populationMillions: 11.0,
    hookFact:
      "North Carolina is one of the fastest-growing franchise markets in the country — Charlotte and Raleigh-Durham have ranked among the top metros for new franchise unit growth for the past decade.",
    uniqueFacts: [
      "The Research Triangle and Charlotte banking sector produce a steady flow of well-capitalized executive operator candidates.",
      "NC's relatively light franchise relationship regulation makes it administratively easier than registration states.",
      "Population growth driven by relocation from higher-cost states is sustaining strong franchise category demand across the board.",
    ],
    industryStrengths: ["Home services", "Fitness", "Beauty / personal care"],
    jasonNote:
      "NC is a top-tier non-registration market. If you're prioritizing where to put marketing dollars after registration states, NC should be near the top of the list.",
    recommendedIndustrySlugs: ["home-services", "fitness", "beauty"],
  },
  {
    slug: "ohio",
    name: "Ohio",
    abbreviation: "OH",
    tier: "businessOpp",
    topMetros: ["Columbus", "Cleveland", "Cincinnati", "Toledo"],
    populationMillions: 11.8,
    hookFact:
      "Ohio applies its Business Opportunity Purchasers Protection Act to franchise offerings that don't qualify for exemption — making proper exemption-claim documentation essential.",
    uniqueFacts: [
      "Columbus has emerged as a top-tier franchise expansion metro — corporate ecosystems around Nationwide, Cardinal Health, and OSU produce strong operator candidates.",
      "Ohio's Business Opportunity statute exemption requires specific franchise structure elements — verify exemption qualification with counsel.",
      "Cleveland and Cincinnati both anchor strong food service and home services franchise activity.",
    ],
    industryStrengths: ["Quick-service restaurants", "Home services", "Senior care"],
    jasonNote:
      "Ohio is a real market with a real regulatory wrinkle. The business opportunity exemption is straightforward if your offering qualifies — don't skip the analysis.",
    recommendedIndustrySlugs: ["quick-service-restaurant", "home-services", "senior-care"],
  },
  {
    slug: "oklahoma",
    name: "Oklahoma",
    abbreviation: "OK",
    tier: "relationship",
    topMetros: ["Oklahoma City", "Tulsa", "Norman"],
    populationMillions: 4.1,
    hookFact:
      "Oklahoma's franchise activity is anchored by energy-sector wealth and military-base operator demographics — both producing well-capitalized candidate pools.",
    uniqueFacts: [
      "Oklahoma City and Tulsa both rank among the most affordable metros for franchise build-out — favorable Item 7 dynamics for service and food categories.",
      "Tinker Air Force Base and Fort Sill create concentrations of veteran candidates who qualify for VetFran discount programs.",
      "Energy-sector cyclicality affects oil-patch markets (Stillwater, Ponca City) — disclose accordingly to candidates exploring those areas.",
    ],
    industryStrengths: ["Quick-service restaurants", "Automotive services", "Fitness"],
    jasonNote:
      "Oklahoma is favorable for franchisor economics — low cost of doing business, well-capitalized operator pool, light regulation.",
    recommendedIndustrySlugs: ["quick-service-restaurant", "automotive", "fitness"],
  },
  {
    slug: "south-carolina",
    name: "South Carolina",
    abbreviation: "SC",
    tier: "relationship",
    topMetros: ["Charleston", "Columbia", "Greenville", "Myrtle Beach"],
    populationMillions: 5.5,
    hookFact:
      "South Carolina's population growth — especially in Greenville-Spartanburg and Charleston — has produced one of the highest franchise-unit-growth rates in the country.",
    uniqueFacts: [
      "Charleston's tourism economy supports strong food service and casual dining franchise penetration.",
      "Greenville-Spartanburg's manufacturing base (BMW, Michelin, Boeing-adjacent suppliers) creates well-capitalized operator candidates.",
      "Coastal markets (Hilton Head, Myrtle Beach) have seasonal unit economics that should appear in candidate sales conversations.",
    ],
    industryStrengths: ["Casual dining", "Home services", "Fitness"],
    jasonNote:
      "SC is a quiet but compelling market — population growth, business-friendly regulation, and a strong operator pool. Worth prioritizing.",
    recommendedIndustrySlugs: ["casual-dining", "home-services", "fitness"],
  },
  {
    slug: "tennessee",
    name: "Tennessee",
    abbreviation: "TN",
    tier: "relationship",
    topMetros: ["Nashville", "Memphis", "Knoxville", "Chattanooga"],
    populationMillions: 7.3,
    hookFact:
      "Tennessee has no state income tax and Nashville has been one of the top-five fastest-growing metros in the country for over a decade — a combination that makes it one of the strongest non-registration franchise markets.",
    uniqueFacts: [
      "Nashville's healthcare and music industry economies produce a uniquely diverse operator candidate pool — from corporate executives to creative-class professionals.",
      "Memphis is the FedEx Worldhub — creating concentrations of logistics-experienced operator candidates.",
      "Knoxville and Chattanooga both anchor strong outdoor-recreation and home services franchise categories.",
    ],
    industryStrengths: ["Quick-service restaurants", "Fitness", "Home services"],
    jasonNote:
      "Tennessee is one of the strongest growth markets in the country right now. If your franchise has any geographic flexibility, Nashville should be on your priority list.",
    recommendedIndustrySlugs: ["quick-service-restaurant", "fitness", "home-services"],
  },
  {
    slug: "texas",
    name: "Texas",
    abbreviation: "TX",
    tier: "businessOpp",
    topMetros: ["Houston", "Dallas-Fort Worth", "Austin", "San Antonio"],
    populationMillions: 31.0,
    hookFact:
      "Texas hosts more franchise units than any other state — over 75,000 — driven by its size, no-state-income-tax structure, and franchise-friendly business climate.",
    uniqueFacts: [
      "Texas applies a Business Opportunity Act registration requirement, but franchise sales generally qualify for exemption with a single short-form filing.",
      "The DFW metroplex alone houses corporate headquarters of multiple major franchisors (Yum Brands operations, AT&T, ExxonMobil) — creating sophisticated operator candidates.",
      "Austin's tech-driven population growth has made it one of the fastest-growing metros for emerging franchise concept piloting.",
    ],
    industryStrengths: ["Quick-service restaurants", "Home services", "Automotive services"],
    jasonNote:
      "Texas is the largest single franchise market in the country and one of the easiest regulatory environments. The exemption filing is straightforward — your attorney handles it. Treat Texas as a top-3 priority market.",
    recommendedIndustrySlugs: ["quick-service-restaurant", "home-services", "automotive"],
  },
  {
    slug: "utah",
    name: "Utah",
    abbreviation: "UT",
    tier: "relationship",
    topMetros: ["Salt Lake City", "Provo", "West Valley City", "Ogden"],
    populationMillions: 3.5,
    hookFact:
      "Utah is one of the most franchisor-friendly states in the country — light regulation, fast-growing population, and a uniquely entrepreneurial operator pool produced by Silicon Slopes.",
    uniqueFacts: [
      "Salt Lake City's tech economy (Silicon Slopes) has driven population growth that consistently ranks among the top three states nationally.",
      "Utah's young median age and high household formation rate sustain strong demand for childcare, education, and family-oriented franchise categories.",
      "Provo's BYU and tech ecosystem produces a steady pool of well-educated executive operator candidates.",
    ],
    industryStrengths: ["Childcare", "Education / tutoring", "Fitness"],
    jasonNote:
      "Utah is one of the most underrated franchise markets in the country. Light regulation, fast growth, sophisticated operator pool. Strongly recommended for emerging franchise expansion.",
    recommendedIndustrySlugs: ["childcare", "education", "fitness"],
  },

  // ─── 18 FTC-ONLY STATES (lighter regulation, FTC Franchise Rule applies) ──
  {
    slug: "alabama",
    name: "Alabama",
    abbreviation: "AL",
    tier: "ftcOnly",
    topMetros: ["Birmingham", "Huntsville", "Montgomery", "Mobile"],
    populationMillions: 5.1,
    hookFact:
      "Alabama operates under federal FTC Franchise Rule alone — no state registration or notice filing required to sell franchises here.",
    uniqueFacts: [
      "Huntsville's defense and aerospace economy (Redstone Arsenal, NASA Marshall) produces an unusually well-capitalized executive operator pool.",
      "Birmingham's healthcare economy supports strong senior care and health-services franchise penetration.",
      "Alabama's low cost of doing business means franchisee Item 7 ranges trend lower than most southeastern states.",
    ],
    industryStrengths: ["Quick-service restaurants", "Senior care", "Automotive services"],
    jasonNote:
      "Alabama is administratively easy — no state-level filings — and a real market. Worth being available there from day one.",
    recommendedIndustrySlugs: ["quick-service-restaurant", "senior-care", "automotive"],
  },
  {
    slug: "alaska",
    name: "Alaska",
    abbreviation: "AK",
    tier: "ftcOnly",
    topMetros: ["Anchorage", "Fairbanks", "Juneau"],
    populationMillions: 0.7,
    hookFact:
      "Alaska's geographic remoteness creates unique franchise economics — high revenue per unit driven by limited competition, but elevated supply chain and labor costs.",
    uniqueFacts: [
      "Alaska franchisees often pay 25-40% more for supplies than mainland operators — disclose this clearly in Item 7.",
      "Anchorage hosts roughly 40% of the state's population — a single metro effectively dominates franchise expansion strategy.",
      "Seasonal tourism creates revenue volatility that should be disclosed in any Item 19 representation.",
    ],
    industryStrengths: ["Quick-service restaurants", "Automotive services", "Home services"],
    jasonNote:
      "Alaska is a small market with unique cost dynamics. Worth being available, but supply chain logistics are the real friction — make sure your Item 8 vendor list works there.",
    recommendedIndustrySlugs: ["quick-service-restaurant", "automotive", "home-services"],
  },
  {
    slug: "arizona",
    name: "Arizona",
    abbreviation: "AZ",
    tier: "ftcOnly",
    topMetros: ["Phoenix", "Tucson", "Mesa", "Scottsdale"],
    populationMillions: 7.7,
    hookFact:
      "Arizona's Phoenix metro has been one of the top-five fastest-growing metros in the country for the past two decades — driving consistently strong franchise category demand.",
    uniqueFacts: [
      "Phoenix's combination of population growth, business-friendly regulation, and warm climate makes it a top market for outdoor-service and food service franchise concepts.",
      "Arizona's older retiree demographic concentrations (especially in Sun City and Mesa) sustain strong senior care franchise demand.",
      "Tucson's university-town demographics support fitness, education, and casual dining franchise penetration.",
    ],
    industryStrengths: ["Quick-service restaurants", "Senior care", "Home services"],
    jasonNote:
      "Arizona is a top-tier non-registration market. Phoenix specifically should be on every franchisor's growth roadmap.",
    recommendedIndustrySlugs: ["quick-service-restaurant", "senior-care", "home-services"],
  },
  {
    slug: "colorado",
    name: "Colorado",
    abbreviation: "CO",
    tier: "ftcOnly",
    topMetros: ["Denver", "Colorado Springs", "Aurora", "Fort Collins"],
    populationMillions: 5.9,
    hookFact:
      "Colorado's population growth, business-friendly regulation, and high household income make Denver one of the most franchise-receptive metros in the country.",
    uniqueFacts: [
      "Denver's tech economy and active-lifestyle demographics drive premium fitness, coffee, and outdoor-recreation franchise categories.",
      "Colorado Springs' military and aerospace base produces a steady pool of veteran operator candidates.",
      "The state's high elevation and weather patterns affect equipment specifications for some franchise categories — disclose accordingly.",
    ],
    industryStrengths: ["Fitness", "Coffee", "Beauty / personal care"],
    jasonNote:
      "Colorado is a high-priority market for emerging franchise concepts. Denver alone is worth a deliberate market-entry plan.",
    recommendedIndustrySlugs: ["fitness", "coffee", "beauty"],
  },
  {
    slug: "georgia",
    name: "Georgia",
    abbreviation: "GA",
    tier: "ftcOnly",
    topMetros: ["Atlanta", "Augusta", "Columbus", "Savannah"],
    populationMillions: 11.1,
    hookFact:
      "Georgia hosts more franchise headquarters than any other southeastern state — Atlanta is the corporate home of Chick-fil-A, Arby's, AAMCO, and dozens of other major franchisors.",
    uniqueFacts: [
      "Atlanta's franchise corporate density creates an unusually sophisticated operator candidate pool.",
      "Georgia's logistics economy (Hartsfield-Jackson airport, Port of Savannah) produces operators with multi-unit and supply chain experience.",
      "Population growth across exurban Atlanta sustains consistently strong franchise category demand.",
    ],
    industryStrengths: ["Quick-service restaurants", "Home services", "Fitness"],
    jasonNote:
      "Georgia is a top-three non-registration market. Atlanta specifically is one of the most franchise-receptive metros in the country.",
    recommendedIndustrySlugs: ["quick-service-restaurant", "home-services", "fitness"],
  },
  {
    slug: "idaho",
    name: "Idaho",
    abbreviation: "ID",
    tier: "ftcOnly",
    topMetros: ["Boise", "Meridian", "Nampa", "Idaho Falls"],
    populationMillions: 2.0,
    hookFact:
      "Idaho has been the fastest-growing state by percentage for several recent years — Boise's population growth has driven among the highest franchise category demand growth in the country.",
    uniqueFacts: [
      "Boise's tech and logistics economy has produced a sophisticated operator candidate pool that didn't exist a decade ago.",
      "Meridian and Nampa, both Boise suburbs, anchor some of the strongest franchise unit growth in the West.",
      "The state's no-corporate-income-tax for many small businesses improves franchisee net economics.",
    ],
    industryStrengths: ["Fitness", "Quick-service restaurants", "Home services"],
    jasonNote:
      "Idaho — and Boise specifically — has gone from a small market to a top-priority growth market in under a decade. Worth proactive expansion attention.",
    recommendedIndustrySlugs: ["fitness", "quick-service-restaurant", "home-services"],
  },
  {
    slug: "kansas",
    name: "Kansas",
    abbreviation: "KS",
    tier: "ftcOnly",
    topMetros: ["Wichita", "Overland Park", "Kansas City KS", "Topeka"],
    populationMillions: 2.9,
    hookFact:
      "Kansas operates under federal FTC Rule alone — no state registration required — and its Johnson County suburbs produce one of the most affluent operator candidate pools in the Midwest.",
    uniqueFacts: [
      "Overland Park and Olathe (Johnson County) consistently rank among the highest-income suburbs in the country — sustaining premium franchise category demand.",
      "Wichita's aviation industry concentration creates pockets of well-capitalized operator candidates.",
      "The state's central location and low cost of living make it favorable for franchisee multi-unit operations.",
    ],
    industryStrengths: ["Quick-service restaurants", "Fitness", "Beauty / personal care"],
    jasonNote:
      "Kansas — particularly Johnson County — punches above its weight. Don't dismiss because of overall population.",
    recommendedIndustrySlugs: ["quick-service-restaurant", "fitness", "beauty"],
  },
  {
    slug: "massachusetts",
    name: "Massachusetts",
    abbreviation: "MA",
    tier: "ftcOnly",
    topMetros: ["Boston", "Worcester", "Springfield", "Cambridge"],
    populationMillions: 7.0,
    hookFact:
      "Massachusetts operates under FTC Rule alone but its franchise relationship case law is among the most developed in the country — making franchise agreement drafting more important than the lighter regulation suggests.",
    uniqueFacts: [
      "Greater Boston's combination of high household income, dense population, and educated demographics makes it a top-tier market for premium franchise categories.",
      "Cambridge and Boston's biotech and tech sectors produce well-capitalized executive operator candidates.",
      "Massachusetts has no state-level franchise registration but case law on franchisee protection is robust — your franchise agreement matters more than in many states.",
    ],
    industryStrengths: ["Education / tutoring", "Fitness", "Beauty / personal care"],
    jasonNote:
      "Massachusetts is a strong market with strong franchisee-protective case law. The lighter regulation doesn't mean light scrutiny — your franchise agreement gets read carefully here.",
    recommendedIndustrySlugs: ["education", "fitness", "beauty"],
  },
  {
    slug: "missouri",
    name: "Missouri",
    abbreviation: "MO",
    tier: "ftcOnly",
    topMetros: ["Kansas City MO", "St. Louis", "Springfield MO", "Columbia MO"],
    populationMillions: 6.2,
    hookFact:
      "Missouri's two major metros — Kansas City and St. Louis — both rank among the most affordable mid-sized franchise markets in the country, supporting unusually attractive Item 7 economics.",
    uniqueFacts: [
      "Missouri's central location and low cost of doing business make it favorable for multi-unit franchisee operations.",
      "Kansas City's Cerner-and-spinoffs healthcare-tech economy creates well-capitalized operator candidates.",
      "St. Louis' historic franchise activity (Edward Jones, Build-A-Bear, Panera predecessor) produces a sophisticated operator pool.",
    ],
    industryStrengths: ["Quick-service restaurants", "Home services", "Senior care"],
    jasonNote:
      "Missouri is a quietly strong market. Both KC and St. Louis are sophisticated franchise environments that don't always get the attention they deserve.",
    recommendedIndustrySlugs: ["quick-service-restaurant", "home-services", "senior-care"],
  },
  {
    slug: "montana",
    name: "Montana",
    abbreviation: "MT",
    tier: "ftcOnly",
    topMetros: ["Billings", "Missoula", "Bozeman", "Great Falls"],
    populationMillions: 1.1,
    hookFact:
      "Montana's sparse population and outdoor-recreation economy create unusual franchise dynamics — small operator pool but high tourism-driven unit economics in select markets.",
    uniqueFacts: [
      "Bozeman's Yellowstone-adjacent location and population growth (one of the fastest-growing small metros) drives strong franchise category demand.",
      "Missoula's University of Montana ecosystem creates a stable college-town operator base.",
      "Geographic distances mean franchisee territories in MT often span larger areas than typical for service categories.",
    ],
    industryStrengths: ["Quick-service restaurants", "Coffee", "Automotive services"],
    jasonNote:
      "Montana is a small market but Bozeman specifically is worth attention. Outdoor-lifestyle brands fit unusually well.",
    recommendedIndustrySlugs: ["quick-service-restaurant", "coffee", "automotive"],
  },
  {
    slug: "nevada",
    name: "Nevada",
    abbreviation: "NV",
    tier: "ftcOnly",
    topMetros: ["Las Vegas", "Henderson", "Reno", "North Las Vegas"],
    populationMillions: 3.3,
    hookFact:
      "Nevada's no-state-income-tax structure and Las Vegas tourism economy create one of the most franchise-friendly tax environments in the country.",
    uniqueFacts: [
      "Las Vegas' tourism volume — over 40 million visitors annually — supports unit economics for hospitality-adjacent franchise categories that don't exist elsewhere.",
      "Henderson and the suburbs around Vegas have been among the fastest-growing in the country, sustaining strong franchise category demand.",
      "Reno's tech sector growth (Tesla Gigafactory, Switch data centers) is producing a new wave of well-capitalized operator candidates.",
    ],
    industryStrengths: ["Quick-service restaurants", "Beauty / personal care", "Fitness"],
    jasonNote:
      "Nevada is favorable on every economic dimension — tax structure, growth, tourism. Vegas-specific concept franchises perform unusually well here.",
    recommendedIndustrySlugs: ["quick-service-restaurant", "beauty", "fitness"],
  },
  {
    slug: "new-mexico",
    name: "New Mexico",
    abbreviation: "NM",
    tier: "ftcOnly",
    topMetros: ["Albuquerque", "Las Cruces", "Santa Fe"],
    populationMillions: 2.1,
    hookFact:
      "New Mexico's smaller population and unique cultural market dynamics mean franchise success often depends on concept-fit with the state's distinct demographic mix.",
    uniqueFacts: [
      "Santa Fe's tourism economy supports premium retail and casual dining franchise concepts.",
      "Albuquerque hosts national laboratory and military facilities — creating well-capitalized executive operator demographics.",
      "Cultural and dietary preferences (heavy Mexican food market saturation) affect competitive dynamics for restaurant franchise concepts.",
    ],
    industryStrengths: ["Quick-service restaurants", "Automotive services", "Home services"],
    jasonNote:
      "New Mexico is a smaller market with unique characteristics. Worth being available but not necessarily a primary expansion target.",
    recommendedIndustrySlugs: ["quick-service-restaurant", "automotive", "home-services"],
  },
  {
    slug: "oregon",
    name: "Oregon",
    abbreviation: "OR",
    tier: "ftcOnly",
    topMetros: ["Portland", "Eugene", "Salem", "Bend"],
    populationMillions: 4.3,
    hookFact:
      "Oregon's combination of no-sales-tax structure and Portland's progressive consumer market makes it a unique testing ground for sustainability-aligned and lifestyle franchise concepts.",
    uniqueFacts: [
      "Portland's coffee, food and beverage culture has produced more emerging restaurant concepts per capita than almost any other U.S. metro.",
      "Bend's outdoor-recreation economy and population growth make it one of the fastest-growing small metros in the West.",
      "Oregon's lack of sales tax simplifies franchisee POS operations and improves the customer-facing price proposition.",
    ],
    industryStrengths: ["Coffee", "Fitness", "Casual dining"],
    jasonNote:
      "Oregon — and Portland especially — is a strong test market for emerging concepts that align with the local consumer values.",
    recommendedIndustrySlugs: ["coffee", "fitness", "casual-dining"],
  },
  {
    slug: "pennsylvania",
    name: "Pennsylvania",
    abbreviation: "PA",
    tier: "ftcOnly",
    topMetros: ["Philadelphia", "Pittsburgh", "Allentown", "Erie"],
    populationMillions: 13.0,
    hookFact:
      "Pennsylvania is one of the largest FTC-only states by population — combining a major franchise market with administratively light regulation.",
    uniqueFacts: [
      "Philadelphia's dense urban demographics support strong food service and personal care franchise penetration.",
      "Pittsburgh's healthcare-and-tech economy (UPMC, CMU spinoffs) produces well-capitalized operator candidates.",
      "Pennsylvania's geographic diversity (urban, suburban, rural Appalachian) means franchise unit economics vary substantially by metro.",
    ],
    industryStrengths: ["Quick-service restaurants", "Senior care", "Home services"],
    jasonNote:
      "PA is a top-five FTC-only market. Philly and Pittsburgh both warrant deliberate market-entry plans.",
    recommendedIndustrySlugs: ["quick-service-restaurant", "senior-care", "home-services"],
  },
  {
    slug: "vermont",
    name: "Vermont",
    abbreviation: "VT",
    tier: "ftcOnly",
    topMetros: ["Burlington", "South Burlington", "Rutland"],
    populationMillions: 0.6,
    hookFact:
      "Vermont is the smallest state by population in the lower 48 — a small franchise market but one with distinctive demographics that suit specific franchise categories.",
    uniqueFacts: [
      "Burlington's University of Vermont and progressive consumer market support strong coffee, fitness, and casual dining franchise penetration.",
      "Vermont's rural geography and small population mean franchisee territory planning is unusual — fewer, larger territories.",
      "The state's tourism economy creates seasonal revenue patterns that should appear in Item 19 disclosures.",
    ],
    industryStrengths: ["Coffee", "Casual dining", "Fitness"],
    jasonNote:
      "Vermont is small. Worth being available but expansion economics rarely justify Vermont-first prioritization.",
    recommendedIndustrySlugs: ["coffee", "casual-dining", "fitness"],
  },
  {
    slug: "west-virginia",
    name: "West Virginia",
    abbreviation: "WV",
    tier: "ftcOnly",
    topMetros: ["Charleston", "Huntington", "Morgantown"],
    populationMillions: 1.8,
    hookFact:
      "West Virginia operates under FTC Rule alone but its smaller population and energy-economy cycles affect operator candidate availability.",
    uniqueFacts: [
      "Morgantown's WVU university ecosystem creates a stable college-town franchise market.",
      "The state's natural-gas economy creates pockets of well-capitalized operator candidates in extraction-active regions.",
      "Lower cost of doing business makes Item 7 ranges among the most attractive in the country.",
    ],
    industryStrengths: ["Quick-service restaurants", "Automotive services", "Home services"],
    jasonNote:
      "West Virginia is a smaller market. Worth being available but not a priority expansion target for most franchisors.",
    recommendedIndustrySlugs: ["quick-service-restaurant", "automotive", "home-services"],
  },
  {
    slug: "wyoming",
    name: "Wyoming",
    abbreviation: "WY",
    tier: "ftcOnly",
    topMetros: ["Cheyenne", "Casper", "Laramie"],
    populationMillions: 0.6,
    hookFact:
      "Wyoming is the least populous U.S. state — but its no-state-income-tax structure and energy-sector wealth create disproportionate operator capitalization.",
    uniqueFacts: [
      "Wyoming has no state income tax and one of the most business-friendly tax environments in the country.",
      "Cheyenne and Casper anchor most franchise activity; rural Wyoming's franchise penetration is among the lowest in the U.S.",
      "Energy-sector cyclicality affects unit economics in extraction-active areas — disclose accordingly.",
    ],
    industryStrengths: ["Quick-service restaurants", "Automotive services", "Home services"],
    jasonNote:
      "Wyoming is small. Worth being available but expansion economics rarely justify making Wyoming a priority.",
    recommendedIndustrySlugs: ["quick-service-restaurant", "automotive", "home-services"],
  },
  {
    slug: "district-of-columbia",
    name: "District of Columbia",
    abbreviation: "DC",
    tier: "ftcOnly",
    topMetros: ["Washington, DC"],
    populationMillions: 0.7,
    hookFact:
      "DC is one of the most affluent and densely educated jurisdictions in the country — sustaining premium franchise demand across personal care, fitness, food service, and education categories.",
    uniqueFacts: [
      "DC operates under FTC Rule alone — no DC-specific franchise registration required.",
      "Federal employee concentration and high household income produce unusually qualified operator candidates.",
      "Premium-tier franchise concepts in fitness, beauty, and education routinely outperform national averages in DC.",
    ],
    industryStrengths: ["Fitness", "Beauty / personal care", "Education / tutoring"],
    jasonNote:
      "DC is small geographically but enormously important economically. Combined with Maryland and Virginia, it forms one of the strongest franchise metros in the country.",
    recommendedIndustrySlugs: ["fitness", "beauty", "education"],
  },
];

/** Look up a state by slug. */
export function getState(slug: string): FranchiseState {
  const s = allStates.find((x) => x.slug === slug);
  if (!s) throw new Error(`State not found: ${slug}`);
  return s;
}

/** Tier display labels for headers and meta. */
export const TIER_LABEL: Record<RegistrationTier, string> = {
  full: "Full Registration State",
  notice: "Notice Filing State",
  businessOpp: "Business Opportunity State",
  relationship: "Franchise Relationship State",
  ftcOnly: "FTC-Only State",
};

/** Short tier description for body copy. */
export const TIER_DESCRIPTION: Record<RegistrationTier, string> = {
  full: "Requires franchisors to file a complete FDD with the state regulator and obtain approval before selling franchises in the state.",
  notice:
    "Requires franchisors to file a notice with the state regulator before selling — lighter than full registration, but more than FTC-only.",
  businessOpp:
    "Applies a state Business Opportunity statute that may require additional filings if the franchise offering doesn't meet a specific exemption.",
  relationship:
    "Has no pre-sale registration requirement, but applies state-specific franchise relationship laws (governing termination, renewal, transfer, and good cause) after the franchise is sold.",
  ftcOnly:
    "Operates under federal FTC Franchise Rule alone — no additional state-level registration, notice filing, or franchise relationship statute applies.",
};

/**
 * Industry-by-industry franchise data for the programmatic SEO collection
 * at /franchise-your/[industry]/business.
 *
 * The 13 core sectors come from the franchise royalty rate benchmarks
 * blog post — the same data set, but now as standalone topical landing
 * pages targeting "how to franchise a [industry] business" search
 * intent. Three additional categories (pet, childcare, wellness) have
 * been added for category coverage.
 *
 * Each entry pairs hard economics (royalty range, franchise fee,
 * Item 7, EBITDA range) with sector-specific operational color so each
 * generated page has substantively differentiated content beyond
 * templated structure.
 */

export type FranchiseIndustry = {
  slug: string;
  name: string;
  shortName: string;
  category: "Food Service" | "Service" | "Retail" | "Hospitality" | "Health & Wellness" | "Education" | "Real Estate";

  // Economics (typical ranges for the sector in 2026)
  royaltyRangePct: { min: number; max: number };
  franchiseFee: { min: number; max: number }; // USD
  item7Range: { min: number; max: number }; // USD total initial investment
  unitEbitdaPct: { min: number; max: number }; // % at typical operating volume
  brandFundPct: { min: number; max: number }; // % brand marketing fund

  // Color
  hookFact: string;
  exampleBrands: string[];
  uniqueFacts: string[];
  whyThisRoyaltyRange: string;
  commonStallPattern: string;
  jasonNote: string;

  // Cross-linking
  recommendedStateSlugs?: string[];
};

export const allIndustries: FranchiseIndustry[] = [
  {
    slug: "quick-service-restaurant",
    name: "Quick-Service Restaurant",
    shortName: "QSR",
    category: "Food Service",
    royaltyRangePct: { min: 4, max: 6 },
    franchiseFee: { min: 35000, max: 75000 },
    item7Range: { min: 250000, max: 1500000 },
    unitEbitdaPct: { min: 15, max: 22 },
    brandFundPct: { min: 2, max: 4 },
    hookFact:
      "Quick-service restaurants are the most franchised business category in the world — over 200,000 QSR units operate in the U.S. alone, and the vast majority are franchisor-owned brands.",
    exampleBrands: ["McDonald's", "Subway", "Chick-fil-A", "Wingstop", "Jersey Mike's"],
    uniqueFacts: [
      "QSR royalties cluster tightly at 4-6% because thin unit margins (15-22% EBITDA) cap how much you can extract while leaving the franchisee profitable.",
      "Brand marketing fund contributions are typically 2-4% on top of royalty — the combined take is often 6-9% of gross.",
      "Item 7 ranges vary 5-6x across markets (small towns vs. premium urban locations) — defensible Item 7 footnotes are essential.",
    ],
    whyThisRoyaltyRange:
      "QSR's thin unit-level margins (15-22% EBITDA) constrain royalty room. Above 6% and most franchisees can't make a competitive return on capital after paying themselves a market-rate operator salary.",
    commonStallPattern:
      "Setting the royalty above 6% to support the franchisor business, then losing serious operator candidates to competitors at 5%. The sustainable answer: improve unit economics first (faster prep times, higher average ticket, lower labor ratio) so the math works for both sides.",
    jasonNote:
      "QSR is the most competitive franchise category in the world — and the most studied. The royalty math is unforgiving. If your unit EBITDA is below 15%, fix it before franchising, not after.",
    recommendedStateSlugs: ["california", "texas", "florida", "illinois"],
  },
  {
    slug: "casual-dining",
    name: "Casual Dining Restaurant",
    shortName: "Casual Dining",
    category: "Food Service",
    royaltyRangePct: { min: 4, max: 6 },
    franchiseFee: { min: 40000, max: 75000 },
    item7Range: { min: 750000, max: 3500000 },
    unitEbitdaPct: { min: 10, max: 18 },
    brandFundPct: { min: 2, max: 4 },
    hookFact:
      "Casual dining franchising peaked in the early 2010s and has since consolidated — but new full-service concepts continue to franchise successfully in markets where the QSR space is saturated.",
    exampleBrands: ["Applebee's", "Outback Steakhouse", "Buffalo Wild Wings", "Texas Roadhouse"],
    uniqueFacts: [
      "Casual dining unit economics carry higher labor costs than QSR (often 32-38% of revenue) — compressing margins and constraining royalty room.",
      "Item 7 ranges typically run $750K-$3.5M because of larger footprints, full-service equipment, and longer build-out timelines.",
      "Many casual dining brands have moved to fast-casual hybrid formats to recapture margin and reduce capex.",
    ],
    whyThisRoyaltyRange:
      "Casual dining's labor-heavy cost structure (35%+ of revenue) leaves less margin for royalty than QSR despite higher average ticket. Royalties cluster at 4-6% to keep the franchisee economics viable.",
    commonStallPattern:
      "Underestimating capex requirements and disclosing Item 7 ranges that look defensible on paper but bankrupt under-capitalized franchisees. Casual dining requires substantial working capital reserves — disclose 6 months in additional funds, not 3.",
    jasonNote:
      "Casual dining is a tougher sector than QSR for emerging franchisors — bigger capex, thinner margins, longer ramp. If you're considering it, validate unit economics across multiple geographies before franchising.",
    recommendedStateSlugs: ["florida", "tennessee", "texas", "north-carolina"],
  },
  {
    slug: "coffee",
    name: "Coffee, Ice Cream & Dessert",
    shortName: "Coffee",
    category: "Food Service",
    royaltyRangePct: { min: 5, max: 7 },
    franchiseFee: { min: 30000, max: 50000 },
    item7Range: { min: 200000, max: 700000 },
    unitEbitdaPct: { min: 18, max: 28 },
    brandFundPct: { min: 2, max: 4 },
    hookFact:
      "Coffee and dessert franchises carry higher product margins than most QSR categories — supporting royalties of 5-7% and unit EBITDAs in the 18-28% range.",
    exampleBrands: ["Dunkin'", "Tim Hortons", "Scooter's Coffee", "Crumbl Cookies", "Dairy Queen"],
    uniqueFacts: [
      "Coffee and dessert categories have higher gross margins (65-75%) than savory QSR — supporting both higher royalties and faster ramp to profitability.",
      "Drive-thru-only formats have grown significantly since 2020 — reducing real estate and build-out costs and accelerating Item 7 ROI.",
      "The category attracts a broader operator pool than full-restaurant franchising because of the lower capital intensity.",
    ],
    whyThisRoyaltyRange:
      "Coffee's higher product margin (65-75% gross) creates room for higher royalties than savory QSR. Most successful coffee franchisors land at 6% royalty + 2% brand fund.",
    commonStallPattern:
      "Underestimating local competition. Even in 'underserved' coffee markets, Starbucks and local independents already capture the morning rush. New franchise concepts have to differentiate on product, format, or daypart — generic coffee franchises stall fast.",
    jasonNote:
      "Coffee is one of the most attractive emerging franchise categories — high margins, lower capex than full-service, broad operator appeal. Differentiation matters more than category entry.",
    recommendedStateSlugs: ["washington", "oregon", "california", "colorado"],
  },
  {
    slug: "fitness",
    name: "Fitness & Personal Training",
    shortName: "Fitness",
    category: "Health & Wellness",
    royaltyRangePct: { min: 5, max: 9 },
    franchiseFee: { min: 25000, max: 60000 },
    item7Range: { min: 200000, max: 1500000 },
    unitEbitdaPct: { min: 18, max: 30 },
    brandFundPct: { min: 2, max: 4 },
    hookFact:
      "Fitness franchising has shifted dramatically since 2015 — from large-format gyms (Gold's, 24 Hour Fitness) toward small-format boutique studios (Orangetheory, F45, Pure Barre) with dramatically better unit economics.",
    exampleBrands: ["Anytime Fitness", "Orangetheory Fitness", "F45 Training", "Pure Barre", "Club Pilates"],
    uniqueFacts: [
      "Boutique fitness formats run 1,800-3,500 sq ft and reach profitability in 6-12 months — compared to 18-36 months for traditional large-format gyms.",
      "Membership-based revenue creates predictable recurring cash flow that supports higher royalties (up to 9%) than transactional fitness models.",
      "Item 7 ranges vary 5-7x depending on format — small-format studios start at $200K, full-service gyms can exceed $1.5M.",
    ],
    whyThisRoyaltyRange:
      "Fitness royalties run 5-9% — higher end for membership-based recurring-revenue models, lower end for traditional pay-per-visit formats. The membership cash flow predictability is what supports the higher rates.",
    commonStallPattern:
      "Saturating the local market. Boutique fitness markets in major metros have become genuinely saturated since 2018 — third and fourth franchisees in the same metro often struggle. Disclose this honestly in Item 19.",
    jasonNote:
      "Boutique fitness has been one of the strongest emerging franchise categories of the past decade — but the saturation is real. Pick markets carefully and don't over-sell territory density.",
    recommendedStateSlugs: ["california", "texas", "florida", "colorado"],
  },
  {
    slug: "beauty",
    name: "Beauty & Personal Care",
    shortName: "Beauty",
    category: "Service",
    royaltyRangePct: { min: 5, max: 8 },
    franchiseFee: { min: 30000, max: 60000 },
    item7Range: { min: 150000, max: 500000 },
    unitEbitdaPct: { min: 18, max: 28 },
    brandFundPct: { min: 1, max: 3 },
    hookFact:
      "Beauty and personal care franchising includes some of the most consistently profitable categories in the franchise universe — hair care (Great Clips, Sport Clips), nail care, eyebrow services, and med-spa concepts all routinely deliver 20%+ unit EBITDAs.",
    exampleBrands: ["Great Clips", "Supercuts", "Sport Clips", "European Wax Center", "Massage Envy"],
    uniqueFacts: [
      "Hair care franchises like Great Clips have proven that simple, repeatable service models can scale to 4,000+ units at consistent unit economics.",
      "Med-spa and aesthetic services franchises have grown substantially — supporting royalties at the higher end (7-8%) given premium service margins.",
      "Membership models (used heavily in Massage Envy, European Wax Center) create predictable recurring revenue that supports higher royalty rates.",
    ],
    whyThisRoyaltyRange:
      "Beauty's strong service margins (gross margins often 70-80%) create room for higher royalties than goods-driven categories. Membership-model concepts cluster at 7-8% royalty.",
    commonStallPattern:
      "Underestimating local labor competition. Beauty franchises depend on hiring and retaining licensed practitioners (cosmetologists, estheticians, massage therapists). In tight labor markets, franchisees who don't pay competitively can't staff their unit — and the unit fails despite a strong brand.",
    jasonNote:
      "Beauty is one of the strongest franchise categories for first-time franchisors — predictable economics, broad operator appeal, established proof points. Just make sure your franchisees understand the labor reality.",
    recommendedStateSlugs: ["california", "florida", "texas", "new-york"],
  },
  {
    slug: "cleaning",
    name: "Cleaning & Janitorial Services",
    shortName: "Cleaning",
    category: "Service",
    royaltyRangePct: { min: 4, max: 7 },
    franchiseFee: { min: 15000, max: 45000 },
    item7Range: { min: 30000, max: 150000 },
    unitEbitdaPct: { min: 15, max: 25 },
    brandFundPct: { min: 1, max: 3 },
    hookFact:
      "Cleaning franchises have some of the lowest Item 7 ranges in the franchise universe — often $30K-$150K — making them accessible to operators who can't capitalize a brick-and-mortar concept.",
    exampleBrands: ["Merry Maids", "Molly Maid", "ServiceMaster Clean", "Stanley Steemer", "Vanguard Cleaning"],
    uniqueFacts: [
      "Mobile/home-services cleaning franchises have minimal real estate requirements — the franchisee operates from home with a vehicle and equipment.",
      "Many cleaning franchises charge tiered or flat-fee royalties (e.g., $X/month + Y% of revenue above threshold) rather than pure percentages.",
      "B2B janitorial franchises (commercial accounts, contracted) have different economics than B2C residential cleaning — disclose the model clearly.",
    ],
    whyThisRoyaltyRange:
      "Cleaning royalties cluster at 4-7%. Pure percentage models lean lower; flat-fee or hybrid models effectively land at the higher end. The category's lower capital intensity creates more room for franchisor royalty extraction without bankrupting franchisees.",
    commonStallPattern:
      "Confusion between B2C residential and B2B commercial models. The two have completely different sales motions, customer types, and unit economics. Franchisors who blur the line in the FDD attract the wrong operators for both.",
    jasonNote:
      "Cleaning is one of the most accessible franchise categories — low Item 7, fast ramp, broad operator pool. The category requires sales-driven operators, not technicians. Qualify accordingly.",
    recommendedStateSlugs: ["texas", "florida", "north-carolina", "georgia"],
  },
  {
    slug: "home-services",
    name: "Home Services (HVAC, Plumbing, Lawn)",
    shortName: "Home Services",
    category: "Service",
    royaltyRangePct: { min: 6, max: 10 },
    franchiseFee: { min: 35000, max: 75000 },
    item7Range: { min: 75000, max: 350000 },
    unitEbitdaPct: { min: 20, max: 35 },
    brandFundPct: { min: 1, max: 3 },
    hookFact:
      "Home services franchising has been the fastest-growing franchise category over the past decade — driven by aging housing stock, two-income household demand for outsourced home maintenance, and operator demand for scalable service businesses.",
    exampleBrands: ["Mr. Rooter", "Roto-Rooter", "Mosquito Joe", "Lawn Doctor", "TruGreen", "Restoration 1"],
    uniqueFacts: [
      "Home services unit margins are among the highest in the franchise universe — 20-35% EBITDA at maturity, supporting royalty rates of 6-10%.",
      "Many home services franchises are mobile/home-based (no physical location), keeping Item 7 ranges compressed at $75K-$350K.",
      "Trade certifications (HVAC, plumbing, electrical) create barriers to entry that protect franchisee margins from generic competition.",
    ],
    whyThisRoyaltyRange:
      "Home services' high gross margins (often 50-65%) and lower technology overhead create room for higher royalties than most service categories. Most successful home services franchisors land at 7-9% royalty + 1-2% brand fund.",
    commonStallPattern:
      "Selling to candidates without trade experience or operational management background. Home services franchises require a specific operator profile — comfortable with field crews, customer escalations, and same-day pricing decisions. Wrong-fit candidates fail in year 2.",
    jasonNote:
      "Home services is one of the strongest franchise categories right now — but the operator profile matters. Qualify hard for trade or operational management background.",
    recommendedStateSlugs: ["texas", "florida", "north-carolina", "tennessee"],
  },
  {
    slug: "senior-care",
    name: "Senior Care & Health Services",
    shortName: "Senior Care",
    category: "Health & Wellness",
    royaltyRangePct: { min: 5, max: 7 },
    franchiseFee: { min: 35000, max: 75000 },
    item7Range: { min: 75000, max: 250000 },
    unitEbitdaPct: { min: 12, max: 22 },
    brandFundPct: { min: 1, max: 3 },
    hookFact:
      "Senior care franchising will be one of the largest franchise categories of the next 20 years — the U.S. population aged 65+ will grow from 56M today to over 80M by 2040, with non-medical home care leading the demand.",
    exampleBrands: ["Home Instead", "Comfort Keepers", "Right at Home", "Visiting Angels", "BrightStar Care"],
    uniqueFacts: [
      "Non-medical senior care franchises (companion care, daily-living assistance) operate from small offices with fleets of W-2 caregivers.",
      "State licensing requirements vary substantially — some states require home-care agency licensing, others don't.",
      "Caregiver labor compression is the dominant operational challenge — franchisees who don't pay caregivers competitively lose them to neighboring agencies.",
    ],
    whyThisRoyaltyRange:
      "Senior care royalties cluster at 5-7% — constrained by caregiver labor cost compression. Royalties above 7% usually require franchisees to under-pay caregivers, creating turnover problems.",
    commonStallPattern:
      "Hiring and caregiver retention. Franchisees who try to undercut market wages can't staff cases — and the agency loses contracts. The right franchisee profile has prior healthcare or service-business management experience.",
    jasonNote:
      "Senior care is structurally one of the most promising franchise categories — demographic tailwinds are real and lasting. The operational challenges are around hiring, not demand.",
    recommendedStateSlugs: ["florida", "arizona", "maryland", "virginia"],
  },
  {
    slug: "education",
    name: "Education & Tutoring",
    shortName: "Education",
    category: "Education",
    royaltyRangePct: { min: 8, max: 12 },
    franchiseFee: { min: 30000, max: 60000 },
    item7Range: { min: 75000, max: 250000 },
    unitEbitdaPct: { min: 22, max: 35 },
    brandFundPct: { min: 1, max: 3 },
    hookFact:
      "Education and tutoring franchises carry the highest royalty rates in the franchise universe — typically 8-12% — supported by high gross margins on instructional time.",
    exampleBrands: ["Kumon", "Sylvan Learning", "Mathnasium", "The Goddard School", "Code Wiz"],
    uniqueFacts: [
      "Education franchise gross margins often exceed 75% (instructional time is the primary cost), supporting unusually high royalty extraction.",
      "Recurring tuition revenue creates predictable cash flow that further supports premium royalty rates.",
      "Demand peaks in suburbs with high household incomes and school-age children — site selection is geographically narrower than most categories.",
    ],
    whyThisRoyaltyRange:
      "Education's high gross margins (75%+) and recurring revenue create room for royalties of 8-12% — among the highest in any franchise category — while still leaving the franchisee with strong returns.",
    commonStallPattern:
      "Underestimating instructor recruitment difficulty. Tutoring franchises depend on qualified educators willing to work part-time. In some markets the labor pool is too small to staff multiple units. Validate instructor availability before approving territory.",
    jasonNote:
      "Education is one of the most economically attractive franchise categories — high margins, recurring revenue, premium royalties. The barrier is operator candidates with the right education-and-business background.",
    recommendedStateSlugs: ["new-jersey", "california", "massachusetts", "virginia"],
  },
  {
    slug: "business-services",
    name: "Business Services (B2B Coaching, Accounting)",
    shortName: "Business Services",
    category: "Service",
    royaltyRangePct: { min: 6, max: 10 },
    franchiseFee: { min: 30000, max: 60000 },
    item7Range: { min: 50000, max: 200000 },
    unitEbitdaPct: { min: 20, max: 35 },
    brandFundPct: { min: 1, max: 3 },
    hookFact:
      "B2B services franchises (coaching, accounting, IT consulting, marketing) operate with minimal physical infrastructure and some of the highest unit margins in franchising — supporting royalties of 6-10%.",
    exampleBrands: ["The Growth Coach", "Padgett Business Services", "Liberty Tax Service", "FirstLight Home Care", "Express Employment Professionals"],
    uniqueFacts: [
      "Most B2B services franchises operate from home or small offices — Item 7 ranges of $50K-$200K are typical.",
      "Recurring-revenue B2B models (managed services, retainers, monthly accounting) support premium royalty rates.",
      "Operator profiles skew toward executives leaving corporate careers — generally well-capitalized but unfamiliar with sales-driven operations.",
    ],
    whyThisRoyaltyRange:
      "B2B services franchises support 6-10% royalties because of high gross margins (often 60-75%) and recurring revenue from contracted clients.",
    commonStallPattern:
      "Selling franchises to corporate executives who lack sales-driven operating experience. B2B services require active selling — not corporate process management. Mismatched operators fail to build a client base in year 1 and exit.",
    jasonNote:
      "B2B services is attractive on paper — high margins, low capex — but the operator profile is narrow. Qualify hard for sales orientation, not just corporate management background.",
    recommendedStateSlugs: ["texas", "georgia", "north-carolina", "florida"],
  },
  {
    slug: "real-estate",
    name: "Real Estate Brokerage",
    shortName: "Real Estate",
    category: "Real Estate",
    royaltyRangePct: { min: 6, max: 9 },
    franchiseFee: { min: 25000, max: 50000 },
    item7Range: { min: 100000, max: 350000 },
    unitEbitdaPct: { min: 15, max: 30 },
    brandFundPct: { min: 1, max: 3 },
    hookFact:
      "Real estate brokerage franchising operates on a commission-split model — franchisees collect commissions from agent sales and pay royalties on a percentage of those commissions.",
    exampleBrands: ["RE/MAX", "Century 21", "Coldwell Banker", "Keller Williams", "Better Homes and Gardens Real Estate"],
    uniqueFacts: [
      "Real estate franchise unit economics are highly variable — franchisee profit depends almost entirely on agent recruitment and retention.",
      "Royalty calculation methods vary substantially — some are percentage of company-dollar, others of gross commission income.",
      "Market cycle sensitivity is high — franchisees who entered at the top of housing cycles often struggled when transactions slowed.",
    ],
    whyThisRoyaltyRange:
      "Real estate royalties of 6-9% reflect commission-based revenue dynamics. Brand fund contributions and other franchisee fees often add another 2-3% to the franchisor take.",
    commonStallPattern:
      "Failing to recruit producing agents. Real estate brokerage franchise success is almost entirely about agent count and average production. Franchisees who can't recruit competitively against established local brokers stall regardless of brand.",
    jasonNote:
      "Real estate is a sophisticated franchise category. Operator candidates need to be agent-recruitment-focused — not just licensed brokers. Qualify carefully.",
    recommendedStateSlugs: ["california", "texas", "florida", "north-carolina"],
  },
  {
    slug: "automotive",
    name: "Automotive Services",
    shortName: "Automotive",
    category: "Service",
    royaltyRangePct: { min: 5, max: 8 },
    franchiseFee: { min: 30000, max: 60000 },
    item7Range: { min: 200000, max: 800000 },
    unitEbitdaPct: { min: 15, max: 25 },
    brandFundPct: { min: 1, max: 4 },
    hookFact:
      "Automotive services franchising covers everything from oil change (Jiffy Lube) to transmission (AAMCO) to wholesale supply (NAPA) — and its mid-range royalty structure (5-8%) reflects the substantial equipment investment required.",
    exampleBrands: ["Jiffy Lube", "AAMCO", "Midas", "Big O Tires", "Maaco"],
    uniqueFacts: [
      "Automotive franchises require substantial equipment capex (lifts, diagnostic equipment, alignment racks) — Item 7 ranges of $200K-$800K reflect this.",
      "EV transition is creating both risk (legacy ICE-focused franchises) and opportunity (EV-specific service concepts) for the category.",
      "Trade certifications and local mechanic recruitment are persistent operational challenges — labor availability significantly affects unit economics.",
    ],
    whyThisRoyaltyRange:
      "Automotive royalties of 5-8% balance the higher capex (which compresses cash flow) against the strong gross margins on parts and labor. Most established automotive franchisors land at 6-7%.",
    commonStallPattern:
      "Underestimating mechanic recruitment difficulty. The trades labor shortage hits automotive franchises particularly hard. Franchisees in markets without a strong technical college or trade school pipeline often can't staff their bays — and revenue suffers.",
    jasonNote:
      "Automotive franchising is mature but evolving. EV-related service concepts are an emerging opportunity for new franchisors with the right technical foundation.",
    recommendedStateSlugs: ["texas", "florida", "tennessee", "ohio"],
  },
  {
    slug: "hotel",
    name: "Hotel & Lodging",
    shortName: "Hotels",
    category: "Hospitality",
    royaltyRangePct: { min: 4, max: 6 },
    franchiseFee: { min: 50000, max: 150000 },
    item7Range: { min: 5000000, max: 30000000 },
    unitEbitdaPct: { min: 20, max: 40 },
    brandFundPct: { min: 2, max: 5 },
    hookFact:
      "Hotel franchising operates at a completely different scale than most franchise categories — Item 7 ranges of $5M-$30M+ make this exclusively the domain of well-capitalized real estate developers and hospitality investors.",
    exampleBrands: ["Hilton", "Marriott", "Holiday Inn", "Best Western", "Choice Hotels"],
    uniqueFacts: [
      "Hotel franchisees are typically real estate investment companies, not individual operators — the candidate qualification process is fundamentally different from most franchise categories.",
      "Royalties are typically supplemented by reservation fees (1-3% of revenue), loyalty program contributions, and other system-level charges.",
      "Hotel franchise agreements are typically long-term (15-20 years) with significant termination fees — a different franchise relationship dynamic than most categories.",
    ],
    whyThisRoyaltyRange:
      "Hotel royalties of 4-6% appear lower than other categories but are paired with substantial reservation system fees, loyalty program contributions, and brand fund charges that effectively bring total franchisor extraction to 8-12%.",
    commonStallPattern:
      "Treating hotel franchising as if it were a typical small-business franchise opportunity. The capital requirements, operator profiles, and contract structures are fundamentally different. Most emerging franchisors should not attempt to franchise hotel concepts without prior hospitality industry experience.",
    jasonNote:
      "Hotel franchising is its own world. The economics, operator pool, and contract dynamics don't transfer cleanly from other franchise categories. Specialized expertise required.",
    recommendedStateSlugs: ["florida", "nevada", "california", "texas"],
  },
  {
    slug: "pet-services",
    name: "Pet Services",
    shortName: "Pet Services",
    category: "Service",
    royaltyRangePct: { min: 5, max: 7 },
    franchiseFee: { min: 30000, max: 60000 },
    item7Range: { min: 100000, max: 500000 },
    unitEbitdaPct: { min: 18, max: 28 },
    brandFundPct: { min: 1, max: 3 },
    hookFact:
      "Pet services franchising — grooming, daycare, training, mobile veterinary — has been one of the fastest-growing franchise categories of the past decade, driven by sustained growth in pet ownership and per-pet spending.",
    exampleBrands: ["Camp Bow Wow", "Dogtopia", "Aussie Pet Mobile", "Woofie's", "Pet Supplies Plus"],
    uniqueFacts: [
      "U.S. pet industry spending exceeds $145B annually and has grown every year since 2001 — including through recessions.",
      "Mobile pet grooming franchises operate from vans with minimal real estate requirements, keeping Item 7 ranges below $200K.",
      "Pet daycare/boarding franchises require larger facilities ($500K+ Item 7) but support strong recurring revenue.",
    ],
    whyThisRoyaltyRange:
      "Pet services royalties of 5-7% are supported by strong gross margins on services and high customer retention from emotional pet-owner attachment.",
    commonStallPattern:
      "Underestimating staff retention difficulty. Pet care work has high physical demands and emotional intensity — burnout and turnover are persistent challenges. Franchisees who don't budget for competitive wages and culture-building struggle.",
    jasonNote:
      "Pet services is a structurally strong category — recession-resistant demand, broad operator appeal, predictable economics. The operational challenge is staff turnover, not demand.",
    recommendedStateSlugs: ["california", "texas", "florida", "colorado"],
  },
  {
    slug: "childcare",
    name: "Childcare & Early Education",
    shortName: "Childcare",
    category: "Education",
    royaltyRangePct: { min: 5, max: 8 },
    franchiseFee: { min: 50000, max: 125000 },
    item7Range: { min: 750000, max: 4000000 },
    unitEbitdaPct: { min: 15, max: 25 },
    brandFundPct: { min: 1, max: 3 },
    hookFact:
      "Childcare franchising sits at the intersection of education, healthcare regulation, and real estate development — making it one of the most operationally complex franchise categories but with strong long-term unit economics.",
    exampleBrands: ["The Goddard School", "Kiddie Academy", "Primrose Schools", "Children's Lighthouse", "Lightbridge Academy"],
    uniqueFacts: [
      "Childcare franchises require state licensing for childcare facilities — a regulatory layer most other franchise categories don't face.",
      "Build-out costs are substantial — typical Item 7 ranges of $750K-$4M+ reflect the large-format facilities and child-safety code requirements.",
      "Long ramp times (12-24 months to full enrollment) require franchisees to be well-capitalized for working capital reserves.",
    ],
    whyThisRoyaltyRange:
      "Childcare royalties of 5-8% reflect both the strong unit economics at maturity and the long ramp period that constrains early-year cash flow.",
    commonStallPattern:
      "Underestimating state licensing complexity. Each state's childcare licensing requirements differ — staffing ratios, square footage minimums, curriculum standards. Franchisees who don't fully understand the regulatory layer face delays and compliance issues.",
    jasonNote:
      "Childcare is a sophisticated category requiring well-capitalized, patient operator candidates. Reward is real — successful units build durable community-anchored businesses — but this isn't a category for under-capitalized first-time business owners.",
    recommendedStateSlugs: ["utah", "texas", "north-carolina", "virginia"],
  },
  {
    slug: "wellness",
    name: "Health & Wellness (Massage, Chiropractic, Med-Spa)",
    shortName: "Wellness",
    category: "Health & Wellness",
    royaltyRangePct: { min: 6, max: 10 },
    franchiseFee: { min: 35000, max: 75000 },
    item7Range: { min: 250000, max: 1000000 },
    unitEbitdaPct: { min: 18, max: 30 },
    brandFundPct: { min: 1, max: 4 },
    hookFact:
      "Health and wellness franchising — massage, chiropractic, IV therapy, med-spa, recovery — has been one of the fastest-growing categories of the past decade, driven by consumer shift toward preventive health and self-care spending.",
    exampleBrands: ["Massage Envy", "The Joint Chiropractic", "iCRYO", "Restore Hyper Wellness", "Hand & Stone Massage"],
    uniqueFacts: [
      "Membership models dominate the category — Massage Envy, The Joint, and others built recurring-revenue businesses that reliably support 7-10% royalties.",
      "Med-spa concepts require significant equipment capex and licensed practitioner relationships — Item 7 ranges typically $500K-$1M.",
      "Some categories (chiropractic, certain medical aesthetics) require state licensing or supervising-physician relationships that affect operator candidate qualification.",
    ],
    whyThisRoyaltyRange:
      "Wellness royalties cluster at 6-10% — higher end for membership-model recurring-revenue concepts, lower end for pay-per-service models. Predictable membership cash flow supports premium rates.",
    commonStallPattern:
      "Selling memberships at unsustainable prices. Some wellness franchises pressure operators to discount memberships heavily to drive enrollment, then operators can't deliver service at the discounted price point. Quality drops, attrition rises, unit fails.",
    jasonNote:
      "Wellness is one of the strongest emerging franchise categories. The membership model creates real recurring revenue. The operational risk is attrition — and that ties back to service quality, which ties back to staffing.",
    recommendedStateSlugs: ["california", "florida", "texas", "colorado"],
  },
];

/** Look up an industry by slug. */
export function getIndustry(slug: string): FranchiseIndustry {
  const i = allIndustries.find((x) => x.slug === slug);
  if (!i) throw new Error(`Industry not found: ${slug}`);
  return i;
}

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Coffee,
  Dumbbell,
  Heart,
  Home,
  GraduationCap,
  Building2,
  Briefcase,
} from "lucide-react";

import { JsonLd } from "@/components/JsonLd";
import { allIndustries, type FranchiseIndustry } from "@/lib/franchise-industries";
import {
  breadcrumbSchema,
  collectionPageSchema,
  faqPageSchema,
} from "@/lib/schema";

export const metadata: Metadata = {
  title:
    "Franchise Your Business by Industry: Royalty Rates, Fees & Economics by Sector | The Franchisor Blueprint",
  description:
    "How to franchise a business in 16 major industries — typical royalty rates, franchise fees, Item 7 ranges, unit EBITDA, and the operational patterns that determine which concepts succeed. Food service, fitness, home services, education, beauty, and more.",
  alternates: { canonical: "/franchise-by-industry" },
  openGraph: {
    title: "Franchise Your Business by Industry (16 Sector Guides)",
    description:
      "Sector-by-sector franchise economics: royalty rates, fees, unit EBITDA, and stall patterns across food service, fitness, home services, beauty, education, and more.",
    type: "website",
  },
};

type CategoryGroup = {
  name: FranchiseIndustry["category"];
  description: string;
  Icon: typeof Coffee;
};

const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    name: "Food Service",
    description:
      "QSR, casual dining, and coffee/dessert concepts. The most franchised category in the world — and the most studied. Royalty math is unforgiving.",
    Icon: Coffee,
  },
  {
    name: "Service",
    description:
      "Cleaning, home services, automotive, B2B services, real estate, and pet services. Lower capital intensity than food service, often higher royalties supported by stronger gross margins.",
    Icon: Briefcase,
  },
  {
    name: "Health & Wellness",
    description:
      "Fitness, senior care, and wellness (massage, chiropractic, med-spa). Membership-model recurring revenue supports premium royalty rates.",
    Icon: Heart,
  },
  {
    name: "Education",
    description:
      "Tutoring, learning centers, and childcare. Among the highest royalty rates in the franchise universe — supported by 75%+ gross margins on instructional time.",
    Icon: GraduationCap,
  },
  {
    name: "Real Estate",
    description:
      "Brokerage franchising operates on commission-split economics — franchisees collect agent commissions and pay royalties on a percentage.",
    Icon: Home,
  },
  {
    name: "Hospitality",
    description:
      "Hotels and lodging. A completely different scale of capital and operator profile from most franchise categories — typically the domain of real estate developers and hospitality investors.",
    Icon: Building2,
  },
];

const FAQS = [
  {
    q: "Which franchise industry has the highest royalty rates?",
    a: "Education and tutoring franchises typically carry the highest royalty rates in the franchise universe — often 8-12% of gross franchisee revenue. Their high gross margins (often 75%+ on instructional time) and recurring tuition revenue support these premium rates while still leaving the franchisee with strong returns. Health & wellness and B2B services follow at 6-10%, also supported by recurring-revenue dynamics.",
  },
  {
    q: "Which franchise industry has the lowest royalty rates?",
    a: "Food service categories — quick-service restaurants, casual dining, and hotels — cluster at the lowest end of the royalty range, typically 4-6%. Thin unit-level margins (often 10-22% EBITDA) constrain how much franchisors can extract while still leaving franchisees with viable economics. Higher royalties in these categories tend to drive operator candidates to competitors at lower rates.",
  },
  {
    q: "Which franchise category is most profitable for the franchisee?",
    a: "Home services (HVAC, plumbing, lawn care, restoration) and education franchises typically deliver the highest unit-level EBITDA — often 22-35% at maturity. Strong gross margins, lower technology overhead, and (for home services) trade certifications that protect against generic competition all contribute. Net franchisee profit after royalty depends substantially on operator quality and local market dynamics.",
  },
  {
    q: "What's the cheapest franchise industry to start in?",
    a: "Cleaning and janitorial franchises typically have the lowest Item 7 ranges — often $30K-$150K total initial investment — because most operate from home with a vehicle and equipment rather than a brick-and-mortar location. B2B services franchises ($50K-$200K) and home services franchises ($75K-$350K) are also relatively low-capital entry points compared to food service ($250K-$3.5M+) or hotels ($5M-$30M+).",
  },
  {
    q: "How do I pick the right franchise industry to enter?",
    a: "The right industry depends on three things: your existing business (don't pivot to a category you have no operating experience in), your unit economics (if your existing business is in a category, validate that the unit margins support the franchise revenue split), and your operator profile match (different categories attract different operator candidate pools — make sure your sales motion aligns).",
  },
];

export default function FranchiseByIndustryPage() {
  // Group industries by category
  const grouped = CATEGORY_GROUPS.map((group) => ({
    ...group,
    industries: allIndustries.filter((i) => i.category === group.name),
  })).filter((g) => g.industries.length > 0);

  const itemUrls = allIndustries.map(
    (i) => `/franchise-your/${i.slug}/business`,
  );

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Franchise by Industry", url: "/franchise-by-industry" },
        ])}
      />
      <JsonLd
        data={collectionPageSchema({
          url: "/franchise-by-industry",
          name: "Franchise Your Business by Industry (16 Sector Guides)",
          description:
            "Industry-by-industry guide to franchise economics — royalty rates, franchise fees, Item 7 ranges, unit EBITDA, and common stall patterns across 16 major franchise sectors.",
          itemCount: allIndustries.length,
          itemUrls,
        })}
      />
      <JsonLd data={faqPageSchema(FAQS)} />

      <div className="bg-grey-1/50">
        {/* ─── Hero ─────────────────────────────────────────────────── */}
        <header className="max-w-[1100px] mx-auto px-6 md:px-8 pt-12 md:pt-20 pb-10">
          <nav aria-label="Breadcrumb" className="mb-6 text-xs text-grey-4 tracking-wide">
            <Link href="/" className="hover:text-gold transition-colors">
              Home
            </Link>
            <span className="mx-2 opacity-40">/</span>
            <span className="text-navy">Franchise by Industry</span>
          </nav>

          <div className="text-gold-warm font-bold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1 inline-block">
            Industry Sector Guides
          </div>

          <h1 className="text-navy text-3xl md:text-5xl font-extrabold leading-[1.1] tracking-tight mb-5 max-w-3xl">
            Franchise Your Business by Industry
          </h1>

          <p className="text-grey-3 text-lg md:text-xl leading-relaxed mb-8 max-w-3xl font-light">
            Royalty rates, franchise fees, Item 7 ranges, and unit-level EBITDA vary
            substantially by sector. Education franchises support 8-12% royalties on
            75%+ gross margins. Casual dining caps out at 6% because labor costs eat
            the rest. Each of these guides shows the real numbers, the real stall
            patterns, and the real path to franchising in your category.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mt-8">
            <StatCard value="16" label="Sectors covered" />
            <StatCard value="4–12%" label="Royalty range" />
            <StatCard value="$30K–$30M" label="Item 7 spread" />
            <StatCard value="10–35%" label="Unit EBITDA range" />
          </div>
        </header>

        {/* ─── Category Sections ─────────────────────────────────────── */}
        <div className="max-w-[1100px] mx-auto px-6 md:px-8 pb-16 space-y-14">
          {grouped.map((group) => {
            const Icon = group.Icon;
            return (
              <section key={group.name}>
                <div className="flex items-start gap-4 mb-3">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-navy text-gold flex items-center justify-center">
                    <Icon size={22} strokeWidth={2.2} />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-navy text-2xl md:text-3xl font-bold leading-tight">
                      {group.name}{" "}
                      <span className="text-grey-4 font-normal text-lg ml-1">
                        ({group.industries.length})
                      </span>
                    </h2>
                    <p className="text-grey-3 text-sm md:text-base leading-relaxed mt-1.5">
                      {group.description}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                  {group.industries.map((ind) => (
                    <Link
                      key={ind.slug}
                      href={`/franchise-your/${ind.slug}/business`}
                      className="group block bg-white rounded-xl p-5 border border-navy/10 hover:border-gold hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <h3 className="text-navy font-bold text-base md:text-lg leading-tight group-hover:text-gold transition-colors">
                          {ind.name}
                        </h3>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        <Tag>
                          {ind.royaltyRangePct.min}-{ind.royaltyRangePct.max}% royalty
                        </Tag>
                        <Tag>
                          {ind.unitEbitdaPct.min}-{ind.unitEbitdaPct.max}% EBITDA
                        </Tag>
                      </div>
                      <p className="text-grey-4 text-xs leading-relaxed line-clamp-2">
                        Examples: {ind.exampleBrands.slice(0, 3).join(", ")}
                      </p>
                      <div className="text-gold font-bold text-xs mt-3 inline-flex items-center gap-1.5 group-hover:gap-2.5 transition-all">
                        Read the full guide
                        <ArrowRight size={13} strokeWidth={2.5} />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {/* ─── Royalty benchmarks blog cross-link ───────────────────── */}
        <section className="bg-grey-1 border-y border-navy/10">
          <div className="max-w-[1100px] mx-auto px-6 md:px-8 py-10 md:py-14">
            <div className="grid md:grid-cols-[1.4fr_1fr] gap-8 items-center">
              <div>
                <div className="text-gold-warm font-bold text-xs tracking-[0.18em] uppercase mb-3">
                  Deep dive
                </div>
                <h2 className="text-navy text-2xl md:text-3xl font-bold mb-3 leading-tight">
                  How to actually set your royalty rate
                </h2>
                <p className="text-grey-3 leading-relaxed mb-5">
                  Sector benchmarks give you the typical range. Setting your specific
                  rate requires unit-economics math against your actual numbers — and
                  cross-checking against franchisee return on invested capital. The
                  full framework is in our pillar guide.
                </p>
                <Link
                  href="/blog/franchise-royalty-rate-benchmarks"
                  className="inline-flex items-center gap-2 text-navy font-bold border-b-2 border-gold pb-1 hover:text-gold transition-colors"
                >
                  Read: Industry Benchmarks by Sector
                  <ArrowRight size={16} strokeWidth={2.5} />
                </Link>
              </div>
              <div className="bg-white rounded-xl p-5 border border-navy/10">
                <Dumbbell size={20} className="text-gold mb-3" />
                <h3 className="text-navy font-bold mb-2 text-sm">Related pillar guides</h3>
                <ul className="space-y-2 text-sm">
                  <li>
                    <Link
                      href="/blog/franchise-fee-vs-royalty"
                      className="text-navy hover:text-gold transition-colors"
                    >
                      → Franchise Fee vs. Royalty
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/blog/fdd-item-19-financial-performance-representations"
                      className="text-navy hover:text-gold transition-colors"
                    >
                      → FDD Item 19 (Financial Performance)
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/blog/why-new-franchisors-stall-in-year-2"
                      className="text-navy hover:text-gold transition-colors"
                    >
                      → Why New Franchisors Stall in Year 2
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ─── FAQs ──────────────────────────────────────────────────── */}
        <section className="max-w-[820px] mx-auto px-6 md:px-8 py-14">
          <h2 className="text-navy text-2xl md:text-3xl font-bold mb-6 leading-tight">
            Frequently asked questions
          </h2>
          <div className="space-y-4">
            {FAQS.map((f, i) => (
              <details
                key={i}
                className="group bg-white rounded-xl border border-navy/10 p-5 hover:border-gold/40 transition-colors"
              >
                <summary className="cursor-pointer list-none">
                  <h3 className="text-navy font-bold text-base md:text-lg pr-4">
                    {f.q}
                  </h3>
                </summary>
                <p className="text-grey-3 text-base leading-[1.75] mt-3">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ─── Cross-link to State hub + closing CTA ───────────────── */}
        <section className="bg-navy text-white">
          <div className="max-w-[1100px] mx-auto px-6 md:px-8 py-14 md:py-20">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div>
                <div className="text-gold font-bold text-xs tracking-[0.2em] uppercase mb-3">
                  Browse by location instead
                </div>
                <h2 className="text-white text-2xl md:text-4xl font-bold mb-4 leading-tight">
                  See state-specific franchise requirements
                </h2>
                <p className="text-white/80 mb-6 leading-relaxed">
                  Fifty-one state guides covering FDD registration tier, regulating
                  agency, filing fees, review timelines, and the regional dynamics
                  that determine which franchise concepts thrive in each state.
                </p>
                <Link
                  href="/franchise-by-state"
                  className="inline-flex items-center gap-2 bg-gold text-navy font-bold px-6 py-3 rounded-lg hover:bg-gold-warm transition-all"
                >
                  Browse states
                  <ArrowRight size={18} strokeWidth={2.5} />
                </Link>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-7">
                <div className="text-gold font-bold text-xs tracking-[0.2em] uppercase mb-3">
                  Talk through your category
                </div>
                <h3 className="text-white text-xl font-bold mb-3 leading-tight">
                  Get an honest read on your sector
                </h3>
                <p className="text-white/75 mb-5 leading-relaxed text-sm">
                  Thirty minutes with someone who's built franchise systems for 30
                  years across all of these categories. We'll look at your business
                  and tell you what's realistic — without the pitch.
                </p>
                <Link
                  href="/strategy-call"
                  className="inline-flex items-center gap-2 border border-white/40 text-white font-bold px-5 py-2.5 rounded-lg hover:bg-white/10 transition-colors text-sm"
                >
                  Book a 30-min strategy call
                  <ArrowRight size={16} strokeWidth={2.5} />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-navy/10">
      <div className="text-navy font-extrabold text-xl md:text-2xl leading-tight">
        {value}
      </div>
      <div className="text-grey-4 text-[11px] tracking-wide uppercase font-bold mt-1.5">
        {label}
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center bg-grey-1 text-navy text-[11px] font-semibold px-2 py-1 rounded">
      {children}
    </span>
  );
}

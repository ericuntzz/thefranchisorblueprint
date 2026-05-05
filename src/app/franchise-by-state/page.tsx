import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin, FileCheck, Bell, AlertTriangle, Scale, Shield } from "lucide-react";

import { JsonLd } from "@/components/JsonLd";
import {
  allStates,
  TIER_LABEL,
  TIER_DESCRIPTION,
  type RegistrationTier,
} from "@/lib/franchise-states";
import {
  breadcrumbSchema,
  collectionPageSchema,
  faqPageSchema,
} from "@/lib/schema";

export const metadata: Metadata = {
  title:
    "Franchise Your Business by State: Complete Guide for All 50 States + DC | The Franchisor Blueprint",
  description:
    "How to franchise a business in every U.S. state — FDD registration tier, regulating agency, filing fees, review timelines, and the operator-pool dynamics that determine which franchise concepts work in each state.",
  alternates: { canonical: "/franchise-by-state" },
  openGraph: {
    title: "Franchise Your Business by State (All 50 States + DC)",
    description:
      "FDD registration tiers, fees, agencies, and timelines for every U.S. state. Plus the regional economic dynamics that determine franchise category fit.",
    type: "website",
  },
};

// Tier ordering — show registration states first (most actionable), then everything else.
const TIER_ORDER: RegistrationTier[] = [
  "full",
  "notice",
  "businessOpp",
  "relationship",
  "ftcOnly",
];

const TIER_ICONS: Record<RegistrationTier, typeof FileCheck> = {
  full: FileCheck,
  notice: Bell,
  businessOpp: AlertTriangle,
  relationship: Scale,
  ftcOnly: Shield,
};

const FAQS = [
  {
    q: "Do I need to register my franchise in every state?",
    a: "No. Federal FTC Franchise Rule disclosure applies nationwide, but only 14 states require franchisors to file the FDD with a state regulator before selling franchises in that state. Another ~19 states have franchise relationship laws that govern post-sale franchisor-franchisee dynamics, and the remaining states operate under FTC Rule alone. Most emerging franchisors register in their home state plus 3-5 strategic expansion states first, then add registration states as their sales pipeline justifies them.",
  },
  {
    q: "Which states are franchise registration states?",
    a: "The 14 franchise registration states are California, Hawaii, Illinois, Indiana, Maryland, Michigan (notice filing only), Minnesota, New York, North Dakota, Rhode Island, South Dakota, Virginia, Washington, and Wisconsin. Each has its own regulator, filing fee, renewal cadence, and review timeline.",
  },
  {
    q: "How much does state-level franchise registration cost?",
    a: "Initial state filing fees range from $150 in lighter-touch states to $750 in California (the highest). Annual renewal fees typically run $100-$450 per state. Multi-state registration adds up: budget $3,000-$8,000/year if you want full coverage of all 14 registration states once you're operating at scale.",
  },
  {
    q: "Which state should I register my franchise in first?",
    a: "Almost always your home state — the one where your operating units exist and where you'll do most of your initial Discovery Days. After your home state, prioritize states where you have specific operator candidates ready to sign or where your unit economics map cleanly to local market conditions. There's no benefit to registering in a state where you have no realistic near-term sales pipeline.",
  },
  {
    q: "What's the difference between a registration state and a relationship state?",
    a: "Registration states require pre-sale filing of the FDD with a state regulator (and usually approval before any sales activity). Relationship states have no pre-sale registration but apply state-specific laws governing what happens after the franchise is sold — typically requiring good cause for termination, providing extended cure rights, or otherwise protecting franchisees from unilateral franchisor action. Both layers matter, but they affect different parts of the franchise lifecycle.",
  },
];

export default function FranchiseByStatePage() {
  // Group states by tier
  const grouped = TIER_ORDER.map((tier) => ({
    tier,
    label: TIER_LABEL[tier],
    description: TIER_DESCRIPTION[tier],
    states: allStates
      .filter((s) => s.tier === tier)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((g) => g.states.length > 0);

  const itemUrls = allStates.map(
    (s) => `/franchise-your-business-in/${s.slug}`,
  );

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Franchise by State", url: "/franchise-by-state" },
        ])}
      />
      <JsonLd
        data={collectionPageSchema({
          url: "/franchise-by-state",
          name: "Franchise Your Business by State (All 50 States + DC)",
          description:
            "Complete state-by-state guide to franchising in the U.S. — registration requirements, filing fees, agencies, review timelines, and regional market dynamics for all 50 states plus DC.",
          itemCount: allStates.length,
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
            <span className="text-navy">Franchise by State</span>
          </nav>

          <div className="text-gold-warm font-bold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1 inline-block">
            State-by-State Guide
          </div>

          <h1 className="text-navy text-3xl md:text-5xl font-extrabold leading-[1.1] tracking-tight mb-5 max-w-3xl">
            Franchise Your Business in Any U.S. State
          </h1>

          <p className="text-grey-3 text-lg md:text-xl leading-relaxed mb-8 max-w-3xl font-light">
            Every state in the U.S. handles franchise sales differently. Fourteen require
            full FDD registration with a state regulator. One requires notice filing.
            Nineteen have franchise relationship laws governing post-sale dynamics. The
            remaining seventeen operate under federal FTC Franchise Rule alone.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mt-8">
            <StatCard value="51" label="States + DC covered" />
            <StatCard value="14" label="Full registration states" />
            <StatCard value="$150–$750" label="Filing fees per state" />
            <StatCard value="3–16 wk" label="First-cycle review" />
          </div>
        </header>

        {/* ─── Tier Sections ─────────────────────────────────────────── */}
        <div className="max-w-[1100px] mx-auto px-6 md:px-8 pb-16 space-y-14">
          {grouped.map((group) => {
            const Icon = TIER_ICONS[group.tier];
            return (
              <section key={group.tier}>
                <div className="flex items-start gap-4 mb-3">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-navy text-gold flex items-center justify-center">
                    <Icon size={22} strokeWidth={2.2} />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-navy text-2xl md:text-3xl font-bold leading-tight">
                      {group.label}{" "}
                      <span className="text-grey-4 font-normal text-lg ml-1">
                        ({group.states.length})
                      </span>
                    </h2>
                    <p className="text-grey-3 text-sm md:text-base leading-relaxed mt-1.5">
                      {group.description}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
                  {group.states.map((s) => (
                    <Link
                      key={s.slug}
                      href={`/franchise-your-business-in/${s.slug}`}
                      className="group flex items-start gap-3 bg-white rounded-xl p-4 border border-navy/10 hover:border-gold hover:shadow-md transition-all"
                    >
                      <MapPin
                        size={16}
                        className="text-gold mt-1 flex-shrink-0 group-hover:scale-110 transition-transform"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <h3 className="text-navy font-bold text-base group-hover:text-gold transition-colors">
                            {s.name}
                          </h3>
                          <span className="text-grey-4 text-xs">{s.abbreviation}</span>
                        </div>
                        {s.agency && (
                          <p className="text-grey-4 text-xs leading-snug mt-0.5 line-clamp-1">
                            {s.agencyAcronym ?? s.agency}
                            {s.initialFilingFee !== undefined && (
                              <> · ${s.initialFilingFee.toLocaleString()} filing</>
                            )}
                          </p>
                        )}
                        {!s.agency && (
                          <p className="text-grey-4 text-xs leading-snug mt-0.5 line-clamp-1">
                            {s.topMetros.slice(0, 2).join(" · ")}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {/* ─── FAQs ──────────────────────────────────────────────────── */}
        <section className="max-w-[820px] mx-auto px-6 md:px-8 pb-16">
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

        {/* ─── Related: Industry hub + closing CTA ─────────────────── */}
        <section className="bg-navy text-white">
          <div className="max-w-[1100px] mx-auto px-6 md:px-8 py-14 md:py-20">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div>
                <div className="text-gold font-bold text-xs tracking-[0.2em] uppercase mb-3">
                  Browse by category instead
                </div>
                <h2 className="text-white text-2xl md:text-4xl font-bold mb-4 leading-tight">
                  See franchise economics by industry
                </h2>
                <p className="text-white/80 mb-6 leading-relaxed">
                  Sixteen sector guides covering typical royalties, franchise fees,
                  Item 7 ranges, unit EBITDA, and the operational patterns that
                  determine which concepts succeed in each category.
                </p>
                <Link
                  href="/franchise-by-industry"
                  className="inline-flex items-center gap-2 bg-gold text-navy font-bold px-6 py-3 rounded-lg hover:bg-gold-warm transition-all"
                >
                  Browse industries
                  <ArrowRight size={18} strokeWidth={2.5} />
                </Link>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-7">
                <div className="text-gold font-bold text-xs tracking-[0.2em] uppercase mb-3">
                  Not sure where to start?
                </div>
                <h3 className="text-white text-xl font-bold mb-3 leading-tight">
                  Get a personalized readiness score
                </h3>
                <p className="text-white/75 mb-5 leading-relaxed text-sm">
                  The free Franchise Readiness Assessment scores your business across
                  10 criteria in 5 minutes — including the regional and category fit
                  that determines which states make sense for you.
                </p>
                <Link
                  href="/assessment"
                  className="inline-flex items-center gap-2 border border-white/40 text-white font-bold px-5 py-2.5 rounded-lg hover:bg-white/10 transition-colors text-sm"
                >
                  Take the free assessment
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

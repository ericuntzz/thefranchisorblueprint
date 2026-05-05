import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, MapPin, TrendingUp, FileText, DollarSign } from "lucide-react";

import { JsonLd } from "@/components/JsonLd";
import { InlineCTA } from "@/components/InlineCTA";
import {
  allIndustries,
  type FranchiseIndustry,
} from "@/lib/franchise-industries";
import { allStates } from "@/lib/franchise-states";
import { breadcrumbSchema, faqPageSchema, serviceSchema } from "@/lib/schema";
import { SITE_URL } from "@/lib/site";

type Params = Promise<{ industry: string }>;

export async function generateStaticParams() {
  return allIndustries.map((i) => ({ industry: i.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { industry: slug } = await params;
  const industry = allIndustries.find((i) => i.slug === slug);
  if (!industry) return {};

  const title = `How to Franchise a ${industry.name} Business (2026 Guide) | The Franchisor Blueprint`;
  const description = `Franchising a ${industry.name.toLowerCase()} business: typical royalty rates (${industry.royaltyRangePct.min}-${industry.royaltyRangePct.max}%), franchise fees, Item 7 ranges, unit economics, and the operational patterns that determine which ${industry.shortName} concepts succeed.`;

  return {
    title,
    description,
    alternates: { canonical: `/franchise-your/${industry.slug}/business` },
    openGraph: {
      title,
      description,
      type: "article",
      authors: ["Jason Stowe"],
    },
  };
}

export default async function IndustryPage({ params }: { params: Params }) {
  const { industry: slug } = await params;
  const industry = allIndustries.find((i) => i.slug === slug);
  if (!industry) return notFound();

  const recommendedStates = (industry.recommendedStateSlugs ?? [])
    .map((s) => allStates.find((st) => st.slug === s))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  const faqs = buildFaqs(industry);

  return (
    <>
      <JsonLd data={breadcrumbSchema([
        { name: "Home", url: "/" },
        { name: "Franchise by Industry", url: "/franchise-by-industry" },
        { name: industry.name, url: `/franchise-your/${industry.slug}/business` },
      ])} />
      <JsonLd data={faqPageSchema(faqs)} />
      <JsonLd
        data={serviceSchema({
          id: `franchise-development-${industry.slug}`,
          name: `Franchise Development Consulting — ${industry.name}`,
          description: `Franchise development consulting for ${industry.name.toLowerCase()} businesses, including FDD preparation, royalty rate setting, operations manual development, and franchisee recruitment guidance.`,
          price: 2997,
          url: `/franchise-your/${industry.slug}/business`,
          category: `Franchise development consulting — ${industry.name}`,
        })}
      />

      <div className="bg-grey-1/50">
        {/* ─── Hero ─────────────────────────────────────────────────── */}
        <header className="max-w-[920px] mx-auto px-6 md:px-8 pt-12 md:pt-16">
          <nav aria-label="Breadcrumb" className="mb-6 text-xs text-grey-4 tracking-wide">
            <Link href="/" className="hover:text-gold transition-colors">Home</Link>
            <span className="mx-2 opacity-40">/</span>
            <Link href="/franchise-by-industry" className="hover:text-gold transition-colors">Franchise by Industry</Link>
            <span className="mx-2 opacity-40">/</span>
            <span className="text-navy">{industry.name}</span>
          </nav>

          <div className="text-gold-warm font-bold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1 inline-block">
            {industry.category}
          </div>

          <h1 className="text-navy text-3xl md:text-5xl font-extrabold leading-[1.1] tracking-tight mb-5">
            How to Franchise a {industry.name} Business
          </h1>

          <p className="text-grey-3 text-lg md:text-xl leading-relaxed mb-6 font-light">
            {industry.hookFact}
          </p>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-grey-4 pb-8 mb-2 border-b border-navy/10">
            <span className="flex items-center gap-1.5">
              <DollarSign size={14} className="text-gold" />
              {industry.royaltyRangePct.min}-{industry.royaltyRangePct.max}% typical royalty
            </span>
            <span className="flex items-center gap-1.5">
              <TrendingUp size={14} className="text-gold" />
              {industry.unitEbitdaPct.min}-{industry.unitEbitdaPct.max}% unit EBITDA
            </span>
            <span className="flex items-center gap-1.5">
              <FileText size={14} className="text-gold" />
              ${(industry.item7Range.min / 1000).toFixed(0)}K-$
              {industry.item7Range.max >= 1_000_000
                ? `${(industry.item7Range.max / 1_000_000).toFixed(1)}M`
                : `${(industry.item7Range.max / 1000).toFixed(0)}K`}{" "}
              Item 7
            </span>
          </div>
        </header>

        {/* ─── Body ─────────────────────────────────────────────────── */}
        <div className="max-w-[920px] mx-auto px-6 md:px-8 py-10 md:py-14 space-y-10">
          {/* Quick economics */}
          <section className="bg-white rounded-2xl p-6 md:p-8 border border-navy/10 shadow-sm">
            <h2 className="text-navy text-2xl font-bold mb-5">
              Quick economics: typical {industry.shortName} franchise
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <FactRow
                label="Initial franchise fee"
                value={`$${industry.franchiseFee.min.toLocaleString()} – $${industry.franchiseFee.max.toLocaleString()}`}
              />
              <FactRow
                label="Royalty"
                value={`${industry.royaltyRangePct.min}% – ${industry.royaltyRangePct.max}% of gross revenue`}
              />
              <FactRow
                label="Brand marketing fund"
                value={`${industry.brandFundPct.min}% – ${industry.brandFundPct.max}% of revenue`}
              />
              <FactRow
                label="Item 7 (total initial investment)"
                value={`$${industry.item7Range.min.toLocaleString()} – $${industry.item7Range.max.toLocaleString()}`}
              />
              <FactRow
                label="Unit EBITDA at maturity"
                value={`${industry.unitEbitdaPct.min}% – ${industry.unitEbitdaPct.max}%`}
              />
              <FactRow label="Category" value={industry.category} />
            </div>
            <p className="text-grey-4 text-xs mt-5 leading-relaxed">
              Ranges reflect typical 2026 industry data across emerging and established
              franchise systems in this category. Your specific numbers will vary based
              on concept positioning, market, and operational maturity.
            </p>
          </section>

          {/* Section 1: What franchising looks like in this category */}
          <section>
            <h2 className="text-navy text-2xl md:text-3xl font-bold mb-4 leading-tight">
              What franchising a {industry.name.toLowerCase()} business looks like
            </h2>
            <p className="text-grey-3 text-base md:text-[17px] leading-[1.75] mb-5">
              {industry.shortName} franchising sits in the{" "}
              <strong className="text-navy">{industry.category.toLowerCase()}</strong>{" "}
              category, with typical royalties of{" "}
              <strong className="text-navy">
                {industry.royaltyRangePct.min}-{industry.royaltyRangePct.max}% of gross
                revenue
              </strong>{" "}
              and franchise fees of{" "}
              <strong className="text-navy">
                ${industry.franchiseFee.min.toLocaleString()}-$
                {industry.franchiseFee.max.toLocaleString()}
              </strong>
              . Established brands in this space include{" "}
              {industry.exampleBrands.slice(0, 3).join(", ")}, and others.
            </p>

            <h3 className="text-navy text-xl md:text-2xl font-bold mt-8 mb-3">
              What's distinctive about this category
            </h3>
            <ul className="text-grey-3 text-base md:text-[17px] leading-[1.75] mb-5 pl-6 space-y-2 list-disc marker:text-gold">
              {industry.uniqueFacts.map((fact, i) => (
                <li key={i} className="pl-1">
                  {fact}
                </li>
              ))}
            </ul>

            <h3 className="text-navy text-xl md:text-2xl font-bold mt-8 mb-3">
              Why royalties land at {industry.royaltyRangePct.min}-{industry.royaltyRangePct.max}%
            </h3>
            <p className="text-grey-3 text-base md:text-[17px] leading-[1.75] mb-5">
              {industry.whyThisRoyaltyRange}
            </p>
            <p className="text-grey-3 text-base md:text-[17px] leading-[1.75] mb-5">
              For the full sector-by-sector royalty breakdown and the unit-economics
              framework for setting your specific rate, see{" "}
              <Link
                href="/blog/franchise-royalty-rate-benchmarks"
                className="text-navy font-semibold underline decoration-gold/60 underline-offset-4 hover:text-gold"
              >
                How to Set Franchise Royalty Rates: Industry Benchmarks by Sector
              </Link>
              .
            </p>

            <blockquote className="border-l-4 border-gold pl-6 py-2 my-7 italic text-navy text-lg md:text-xl font-light">
              "{industry.jasonNote}"
              <cite className="block mt-2 text-sm text-grey-4 not-italic">
                — Jason Stowe, Founder
              </cite>
            </blockquote>
          </section>

          {/* InlineCTA at ~60% mark */}
          <InlineCTA
            eyebrow={`${industry.shortName} franchise readiness`}
            title={`Find out if your ${industry.name.toLowerCase()} business is franchise-ready`}
            body={`The free Franchise Readiness Assessment scores your business across 15 questions in 5 minutes — including the unit-economics, brand, and operational criteria specific to ${industry.shortName} franchising. Tailored next-step recommendation based on where you score.`}
            href="/assessment"
            ctaLabel="Take the free 5-min assessment"
          />

          {/* Section 2: Common stall pattern */}
          <section>
            <h2 className="text-navy text-2xl md:text-3xl font-bold mb-4 leading-tight">
              The most common stall pattern for {industry.shortName} franchisors
            </h2>
            <p className="text-grey-3 text-base md:text-[17px] leading-[1.75] mb-5">
              {industry.commonStallPattern}
            </p>
            <p className="text-grey-3 text-base md:text-[17px] leading-[1.75] mb-5">
              For the seven patterns that cause new franchise systems to stall in their
              second year — across categories — see{" "}
              <Link
                href="/blog/why-new-franchisors-stall-in-year-2"
                className="text-navy font-semibold underline decoration-gold/60 underline-offset-4 hover:text-gold"
              >
                Why Most New Franchisors Stall in Year 2
              </Link>
              .
            </p>
          </section>

          {/* Section 3: Strongest markets */}
          {recommendedStates.length > 0 && (
            <section>
              <h2 className="text-navy text-2xl md:text-3xl font-bold mb-4 leading-tight">
                Strongest U.S. markets for {industry.name.toLowerCase()} franchising
              </h2>
              <p className="text-grey-3 text-base md:text-[17px] leading-[1.75] mb-6">
                Based on operator demographics, regional economic structure, and historical
                category penetration, these states have consistently been strong markets
                for {industry.shortName.toLowerCase()} franchise expansion:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recommendedStates.map((st) => (
                  <Link
                    key={st.slug}
                    href={`/franchise-your-business-in/${st.slug}`}
                    className="block bg-white rounded-xl p-5 border border-navy/10 hover:border-gold hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin size={14} className="text-gold" />
                      <h3 className="text-navy font-bold text-base group-hover:text-gold transition-colors">
                        {st.name}
                      </h3>
                    </div>
                    <p className="text-grey-4 text-xs leading-relaxed">
                      Top metros: {st.topMetros.slice(0, 3).join(", ")}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Section 4: How to franchise — step ladder */}
          <section>
            <h2 className="text-navy text-2xl md:text-3xl font-bold mb-4 leading-tight">
              How to actually franchise your {industry.name.toLowerCase()} business
            </h2>
            <p className="text-grey-3 text-base md:text-[17px] leading-[1.75] mb-6">
              The structural sequence is the same across categories, but the order of
              operations matters. Most successful franchisors in {industry.shortName.toLowerCase()}{" "}
              follow this path:
            </p>
            <ol className="space-y-4">
              <Step
                n={1}
                title="Validate unit economics"
                body={`Confirm your unit-level EBITDA is sustainably in the ${industry.unitEbitdaPct.min}-${industry.unitEbitdaPct.max}% range across multiple operating periods — not just a single strong year.`}
              />
              <Step
                n={2}
                title="Document the operating system"
                body={
                  <>
                    Build the operations manual that codifies how a franchisee runs
                    a unit. The 17-chapter framework covered in{" "}
                    <Link
                      href="/blog/how-to-write-franchise-operations-manual"
                      className="text-navy font-semibold underline decoration-gold/60 underline-offset-4 hover:text-gold"
                    >
                      How to Write a Franchise Operations Manual
                    </Link>{" "}
                    works across categories.
                  </>
                }
              />
              <Step
                n={3}
                title="Set your fee structure"
                body={
                  <>
                    Price your initial franchise fee ($
                    {industry.franchiseFee.min.toLocaleString()}-$
                    {industry.franchiseFee.max.toLocaleString()} typical), royalty (
                    {industry.royaltyRangePct.min}-{industry.royaltyRangePct.max}%), and
                    brand marketing fund ({industry.brandFundPct.min}-
                    {industry.brandFundPct.max}%) against your unit economics. See{" "}
                    <Link
                      href="/blog/franchise-fee-vs-royalty"
                      className="text-navy font-semibold underline decoration-gold/60 underline-offset-4 hover:text-gold"
                    >
                      Initial Franchise Fee vs. Royalty
                    </Link>
                    .
                  </>
                }
              />
              <Step
                n={4}
                title="Prepare and file the FDD"
                body={
                  <>
                    Engage a franchise attorney to draft and file your FDD. Identify your
                    target registration states and build the state-specific addenda.
                    Reference the{" "}
                    <Link
                      href="/blog/franchise-disclosure-document-explained"
                      className="text-navy font-semibold underline decoration-gold/60 underline-offset-4 hover:text-gold"
                    >
                      FDD Explained guide
                    </Link>{" "}
                    for the 23-item structure.
                  </>
                }
              />
              <Step
                n={5}
                title="Build the sales funnel"
                body={
                  <>
                    Recruit your first 10 franchisees through a structured funnel. The
                    playbook for early-franchise sales is in{" "}
                    <Link
                      href="/blog/how-to-recruit-first-10-franchisees"
                      className="text-navy font-semibold underline decoration-gold/60 underline-offset-4 hover:text-gold"
                    >
                      How to Recruit Your First 10 Franchisees
                    </Link>
                    .
                  </>
                }
              />
            </ol>
          </section>

          {/* FAQs */}
          <section>
            <h2 className="text-navy text-2xl md:text-3xl font-bold mb-5 leading-tight">
              Frequently asked questions
            </h2>
            <div className="space-y-5">
              {faqs.map((f, i) => (
                <details
                  key={i}
                  className="group bg-white rounded-xl border border-navy/10 p-5 hover:border-gold/40 transition-colors"
                >
                  <summary className="flex items-start gap-3 cursor-pointer list-none">
                    <Check
                      size={18}
                      className="text-gold mt-1 flex-shrink-0 transition-transform group-open:rotate-12"
                    />
                    <h3 className="text-navy font-bold text-base md:text-lg">{f.q}</h3>
                  </summary>
                  <p className="text-grey-3 text-base leading-[1.75] mt-3 pl-8">{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          {/* Closing CTA */}
          <section className="bg-navy text-white rounded-2xl p-8 md:p-10 text-center">
            <div className="text-gold font-bold text-xs tracking-[0.2em] uppercase mb-3">
              Ready to franchise your {industry.shortName.toLowerCase()} business?
            </div>
            <h2 className="text-white text-2xl md:text-3xl font-bold mb-4">
              Start with the 5-minute readiness check
            </h2>
            <p className="text-white/80 mb-6 max-w-2xl mx-auto leading-relaxed">
              The free Franchise Readiness Assessment scores your business across 15
              questions — same scoring rubric we use in our paid intake calls. Five
              minutes, instant tailored recommendation.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/assessment"
                className="inline-flex items-center justify-center gap-2 bg-gold text-navy font-bold px-6 py-3 rounded-lg hover:bg-gold-warm transition-all"
              >
                Take the free assessment
                <ArrowRight size={18} strokeWidth={2.5} />
              </Link>
              <Link
                href="/strategy-call"
                className="inline-flex items-center justify-center gap-2 border border-white/40 text-white font-bold px-6 py-3 rounded-lg hover:bg-white/10 transition-colors"
              >
                Book a 30-min strategy call
              </Link>
            </div>
          </section>

          {/* Related blog content */}
          <section className="border-t border-navy/10 pt-8">
            <h2 className="text-navy text-xl font-bold mb-4">Related guides</h2>
            <ul className="space-y-2 text-base">
              <li>
                <Link
                  href="/blog/franchise-royalty-rate-benchmarks"
                  className="text-navy underline decoration-gold/60 underline-offset-4 hover:text-gold"
                >
                  How to Set Franchise Royalty Rates: Industry Benchmarks by Sector
                </Link>
              </li>
              <li>
                <Link
                  href="/blog/franchise-fee-vs-royalty"
                  className="text-navy underline decoration-gold/60 underline-offset-4 hover:text-gold"
                >
                  Initial Franchise Fee vs. Royalty: What Each One Pays For
                </Link>
              </li>
              <li>
                <Link
                  href="/blog/how-to-write-franchise-operations-manual"
                  className="text-navy underline decoration-gold/60 underline-offset-4 hover:text-gold"
                >
                  How to Write a Franchise Operations Manual
                </Link>
              </li>
              <li>
                <Link
                  href="/blog/why-new-franchisors-stall-in-year-2"
                  className="text-navy underline decoration-gold/60 underline-offset-4 hover:text-gold"
                >
                  Why Most New Franchisors Stall in Year 2
                </Link>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] tracking-[0.18em] uppercase text-grey-4 font-bold">
        {label}
      </span>
      <span className="text-navy font-medium">{value}</span>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-navy text-gold font-bold text-base flex items-center justify-center">
        {n}
      </div>
      <div>
        <h3 className="text-navy font-bold text-lg mb-1">{title}</h3>
        <p className="text-grey-3 text-base leading-[1.75]">{body}</p>
      </div>
    </li>
  );
}

function buildFaqs(industry: FranchiseIndustry) {
  return [
    {
      q: `How much does it cost to franchise a ${industry.name.toLowerCase()} business?`,
      a: `Franchising a ${industry.name.toLowerCase()} business in 2026 typically requires $13,500 to $25,000 in development cost (a coached program plus franchise attorney) for emerging brands, or $45,000 to $95,000+ at traditional consulting firms. Add $5,000 to $15,000 in attorney fees regardless of which firm you choose. The franchisee's initial investment (Item 7) for ${industry.shortName.toLowerCase()} concepts typically runs $${industry.item7Range.min.toLocaleString()} to $${industry.item7Range.max.toLocaleString()}.`,
    },
    {
      q: `What is a typical royalty for a ${industry.name.toLowerCase()} franchise?`,
      a: `${industry.shortName} franchise royalties typically run ${industry.royaltyRangePct.min}% to ${industry.royaltyRangePct.max}% of gross franchisee revenue, with a separate brand marketing fund contribution of ${industry.brandFundPct.min}% to ${industry.brandFundPct.max}%. ${industry.whyThisRoyaltyRange}`,
    },
    {
      q: `What is a typical franchise fee for a ${industry.name.toLowerCase()} business?`,
      a: `Initial franchise fees for ${industry.shortName.toLowerCase()} concepts typically range from $${industry.franchiseFee.min.toLocaleString()} to $${industry.franchiseFee.max.toLocaleString()} in 2026. The fee should be set based on your real onboarding cost, sector benchmarks (pulled from competitors' Item 5 disclosures), and strategic positioning within the typical range.`,
    },
    {
      q: `What unit-level EBITDA do I need before franchising a ${industry.name.toLowerCase()} business?`,
      a: `${industry.shortName} franchises typically need unit-level EBITDA of at least ${industry.unitEbitdaPct.min}% at typical operating volume to support a sustainable franchise system. After royalty (${industry.royaltyRangePct.min}-${industry.royaltyRangePct.max}%) and brand fund (${industry.brandFundPct.min}-${industry.brandFundPct.max}%) contributions, the franchisee needs to retain enough margin to support a competitive return on invested capital — typically 15-30% ROIC.`,
    },
    {
      q: `Are ${industry.name.toLowerCase()} franchises profitable?`,
      a: `Established ${industry.shortName.toLowerCase()} franchise units operating at typical volume produce ${industry.unitEbitdaPct.min}-${industry.unitEbitdaPct.max}% EBITDA before royalty and brand fund contributions. Net franchisee profit after the franchisor take is typically ${Math.max(0, industry.unitEbitdaPct.min - industry.royaltyRangePct.max - industry.brandFundPct.max)}-${Math.max(0, industry.unitEbitdaPct.max - industry.royaltyRangePct.min - industry.brandFundPct.min)}% of revenue at maturity. Profitability depends substantially on operator quality, local market dynamics, and ramp time.`,
    },
  ];
}

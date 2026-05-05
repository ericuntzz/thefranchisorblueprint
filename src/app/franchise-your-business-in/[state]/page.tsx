import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, MapPin, Building2, Clock, FileText } from "lucide-react";

import { JsonLd } from "@/components/JsonLd";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { InlineCTA } from "@/components/InlineCTA";
import {
  allStates,
  getState,
  TIER_LABEL,
  TIER_DESCRIPTION,
  type FranchiseState,
} from "@/lib/franchise-states";
import { allIndustries } from "@/lib/franchise-industries";
import { breadcrumbSchema, faqPageSchema, serviceSchema } from "@/lib/schema";
import { SITE_URL } from "@/lib/site";

type Params = Promise<{ state: string }>;

export async function generateStaticParams() {
  return allStates.map((s) => ({ state: s.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { state: slug } = await params;
  const state = allStates.find((s) => s.slug === slug);
  if (!state) return {};

  const title = `Franchise Your Business in ${state.name} (2026 Guide) | The Franchisor Blueprint`;
  const description = `How to franchise a business in ${state.name}: FDD registration requirements, agency, fees, timeline, and the operator-pool dynamics that determine which franchise concepts work in ${state.name}.`;

  return {
    title,
    description,
    alternates: { canonical: `/franchise-your-business-in/${state.slug}` },
    openGraph: {
      title,
      description,
      type: "article",
      authors: ["Jason Stowe"],
    },
  };
}

export default async function StatePage({ params }: { params: Params }) {
  const { state: slug } = await params;
  const state = allStates.find((s) => s.slug === slug);
  if (!state) return notFound();

  const isRegistration = state.tier === "full" || state.tier === "notice";
  const recommendedIndustries = (state.recommendedIndustrySlugs ?? [])
    .map((s) => allIndustries.find((i) => i.slug === s))
    .filter((i): i is NonNullable<typeof i> => Boolean(i));

  const url = `${SITE_URL}/franchise-your-business-in/${state.slug}`;

  const faqs = buildFaqs(state);

  return (
    <>
      <JsonLd data={breadcrumbSchema([
        { name: "Home", url: "/" },
        { name: "Franchise by State", url: "/franchise-by-state" },
        { name: state.name, url: `/franchise-your-business-in/${state.slug}` },
      ])} />
      <JsonLd data={faqPageSchema(faqs)} />
      <JsonLd
        data={serviceSchema({
          id: `franchise-development-${state.slug}`,
          name: `Franchise Development Consulting — ${state.name}`,
          description: `Franchise development consulting and FDD preparation guidance for businesses franchising in ${state.name}.`,
          price: 2997,
          url: `/franchise-your-business-in/${state.slug}`,
          category: `Franchise development consulting in ${state.name}`,
        })}
      />

      <SiteNav />

      <div className="bg-grey-1/50">
        {/* ─── Hero ─────────────────────────────────────────────────── */}
        <header className="max-w-[920px] mx-auto px-6 md:px-8 pt-12 md:pt-16">
          <nav aria-label="Breadcrumb" className="mb-6 text-xs text-grey-4 tracking-wide">
            <Link href="/" className="hover:text-gold transition-colors">Home</Link>
            <span className="mx-2 opacity-40">/</span>
            <Link href="/franchise-by-state" className="hover:text-gold transition-colors">Franchise by State</Link>
            <span className="mx-2 opacity-40">/</span>
            <span className="text-navy">{state.name}</span>
          </nav>

          <div className="text-gold-warm font-bold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1 inline-block">
            {TIER_LABEL[state.tier]}
          </div>

          <h1 className="text-navy text-3xl md:text-5xl font-extrabold leading-[1.1] tracking-tight mb-5">
            How to Franchise a Business in {state.name}
          </h1>

          <p className="text-grey-3 text-lg md:text-xl leading-relaxed mb-6 font-light">
            {state.hookFact}
          </p>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-grey-4 pb-8 mb-2 border-b border-navy/10">
            <span className="flex items-center gap-1.5">
              <MapPin size={14} className="text-gold" /> {state.topMetros.slice(0, 3).join(" · ")}
            </span>
            <span className="flex items-center gap-1.5">
              <Building2 size={14} className="text-gold" />
              ~{state.populationMillions.toFixed(1)}M residents
            </span>
            {isRegistration && state.reviewTimeWeeks && (
              <span className="flex items-center gap-1.5">
                <Clock size={14} className="text-gold" />
                {state.reviewTimeWeeks.min}-{state.reviewTimeWeeks.max} week first-cycle review
              </span>
            )}
          </div>
        </header>

        {/* ─── Body ─────────────────────────────────────────────────── */}
        <div className="max-w-[920px] mx-auto px-6 md:px-8 py-10 md:py-14 space-y-10">
          {/* TL;DR / Quick facts */}
          <section className="bg-white rounded-2xl p-6 md:p-8 border border-navy/10 shadow-sm">
            <h2 className="text-navy text-2xl font-bold mb-5">
              Quick facts: franchising in {state.name}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <FactRow label="Regulatory tier" value={TIER_LABEL[state.tier]} />
              {state.agency && <FactRow label="Regulating agency" value={state.agency} />}
              {state.initialFilingFee !== undefined && (
                <FactRow
                  label="Initial filing fee"
                  value={`$${state.initialFilingFee.toLocaleString()}`}
                />
              )}
              {state.renewalFee !== undefined && (
                <FactRow
                  label="Renewal fee"
                  value={`$${state.renewalFee.toLocaleString()} (${state.renewalCadence ?? "annual"})`}
                />
              )}
              {state.reviewTimeWeeks && (
                <FactRow
                  label="First-cycle review"
                  value={`${state.reviewTimeWeeks.min}-${state.reviewTimeWeeks.max} weeks`}
                />
              )}
              <FactRow label="Top metros" value={state.topMetros.join(", ")} />
              <FactRow label="Strongest sectors" value={state.industryStrengths.join(", ")} />
              <FactRow label="Population" value={`${state.populationMillions.toFixed(1)}M`} />
            </div>
          </section>

          {/* Section 1: What franchising looks like in this state */}
          <section>
            <h2 className="text-navy text-2xl md:text-3xl font-bold mb-4 leading-tight">
              What franchising looks like in {state.name}
            </h2>
            <p className="text-grey-3 text-base md:text-[17px] leading-[1.75] mb-5">
              {state.name} is a{" "}
              <strong className="text-navy">{TIER_LABEL[state.tier].toLowerCase()}</strong>{" "}
              for franchise sales purposes. {TIER_DESCRIPTION[state.tier]}
            </p>
            {isRegistration && state.agency ? (
              <p className="text-grey-3 text-base md:text-[17px] leading-[1.75] mb-5">
                The state regulator is the{" "}
                <strong className="text-navy">{state.agency}</strong>
                {state.initialFilingFee !== undefined && (
                  <>
                    , with an initial filing fee of{" "}
                    <strong className="text-navy">
                      ${state.initialFilingFee.toLocaleString()}
                    </strong>
                  </>
                )}
                {state.renewalFee !== undefined && (
                  <>
                    {" "}
                    and a renewal fee of{" "}
                    <strong className="text-navy">
                      ${state.renewalFee.toLocaleString()}
                    </strong>{" "}
                    ({state.renewalCadence ?? "annual"})
                  </>
                )}
                . First-cycle reviews typically run{" "}
                {state.reviewTimeWeeks
                  ? `${state.reviewTimeWeeks.min}-${state.reviewTimeWeeks.max} weeks`
                  : "varies"}{" "}
                from initial submission to approval, depending on FDD quality and the
                examiner's queue.
              </p>
            ) : (
              <p className="text-grey-3 text-base md:text-[17px] leading-[1.75] mb-5">
                {state.name} requires no state-specific franchise registration before
                sale, but franchisors selling here must still comply with the federal{" "}
                <Link href="/blog/franchise-disclosure-document-explained" className="text-navy font-semibold underline decoration-gold/60 underline-offset-4 hover:text-gold">
                  FTC Franchise Rule
                </Link>{" "}
                — meaning a current, compliant FDD must be delivered to every prospect
                at least 14 calendar days before they sign or pay.
              </p>
            )}

            <h3 className="text-navy text-xl md:text-2xl font-bold mt-8 mb-3">
              What's actually distinctive about {state.name}
            </h3>
            <ul className="text-grey-3 text-base md:text-[17px] leading-[1.75] mb-5 pl-6 space-y-2 list-disc marker:text-gold">
              {state.uniqueFacts.map((fact, i) => (
                <li key={i} className="pl-1">
                  {fact}
                </li>
              ))}
            </ul>

            <blockquote className="border-l-4 border-gold pl-6 py-2 my-7 italic text-navy text-lg md:text-xl font-light">
              "{state.jasonNote}"
              <cite className="block mt-2 text-sm text-grey-4 not-italic">
                — Jason Stowe, Founder
              </cite>
            </blockquote>
          </section>

          {/* InlineCTA at ~60% mark */}
          <InlineCTA
            eyebrow={`${state.name} franchise strategy`}
            title={`Talk through your ${state.name} franchise registration plan`}
            body={`In a 30-minute strategy call, we'll map out your ${state.name} timeline — what you'll file, what your attorney will need from you, and which markets in the state are best aligned with your concept. No pitch, no pressure.`}
            href="/strategy-call"
            ctaLabel="Book a 30-min strategy call"
          />

          {/* Section 2: Industries that work here */}
          {recommendedIndustries.length > 0 && (
            <section>
              <h2 className="text-navy text-2xl md:text-3xl font-bold mb-4 leading-tight">
                Strongest franchise categories in {state.name}
              </h2>
              <p className="text-grey-3 text-base md:text-[17px] leading-[1.75] mb-6">
                Based on operator demographics, regional economic structure, and historical
                franchise unit growth in {state.name}, these categories have consistently
                performed well for emerging franchisors entering this market:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {recommendedIndustries.map((ind) => (
                  <Link
                    key={ind.slug}
                    href={`/franchise-your/${ind.slug}/business`}
                    className="block bg-white rounded-xl p-5 border border-navy/10 hover:border-gold hover:shadow-md transition-all group"
                  >
                    <div className="text-gold-warm text-[10px] tracking-[0.18em] uppercase font-bold mb-2">
                      {ind.category}
                    </div>
                    <h3 className="text-navy font-bold text-base mb-2 group-hover:text-gold transition-colors">
                      {ind.name}
                    </h3>
                    <p className="text-grey-4 text-xs leading-relaxed">
                      {ind.royaltyRangePct.min}-{ind.royaltyRangePct.max}% royalty ·{" "}
                      {ind.unitEbitdaPct.min}-{ind.unitEbitdaPct.max}% unit EBITDA
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Section 3: What it costs */}
          <section>
            <h2 className="text-navy text-2xl md:text-3xl font-bold mb-4 leading-tight">
              What it costs to franchise into {state.name}
            </h2>
            <p className="text-grey-3 text-base md:text-[17px] leading-[1.75] mb-5">
              Beyond the development cost of preparing your FDD, the {state.name}-specific
              line items to budget for:
            </p>
            <div className="overflow-x-auto my-6 rounded-lg border border-navy/10 shadow-sm">
              <table className="w-full border-collapse text-sm md:text-[15px]">
                <thead className="bg-navy text-white">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Cost item</th>
                    <th className="text-left px-4 py-3 font-semibold">Amount (2026 USD)</th>
                  </tr>
                </thead>
                <tbody className="[&>tr:nth-child(even)]:bg-grey-1/40">
                  {state.initialFilingFee !== undefined && (
                    <tr className="border-b border-navy/5">
                      <td className="px-4 py-3 text-grey-3">Initial state filing fee</td>
                      <td className="px-4 py-3 text-grey-3 font-medium">
                        ${state.initialFilingFee.toLocaleString()}
                      </td>
                    </tr>
                  )}
                  {state.renewalFee !== undefined && (
                    <tr className="border-b border-navy/5">
                      <td className="px-4 py-3 text-grey-3">
                        Renewal fee ({state.renewalCadence ?? "annual"})
                      </td>
                      <td className="px-4 py-3 text-grey-3 font-medium">
                        ${state.renewalFee.toLocaleString()}
                      </td>
                    </tr>
                  )}
                  <tr className="border-b border-navy/5">
                    <td className="px-4 py-3 text-grey-3">Franchise attorney (FDD prep)</td>
                    <td className="px-4 py-3 text-grey-3 font-medium">$5,000 – $15,000</td>
                  </tr>
                  <tr className="border-b border-navy/5">
                    <td className="px-4 py-3 text-grey-3">Trademark federal registration</td>
                    <td className="px-4 py-3 text-grey-3 font-medium">$250 – $350 / class</td>
                  </tr>
                  <tr className="border-b border-navy/5">
                    <td className="px-4 py-3 text-grey-3">Audited financial statements</td>
                    <td className="px-4 py-3 text-grey-3 font-medium">$2,500 – $5,500</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-grey-3">
                      Franchise development consulting
                    </td>
                    <td className="px-4 py-3 text-grey-3 font-medium">
                      $2,997 – $80,000+
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-grey-3 text-base md:text-[17px] leading-[1.75] mb-5">
              For the full breakdown of franchise development costs across paths and tiers,
              see{" "}
              <Link
                href="/blog/the-real-cost-of-franchising-your-business"
                className="text-navy font-semibold underline decoration-gold/60 underline-offset-4 hover:text-gold"
              >
                The Real Cost of Franchising Your Business in 2026
              </Link>
              .
            </p>
          </section>

          {/* Section 4: Common pitfalls */}
          <section>
            <h2 className="text-navy text-2xl md:text-3xl font-bold mb-4 leading-tight">
              Common pitfalls when franchising in {state.name}
            </h2>
            <ul className="text-grey-3 text-base md:text-[17px] leading-[1.75] mb-5 space-y-3">
              {isRegistration ? (
                <>
                  <li className="pl-1 flex gap-3">
                    <Check size={18} className="text-gold mt-1.5 flex-shrink-0" />
                    <span>
                      <strong className="text-navy">Underestimating review timelines.</strong>{" "}
                      First-cycle reviews of{" "}
                      {state.reviewTimeWeeks
                        ? `${state.reviewTimeWeeks.min}-${state.reviewTimeWeeks.max} weeks`
                        : "the typical range"}{" "}
                      are common. Plan accordingly — don't promise franchise sales 30 days
                      after attorney engagement.
                    </span>
                  </li>
                  <li className="pl-1 flex gap-3">
                    <Check size={18} className="text-gold mt-1.5 flex-shrink-0" />
                    <span>
                      <strong className="text-navy">
                        Skipping {state.name}-specific addendum language.
                      </strong>{" "}
                      Each registration state requires specific addendum provisions in
                      the franchise agreement. Generic templates often get rejected.
                    </span>
                  </li>
                </>
              ) : (
                <>
                  <li className="pl-1 flex gap-3">
                    <Check size={18} className="text-gold mt-1.5 flex-shrink-0" />
                    <span>
                      <strong className="text-navy">
                        Treating "no state registration" as "no state law."
                      </strong>{" "}
                      {state.name} may have franchise relationship statutes or business
                      opportunity laws that affect franchise agreement provisions even
                      without a registration filing. Verify with counsel.
                    </span>
                  </li>
                </>
              )}
              <li className="pl-1 flex gap-3">
                <Check size={18} className="text-gold mt-1.5 flex-shrink-0" />
                <span>
                  <strong className="text-navy">
                    Using national Item 7 ranges without local validation.
                  </strong>{" "}
                  Real estate, labor, and operating costs in {state.name} may differ
                  materially from your existing markets. Build a {state.name}-specific
                  pro forma before disclosing.
                </span>
              </li>
              <li className="pl-1 flex gap-3">
                <Check size={18} className="text-gold mt-1.5 flex-shrink-0" />
                <span>
                  <strong className="text-navy">
                    Selling to candidates outside the right operator profile.
                  </strong>{" "}
                  {state.name}'s strongest categories ({state.industryStrengths.join(", ")})
                  attract specific candidate types. Generic recruitment risks selling to
                  the wrong operator and damaging your future Item 19 numbers.
                </span>
              </li>
            </ul>
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
                    <FileText
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
              Ready to franchise in {state.name}?
            </div>
            <h2 className="text-white text-3xl md:text-4xl font-bold mb-4 leading-tight">
              Get an honest read on your {state.name} expansion plan
            </h2>
            <p className="text-white/80 mb-6 max-w-2xl mx-auto leading-relaxed">
              Thirty minutes with someone who's built franchise systems for 30 years.
              We'll look at your business, your timeline, and what it'll take to be selling
              franchises in {state.name} — without the sales pitch.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/strategy-call"
                className="inline-flex items-center justify-center gap-2 bg-gold text-navy font-bold px-6 py-3 rounded-lg hover:bg-gold-warm transition-all"
              >
                Book a 30-min strategy call
                <ArrowRight size={18} strokeWidth={2.5} />
              </Link>
              <Link
                href="/assessment"
                className="inline-flex items-center justify-center gap-2 border border-white/40 text-white font-bold px-6 py-3 rounded-lg hover:bg-white/10 transition-colors"
              >
                Take the readiness assessment
              </Link>
            </div>
          </section>

          {/* Related blog content */}
          <section className="border-t border-navy/10 pt-8">
            <h2 className="text-navy text-xl font-bold mb-4">Related guides</h2>
            <ul className="space-y-2 text-base">
              <li>
                <Link
                  href="/blog/franchise-disclosure-document-explained"
                  className="text-navy underline decoration-gold/60 underline-offset-4 hover:text-gold"
                >
                  The Franchise Disclosure Document (FDD) Explained: All 23 Items in Plain English
                </Link>
              </li>
              <li>
                <Link
                  href="/blog/is-my-business-ready-to-franchise"
                  className="text-navy underline decoration-gold/60 underline-offset-4 hover:text-gold"
                >
                  Is My Business Ready to Franchise? A 10-Point Checklist
                </Link>
              </li>
              <li>
                <Link
                  href="/blog/the-real-cost-of-franchising-your-business"
                  className="text-navy underline decoration-gold/60 underline-offset-4 hover:text-gold"
                >
                  The Real Cost of Franchising Your Business in 2026
                </Link>
              </li>
              <li>
                <Link
                  href="/blog/franchise-royalty-rate-benchmarks"
                  className="text-navy underline decoration-gold/60 underline-offset-4 hover:text-gold"
                >
                  How to Set Franchise Royalty Rates: Industry Benchmarks by Sector
                </Link>
              </li>
            </ul>
          </section>
        </div>
      </div>

      <SiteFooter />
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

function buildFaqs(state: FranchiseState) {
  const isReg = state.tier === "full" || state.tier === "notice";
  return [
    {
      q: `Do I need to register my FDD in ${state.name}?`,
      a: isReg
        ? `Yes. ${state.name} is a ${TIER_LABEL[state.tier].toLowerCase()}. ${TIER_DESCRIPTION[state.tier]} The state regulator is the ${state.agency ?? "applicable state agency"}${
            state.initialFilingFee !== undefined ? `, and the initial filing fee is $${state.initialFilingFee.toLocaleString()}` : ""
          }.`
        : `No state-specific FDD registration is required to sell franchises in ${state.name}. Federal FTC Franchise Rule compliance applies — meaning you must have a current, compliant FDD and deliver it to prospects at least 14 calendar days before signing.`,
    },
    {
      q: `What is the franchise filing fee in ${state.name}?`,
      a: state.initialFilingFee !== undefined
        ? `The initial filing fee in ${state.name} is $${state.initialFilingFee.toLocaleString()}.${
            state.renewalFee !== undefined ? ` The renewal fee is $${state.renewalFee.toLocaleString()} (${state.renewalCadence ?? "annual"}).` : ""
          } Franchise attorney fees for FDD preparation typically run $5,000 to $15,000 separately.`
        : `${state.name} does not have a state-level franchise filing fee. Costs are the federal FDD preparation (typically $5,000 to $15,000 in attorney fees) and any related federal trademark and audit costs.`,
    },
    {
      q: `How long does FDD registration take in ${state.name}?`,
      a: state.reviewTimeWeeks
        ? `First-cycle reviews in ${state.name} typically run ${state.reviewTimeWeeks.min} to ${state.reviewTimeWeeks.max} weeks from initial submission to approval, depending on FDD quality and the regulator's queue. Allow time for one or more rounds of comments before the registration becomes effective.`
        : `${state.name} has no pre-sale state registration process — once your federal FDD is finalized, you can begin selling. Allow 60 to 120 days from attorney engagement to a finalized FDD.`,
    },
    {
      q: `What franchise categories perform well in ${state.name}?`,
      a: `Based on operator demographics and regional economic structure, ${state.industryStrengths.join(", ")} have historically performed well as franchise categories in ${state.name}. Specific brand fit depends on local market saturation and your unit economics.`,
    },
    {
      q: `Should I register my franchise in ${state.name} first or wait until I have demand there?`,
      a: isReg
        ? `Most franchisors register in their home state plus the top 3-5 expansion target states first, then add registration states as their sales pipeline justifies them. ${state.name} is worth registering early if you have any reasonable expectation of operator demand there. Initial registration is the slowest and most expensive cycle; renewals are dramatically cheaper.`
        : `${state.name} requires no state-specific filing, so franchisors can sell here as soon as their federal FDD is finalized. There's no registration timing decision to make beyond your overall FDD readiness.`,
    },
  ];
}

import Link from "next/link";
import type { Metadata } from "next";
import { TrendingUp, CreditCard } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/PageHero";
import { ComparisonTable } from "@/components/ComparisonTable";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbSchema, faqPageSchema, serviceSchema } from "@/lib/schema";
import { AnalyticsLink } from "@/components/AnalyticsLink";
import { SectionViewTracker } from "@/components/SectionViewTracker";

const pricingFaqs = [
  {
    q: "Are legal fees included in the price?",
    a: "No. You'll need to budget separately for a franchise attorney to file your FDD (typically $5,000–$15,000 depending on the attorney and number of states). We can refer you to several affordable, vetted franchise attorneys.",
  },
  {
    q: "What if I need to pause my coaching?",
    a: "We understand business happens. You can pause your Navigator coaching for up to 30 days, once during the program, at no cost.",
  },
  {
    q: "Can I upgrade tiers later?",
    a: "Yes. Start with The Blueprint and we'll credit your full $2,997 toward Navigator if you decide you want the coaching layer.",
  },
  {
    q: "Are there any hidden fees or upsells?",
    a: "No. The price you see is the price you pay. The only thing not included is your franchise attorney's filing fee, which is paid directly to your attorney — not to us.",
  },
  {
    q: "What does it cost to franchise a business?",
    a: "Traditional consulting firms charge $40,000–$80,000+ for documents alone with no ongoing coaching. The Franchisor Blueprint delivers the same complete operating system plus 6 months of 1:1 coaching for $2,997 (DIY) to $29,500 (done-with-you). Plan for an additional $5,000–$15,000 in franchise attorney fees regardless of which firm you choose.",
  },
  {
    q: "What is the ROI on franchising?",
    a: "Most clients recoup their entire program cost on the first franchise sale. Example: a typical initial franchise fee is $45,000; the Navigator program is $8,500; net return on the first sale is $36,500 — plus ongoing royalties on every unit. Most franchisors break even on total development costs in less than 12 months.",
  },
];

export const metadata: Metadata = {
  title: "Pricing | The Franchisor Blueprint | From $2,997",
  description:
    "Transparent pricing. No hidden fees. The Blueprint ($2,997 DIY), Navigator ($8,500 with 6-month coaching), Builder ($29,500 done-with-you). See the full value stack and ROI.",
};

const valueStack = [
  { item: "Codify Your Operations (17-chapter manual)", value: "$10,000" },
  { item: "Train Your Team to Replicate (certification program)", value: "$5,000" },
  { item: "Decode the FDD (all 23 federal items)", value: "$5,000" },
  { item: "Score Real Estate Like a Franchisor (scoring system)", value: "$3,500" },
  { item: "Close Discovery Day (29-slide deck)", value: "$3,500" },
  { item: "Qualify Every Candidate (scoring matrix)", value: "$2,500" },
  { item: "Build Your 12-Month Roadmap (Gantt chart)", value: "$1,500" },
  { item: "Model Your Unit Economics (pro forma + Items 7/19)", value: "$1,500" },
  { item: "Audit Your Business (150-point checklist)", value: "$1,000" },
];

export default function PricingPage() {
  return (
    <>
      <JsonLd data={faqPageSchema(pricingFaqs)} />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Pricing", url: "/pricing" },
        ])}
      />
      <JsonLd
        data={serviceSchema({
          id: "the-blueprint",
          name: "The Blueprint — DIY Franchise Development Kit ($2,997)",
          description:
            "Tier 1: complete 9-framework franchisor operating system. 60-min onboarding call. 30 days email support. Lifetime access to system updates.",
          price: 2997,
          url: "/programs/blueprint",
        })}
      />
      <JsonLd
        data={serviceSchema({
          id: "navigator",
          name: "Navigator — 6-Month Coached Franchise Development ($8,500)",
          description:
            "Tier 2: complete operating system plus 6 months of 1:1 weekly coaching, document review, milestone gates, attorney/CPA referrals, Franchise Ready certification.",
          price: 8500,
          url: "/pricing",
          category: "Franchise development consulting with coaching",
        })}
      />
      <JsonLd
        data={serviceSchema({
          id: "builder",
          name: "Builder — Done-With-You Franchise Development ($29,500)",
          description:
            "Tier 3: 12-month done-with-you build. Vendor and attorney coordination. First franchisee recruitment assistance.",
          price: 29500,
          url: "/pricing",
          category: "Franchise development done-with-you service",
        })}
      />
      <SiteNav />

      <PageHero
        eyebrow="Pricing"
        title="Transparent Pricing. Incredible Value."
        subtitle="You should know exactly what your investment is upfront. No hidden fees. No “call for pricing” games."
      />

      {/* ===== Pricing Cards ===== */}
      <section className="bg-white py-24 md:py-28">
        <div className="max-w-[1200px] mx-auto px-8">
          <div className="grid md:grid-cols-3 gap-7 items-stretch">
            {/* Tier 1 */}
            <SectionViewTracker
              event="view_item"
              params={{
                item_id: "the-blueprint",
                item_name: "The Blueprint",
                price: 2997,
                page_location: "pricing_page",
              }}
              className="h-full"
            >
            <div className="h-full bg-white rounded-2xl p-10 text-left flex flex-col border border-navy/10 shadow-[0_12px_36px_rgba(30,58,95,0.18)] hover:-translate-y-1 hover:shadow-[0_24px_50px_rgba(30,58,95,0.24)] transition-all relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gold" aria-hidden />
              <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-gold-warm mb-2">
                Tier 1 — DIY
              </div>
              <h3 className="text-3xl font-bold mb-4">The Blueprint</h3>
              <div className="text-5xl font-extrabold text-navy leading-none mb-1 tracking-tight">$2,997</div>
              <div className="text-grey-4 text-sm mb-1">Save 5% when you pay in full · or $1,100/mo × 3</div>
              <div className="text-gold-warm text-xs font-semibold tracking-[0.08em] uppercase mb-5">5% off pay-in-full</div>
              <p className="text-grey-3 text-[15px] italic mb-6">For the self-starter who just needs the tools.</p>
              <ul className="list-none flex-1 mb-8 space-y-2">
                {[
                  "The Complete Operating System (9 frameworks)",
                  "60-Min White-Glove Onboarding Call",
                  "Self-Paced Implementation Guides",
                  "30 Days Email Support",
                ].map((f) => (
                  <li key={f} className="text-sm text-[#333] flex gap-2.5 items-start">
                    <span className="flex-shrink-0 mt-2 w-1.5 h-1.5 rounded-full bg-gold" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <AnalyticsLink
                href="/programs/blueprint"
                trackEvent="select_item"
                trackParams={{
                  item_id: "the-blueprint",
                  item_name: "The Blueprint",
                  price: 2997,
                  cta_location: "pricing_page_card",
                }}
                className="block w-full text-center bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-6 py-4 rounded-full hover:bg-gold-dark transition-colors"
              >
                Buy the Blueprint
              </AnalyticsLink>
              <p className="text-center text-grey-4 text-xs italic mt-3">
                <span className="font-semibold text-navy/70">+$2,000</span> to add 4 coaching calls (
                <AnalyticsLink
                  href="/programs/blueprint"
                  trackEvent="select_item"
                  trackParams={{
                    item_id: "blueprint-plus",
                    item_name: "Blueprint Plus",
                    price: 4997,
                    cta_location: "pricing_page_blueprint_plus_hint",
                  }}
                  className="text-gold-warm font-semibold underline hover:text-navy"
                >
                  Blueprint Plus, $4,997
                </AnalyticsLink>
                )
              </p>
            </div>
            </SectionViewTracker>

            {/* Tier 2 */}
            <SectionViewTracker
              event="view_item"
              params={{
                item_id: "navigator",
                item_name: "Navigator",
                price: 8500,
                page_location: "pricing_page",
              }}
              className="h-full"
            >
            <div className="h-full bg-white rounded-2xl p-10 pt-10 text-left flex flex-col relative shadow-[0_24px_60px_rgba(30,58,95,0.28)] ring-1 ring-gold/30 md:-translate-y-4 hover:md:-translate-y-5 transition-all">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gold text-navy px-5 py-1.5 rounded-full text-[11px] font-extrabold tracking-[0.14em] whitespace-nowrap">
                MOST POPULAR
              </div>
              <div className="bg-navy text-white -mx-10 -mt-10 mb-6 px-10 py-5 rounded-t-2xl">
                <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-gold mb-1">Tier 2</div>
                <h3 className="text-3xl font-bold text-white mb-0">Navigator</h3>
              </div>
              <div className="text-5xl font-extrabold text-navy leading-none mb-1 tracking-tight">$8,500</div>
              <div className="text-grey-4 text-sm mb-1">Save 5% when you pay in full · or $3,200/mo × 3</div>
              <div className="text-gold-warm text-xs font-semibold tracking-[0.08em] uppercase mb-5">5% off pay-in-full</div>
              <p className="text-grey-3 text-[15px] italic mb-6">
                The system + 6 months of expert coaching.
              </p>
              <ul className="list-none flex-1 mb-8 space-y-2">
                {[
                  "Everything in The Blueprint",
                  "24 Weekly Coaching Calls",
                  "Document Review & Feedback",
                  "Monthly Milestone Gates",
                  "Unlimited Email/Slack Support",
                  "Attorney & CPA Referral Network",
                  "“Franchise Ready” Certification",
                ].map((f) => (
                  <li key={f} className="text-sm text-[#333] flex gap-2.5 items-start">
                    <span className="flex-shrink-0 mt-2 w-1.5 h-1.5 rounded-full bg-gold" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <AnalyticsLink
                href="/strategy-call"
                trackEvent="select_item"
                trackParams={{
                  item_id: "navigator",
                  item_name: "Navigator",
                  price: 8500,
                  cta_location: "pricing_page_card",
                }}
                className="block w-full text-center bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-6 py-4 rounded-full hover:bg-gold-dark transition-colors"
              >
                Talk to Us First
              </AnalyticsLink>
            </div>
            </SectionViewTracker>

            {/* Tier 3 */}
            <SectionViewTracker
              event="view_item"
              params={{
                item_id: "builder",
                item_name: "Builder",
                price: 29500,
                page_location: "pricing_page",
              }}
              className="h-full"
            >
            <div className="h-full bg-white rounded-2xl p-10 text-left flex flex-col border border-navy/10 shadow-[0_12px_36px_rgba(30,58,95,0.18)] hover:-translate-y-1 hover:shadow-[0_24px_50px_rgba(30,58,95,0.24)] transition-all relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-navy" aria-hidden />
              <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-gold-warm mb-2">
                Tier 3 — Done-With-You
              </div>
              <h3 className="text-3xl font-bold mb-4">Builder</h3>
              <div className="text-5xl font-extrabold text-navy leading-none mb-1 tracking-tight">$29,500</div>
              <div className="text-grey-4 text-sm mb-1">Save 5% when you pay in full · or $13,000 down + $3,000/mo × 6</div>
              <div className="text-gold-warm text-xs font-semibold tracking-[0.08em] uppercase mb-5">5% off pay-in-full</div>
              <p className="text-grey-3 text-[15px] italic mb-6">We build it for you. Done-with-you service.</p>
              <ul className="list-none flex-1 mb-8 space-y-2">
                {[
                  "Everything in Navigator",
                  "Done-With-You Build",
                  "12-Month Engagement",
                  "Vendor & Attorney Coordination",
                  "First franchisee recruitment assist",
                ].map((f) => (
                  <li key={f} className="text-sm text-[#333] flex gap-2.5 items-start">
                    <span className="flex-shrink-0 mt-2 w-1.5 h-1.5 rounded-full bg-gold" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <AnalyticsLink
                href="/strategy-call/builder"
                trackEvent="select_item"
                trackParams={{
                  item_id: "builder",
                  item_name: "Builder",
                  price: 29500,
                  cta_location: "pricing_page_card",
                }}
                className="block w-full text-center bg-navy text-white font-bold text-sm uppercase tracking-[0.1em] px-6 py-4 rounded-full hover:bg-navy-dark transition-colors"
              >
                Book Your Fit Call
              </AnalyticsLink>
            </div>
            </SectionViewTracker>
          </div>
        </div>
      </section>

      {/* ===== Value Stack ===== */}
      <section className="bg-cream py-24 md:py-28">
        <div className="max-w-[1100px] mx-auto px-8">
          <div className="text-center mb-12">
            <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
              What You&apos;re Actually Getting
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mb-5 max-w-[860px] mx-auto">
              Total System Value: $33,500+
            </h2>
            <p className="text-lg text-grey-3 max-w-[760px] mx-auto">
              For a starting price of $2,997, you get access to intellectual property that cost tens of thousands of dollars and three decades of franchise experience to develop.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-navy/10 shadow-[0_10px_30px_rgba(30,58,95,0.10)] overflow-hidden max-w-[820px] mx-auto">
            {valueStack.map((row, i) => (
              <div
                key={row.item}
                className={`flex items-center justify-between px-6 md:px-8 py-4 md:py-5 ${
                  i % 2 === 0 ? "bg-white" : "bg-grey-1/40"
                }`}
              >
                <div className="text-navy font-semibold text-sm md:text-[15px]">{row.item}</div>
                <div className="text-gold-warm font-extrabold text-base md:text-lg tabular-nums">
                  {row.value}
                </div>
              </div>
            ))}
            <div className="bg-navy text-white flex items-center justify-between px-6 md:px-8 py-5 md:py-6">
              <div className="font-extrabold text-base md:text-lg tracking-wide">TOTAL VALUE</div>
              <div className="text-gold font-extrabold text-2xl md:text-3xl tabular-nums">$33,500+</div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Comparison ===== */}
      <section className="bg-white py-24 md:py-28">
        <div className="max-w-[1200px] mx-auto px-8">
          <div className="text-center mb-14">
            <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
              How We Compare
            </span>
            <h2 className="text-3xl md:text-5xl font-bold">
              The Smarter Middle Path
            </h2>
          </div>
          <ComparisonTable />
        </div>
      </section>

      {/* ===== ROI Section ===== */}
      <section className="bg-blueprint text-white py-24 md:py-28">
        <div className="max-w-[1100px] mx-auto px-8">
          <div className="text-center mb-12">
            <span className="inline-block text-gold font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
              The ROI of Franchising
            </span>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-5">
              Franchising Is an Investment, Not a Cost
            </h2>
            <p className="text-lg text-white/80 max-w-[760px] mx-auto">
              With Navigator at $8,500, most clients recoup their entire investment with their very first franchise sale.
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 md:p-12 max-w-[760px] mx-auto">
            <div className="flex items-center gap-3 text-gold mb-6">
              <TrendingUp size={22} />
              <span className="text-xs font-bold tracking-[0.18em] uppercase">
                Example ROI on Sale #1
              </span>
            </div>
            <div className="space-y-4">
              <div className="flex items-baseline justify-between border-b border-white/10 pb-3">
                <span className="text-white/85 text-base">Initial franchise fee (revenue)</span>
                <span className="text-white font-bold text-xl tabular-nums">+$45,000</span>
              </div>
              <div className="flex items-baseline justify-between border-b border-white/10 pb-3">
                <span className="text-white/85 text-base">Navigator program (cost)</span>
                <span className="text-white/70 font-bold text-xl tabular-nums">−$8,500</span>
              </div>
              <div className="flex items-baseline justify-between pt-2">
                <span className="text-gold font-bold text-base tracking-wide uppercase">
                  Net return on sale #1
                </span>
                <span className="text-gold font-extrabold text-3xl tabular-nums">$36,500</span>
              </div>
            </div>
            <p className="mt-8 pt-6 border-t border-white/10 text-white/70 text-sm leading-relaxed">
              Plus <strong className="text-white">ongoing royalties on every unit you sell</strong>. Most franchisors recoup their entire program cost on Sale #1 and break even on total development costs (program + legal + filing) in less than 12 months.
            </p>
          </div>
        </div>
      </section>

      {/* ===== Payment Options ===== */}
      <section className="bg-grey-1 py-24 md:py-28">
        <div className="max-w-[860px] mx-auto px-8">
          <div className="text-center mb-12">
            <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
              Flexible Payment
            </span>
            <h2 className="text-3xl md:text-5xl font-bold">Two Ways to Pay for Every Tier</h2>
            <p className="mt-5 text-grey-3 text-base md:text-lg leading-relaxed">
              Pay in full and save 5%, or break the investment into monthly installments. Same access either way.
            </p>
          </div>

          <div className="bg-white border border-navy/10 rounded-2xl p-8 md:p-10 shadow-[0_8px_24px_rgba(30,58,95,0.08)]">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold mb-5">
              <CreditCard size={22} />
            </div>
            <ul className="space-y-4 text-grey-3 leading-relaxed">
              <li>
                <strong className="text-navy">Tier 1 — The Blueprint ($2,997):</strong> Pay in full and save 5%, or pay $1,100/month for 3 months ($3,300 total). Credit card or ACH.
              </li>
              <li>
                <strong className="text-navy">Tier 2 — Navigator ($8,500):</strong> Pay in full and save 5%, or pay $3,200/month for 3 months ($9,600 total).
              </li>
              <li>
                <strong className="text-navy">Tier 3 — Builder ($29,500):</strong> Pay in full and save 5%, or $13,000 down plus $3,000/month for 6 months ($31,000 total).
              </li>
            </ul>
            <p className="mt-6 text-xs text-grey-4 italic">
              Note: franchise development costs are often tax-deductible business expenses. Consult your CPA.
            </p>
          </div>
        </div>
      </section>

      {/* ===== Pricing FAQ ===== */}
      <section className="bg-white py-24 md:py-28">
        <div className="max-w-[860px] mx-auto px-8">
          <div className="text-center mb-12">
            <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
              Pricing FAQ
            </span>
            <h2 className="text-3xl md:text-5xl font-bold">Common Pricing Questions</h2>
          </div>
          <div className="space-y-6">
            {[
              {
                q: "Are legal fees included in the price?",
                a: "No. You'll need to budget separately for a franchise attorney to file your FDD (typically $5K–$15K depending on the attorney and number of states). We can refer you to several affordable, vetted franchise attorneys.",
              },
              {
                q: "What if I need to pause my coaching?",
                a: "We understand business happens. You can pause your Navigator coaching for up to 30 days, once during the program, at no cost.",
              },
              {
                q: "Can I upgrade tiers later?",
                a: "Yes. Start with The Blueprint and we'll credit your full $2,997 toward Navigator if you decide you want the coaching layer.",
              },
              {
                q: "Are there any hidden fees or upsells?",
                a: "No. The price you see is the price you pay. The only thing not included is your franchise attorney's filing fee, which is paid directly to your attorney — not to us.",
              },
            ].map((f) => (
              <div
                key={f.q}
                className="bg-white border border-navy/10 rounded-2xl p-7 shadow-[0_4px_16px_rgba(30,58,95,0.06)]"
              >
                <h3 className="text-navy font-bold text-lg mb-2">{f.q}</h3>
                <p className="text-grey-3 leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="bg-blueprint text-white text-center py-24 md:py-28">
        <div className="max-w-[1200px] mx-auto px-8">
          <h2 className="text-3xl md:text-6xl font-bold text-white mb-5">
            Not Sure Which Tier Is Right for You?
          </h2>
          <p className="text-lg md:text-xl text-white/85 mb-10 font-light">
            Let&apos;s chat about your goals and budget — no pressure.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/strategy-call"
              className="bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-9 py-4 rounded-full hover:bg-gold-dark transition-colors"
            >
              Book Your Free 30-Min Strategy Call
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}

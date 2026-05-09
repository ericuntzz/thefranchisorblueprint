import Link from "next/link";
import type { Metadata } from "next";
import {
  ListChecks,
  CalendarClock,
  DollarSign,
  BookMarked,
  GraduationCap,
  ScrollText,
  MapPin,
  Users,
  Presentation,
  Check,
} from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/PageHero";
import { HowItWorks } from "@/components/HowItWorks";
import { ComparisonTable } from "@/components/ComparisonTable";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbSchema, serviceSchema } from "@/lib/schema";
import { AnalyticsLink } from "@/components/AnalyticsLink";

export const metadata: Metadata = {
  title: "Programs | The Franchisor Blueprint",
  description:
    "The Blueprint ($2,997 DIY), Navigator ($8,500 coached), Builder ($29,500 done-with-you). Three engagement tiers. One complete franchisor operating system.",
  openGraph: {
    title: "Programs | The Franchisor Blueprint",
    description:
      "Three ways to franchise your business — from $2,997 DIY to $29,500 done-with-you. All built on the same complete franchisor operating system.",
    url: "/programs",
  },
};

const docs = [
  {
    icon: ListChecks,
    title: "Audit Your Business",
    body: "A 150+ item readiness audit covering every detail attorneys and franchisees will ask about — so nothing gets missed when we build your franchise system. Backed by the Comprehensive Fact-Finding Checklist.",
  },
  {
    icon: CalendarClock,
    title: "Build Your 12-Month Roadmap",
    body: "A Gantt chart that keeps your project on track, identifying critical paths and dependencies from day one to launch.",
  },
  {
    icon: DollarSign,
    title: "Model Your Unit Economics",
    body: "Pro forma templates that calculate your FDD Item 7 startup costs and Item 19 financial performance representations — the numbers candidates evaluate before they sign.",
  },
  {
    icon: BookMarked,
    title: "Codify Your Operations",
    body: "A 17-section, 100+ page Operations Manual template — the brand bible franchisees will live by every day.",
  },
  {
    icon: GraduationCap,
    title: "Train Your Team to Replicate",
    body: "Staff training and certification modules so your franchisees can deliver your service quality from day one — without you in the room.",
  },
  {
    icon: ScrollText,
    title: "Decode the FDD",
    body: "All 23 federal disclosure items decoded into plain English — you walk into your franchise attorney prepared, not lost.",
  },
  {
    icon: MapPin,
    title: "Score Real Estate Like a Franchisor",
    body: "A proprietary scoring system that lets your franchisees evaluate real estate objectively — not by gut feel. Backed by the Site Selection & Build-Out Guide.",
  },
  {
    icon: Users,
    title: "Qualify Every Candidate",
    body: "A weighted scoring matrix that lets you objectively qualify or disqualify potential franchisees before you waste a Discovery Day on the wrong fit.",
  },
  {
    icon: Presentation,
    title: "Close Discovery Day",
    body: "A 29-slide sales presentation engineered to convert qualified leads into signed franchise owners.",
  },
];

type TierItemId = "the-blueprint" | "navigator" | "builder";

type Tier = {
  itemId: TierItemId;
  itemPrice: number;
  badge?: string;
  eyebrow: string;
  name: string;
  price: string;
  priceSub: string;
  bestFor: string;
  description: string;
  features: string[];
  cta: { label: string; href: string; style: "gold" | "navy" };
  featured?: boolean;
};

const tiers: Tier[] = [
  {
    itemId: "the-blueprint",
    itemPrice: 2997,
    eyebrow: "Tier 1 — DIY",
    name: "The Blueprint",
    price: "$2,997",
    priceSub: "Save 5% pay-in-full · or $1,100/mo × 3",
    bestFor: "Experienced entrepreneurs who want the tools but don't need the hand-holding.",
    description:
      "You get the complete franchisor operating system with detailed implementation guides for every framework. We kick off with a 60-minute onboarding call to orient you to the materials. From there, you execute at your own pace.",
    features: [
      "The Complete Operating System (9 frameworks)",
      "60-Minute Onboarding Strategy Call",
      "Self-Paced Implementation Guides",
      "30 Days of Email Support",
      "Lifetime access to system updates",
    ],
    cta: { label: "Get the Blueprint", href: "/programs/blueprint", style: "gold" },
  },
  {
    itemId: "navigator",
    itemPrice: 8500,
    badge: "Most Popular",
    eyebrow: "Tier 2",
    name: "Navigator",
    price: "$8,500",
    priceSub: "Save 5% pay-in-full · or $3,200/mo × 3",
    bestFor: "Business owners who want to move fast, avoid mistakes, and have an expert partner.",
    description:
      "A 6-month intensive program. You get the full system, plus we meet weekly to build it together. We review your work, refine your strategy, and ensure you're legally and operationally prepared.",
    features: [
      "Everything in The Blueprint",
      "24 Weekly 1:1 Coaching Calls (6 months)",
      "Document Review & Feedback",
      "Monthly Milestone Gates",
      "Unlimited Email & Slack Support",
      "Attorney & CPA Referral Network",
      "“Franchise Ready” Certification on completion",
    ],
    cta: { label: "Talk to Us First", href: "/strategy-call", style: "gold" },
    featured: true,
  },
  {
    itemId: "builder",
    itemPrice: 29500,
    eyebrow: "Tier 3 — Done-With-You",
    name: "Builder",
    price: "$29,500",
    priceSub: "Save 5% pay-in-full · or $13,000 down + $3,000/mo × 6",
    bestFor: "Established brands with budget who want a done-with-you service.",
    description:
      "We take the lead. We project-manage the entire build, handle vendor management, assist with your first franchisee recruitment, and provide a 12-month engagement.",
    features: [
      "Everything in Navigator",
      "Done-With-You build of all 9 frameworks",
      "12-month engagement",
      "Vendor & attorney coordination",
      "First franchisee recruitment assistance",
      "Priority access to Jason directly",
    ],
    cta: { label: "Book Your Fit Call", href: "/strategy-call/builder", style: "navy" },
  },
];

export default function ProgramsPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Programs", url: "/programs" },
        ])}
      />
      <JsonLd
        data={serviceSchema({
          id: "the-blueprint",
          name: "The Blueprint — DIY Franchise Development Kit",
          description:
            "Tier 1: $2,997 one-time (save 5% pay-in-full or pay $1,100/mo × 3). The complete 9-framework franchisor operating system. 60-min onboarding call. Lifetime access to system updates. Best for experienced operators who want the tools but not the coaching.",
          price: 2997,
          url: "/programs/blueprint",
        })}
      />
      <JsonLd
        data={serviceSchema({
          id: "navigator",
          name: "Navigator — Franchise Development with 6-Month Coaching",
          description:
            "Tier 2: $8,500. Complete operating system + 24 weekly 1:1 coaching calls over 6 months + document review + monthly milestone gates + Franchise Ready certification. The only franchise development program with structured coaching.",
          price: 8500,
          url: "/programs",
          category: "Franchise development consulting with coaching",
        })}
      />
      <JsonLd
        data={serviceSchema({
          id: "builder",
          name: "Builder — Done-With-You Franchise Development",
          description:
            "Tier 3: $29,500. 12-month done-with-you build of the entire franchise system. Vendor and attorney coordination. First franchisee recruitment assist. Priority access to founder Jason Stowe directly.",
          price: 29500,
          url: "/programs",
          category: "Franchise development done-with-you service",
        })}
      />
      <SiteNav />

      <PageHero
        eyebrow="Programs"
        title="Three Ways to Work Together"
        subtitle="Whether you're a do-it-yourselfer or you need hands-on guidance, we have a path for you. All three programs are built on the same complete operating system — nine interlocking frameworks, one $33,500+ foundation."
      />

      {/* ===== Operating System Detail ===== */}
      <section className="bg-white py-24 md:py-28">
        <div className="max-w-[1200px] mx-auto px-8">
          <div className="text-center mb-14">
            <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
              The Foundation
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mb-5 max-w-[900px] mx-auto">
              The Complete Franchisor Operating System — Included in Every Tier
            </h2>
            <p className="text-lg text-grey-3 max-w-[820px] mx-auto">
              Nine interlocking frameworks that take you from &ldquo;I have a profitable business&rdquo; to &ldquo;I&apos;m ready to award my first franchise.&rdquo; Every audit, model, manual, and matrix is production-ready from day one.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {docs.map(({ icon: Icon, title, body }, i) => (
              <div
                key={title}
                className="bg-white p-7 rounded-xl shadow-[0_10px_30px_rgba(30,58,95,0.10)] border border-navy/10 flex gap-4 items-start"
              >
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-navy to-navy-light rounded-xl flex items-center justify-center text-gold">
                  <Icon size={22} />
                </div>
                <div>
                  <div className="text-gold-warm font-semibold text-[11px] tracking-[0.14em] uppercase mb-1">
                    Mastery {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3 className="text-base font-bold text-navy mb-1.5">{title}</h3>
                  <p className="text-grey-3 text-sm leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Tier Deep Dives ===== */}
      <section
        className="py-24 md:py-28 relative overflow-hidden"
        style={{ backgroundColor: "#e3e8f0" }}
      >
        <div className="max-w-[1200px] mx-auto px-8">
          <div className="text-center mb-14">
            <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
              Choose Your Path
            </span>
            <h2 className="text-3xl md:text-5xl font-bold">
              Three Programs. One Outcome: A Franchise You Can Sell.
            </h2>
          </div>

          <div className="space-y-8">
            {tiers.map((t) => (
              <div
                key={t.name}
                className={`relative bg-white rounded-2xl border ${t.featured ? "border-gold/40 shadow-[0_24px_60px_rgba(30,58,95,0.22)]" : "border-navy/10 shadow-[0_12px_36px_rgba(30,58,95,0.14)]"} p-8 md:p-12 grid md:grid-cols-[1.4fr_1fr] gap-8 md:gap-12 items-center`}
              >
                {t.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gold text-navy px-5 py-1.5 rounded-full text-[11px] font-extrabold tracking-[0.14em] whitespace-nowrap">
                    {t.badge.toUpperCase()}
                  </div>
                )}

                <div>
                  <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-gold-warm mb-2">
                    {t.eyebrow}
                  </div>
                  <h3 className="text-3xl md:text-4xl font-bold mb-3">{t.name}</h3>
                  <p className="text-navy/70 text-sm md:text-[15px] font-semibold mb-5">
                    Best for: {t.bestFor}
                  </p>
                  <p className="text-grey-3 text-base leading-relaxed mb-6">{t.description}</p>
                  <ul className="grid sm:grid-cols-2 gap-x-5 gap-y-2.5">
                    {t.features.map((f) => (
                      <li key={f} className="flex gap-2.5 items-start text-sm text-[#333]">
                        <Check className="flex-shrink-0 mt-0.5 text-gold" size={16} strokeWidth={3} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="md:pl-6 md:border-l md:border-navy/10">
                  <div className="text-5xl font-extrabold text-navy leading-none mb-1 tracking-tight">
                    {t.price}
                  </div>
                  <div className="text-grey-4 text-sm mb-6">{t.priceSub}</div>
                  <AnalyticsLink
                    href={t.cta.href}
                    trackEvent="select_item"
                    trackParams={{
                      item_id: t.itemId,
                      item_name: t.name,
                      price: t.itemPrice,
                      cta_location: "programs_page_card",
                    }}
                    className={`block w-full text-center font-bold text-sm uppercase tracking-[0.1em] px-6 py-4 rounded-full transition-colors ${t.cta.style === "gold" ? "bg-gold text-navy hover:bg-gold-dark" : "bg-navy text-white hover:bg-navy-dark"}`}
                  >
                    {t.cta.label}
                  </AnalyticsLink>
                  {t.featured && (
                    <p className="mt-4 text-center text-xs text-grey-3">
                      Engagements begin with a free fit call.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Coaching Process Timeline ===== */}
      <section className="bg-white py-24 md:py-28">
        <div className="max-w-[1100px] mx-auto px-8">
          <div className="text-center mb-16">
            <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
              The Navigator Process
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mb-5 max-w-[860px] mx-auto">
              Your 6-Month Path from Concept to Franchise-Ready
            </h2>
            <p className="text-lg text-grey-3 max-w-[760px] mx-auto">
              Every Navigator engagement runs on this proven cadence. Each month builds on the last, so by month six you have a fully documented, attorney-reviewed, sales-ready franchise system.
            </p>
          </div>
          <HowItWorks />
        </div>
      </section>

      {/* ===== Comparison ===== */}
      <section className="bg-grey-1 py-24 md:py-28">
        <div className="max-w-[1200px] mx-auto px-8">
          <div className="text-center mb-14">
            <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
              How We Compare
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mb-5 max-w-[860px] mx-auto">
              The Smarter Middle Path
            </h2>
          </div>
          <ComparisonTable />
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="bg-white py-24 md:py-28">
        <div className="max-w-[860px] mx-auto px-8">
          <div className="text-center mb-12">
            <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
              Programs FAQ
            </span>
            <h2 className="text-3xl md:text-5xl font-bold">Common Questions About Our Programs</h2>
          </div>
          <div className="space-y-6">
            {[
              {
                q: "What happens after the 6 months of coaching?",
                a: "Most clients are launch-ready by month six. If you want continued support, we offer a month-to-month advisory retainer. There's no obligation to extend.",
              },
              {
                q: "Do you have experience in my industry?",
                a: "Franchise systems are universal. Whether you're in coffee, service, retail, or food — the principles of franchising (consistency, branding, training, legal compliance) are the same. The system adapts to your model.",
              },
              {
                q: "Can I start with The Blueprint and upgrade to Navigator?",
                a: "Absolutely. If you start with Tier 1 and realize you want more support, we credit your full $2,997 toward the price of Navigator. No penalty for starting small.",
              },
              {
                q: "What if I need to pause the coaching?",
                a: "Business happens. You can pause your Navigator coaching for up to 30 days once during the program at no cost.",
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
            Not Sure Which Program Is Right for You?
          </h2>
          <p className="text-lg md:text-xl text-white/85 mb-10 font-light">
            Take the free Franchise Readiness Assessment, or book a strategy call and we&apos;ll help you choose.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/assessment"
              className="bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-9 py-4 rounded-full hover:bg-gold-dark transition-colors"
            >
              Take the Free Assessment
            </Link>
            <Link
              href="/strategy-call"
              className="bg-transparent text-white border-2 border-white font-bold text-sm uppercase tracking-[0.1em] px-9 py-4 rounded-full hover:bg-white hover:text-navy transition-colors"
            >
              Book a Strategy Call
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}

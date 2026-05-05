import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Scale, Users, Settings, Building2, Compass } from "lucide-react";

import { JsonLd } from "@/components/JsonLd";
import { allComparisons, type FranchiseComparison } from "@/lib/franchise-comparisons";
import { breadcrumbSchema, collectionPageSchema } from "@/lib/schema";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Franchise Decision Comparisons: Side-by-Side Guides | The Franchisor Blueprint",
  description:
    "Side-by-side comparisons of the franchise decisions that actually matter — consultant vs attorney, coached program vs traditional firm, buying a franchise vs starting your own. Honest verdicts from 30 years in the industry.",
  alternates: { canonical: "/compare" },
  openGraph: {
    title: "Franchise Comparisons (Side-by-Side Decision Guides)",
    description:
      "The franchise comparisons that determine your path — service providers, engagement models, brands, tiers, and the buy-vs-build question.",
    type: "website",
  },
};

const CATEGORY_ICONS: Record<FranchiseComparison["category"], typeof Scale> = {
  "Service Providers": Users,
  "Engagement Models": Settings,
  Brands: Building2,
  "TFB Tiers": Compass,
  Decisions: Scale,
};

const CATEGORY_DESCRIPTIONS: Record<FranchiseComparison["category"], string> = {
  "Service Providers":
    "Who you hire to help you franchise — and how to sequence the work.",
  "Engagement Models":
    "How franchise development engagements are structured — and what each model actually delivers.",
  Brands:
    "Direct comparisons between franchise development firms.",
  "TFB Tiers":
    "Choosing between The Franchisor Blueprint's coached and done-with-you tiers.",
  Decisions:
    "The strategic decisions that come before — buying versus starting, franchise versus license, etc.",
};

export default function CompareHubPage() {
  // Group by category
  const grouped = (
    [
      "Service Providers",
      "Engagement Models",
      "Brands",
      "TFB Tiers",
      "Decisions",
    ] as const
  )
    .map((cat) => ({
      category: cat,
      description: CATEGORY_DESCRIPTIONS[cat],
      comparisons: allComparisons.filter((c) => c.category === cat),
    }))
    .filter((g) => g.comparisons.length > 0);

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Compare", url: "/compare" },
        ])}
      />
      <JsonLd
        data={collectionPageSchema({
          url: "/compare",
          name: "Franchise Decision Comparisons",
          description:
            "Side-by-side comparisons of the franchise decisions that determine your path — providers, engagement models, brands, and strategic choices.",
          itemCount: allComparisons.length,
          itemUrls: allComparisons.map((c) => `/compare/${c.slug}`),
        })}
      />

      <div className="bg-grey-1/50">
        {/* ─── Hero ─────────────────────────────────────────────────── */}
        <header className="max-w-[1100px] mx-auto px-6 md:px-8 pt-12 md:pt-20 pb-10">
          <nav aria-label="Breadcrumb" className="mb-6 text-xs text-grey-4 tracking-wide">
            <Link href="/" className="hover:text-gold transition-colors">
              Home
            </Link>
            <span className="mx-2 opacity-40">/</span>
            <span className="text-navy">Compare</span>
          </nav>

          <div className="text-gold-warm font-bold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1 inline-block">
            Side-by-Side Comparisons
          </div>

          <h1 className="text-navy text-3xl md:text-5xl font-extrabold leading-[1.1] tracking-tight mb-5 max-w-3xl">
            The Franchise Decisions That Actually Matter
          </h1>

          <p className="text-grey-3 text-lg md:text-xl leading-relaxed mb-8 max-w-3xl font-light">
            Side-by-side comparisons of the choices franchise founders weigh during
            development — service providers, engagement models, competing firms,
            program tiers, and the strategic decisions that come before any of them.
            Each comparison ends with the honest answer.
          </p>
        </header>

        {/* ─── Category Sections ─────────────────────────────────────── */}
        <div className="max-w-[1100px] mx-auto px-6 md:px-8 pb-16 space-y-14">
          {grouped.map((group) => {
            const Icon = CATEGORY_ICONS[group.category];
            return (
              <section key={group.category}>
                <div className="flex items-start gap-4 mb-3">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-navy text-gold flex items-center justify-center">
                    <Icon size={22} strokeWidth={2.2} />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-navy text-2xl md:text-3xl font-bold leading-tight">
                      {group.category}{" "}
                      <span className="text-grey-4 font-normal text-lg ml-1">
                        ({group.comparisons.length})
                      </span>
                    </h2>
                    <p className="text-grey-3 text-sm md:text-base leading-relaxed mt-1.5">
                      {group.description}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  {group.comparisons.map((c) => (
                    <Link
                      key={c.slug}
                      href={`/compare/${c.slug}`}
                      className="group block bg-white rounded-xl p-5 border border-navy/10 hover:border-gold hover:shadow-md transition-all"
                    >
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-navy font-bold text-base">
                          {c.leftName}
                        </span>
                        <span className="text-grey-4 text-xs font-bold uppercase tracking-wider">
                          vs
                        </span>
                        <span className="text-navy font-bold text-base">
                          {c.rightName}
                        </span>
                      </div>
                      <p className="text-grey-4 text-xs leading-relaxed line-clamp-3 mb-3">
                        {c.verdict.split(".")[0]}.
                      </p>
                      <div className="text-gold font-bold text-xs inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                        Read the comparison
                        <ArrowRight size={12} strokeWidth={2.5} />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {/* ─── Closing CTA ────────────────────────────────────────────── */}
        <section className="bg-navy text-white">
          <div className="max-w-[1100px] mx-auto px-6 md:px-8 py-14 md:py-20 text-center">
            <div className="text-gold font-bold text-xs tracking-[0.2em] uppercase mb-3">
              Talk through your decision
            </div>
            <h2 className="text-white text-3xl md:text-4xl font-bold mb-4 leading-tight">
              Get the honest answer for your specific situation
            </h2>
            <p className="text-white/80 mb-6 max-w-2xl mx-auto leading-relaxed">
              Thirty minutes with someone who's built franchise systems for 30 years.
              We'll look at your business and tell you which path actually fits — without
              the sales pitch.
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
          </div>
        </section>
      </div>
    </>
  );
}

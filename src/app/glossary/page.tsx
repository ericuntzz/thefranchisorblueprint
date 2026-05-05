import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Briefcase, DollarSign, Users, Cog, Building2 } from "lucide-react";

import { JsonLd } from "@/components/JsonLd";
import {
  allGlossaryTerms,
  CATEGORY_ORDER,
  CATEGORY_DESCRIPTION,
  type GlossaryCategory,
} from "@/lib/franchise-glossary";
import { breadcrumbSchema, faqPageSchema } from "@/lib/schema";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title:
    "Franchise Glossary: 30+ Franchise Terms Explained in Plain English | The Franchisor Blueprint",
  description:
    "Plain-English definitions of the franchise terms that matter — FDD, royalty, Item 7, Item 19, Discovery Day, master franchise, area developer, and more. Written by Jason Stowe, 30 years in the franchise industry.",
  alternates: { canonical: "/glossary" },
  openGraph: {
    title: "The Franchise Glossary (30+ Terms in Plain English)",
    description:
      "Every franchise term every franchisor needs to know — defined, contextualized, and cross-linked to deeper guides.",
    type: "website",
  },
};

const CATEGORY_ICONS: Record<GlossaryCategory, typeof BookOpen> = {
  "FDD & Legal": BookOpen,
  Financial: DollarSign,
  "Sales & Discovery": Users,
  Operations: Cog,
  Structure: Building2,
};

const FAQS = [
  {
    q: "What is a franchise in plain English?",
    a: "A franchise is a business arrangement where one party (the franchisee) pays another (the franchisor) for the right to operate a unit of the franchisor's business — using their brand, system, and ongoing support. Under the FTC Franchise Rule, an arrangement is legally a franchise if it combines three elements: a trademark license, significant operational control or assistance from the franchisor, and a required fee paid by the franchisee.",
  },
  {
    q: "What's the difference between a franchise and a license?",
    a: "A franchise involves ongoing operational control by the franchisor — the franchisee uses the franchisor's system, follows their operations manual, and pays continuing royalties. A license is narrower — typically just the right to use a trademark or specific IP, without the franchisor controlling the operating system. The legal distinction matters: if your 'license' includes trademark + operational control + a required fee, the FTC treats it as a franchise, and selling it without an FDD is a federal violation.",
  },
  {
    q: "What does FDD mean?",
    a: "FDD stands for Franchise Disclosure Document — the federally required legal document that a franchisor must give to every prospective franchisee at least 14 calendar days before signing. The FDD contains 23 specific items covering the franchisor's background, fees, obligations, and historical performance. The FTC Franchise Rule (16 CFR Part 436) makes FDD delivery a federal requirement for any U.S. franchise sale.",
  },
  {
    q: "What's a typical franchise royalty rate?",
    a: "Most U.S. franchise systems charge royalties of 4-8% of gross franchisee revenue, with 5-6% being the most common range. Rates vary by sector: quick-service restaurants typically run 4-6% (thin margins), home services 6-10% (high margins), education franchises 8-12% (recurring revenue, high gross margins). The royalty is paid weekly or monthly throughout the franchise term.",
  },
  {
    q: "How long should I budget to franchise my business?",
    a: "Most successful franchise launches take 6-12 months from first engagement to selling the first franchise. The bulk of that timeline is FDD preparation (60-120 days at the legal layer), state registration filings (3-16 weeks per registration state), and operations manual development (6-12 weeks of focused work). Most coached programs deliver Franchise Ready status in about 6 months.",
  },
];

export default function FranchiseGlossaryPage() {
  // Group terms by category
  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    description: CATEGORY_DESCRIPTION[category],
    terms: allGlossaryTerms
      .filter((t) => t.category === category)
      .sort((a, b) => a.term.localeCompare(b.term)),
  })).filter((g) => g.terms.length > 0);

  // DefinedTermSet schema enumerating all members
  const definedTermSet = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    "@id": `${SITE_URL}/glossary#set`,
    name: "The Franchisor Blueprint Franchise Glossary",
    description:
      "A plain-English glossary of franchise terminology — 30+ definitions covering the FDD, financial concepts, sales motion, operations, and franchise system structure.",
    url: `${SITE_URL}/glossary`,
    inLanguage: "en-US",
    publisher: { "@id": `${SITE_URL}/#organization` },
    hasDefinedTerm: allGlossaryTerms.map((t) => ({
      "@type": "DefinedTerm",
      "@id": `${SITE_URL}/glossary/${t.slug}#term`,
      name: t.term,
      description: t.shortDef,
      url: `${SITE_URL}/glossary/${t.slug}`,
      ...(t.aka && t.aka.length > 0 ? { alternateName: t.aka } : {}),
    })),
  };

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Glossary", url: "/glossary" },
        ])}
      />
      <JsonLd data={definedTermSet} />
      <JsonLd data={faqPageSchema(FAQS)} />

      <div className="bg-grey-1/50">
        {/* ─── Hero ─────────────────────────────────────────────────── */}
        <header className="max-w-[1100px] mx-auto px-6 md:px-8 pt-12 md:pt-20 pb-10">
          <nav aria-label="Breadcrumb" className="mb-6 text-xs text-grey-4 tracking-wide">
            <Link href="/" className="hover:text-gold transition-colors">
              Home
            </Link>
            <span className="mx-2 opacity-40">/</span>
            <span className="text-navy">Glossary</span>
          </nav>

          <div className="text-gold-warm font-bold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1 inline-block">
            Plain-English Definitions
          </div>

          <h1 className="text-navy text-3xl md:text-5xl font-extrabold leading-[1.1] tracking-tight mb-5 max-w-3xl">
            The Franchise Glossary
          </h1>

          <p className="text-grey-3 text-lg md:text-xl leading-relaxed mb-8 max-w-3xl font-light">
            Every franchise term that matters — defined in plain English, with the
            real-world implications operators care about. Written by Jason Stowe,
            three decades in the franchise industry. Cross-linked to long-form guides
            when you want to go deeper.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mt-8">
            <StatCard value={`${allGlossaryTerms.length}`} label="Terms defined" />
            <StatCard value="5" label="Topical categories" />
            <StatCard value="14" label="FDD-specific terms" />
            <StatCard value="100%" label="Plain English" />
          </div>
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
                        ({group.terms.length})
                      </span>
                    </h2>
                    <p className="text-grey-3 text-sm md:text-base leading-relaxed mt-1.5">
                      {group.description}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
                  {group.terms.map((term) => (
                    <Link
                      key={term.slug}
                      href={`/glossary/${term.slug}`}
                      className="group block bg-white rounded-xl p-4 border border-navy/10 hover:border-gold hover:shadow-md transition-all"
                    >
                      <h3 className="text-navy font-bold text-base leading-tight group-hover:text-gold transition-colors mb-1.5">
                        {term.term}
                      </h3>
                      <p className="text-grey-4 text-xs leading-relaxed line-clamp-3">
                        {term.shortDef}
                      </p>
                      <div className="text-gold font-bold text-xs mt-2 inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                        Read full definition
                        <ArrowRight size={12} strokeWidth={2.5} />
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

        {/* ─── Cross-link section ─────────────────────────────────────── */}
        <section className="bg-navy text-white">
          <div className="max-w-[1100px] mx-auto px-6 md:px-8 py-14 md:py-20">
            <div className="grid md:grid-cols-2 gap-10 items-stretch">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-7">
                <Briefcase size={20} className="text-gold mb-3" />
                <div className="text-gold font-bold text-xs tracking-[0.2em] uppercase mb-2">
                  By state
                </div>
                <h2 className="text-white text-2xl font-bold mb-3 leading-tight">
                  See state-specific franchise requirements
                </h2>
                <p className="text-white/80 mb-5 leading-relaxed text-sm">
                  Fifty-one state guides covering FDD registration tier, regulating
                  agency, filing fees, and review timelines for every U.S. state.
                </p>
                <Link
                  href="/franchise-by-state"
                  className="inline-flex items-center gap-2 border border-white/40 text-white font-bold px-5 py-2.5 rounded-lg hover:bg-white/10 transition-colors text-sm"
                >
                  Browse states
                  <ArrowRight size={16} strokeWidth={2.5} />
                </Link>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-7">
                <DollarSign size={20} className="text-gold mb-3" />
                <div className="text-gold font-bold text-xs tracking-[0.2em] uppercase mb-2">
                  By industry
                </div>
                <h2 className="text-white text-2xl font-bold mb-3 leading-tight">
                  See royalty rates and fee structures by sector
                </h2>
                <p className="text-white/80 mb-5 leading-relaxed text-sm">
                  Sixteen sector guides covering royalty ranges, franchise fees, Item 7
                  ranges, unit EBITDA, and common stall patterns.
                </p>
                <Link
                  href="/franchise-by-industry"
                  className="inline-flex items-center gap-2 border border-white/40 text-white font-bold px-5 py-2.5 rounded-lg hover:bg-white/10 transition-colors text-sm"
                >
                  Browse industries
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

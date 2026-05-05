import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, X, Scale, BookOpen } from "lucide-react";

import { JsonLd } from "@/components/JsonLd";
import { InlineCTA } from "@/components/InlineCTA";
import {
  allComparisons,
  type FranchiseComparison,
} from "@/lib/franchise-comparisons";
import { allPosts } from "@/lib/blog";
import { allGlossaryTerms } from "@/lib/franchise-glossary";
import { breadcrumbSchema, faqPageSchema, blogPostingSchema } from "@/lib/schema";
import { SITE_URL } from "@/lib/site";

type Params = Promise<{ topic: string }>;

export async function generateStaticParams() {
  return allComparisons.map((c) => ({ topic: c.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { topic: slug } = await params;
  const c = allComparisons.find((x) => x.slug === slug);
  if (!c) return {};

  return {
    title: c.metaTitle,
    description: c.metaDescription,
    alternates: { canonical: `/compare/${c.slug}` },
    openGraph: {
      title: c.metaTitle,
      description: c.metaDescription,
      type: "article",
      authors: ["Jason Stowe"],
    },
  };
}

export default async function ComparisonPage({ params }: { params: Params }) {
  const { topic: slug } = await params;
  const c = allComparisons.find((x) => x.slug === slug);
  if (!c) return notFound();

  const url = `${SITE_URL}/compare/${c.slug}`;

  // Resolve cross-link targets
  const relatedComparisons = (c.relatedComparisonSlugs ?? [])
    .map((s) => allComparisons.find((x) => x.slug === s))
    .filter((x): x is FranchiseComparison => Boolean(x));
  const relatedBlogPosts = (c.relatedBlogSlugs ?? [])
    .map((s) => allPosts.find((p) => p.slug === s))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const relatedGlossary = (c.relatedGlossarySlugs ?? [])
    .map((s) => allGlossaryTerms.find((g) => g.slug === s))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Compare", url: "/compare" },
          { name: `${c.leftName} vs ${c.rightName}`, url: `/compare/${c.slug}` },
        ])}
      />
      <JsonLd data={faqPageSchema(c.faqs)} />
      <JsonLd
        data={blogPostingSchema({
          slug: c.slug,
          title: c.metaTitle,
          description: c.metaDescription,
          datePublished: "2026-05-04",
          wordCount: 2000,
        })}
      />

      <div className="bg-grey-1/50">
        {/* ─── Hero ─────────────────────────────────────────────────── */}
        <header className="max-w-[920px] mx-auto px-6 md:px-8 pt-12 md:pt-16">
          <nav aria-label="Breadcrumb" className="mb-6 text-xs text-grey-4 tracking-wide">
            <Link href="/" className="hover:text-gold transition-colors">
              Home
            </Link>
            <span className="mx-2 opacity-40">/</span>
            <Link href="/compare" className="hover:text-gold transition-colors">
              Compare
            </Link>
            <span className="mx-2 opacity-40">/</span>
            <span className="text-navy">
              {c.leftName} vs {c.rightName}
            </span>
          </nav>

          <div className="text-gold-warm font-bold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1 inline-block">
            {c.category}
          </div>

          <h1 className="text-navy text-3xl md:text-5xl font-extrabold leading-[1.1] tracking-tight mb-5">
            {c.h1}
          </h1>

          <p className="text-grey-3 text-lg md:text-xl leading-relaxed mb-8 font-light">
            {c.intro}
          </p>

          {/* The two options as side-by-side header cards */}
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            <div className="bg-white rounded-2xl p-6 border-2 border-navy/10">
              <div className="text-gold-warm font-bold text-[10px] tracking-[0.18em] uppercase mb-2">
                Option A
              </div>
              <h2 className="text-navy text-xl md:text-2xl font-bold mb-2 leading-tight">
                {c.leftName}
              </h2>
              <p className="text-grey-3 text-sm leading-relaxed">{c.leftTagline}</p>
            </div>
            <div className="bg-white rounded-2xl p-6 border-2 border-navy/10">
              <div className="text-gold-warm font-bold text-[10px] tracking-[0.18em] uppercase mb-2">
                Option B
              </div>
              <h2 className="text-navy text-xl md:text-2xl font-bold mb-2 leading-tight">
                {c.rightName}
              </h2>
              <p className="text-grey-3 text-sm leading-relaxed">{c.rightTagline}</p>
            </div>
          </div>
        </header>

        {/* ─── Body ─────────────────────────────────────────────────── */}
        <div className="max-w-[920px] mx-auto px-6 md:px-8 py-8 md:py-12 space-y-12">
          {/* Quick verdict */}
          <section className="bg-white border-l-4 border-gold rounded-r-2xl p-6 md:p-8 shadow-sm">
            <div className="flex items-start gap-3 mb-3">
              <Scale size={20} className="text-gold mt-1 flex-shrink-0" />
              <div className="text-gold-warm text-[11px] tracking-[0.2em] uppercase font-bold">
                Quick verdict
              </div>
            </div>
            <p className="text-navy text-lg md:text-xl leading-[1.5] font-medium">
              {c.verdict}
            </p>
          </section>

          {/* Comparison table */}
          <section>
            <h2 className="text-navy text-2xl md:text-3xl font-bold mb-4 leading-tight">
              Side-by-side comparison
            </h2>
            <div className="overflow-x-auto rounded-lg border border-navy/10 shadow-sm">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-navy text-white">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold w-1/4">Dimension</th>
                    <th className="text-left px-4 py-3 font-semibold">{c.leftName}</th>
                    <th className="text-left px-4 py-3 font-semibold">{c.rightName}</th>
                  </tr>
                </thead>
                <tbody className="[&>tr:nth-child(even)]:bg-grey-1/40">
                  {c.comparisonRows.map((row, i) => (
                    <tr key={i} className="border-b border-navy/5 last:border-0">
                      <td className="px-4 py-3 text-navy font-semibold align-top">
                        {row.dimension}
                      </td>
                      <td className="px-4 py-3 text-grey-3 align-top leading-relaxed">
                        {row.left}
                      </td>
                      <td className="px-4 py-3 text-grey-3 align-top leading-relaxed">
                        {row.right}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* When each wins */}
          <section className="grid md:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl p-6 border border-navy/10">
              <div className="flex items-center gap-2 mb-4">
                <Check size={18} className="text-gold" />
                <h3 className="text-navy font-bold text-lg">
                  When {c.leftName} wins
                </h3>
              </div>
              <ul className="space-y-3">
                {c.whenLeftWins.map((item, i) => (
                  <li
                    key={i}
                    className="text-grey-3 text-sm leading-[1.65] flex gap-2 items-start"
                  >
                    <ArrowRight
                      size={14}
                      className="text-gold mt-1 flex-shrink-0"
                      strokeWidth={2.5}
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-navy/10">
              <div className="flex items-center gap-2 mb-4">
                <Check size={18} className="text-gold" />
                <h3 className="text-navy font-bold text-lg">
                  When {c.rightName} wins
                </h3>
              </div>
              <ul className="space-y-3">
                {c.whenRightWins.map((item, i) => (
                  <li
                    key={i}
                    className="text-grey-3 text-sm leading-[1.65] flex gap-2 items-start"
                  >
                    <ArrowRight
                      size={14}
                      className="text-gold mt-1 flex-shrink-0"
                      strokeWidth={2.5}
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* InlineCTA at ~60% mark */}
          <InlineCTA
            eyebrow={c.cta.eyebrow}
            title={c.cta.title}
            body={c.cta.body}
            href={c.cta.href}
            ctaLabel={c.cta.ctaLabel}
          />

          {/* Honest answer */}
          <section>
            <h2 className="text-navy text-2xl md:text-3xl font-bold mb-4 leading-tight">
              The honest answer
            </h2>
            <p className="text-grey-3 text-base md:text-[17px] leading-[1.75]">
              {c.honestAnswer}
            </p>
          </section>

          {/* FAQs */}
          <section>
            <h2 className="text-navy text-2xl md:text-3xl font-bold mb-5 leading-tight">
              Frequently asked questions
            </h2>
            <div className="space-y-4">
              {c.faqs.map((f, i) => (
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

          {/* Related comparisons */}
          {relatedComparisons.length > 0 && (
            <section>
              <h2 className="text-navy text-xl md:text-2xl font-bold mb-4 leading-tight">
                Related comparisons
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {relatedComparisons.map((rc) => (
                  <Link
                    key={rc.slug}
                    href={`/compare/${rc.slug}`}
                    className="group block bg-white rounded-xl p-4 border border-navy/10 hover:border-gold hover:shadow-md transition-all"
                  >
                    <div className="text-gold-warm text-[10px] tracking-[0.18em] uppercase font-bold mb-1.5">
                      {rc.category}
                    </div>
                    <h3 className="text-navy font-bold text-base leading-tight group-hover:text-gold transition-colors mb-1">
                      {rc.leftName} vs {rc.rightName}
                    </h3>
                    <p className="text-grey-4 text-xs leading-relaxed line-clamp-2">
                      {rc.verdict.split(".")[0]}.
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Related blog posts + glossary */}
          {(relatedBlogPosts.length > 0 || relatedGlossary.length > 0) && (
            <section>
              <h2 className="text-navy text-xl md:text-2xl font-bold mb-4 leading-tight">
                Read deeper
              </h2>
              <ul className="space-y-2 text-base">
                {relatedBlogPosts.map((p) => (
                  <li key={p.slug}>
                    <Link
                      href={`/blog/${p.slug}`}
                      className="inline-flex items-center gap-2 text-navy underline decoration-gold/60 underline-offset-4 hover:text-gold transition-colors"
                    >
                      <BookOpen size={14} className="flex-shrink-0" />
                      {p.title}
                    </Link>
                  </li>
                ))}
                {relatedGlossary.map((g) => (
                  <li key={g.slug}>
                    <Link
                      href={`/glossary/${g.slug}`}
                      className="inline-flex items-center gap-2 text-navy underline decoration-gold/60 underline-offset-4 hover:text-gold transition-colors"
                    >
                      <BookOpen size={14} className="flex-shrink-0" />
                      Glossary: {g.term}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

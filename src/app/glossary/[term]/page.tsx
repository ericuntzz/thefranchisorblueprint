import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpen, ExternalLink, Tag } from "lucide-react";

import { JsonLd } from "@/components/JsonLd";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { InlineCTA } from "@/components/InlineCTA";
import {
  allGlossaryTerms,
  getGlossaryTerm,
  type FranchiseGlossaryTerm,
} from "@/lib/franchise-glossary";
import { allPosts } from "@/lib/blog";
import { breadcrumbSchema } from "@/lib/schema";
import { SITE_URL } from "@/lib/site";

type Params = Promise<{ term: string }>;

export async function generateStaticParams() {
  return allGlossaryTerms.map((t) => ({ term: t.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { term: slug } = await params;
  const t = allGlossaryTerms.find((x) => x.slug === slug);
  if (!t) return {};

  const title = `${t.term}: Definition & Meaning in Franchising | The Franchisor Blueprint`;
  const description = t.shortDef;

  return {
    title,
    description,
    alternates: { canonical: `/glossary/${t.slug}` },
    openGraph: {
      title,
      description,
      type: "article",
      authors: ["Jason Stowe"],
    },
  };
}

export default async function GlossaryTermPage({ params }: { params: Params }) {
  const { term: slug } = await params;
  const t = allGlossaryTerms.find((x) => x.slug === slug);
  if (!t) return notFound();

  const url = `${SITE_URL}/glossary/${t.slug}`;
  const definedTerm = buildDefinedTermSchema(t, url);

  // Resolve cross-link targets
  const relatedTerms = (t.relatedTerms ?? [])
    .map((s) => allGlossaryTerms.find((x) => x.slug === s))
    .filter((x): x is FranchiseGlossaryTerm => Boolean(x));
  const relatedBlogPosts = (t.relatedBlogSlugs ?? [])
    .map((s) => allPosts.find((p) => p.slug === s))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  // Tier-aware InlineCTA based on category
  const cta =
    t.category === "Sales & Discovery"
      ? {
          eyebrow: "Recruit your first 10 franchisees",
          title: "Get coaching through your franchise sales funnel",
          body: `Navigator includes weekly coaching specifically on the sales motion — qualification, validation, Discovery Day, the close. Six months of structured guidance most first-time franchisors learn the hard way.`,
          href: "/programs",
          ctaLabel: "Explore Navigator",
        }
      : t.category === "Operations"
        ? {
            eyebrow: "Skip the structural work",
            title: "Get the 17-section Operations Manual template",
            body: `The Blueprint includes the full Operations Manual template with prompts and examples for each section. Same framework Navigator clients use. $2,997 one-time, lifetime template updates.`,
            href: "/programs/blueprint",
            ctaLabel: "Get The Blueprint",
          }
        : {
            eyebrow: "Talk through your specific situation",
            title: `Have questions about ${t.term.replace(/\(.*\)/, "").trim()}?`,
            body: `Thirty minutes with a franchise SME who's built systems for 30 years. We'll look at your specific situation and tell you what's realistic — without the pitch.`,
            href: "/strategy-call",
            ctaLabel: "Book a 30-min strategy call",
          };

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Glossary", url: "/glossary" },
          { name: t.term, url: `/glossary/${t.slug}` },
        ])}
      />
      <JsonLd data={definedTerm} />

      <SiteNav />

      <div className="bg-grey-1/50">
        {/* ─── Hero ─────────────────────────────────────────────────── */}
        <header className="max-w-[820px] mx-auto px-6 md:px-8 pt-12 md:pt-16">
          <nav aria-label="Breadcrumb" className="mb-6 text-xs text-grey-4 tracking-wide">
            <Link href="/" className="hover:text-gold transition-colors">
              Home
            </Link>
            <span className="mx-2 opacity-40">/</span>
            <Link href="/glossary" className="hover:text-gold transition-colors">
              Glossary
            </Link>
            <span className="mx-2 opacity-40">/</span>
            <span className="text-navy">{t.term}</span>
          </nav>

          <div className="text-gold-warm font-bold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1 inline-block">
            {t.category}
          </div>

          <h1 className="text-navy text-3xl md:text-5xl font-extrabold leading-[1.1] tracking-tight mb-5">
            {t.term}
          </h1>

          {t.aka && t.aka.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <span className="text-grey-4 text-xs uppercase tracking-wide font-bold">
                Also known as:
              </span>
              {t.aka.map((alt) => (
                <span
                  key={alt}
                  className="inline-flex items-center bg-white border border-navy/10 text-navy text-xs font-semibold px-2.5 py-1 rounded"
                >
                  {alt}
                </span>
              ))}
            </div>
          )}

          {/* The "answer" pulled out as a featured definition card —
              this is what AEO assistants quote */}
          <div className="bg-white border-l-4 border-gold rounded-r-2xl p-6 md:p-7 shadow-sm my-8">
            <div className="flex items-start gap-3 mb-3">
              <BookOpen size={18} className="text-gold mt-1 flex-shrink-0" />
              <div className="text-gold-warm text-[11px] tracking-[0.2em] uppercase font-bold">
                Definition
              </div>
            </div>
            <p className="text-navy text-lg md:text-xl leading-[1.5] font-medium">
              {t.shortDef}
            </p>
          </div>
        </header>

        {/* ─── Body ─────────────────────────────────────────────────── */}
        <div className="max-w-[820px] mx-auto px-6 md:px-8 py-8 md:py-12">
          <h2 className="text-navy text-2xl md:text-3xl font-bold mb-5 leading-tight">
            What it means in practice
          </h2>
          <div className="space-y-5 text-grey-3 text-base md:text-[17px] leading-[1.75]">
            {t.longDef.split("\n\n").map((para, i) => (
              <p key={i} dangerouslySetInnerHTML={{ __html: formatPara(para) }} />
            ))}
          </div>

          {t.ftcCitation && (
            <div className="mt-8 inline-flex items-center gap-2 bg-grey-1 px-4 py-2 rounded-lg text-sm">
              <Tag size={14} className="text-gold" />
              <span className="text-grey-4 font-semibold uppercase tracking-wide text-[10px]">
                Regulatory citation
              </span>
              <span className="text-navy font-mono font-semibold">{t.ftcCitation}</span>
            </div>
          )}

          {t.jasonNote && (
            <blockquote className="border-l-4 border-gold pl-6 py-2 my-9 italic text-navy text-lg md:text-xl font-light">
              &ldquo;{t.jasonNote}&rdquo;
              <cite className="block mt-2 text-sm text-grey-4 not-italic">
                — Jason Stowe, Founder
              </cite>
            </blockquote>
          )}

          {/* InlineCTA at ~60% mark */}
          <div className="my-10">
            <InlineCTA
              eyebrow={cta.eyebrow}
              title={cta.title}
              body={cta.body}
              href={cta.href}
              ctaLabel={cta.ctaLabel}
            />
          </div>

          {/* Related terms */}
          {relatedTerms.length > 0 && (
            <section className="mt-12">
              <h2 className="text-navy text-xl md:text-2xl font-bold mb-4 leading-tight">
                Related glossary terms
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {relatedTerms.map((rt) => (
                  <Link
                    key={rt.slug}
                    href={`/glossary/${rt.slug}`}
                    className="group block bg-white rounded-xl p-4 border border-navy/10 hover:border-gold hover:shadow-md transition-all"
                  >
                    <div className="text-gold-warm text-[10px] tracking-[0.18em] uppercase font-bold mb-1.5">
                      {rt.category}
                    </div>
                    <h3 className="text-navy font-bold text-base leading-tight group-hover:text-gold transition-colors mb-1">
                      {rt.term}
                    </h3>
                    <p className="text-grey-4 text-xs leading-relaxed line-clamp-2">
                      {rt.shortDef}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Related blog posts */}
          {relatedBlogPosts.length > 0 && (
            <section className="mt-10">
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
                      <ExternalLink size={14} className="flex-shrink-0" />
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Back to glossary */}
          <div className="mt-12 pt-8 border-t border-navy/10">
            <Link
              href="/glossary"
              className="inline-flex items-center gap-2 text-navy font-semibold hover:text-gold transition-colors"
            >
              <ArrowRight size={16} className="rotate-180" />
              Back to the full glossary
            </Link>
          </div>
        </div>
      </div>

      <SiteFooter />
    </>
  );
}

/** Light formatting: bold **text** and preserve line structure. */
function formatPara(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-navy font-bold">$1</strong>');
}

/** schema.org DefinedTerm for the entry. */
function buildDefinedTermSchema(t: FranchiseGlossaryTerm, url: string) {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    "@id": `${url}#term`,
    name: t.term,
    description: t.shortDef,
    url,
    inDefinedTermSet: {
      "@type": "DefinedTermSet",
      "@id": `${SITE_URL}/glossary#set`,
      name: "The Franchisor Blueprint Franchise Glossary",
      url: `${SITE_URL}/glossary`,
    },
    ...(t.aka && t.aka.length > 0 ? { alternateName: t.aka } : {}),
    termCode: t.slug,
  };
}

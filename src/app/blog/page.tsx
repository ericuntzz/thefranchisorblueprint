import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen, ArrowRight } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/PageHero";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbSchema } from "@/lib/schema";
import { allPosts } from "@/lib/blog";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Blog | The Franchisor Blueprint",
  description:
    "Frameworks, walkthroughs, and case studies for founders serious about franchising. Written by Jason Stowe — 30+ years in franchise development.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Blog | The Franchisor Blueprint",
    description:
      "Frameworks, walkthroughs, and case studies for founders serious about franchising. Written by Jason Stowe — 30+ years in franchise development.",
    url: "/blog",
    type: "website",
  },
};

export default function BlogPage() {
  const sortedPosts = [...allPosts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  // Surface the most recent post as a featured hero
  const [featured, ...rest] = sortedPosts;

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Blog", url: "/blog" },
        ])}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Blog",
          "@id": `${SITE_URL}/blog#blog`,
          name: "The Franchisor Blueprint Blog",
          url: `${SITE_URL}/blog`,
          description:
            "Frameworks, walkthroughs, and case studies for founders serious about franchising.",
          publisher: { "@id": `${SITE_URL}/#organization` },
          blogPost: sortedPosts.map((p) => ({
            "@type": "BlogPosting",
            "@id": `${SITE_URL}/blog/${p.slug}#article`,
            headline: p.title,
            description: p.excerpt,
            datePublished: p.date,
            url: `${SITE_URL}/blog/${p.slug}`,
            author: { "@type": "Person", name: "Jason Stowe" },
          })),
        }}
      />

      <SiteNav />

      <PageHero
        eyebrow="Blog"
        title="Notes from the Franchise Trenches"
        subtitle="Frameworks, walkthroughs, and case studies for founders serious about franchising. Written by Jason Stowe — 30+ years in franchise development."
      />

      {/* ===== Featured post ===== */}
      {featured && (
        <section className="bg-white py-16 md:py-20">
          <div className="max-w-[1200px] mx-auto px-6 md:px-8">
            <Link
              href={`/blog/${featured.slug}`}
              className="group block bg-gradient-to-br from-navy to-navy-light text-white rounded-2xl p-8 md:p-12 shadow-[0_24px_60px_rgba(30,58,95,0.22)] hover:shadow-[0_32px_72px_rgba(30,58,95,0.28)] transition-all"
            >
              <div className="flex items-center gap-3 mb-5">
                <span className="bg-gold text-navy text-[11px] font-extrabold tracking-[0.14em] uppercase px-3 py-1 rounded-full">
                  Latest
                </span>
                <span className="text-gold font-bold text-xs tracking-[0.16em] uppercase">
                  {featured.category}
                </span>
              </div>
              <h2 className="text-2xl md:text-4xl font-extrabold text-white mb-4 leading-tight max-w-[860px] group-hover:text-gold transition-colors">
                {featured.title}
              </h2>
              <p className="text-white/80 text-base md:text-lg leading-relaxed mb-6 max-w-[760px]">
                {featured.excerpt}
              </p>
              <div className="flex items-center gap-2 text-gold font-semibold">
                <span>Read the post</span>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                <span className="text-white/60 text-sm font-normal ml-3">
                  · {featured.readingTimeMin} min read
                </span>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* ===== Post grid ===== */}
      {rest.length > 0 && (
        <section className="bg-cream py-20 md:py-24">
          <div className="max-w-[1200px] mx-auto px-6 md:px-8">
            <div className="text-center mb-14">
              <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
                The Library
              </span>
              <h2 className="text-3xl md:text-5xl font-bold">More Posts</h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rest.map((p) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="group bg-white rounded-2xl p-7 border border-navy/10 shadow-[0_8px_24px_rgba(30,58,95,0.08)] hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(30,58,95,0.16)] transition-all flex flex-col"
                >
                  <div className="text-gold-warm font-bold text-[11px] tracking-[0.14em] uppercase mb-3">
                    {p.category}
                  </div>
                  <h3 className="text-navy font-bold text-lg leading-tight mb-3 group-hover:text-gold transition-colors">
                    {p.title}
                  </h3>
                  <p className="text-grey-3 text-sm leading-relaxed mb-5 flex-1">{p.excerpt}</p>
                  <div className="text-xs text-grey-4 flex items-center justify-between">
                    <span>{p.readingTimeMin} min read</span>
                    <span className="font-semibold text-navy group-hover:text-gold">Read →</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== Email subscribe + assessment CTA ===== */}
      <section className="bg-white py-20 md:py-24">
        <div className="max-w-[760px] mx-auto px-6 md:px-8">
          <div className="bg-gradient-to-br from-navy to-navy-light rounded-2xl p-8 md:p-12 text-white text-center shadow-[0_20px_50px_rgba(30,58,95,0.25)]">
            <div className="w-14 h-14 mx-auto rounded-full bg-gold flex items-center justify-center text-navy mb-5">
              <BookOpen size={26} />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              Get New Posts in Your Inbox
            </h2>
            <p className="text-white/85 text-base md:text-lg leading-relaxed mb-7 max-w-[560px] mx-auto">
              One franchise development insight per week. No spam, ever. Unsubscribe in one click.
            </p>
            <form
              action="/api/subscribe"
              method="POST"
              className="flex flex-col sm:flex-row gap-3 max-w-[460px] mx-auto"
            >
              <input
                type="email"
                name="email"
                required
                placeholder="you@yourcompany.com"
                className="flex-1 px-4 py-3.5 rounded-full border-0 bg-white text-navy placeholder-grey-4 outline-none focus:ring-2 focus:ring-gold/50"
              />
              <button
                type="submit"
                className="bg-gold text-navy font-bold text-xs uppercase tracking-[0.1em] px-6 py-3.5 rounded-full hover:bg-gold-dark transition-colors whitespace-nowrap"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}

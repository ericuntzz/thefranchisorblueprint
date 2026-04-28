import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { relatedPosts } from "@/lib/blog";

export function RelatedPosts({ currentSlug }: { currentSlug: string }) {
  const posts = relatedPosts(currentSlug, 3);
  if (posts.length === 0) return null;

  return (
    <section className="bg-cream py-20 md:py-24">
      <div className="max-w-[1200px] mx-auto px-6 md:px-8">
        <div className="flex items-end justify-between mb-10">
          <div>
            <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-3 border-b-2 border-gold pb-1">
              Keep Reading
            </span>
            <h2 className="text-navy text-2xl md:text-3xl font-bold">More from the blog</h2>
          </div>
          <Link
            href="/blog"
            className="hidden sm:inline-flex items-center gap-1.5 text-navy font-semibold text-sm hover:text-gold transition-colors"
          >
            All posts <ArrowRight size={14} />
          </Link>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {posts.map((p) => (
            <Link
              key={p.slug}
              href={`/blog/${p.slug}`}
              className="group bg-white rounded-2xl p-7 border border-navy/10 shadow-[0_4px_16px_rgba(30,58,95,0.06)] hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(30,58,95,0.14)] transition-all flex flex-col"
            >
              <div className="text-gold-warm font-bold text-[11px] tracking-[0.14em] uppercase mb-3">
                {p.category}
              </div>
              <h3 className="text-navy font-bold text-lg leading-tight mb-3 group-hover:text-gold transition-colors">
                {p.title}
              </h3>
              <p className="text-grey-3 text-sm leading-relaxed mb-5 flex-1">{p.excerpt}</p>
              <div className="text-xs text-grey-4">{p.readingTimeMin} min read</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

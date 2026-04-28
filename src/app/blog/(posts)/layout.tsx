import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

/**
 * Layout shared by every blog post. The post itself (an MDX file at
 * src/app/blog/(posts)/<slug>/page.mdx) provides the BlogPostHeader
 * and any post-specific JSON-LD; this layout wraps everything in
 * site nav + footer + a hero CTA at the bottom.
 */
export default function BlogPostLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteNav />
      <article className="bg-white">
        {children}
      </article>

      {/* Post-content CTA band, before footer */}
      <section className="bg-blueprint text-white py-20 md:py-24">
        <div className="max-w-[860px] mx-auto px-6 md:px-8 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-5">
            Ready to See if Your Business Is Franchise-Ready?
          </h2>
          <p className="text-lg md:text-xl text-white/85 mb-10 font-light max-w-[640px] mx-auto">
            Take the free 5-minute Franchise Readiness Assessment, or book a 30-minute strategy call with Jason.
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

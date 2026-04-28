import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Handshake, Eye, ShieldCheck } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/PageHero";

export const metadata: Metadata = {
  title: "About | The Franchisor Blueprint | Franchise Development Experts",
  description:
    "Built by operators, not just consultants. We bridge the gap between DIY risk and big-firm expense — the partners we wish we'd had when we started franchising.",
};

const values = [
  {
    Icon: Handshake,
    title: "Accessibility",
    body: "No hidden fees. No surprises. We're upfront about what we do, what you need to do, and what it costs. We believe trust is the foundation of any partnership.",
  },
  {
    Icon: Eye,
    title: "Accountability",
    body: "We don't disappear. We're coaches first — we push you, encourage you, and make sure you cross the finish line.",
  },
  {
    Icon: ShieldCheck,
    title: "Integrity",
    body: "We only take clients we believe in. If we don't think your business is ready to franchise, we'll tell you. Your success is our reputation.",
  },
];

export default function AboutPage() {
  return (
    <>
      <SiteNav />

      <PageHero
        eyebrow="About TFB"
        title="We Believe Franchising Shouldn't Be Reserved for the Wealthy"
        subtitle="We bridge the gap between “DIY” risk and “Big Firm” expense — the partners we wish we'd had when we started."
      />

      {/* ===== Founder Story ===== */}
      <section className="bg-white py-24 md:py-28">
        <div className="max-w-[1200px] mx-auto px-8 grid md:grid-cols-[1fr_1.4fr] gap-10 md:gap-16 items-center">
          <div className="relative w-full aspect-[4/5] max-w-[320px] md:max-w-[440px] mx-auto rounded-2xl shadow-featured overflow-hidden bg-navy">
            <Image
              src="/images/jason.png"
              alt="Jason — Founder, The Franchisor Blueprint"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 320px, 440px"
            />
          </div>
          <div>
            <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.16em] uppercase mb-3 border-b-2 border-gold pb-1">
              The Founder
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Built by Someone Who&apos;s Been in the Trenches
            </h2>
            <div className="space-y-5 text-grey-3 text-base md:text-[17px] leading-relaxed">
              <p>
                Hello, I&apos;m Jason. After three decades inside the franchise industry — building, scaling, and advising emerging brands — I noticed a disturbing trend. Great business owners with profitable concepts and loyal customers were being shut out of franchising. Not because their business wasn&apos;t ready, but because the entry fee was simply too high.
              </p>
              <p>
                The traditional consulting firms wanted $80,000 just to get started. The budget-friendly options were templates pulled off the internet that offered no real protection or guidance. There was no middle ground for the successful small business owner who needed professional systems without the corporate price tag.
              </p>
              <p>
                I realized enough was enough. I took the exact systems, documents, and strategies used by the big firms and packaged them into an accessible, coach-led program. The Franchisor Blueprint was born from a simple belief: <strong className="text-navy">if you&apos;ve built a great business, you deserve the chance to scale it.</strong>
              </p>
              <p>
                Today we help founders turn local success stories into national brands.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Credentials ===== */}
      <section className="bg-blueprint text-white py-20 md:py-24">
        <div className="max-w-[1200px] mx-auto px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 text-center">
            <div>
              <div className="font-display text-6xl md:text-7xl font-extrabold text-gold leading-none mb-3">30+</div>
              <div className="text-white text-base md:text-lg font-semibold">Years inside the franchise industry</div>
            </div>
            <div>
              <div className="font-display text-6xl md:text-7xl font-extrabold text-gold leading-none mb-3">$33K+</div>
              <div className="text-white text-base md:text-lg font-semibold">Documented value delivered per client</div>
            </div>
            <div>
              <div className="font-display text-6xl md:text-7xl font-extrabold text-gold leading-none mb-3">100%</div>
              <div className="text-white text-base md:text-lg font-semibold">Coach-led, partner-driven approach</div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Mission ===== */}
      <section className="bg-cream py-24 md:py-28">
        <div className="max-w-[920px] mx-auto px-8 text-center">
          <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
            Our Mission
          </span>
          <h2 className="text-3xl md:text-5xl font-bold mb-8">
            Make professional franchise development accessible to every great business owner — not just those who can write an $80,000 check.
          </h2>
          <p className="text-grey-3 text-lg md:text-xl leading-relaxed">
            We exist to democratize franchising. We believe that with the right tools and accountability, any proven business model can scale.
          </p>
          <div className="mt-10 inline-block border-l-4 border-gold pl-6 py-3 text-left italic text-xl md:text-2xl text-navy font-light max-w-[640px]">
            &ldquo;We don&apos;t just sell you documents. We empower you to become a franchisor.&rdquo;
          </div>
        </div>
      </section>

      {/* ===== Core Values ===== */}
      <section className="bg-white py-24 md:py-28">
        <div className="max-w-[1200px] mx-auto px-8">
          <div className="text-center mb-14">
            <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
              Core Values
            </span>
            <h2 className="text-3xl md:text-5xl font-bold">What We Stand For</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {values.map(({ Icon, title, body }) => (
              <div
                key={title}
                className="bg-white rounded-2xl p-8 shadow-[0_10px_30px_rgba(30,58,95,0.10)] border border-navy/10"
              >
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold mb-6">
                  <Icon size={26} strokeWidth={1.75} />
                </div>
                <h3 className="text-navy font-bold text-2xl mb-3">{title}</h3>
                <p className="text-grey-3 text-[15px] leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Old Way vs Blueprint Way ===== */}
      <section className="bg-grey-1 py-24 md:py-28">
        <div className="max-w-[1100px] mx-auto px-8">
          <div className="text-center mb-14">
            <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
              Why We&apos;re Different
            </span>
            <h2 className="text-3xl md:text-5xl font-bold">Why The Blueprint Way Works</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-8 md:p-10 border border-navy/10 shadow-[0_8px_24px_rgba(30,58,95,0.08)]">
              <div className="text-grey-4 font-bold text-xs tracking-[0.18em] uppercase mb-4">
                The Old Way (Traditional Firms)
              </div>
              <ul className="list-none space-y-3 text-grey-3 text-[15px]">
                <li>• Expensive ($40k–$80k+)</li>
                <li>• Hands-off &ldquo;delivery&rdquo; model</li>
                <li>• Generic templates and binders</li>
                <li>• You rely on them forever</li>
                <li>• 12–18 months to launch</li>
              </ul>
            </div>
            <div className="bg-gradient-to-br from-navy to-navy-light text-white rounded-2xl p-8 md:p-10 shadow-[0_20px_50px_rgba(30,58,95,0.25)]">
              <div className="text-gold font-bold text-xs tracking-[0.18em] uppercase mb-4">
                The Blueprint Way
              </div>
              <ul className="list-none space-y-3 text-white/90 text-[15px]">
                <li>• Accessible ($2,997–$29,500)</li>
                <li>• Hands-on &ldquo;coaching&rdquo; model</li>
                <li>• Customized, strategic systems</li>
                <li>• We teach you to fish</li>
                <li>• Launch in 6 months</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="bg-blueprint text-white text-center py-24 md:py-28">
        <div className="max-w-[1200px] mx-auto px-8">
          <h2 className="text-3xl md:text-6xl font-bold text-white mb-5">Ready to Build Your Franchise Legacy?</h2>
          <p className="text-lg md:text-xl text-white/85 mb-10 font-light">
            Let&apos;s talk through your business and where franchising fits.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/strategy-call"
              className="bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-9 py-4 rounded-full hover:bg-gold-dark transition-colors"
            >
              Book a Strategy Call
            </Link>
            <Link
              href="/programs"
              className="bg-transparent text-white border-2 border-white font-bold text-sm uppercase tracking-[0.1em] px-9 py-4 rounded-full hover:bg-white hover:text-navy transition-colors"
            >
              See Our Programs
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}

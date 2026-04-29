import Link from "next/link";
import type { Metadata } from "next";
import { ClipboardCheck, Clock, BarChart3, FileText } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/PageHero";
import { AssessmentFlow } from "@/components/AssessmentFlow";

export const metadata: Metadata = {
  title: "Free Franchise Readiness Assessment | The Franchisor Blueprint",
  description:
    "Take our free 15-question Franchise Readiness Assessment and find out in 5–7 minutes whether your business is positioned to scale through franchising.",
};

const dimensions = [
  { Icon: BarChart3, title: "Financial readiness", body: "Revenue, profitability, unit economics, and reproducible margins." },
  { Icon: ClipboardCheck, title: "Operational readiness", body: "Documented systems, training, and standards a franchisee can replicate." },
  { Icon: FileText, title: "Brand readiness", body: "Brand strength, IP protection, market positioning, and demand signals." },
  { Icon: Clock, title: "Founder readiness", body: "Capacity, mindset, and willingness to shift from operator to franchisor." },
];

export default function AssessmentPage() {
  return (
    <>
      <SiteNav />

      <PageHero
        eyebrow="Free Assessment"
        title="Is Your Business Franchise-Ready?"
        subtitle="A 15-question assessment across the four dimensions that actually predict franchise success. About 5–7 minutes. You'll get an honest score and a tailored next-step recommendation."
      />

      {/* ===== In-house assessment flow (replaces the prior JotForm embed) =====
          Cream section background so the white assessment card pops with a
          real drop-shadow instead of disappearing into the page bg. */}
      <section className="bg-cream py-16 md:py-24">
        <AssessmentFlow source="assessment_page" />
      </section>

      {/* ===== What we measure ===== */}
      <section className="bg-cream py-24 md:py-28">
        <div className="max-w-[1200px] mx-auto px-8">
          <div className="text-center mb-14">
            <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
              What We Measure
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mb-5 max-w-[760px] mx-auto">
              Four Dimensions That Predict Franchise Success
            </h2>
            <p className="text-lg text-grey-3 max-w-[720px] mx-auto">
              The assessment doesn&apos;t just check boxes. We score your business across the four areas that consistently determine whether a franchise system will scale or stall.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {dimensions.map(({ Icon, title, body }) => (
              <div
                key={title}
                className="bg-white rounded-2xl p-7 border border-navy/10 shadow-[0_8px_24px_rgba(30,58,95,0.08)]"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold mb-5">
                  <Icon size={22} />
                </div>
                <h3 className="text-navy font-bold text-lg mb-2">{title}</h3>
                <p className="text-grey-3 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== What you get ===== */}
      <section className="bg-white py-24 md:py-28">
        <div className="max-w-[860px] mx-auto px-8">
          <div className="text-center mb-12">
            <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
              What You Get
            </span>
            <h2 className="text-3xl md:text-5xl font-bold">Your Personalized Readiness Report</h2>
          </div>

          <ul className="space-y-5 text-grey-3 text-base md:text-lg leading-relaxed">
            <li className="flex gap-4">
              <span className="flex-shrink-0 mt-1 w-6 h-6 rounded-full bg-gold text-navy text-xs font-extrabold flex items-center justify-center">
                1
              </span>
              <span>
                <strong className="text-navy">Your overall readiness score</strong> on a 0–100 scale, with category breakdowns so you know your strengths and your gaps.
              </span>
            </li>
            <li className="flex gap-4">
              <span className="flex-shrink-0 mt-1 w-6 h-6 rounded-full bg-gold text-navy text-xs font-extrabold flex items-center justify-center">
                2
              </span>
              <span>
                <strong className="text-navy">A tailored next-step recommendation</strong> — whether you&apos;re ready to start now, ready in 6 months with the right work, or not ready yet (and what to fix first).
              </span>
            </li>
            <li className="flex gap-4">
              <span className="flex-shrink-0 mt-1 w-6 h-6 rounded-full bg-gold text-navy text-xs font-extrabold flex items-center justify-center">
                3
              </span>
              <span>
                <strong className="text-navy">A program fit suggestion</strong> — Tier 1, 2, or 3 — based on what your score reveals about how much support you actually need.
              </span>
            </li>
            <li className="flex gap-4">
              <span className="flex-shrink-0 mt-1 w-6 h-6 rounded-full bg-gold text-navy text-xs font-extrabold flex items-center justify-center">
                4
              </span>
              <span>
                <strong className="text-navy">No sales follow-up unless you ask for one.</strong> Take the quiz, get your report, decide if you want to talk. We respect that.
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="bg-blueprint text-white text-center py-24 md:py-28">
        <div className="max-w-[1200px] mx-auto px-8">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-5">
            Skip the Quiz and Talk to Us Directly
          </h2>
          <p className="text-lg md:text-xl text-white/85 mb-10 font-light max-w-[680px] mx-auto">
            Prefer a real conversation over a quiz? Book a free 30-minute strategy call instead.
          </p>
          <Link
            href="/strategy-call"
            className="inline-block bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-9 py-4 rounded-full hover:bg-gold-dark transition-colors"
          >
            Book a Strategy Call
          </Link>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}

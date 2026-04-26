import Link from "next/link";
import type { Metadata } from "next";
import { Check, ShieldCheck, Download, Zap, Users } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/PageHero";

export const metadata: Metadata = {
  title: "The Blueprint — DIY Franchise Kit ($2,997) | The Franchisor Blueprint",
  description:
    "The complete 9-document franchise development system for the self-starter. $2,997 one-time. 30-day satisfaction guarantee. Lifetime access to system updates.",
};

const includes = [
  "Comprehensive Fact-Finding Checklist (150+ items)",
  "12-Month Franchise Development Timeline (Gantt)",
  "Investment Overview & Pro Forma Templates",
  "Operations Manual Master Template (17 chapters)",
  "Staff Training & Certification Program",
  "FDD Explainer — All 23 Items decoded",
  "Site Selection & Build-Out Guide",
  "Franchisee Ideal Profile & Scoring Matrix",
  "Discovery Day Presentation Deck (29 slides)",
  "Implementation guides for every document",
  "60-Minute white-glove onboarding strategy call",
  "30 days of email support",
  "Lifetime access to system updates",
];

export default function BlueprintProductPage() {
  return (
    <>
      <SiteNav />

      <PageHero
        eyebrow="Tier 1 — DIY Kit"
        title="The Blueprint — $2,997"
        subtitle="The complete 9-document franchise development system for the experienced entrepreneur who wants the tools but doesn't need the hand-holding. One-time payment, lifetime access."
      />

      {/* ===== Buy box + what's included ===== */}
      <section className="bg-white py-20 md:py-24">
        <div className="max-w-[1200px] mx-auto px-8 grid md:grid-cols-[1.4fr_1fr] gap-10 md:gap-14">
          {/* What's included */}
          <div>
            <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
              Everything Included
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              The Full $33,500+ System for $2,997
            </h2>
            <p className="text-grey-3 text-lg leading-relaxed mb-8">
              You get instant access to every document in our system, plus the implementation guides that walk you through how to use each one. We also kick off your engagement with a 60-minute strategy call so you start with momentum.
            </p>
            <ul className="space-y-3">
              {includes.map((item) => (
                <li key={item} className="flex gap-3 items-start text-[15px] text-[#333]">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gold/15 flex items-center justify-center mt-0.5">
                    <Check size={12} className="text-gold-warm" strokeWidth={3} />
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Sticky buy box */}
          <div className="md:sticky md:top-24 md:self-start">
            <div className="bg-white rounded-2xl border border-gold/40 shadow-[0_24px_60px_rgba(30,58,95,0.22)] overflow-hidden">
              <div className="bg-gradient-to-br from-navy to-navy-light text-white p-6 md:p-7">
                <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-gold mb-1">
                  Tier 1 — DIY
                </div>
                <h3 className="text-2xl font-bold text-white">The Blueprint</h3>
              </div>
              <div className="p-6 md:p-7">
                <div className="text-5xl font-extrabold text-navy leading-none mb-1 tracking-tight">
                  $2,997
                </div>
                <div className="text-grey-4 text-sm mb-5">One-time payment · Instant access</div>

                {/* TODO (Eric): wire up Stripe Payment Link or Checkout Session.
                    Replace this <a> with the real Stripe URL. */}
                <a
                  href="#TODO-STRIPE-CHECKOUT"
                  className="block w-full text-center bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-6 py-4 rounded-full hover:bg-gold-dark transition-colors"
                >
                  Buy Now
                </a>
                <p className="text-center text-xs text-grey-4 italic mt-3">
                  Secure checkout via Stripe. Credit card or ACH.
                </p>

                <div className="mt-6 pt-6 border-t border-navy/10 space-y-3">
                  <div className="flex items-start gap-3 text-sm text-grey-3">
                    <Zap className="flex-shrink-0 mt-0.5 text-gold" size={16} />
                    <span>Instant access to all 9 documents</span>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-grey-3">
                    <Users className="flex-shrink-0 mt-0.5 text-gold" size={16} />
                    <span>Onboarding call within 1–2 business days</span>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-grey-3">
                    <Download className="flex-shrink-0 mt-0.5 text-gold" size={16} />
                    <span>Lifetime access to system updates</span>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-grey-3">
                    <ShieldCheck className="flex-shrink-0 mt-0.5 text-gold" size={16} />
                    <span>30-day satisfaction guarantee</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Who it's for / not for ===== */}
      <section className="bg-grey-1 py-24 md:py-28">
        <div className="max-w-[1100px] mx-auto px-8">
          <div className="text-center mb-12">
            <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
              Right Tier?
            </span>
            <h2 className="text-3xl md:text-5xl font-bold">Is The Blueprint Right for You?</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-navy/10 p-8 md:p-10 shadow-[0_8px_24px_rgba(30,58,95,0.08)]">
              <h3 className="text-navy font-extrabold text-xl mb-5">
                The Blueprint is right for you if…
              </h3>
              <ul className="list-none space-y-3 text-grey-3 text-[15px] leading-relaxed">
                <li>✓ You&apos;ve already built and run a successful business</li>
                <li>✓ You&apos;re comfortable working through systems on your own</li>
                <li>✓ You want the full $33K+ system without the coaching cost</li>
                <li>✓ You have a franchise attorney lined up (or want our referrals)</li>
                <li>✓ You want to keep total control over your timeline</li>
              </ul>
            </div>
            <div className="bg-white rounded-2xl border border-navy/10 p-8 md:p-10 shadow-[0_8px_24px_rgba(30,58,95,0.08)]">
              <h3 className="text-navy font-extrabold text-xl mb-5">
                Consider Navigator instead if…
              </h3>
              <ul className="list-none space-y-3 text-grey-3 text-[15px] leading-relaxed">
                <li>• You want weekly accountability calls with Jason</li>
                <li>• You want document review and feedback</li>
                <li>• You&apos;ve never franchised before and want a guide</li>
                <li>• You want a guaranteed 6-month launch timeline</li>
                <li>
                  •{" "}
                  <Link href="/programs" className="text-gold-warm font-bold underline">
                    See Navigator details →
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Guarantee ===== */}
      <section className="bg-white py-20 md:py-24">
        <div className="max-w-[760px] mx-auto px-8">
          <div className="bg-cream rounded-2xl border border-gold/30 p-8 md:p-10 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
            <div className="flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold">
              <ShieldCheck size={32} strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-navy font-extrabold text-xl mb-2">
                30-Day Satisfaction Guarantee
              </h3>
              <p className="text-grey-3 text-sm md:text-[15px] leading-relaxed">
                Buy The Blueprint risk-free. If the system isn&apos;t what you expected, email us within 30 days for a full refund. No friction, no hassle, no awkward exit interview.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="bg-blueprint text-white text-center py-24 md:py-28">
        <div className="max-w-[1200px] mx-auto px-8">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-5">
            Want the Coaching Layer Instead?
          </h2>
          <p className="text-lg md:text-xl text-white/85 mb-10 font-light max-w-[640px] mx-auto">
            Navigator (Tier 2) adds 24 weekly coaching calls + document review for $8,500. Talk to us first to see if it&apos;s a fit.
          </p>
          <Link
            href="/strategy-call"
            className="inline-block bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-9 py-4 rounded-full hover:bg-gold-dark transition-colors"
          >
            Book a Free Strategy Call
          </Link>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}

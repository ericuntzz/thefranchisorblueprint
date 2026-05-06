import Link from "next/link";
import type { Metadata } from "next";
import { Calendar, Clock, Shield, MessageCircle, TrendingUp } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/PageHero";
import { CalendlyEmbed } from "@/components/CalendlyEmbed";

const CALENDLY_URL =
  "https://calendly.com/team-thefranchisorblueprint/45-minute-builder-fit-call";

export const metadata: Metadata = {
  title: "Book Your Builder Fit Call | The Franchisor Blueprint",
  description:
    "A 45-minute fit call for founders considering our Builder ($29,500) tier. Deeper screening on capital, brand maturity, and timeline. With Jason directly.",
};

export default function BuilderFitCallPage() {
  return (
    <>
      <SiteNav />

      <PageHero
        eyebrow="Builder Fit Call"
        title="Book Your 45-Minute Builder Fit Call"
        subtitle="A deeper conversation for founders considering Builder ($29,500). We use the extra time to understand your capital position, brand maturity, attorney readiness, and the realistic 12-month roadmap."
      />

      {/* ===== Calendly + plan ===== */}
      <section className="bg-white py-20 md:py-24">
        <div className="max-w-[1100px] mx-auto px-8">
          <div className="bg-grey-1 rounded-2xl border border-navy/10 p-8 md:p-12 grid md:grid-cols-[1fr_1.4fr] gap-10 md:gap-14 items-start">
            {/* Left: what to expect */}
            <div>
              <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
                The Plan
              </span>
              <h2 className="text-2xl md:text-3xl font-bold text-navy mb-6">
                Here&apos;s how the 45 minutes will go
              </h2>
              <ul className="space-y-4">
                {[
                  {
                    Icon: MessageCircle,
                    t: "First 15 min: Your business",
                    d: "Brand, customers, locations, revenue, leadership team, and where you want to be in 24 months.",
                  },
                  {
                    Icon: TrendingUp,
                    t: "Next 15 min: Builder fit",
                    d: "Capital allocated for development, attorney status, vendor preferences, and your bandwidth to be the franchisor.",
                  },
                  {
                    Icon: Calendar,
                    t: "Last 15 min: Scope & timeline",
                    d: "If we're a fit, we map the 12-month engagement together. If we're not, we tell you why and recommend the right next step.",
                  },
                ].map(({ Icon, t, d }) => (
                  <li key={t} className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold">
                      <Icon size={18} />
                    </div>
                    <div>
                      <div className="text-navy font-bold text-base mb-0.5">{t}</div>
                      <div className="text-grey-3 text-sm leading-relaxed">{d}</div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-8 pt-6 border-t border-navy/10 flex items-center gap-2 text-sm text-grey-3">
                <Clock size={16} className="text-gold" />
                <span>45 minutes · Free · Zoom · With Jason directly</span>
              </div>

              <div className="mt-6 flex items-start gap-3 bg-white border border-navy/10 rounded-xl p-4">
                <Shield className="flex-shrink-0 text-gold mt-0.5" size={20} />
                <div className="text-grey-3 text-sm leading-relaxed">
                  <strong className="text-navy">No pressure.</strong> If Builder
                  isn&apos;t the right fit, we&apos;ll point you toward Navigator,
                  The Blueprint, or back to the drawing board — whichever serves
                  you. Reputation over revenue.
                </div>
              </div>
            </div>

            {/* Right: live Calendly embed */}
            <div>
              <CalendlyEmbed url={CALENDLY_URL} minHeight={760} />
              <p className="mt-3 text-xs text-grey-4 text-center">
                Trouble loading?{" "}
                <a
                  href={CALENDLY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-navy font-semibold underline"
                >
                  Open scheduler in a new tab →
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Smaller footer reassurance ===== */}
      <section className="bg-cream py-16 md:py-20">
        <div className="max-w-[860px] mx-auto px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Not Sure If You&apos;re Ready for Builder Yet?
          </h2>
          <p className="text-grey-3 text-base md:text-lg mb-8 max-w-[640px] mx-auto">
            Take the 5-minute Franchise Readiness Assessment first — if you don&apos;t
            score in the top range, Navigator (Tier 2) is probably the smarter
            entry point.
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
              className="bg-transparent text-navy border-2 border-navy font-bold text-sm uppercase tracking-[0.1em] px-9 py-4 rounded-full hover:bg-navy hover:text-white transition-colors"
            >
              Book the 30-Min Discovery Call Instead
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { Calendar, Clock, Shield, MessageCircle } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Book a Strategy Call | The Franchisor Blueprint",
  description:
    "Book a free 30-minute strategy call with Jason. We'll evaluate your business, recommend a path forward, and answer every question — no pressure, no sales tactics.",
};

export default function StrategyCallPage() {
  return (
    <>
      <SiteNav />

      <PageHero
        eyebrow="Strategy Call"
        title="Book Your Free 30-Minute Strategy Call"
        subtitle="No pressure, no sales tactics — just clarity on whether your business is ready to franchise and which path forward makes sense for you."
      />

      {/* ===== Calendly placeholder ===== */}
      <section className="bg-white py-20 md:py-24">
        <div className="max-w-[1100px] mx-auto px-8">
          <div className="bg-grey-1 rounded-2xl border border-navy/10 p-8 md:p-12 grid md:grid-cols-[1fr_1.4fr] gap-10 md:gap-14 items-start">
            {/* Left: what to expect */}
            <div>
              <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
                The Plan
              </span>
              <h2 className="text-2xl md:text-3xl font-bold text-navy mb-6">
                Here&apos;s how the 30 minutes will go
              </h2>
              <ul className="space-y-4">
                {[
                  { Icon: MessageCircle, t: "First 10 min: You talk", d: "Tell us about your brand, your customers, where you are today." },
                  { Icon: Shield, t: "Next 10 min: We evaluate", d: "We map your business against the franchise-ready bar. Real assessment, no fluff." },
                  { Icon: Calendar, t: "Last 10 min: Recommendation", d: "We tell you which tier (if any) makes sense — or that you should wait. We mean it." },
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
                <span>30 minutes · Free · Zoom or phone</span>
              </div>
            </div>

            {/* Right: Calendly placeholder */}
            <div>
              <div className="bg-white rounded-xl border-2 border-dashed border-navy/20 aspect-[4/5] flex flex-col items-center justify-center text-center p-10">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold mb-5">
                  <Calendar size={28} />
                </div>
                <div className="text-gold-warm font-bold text-xs tracking-[0.18em] uppercase mb-3">
                  Calendly Embed
                </div>
                <h3 className="text-navy font-bold text-xl mb-3 max-w-[260px]">
                  Pick a time that works for you
                </h3>
                <p className="text-grey-3 text-sm mb-7 max-w-[280px]">
                  Once Eric connects the Calendly account, this block becomes the live booking widget.
                </p>
                <a
                  href="mailto:hello@thefranchisorblueprint.com?subject=Strategy%20Call%20Request"
                  className="bg-gold text-navy font-bold text-xs uppercase tracking-[0.1em] px-6 py-3 rounded-full hover:bg-gold-dark transition-colors"
                >
                  Email to book
                </a>
                <p className="mt-5 text-xs text-grey-4 italic max-w-[260px]">
                  Wiring note: Calendly inline embed goes here. See public/scripts/calendly.js (TBD).
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Reassurance ===== */}
      <section className="bg-cream py-20 md:py-24">
        <div className="max-w-[860px] mx-auto px-8 text-center">
          <h2 className="text-2xl md:text-4xl font-bold mb-6 max-w-[680px] mx-auto">
            We&apos;d Rather Tell You Not to Franchise Than Sell You Something That Won&apos;t Work
          </h2>
          <p className="text-grey-3 text-lg leading-relaxed">
            If your business isn&apos;t profitable yet, hasn&apos;t been operating long enough, or doesn&apos;t have the systems in place to be replicated — we&apos;ll tell you. Reputation is more valuable than any single sale.
          </p>
        </div>
      </section>

      {/* ===== Quiz alt CTA ===== */}
      <section className="bg-white py-20 md:py-24">
        <div className="max-w-[860px] mx-auto px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Want to Pre-Qualify Yourself First?</h2>
          <p className="text-grey-3 text-lg mb-8 max-w-[600px] mx-auto">
            The free Franchise Readiness Assessment takes 2 minutes and tells you instantly where you stand.
          </p>
          <Link
            href="/assessment"
            className="inline-block bg-transparent text-navy border-2 border-navy font-bold text-sm uppercase tracking-[0.1em] px-9 py-4 rounded-full hover:bg-navy hover:text-white transition-colors"
          >
            Take the Free Assessment
          </Link>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}

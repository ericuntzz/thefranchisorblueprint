import Link from "next/link";
import type { Metadata } from "next";
import { Calendar, Clock, Shield, MessageCircle, Mail } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/PageHero";
import { CalendlyEmbed } from "@/components/CalendlyEmbed";

const CALENDLY_URL = "https://calendly.com/team-thefranchisorblueprint/30-minute-discovery-call";

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
                  { Icon: MessageCircle, t: "First 10 min: We listen", d: "You walk us through the business — where it is now, where you want to take it, and what's in the way." },
                  { Icon: Shield, t: "Next 10 min: We diagnose", d: "We hold your model up against the same criteria a franchise attorney and your first franchisees will run. Strengths, gaps, what attorneys ask first." },
                  { Icon: Calendar, t: "Last 10 min: A clear next step", d: "Which tier fits, what to fix before franchising makes sense, or a straight “wait six months.” Whichever’s true." },
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

      {/* ===== Tertiary: have a question first? ===== */}
      <section className="bg-grey-1 border-t border-navy/5 py-10">
        <div className="max-w-[860px] mx-auto px-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5 text-center">
          <Mail size={18} className="text-gold flex-shrink-0" />
          <p className="text-grey-3 text-[15px]">
            Have a question first? Not ready to book?
          </p>
          <Link
            href="/contact"
            className="text-navy font-semibold text-[15px] hover:text-gold transition-colors underline-offset-4 hover:underline"
          >
            Send us a message →
          </Link>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { Calendar, Clock, Sparkles, MessageCircle, Mail } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/PageHero";
import { CalendlyEmbed } from "@/components/CalendlyEmbed";

/**
 * 15-minute founding-member kickoff call for The Blueprint (Tier 1).
 *
 * This is the destination for the BlueprintUpsellBuyBox CTA while
 * NEXT_PUBLIC_STRIPE_LIVE !== "true". Once direct Stripe checkout is
 * wired, this page can stay live as a low-friction alternative path
 * for founders who want a quick call before purchasing.
 *
 * NOTE: Eric needs to create the matching Calendly event (15-minute
 * duration, slug "15-minute-blueprint-call") for this URL to work. If
 * the slug differs in the actual Calendly account, update CALENDLY_URL
 * below to match.
 */
const CALENDLY_URL =
  "https://calendly.com/team-thefranchisorblueprint/15-minute-blueprint-call";

export const metadata: Metadata = {
  title: "Book Your 15-Minute Founding-Member Call | The Franchisor Blueprint",
  description:
    "We're onboarding our first cohort of Blueprint customers personally. Schedule a 15-minute call — we'll confirm fit, walk you through the system, and lock in founding-member pricing.",
};

export default function BlueprintStrategyCallPage() {
  return (
    <>
      <SiteNav />

      <PageHero
        eyebrow="Founding Member · 15 Minutes"
        title="Lock In Your Founding-Member Pricing on The Blueprint"
        subtitle="We're onboarding our first cohort of Blueprint customers personally. Quick fit check, system walkthrough, and your founding-member discount — no pressure, no sales tactics."
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
                Here&apos;s how the 15 minutes will go
              </h2>
              <ul className="space-y-4">
                {[
                  {
                    Icon: MessageCircle,
                    t: "First 5 min: Quick fit check",
                    d: "You walk us through where the business is and where you want to take it. We confirm The Blueprint is the right tier (or steer you to Navigator/Builder if it’s not).",
                  },
                  {
                    Icon: Sparkles,
                    t: "Next 5 min: Walk through the system",
                    d: "We show you exactly what’s inside The Blueprint — the 9 frameworks, the 17-chapter operations manual, the 150-point readiness checklist — so you know what you’re getting before you buy.",
                  },
                  {
                    Icon: Calendar,
                    t: "Last 5 min: Founding-member pricing + next steps",
                    d: "If The Blueprint is a fit, we lock in your founding-member discount and send you a custom invoice. If it’s not, we tell you straight — and refer you to whatever does fit.",
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
                <span>15 minutes · Free · Zoom or phone</span>
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

      {/* ===== Why founding member ===== */}
      <section className="bg-cream py-20 md:py-24">
        <div className="max-w-[860px] mx-auto px-8 text-center">
          <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
            Why we&apos;re doing this in person
          </span>
          <h2 className="text-2xl md:text-4xl font-bold mb-6 max-w-[680px] mx-auto">
            We&apos;re Walking the First Cohort Through the System Personally
          </h2>
          <p className="text-grey-3 text-lg leading-relaxed mb-4">
            Self-serve checkout opens shortly. Until then, every founding
            member gets a real conversation with the team — so we know who
            you are, you know what you&apos;re getting, and we both walk away
            confident this is the right fit.
          </p>
          <p className="text-grey-3 text-lg leading-relaxed">
            In exchange: a discount that won&apos;t exist after we open
            self-serve checkout, and direct access to us during your build.
          </p>
        </div>
      </section>

      {/* ===== Pre-qualify alt CTA ===== */}
      <section className="bg-white py-20 md:py-24">
        <div className="max-w-[860px] mx-auto px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Want to Pre-Qualify Yourself First?
          </h2>
          <p className="text-grey-3 text-lg mb-8 max-w-[600px] mx-auto">
            The free Franchise Readiness Assessment takes 2 minutes and tells
            you instantly where you stand.
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

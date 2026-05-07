import Link from "next/link";
import type { Metadata } from "next";
import { Calendar, Clock, Sparkles, MessageCircle, Mail } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/PageHero";
import { CalendlyEmbed } from "@/components/CalendlyEmbed";

/**
 * 15-minute Blueprint onboarding call (Tier 1 entry point).
 *
 * This is the destination for the BlueprintUpsellBuyBox CTA while
 * NEXT_PUBLIC_STRIPE_LIVE !== "true". Once direct Stripe checkout is
 * wired, this page can stay live as a low-friction alternative path
 * for founders who want a quick call before purchasing.
 */
const CALENDLY_URL =
  "https://calendly.com/team-thefranchisorblueprint/15-minute-discovery-call";

export const metadata: Metadata = {
  title: "Book Your Blueprint Onboarding Call | The Franchisor Blueprint",
  description:
    "Every Blueprint engagement starts with a 15-minute onboarding call. We confirm fit, walk you through the system, and send you a custom invoice — credit card or ACH.",
  openGraph: {
    title: "Book Your Blueprint Onboarding Call | The Franchisor Blueprint",
    description:
      "Every Blueprint engagement starts with a 15-minute onboarding call. Confirm fit, walk through the system, get a custom invoice.",
    url: "/strategy-call/blueprint",
  },
};

export default function BlueprintStrategyCallPage() {
  return (
    <>
      <SiteNav />

      <PageHero
        eyebrow="Onboarding Call · 15 Minutes"
        title="Get Started with The Blueprint"
        subtitle="Every Blueprint engagement starts with a quick onboarding call. Confirm fit, walk through the system, and we'll send you a custom invoice — no pressure, no sales tactics."
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
                    t: "Last 5 min: Pricing + next steps",
                    d: "If The Blueprint is a fit, we send you a custom invoice (credit card or ACH) and you get instant access to the system. If it’s not, we tell you straight — and refer you to whatever does fit.",
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

      {/* ===== Why a call ===== */}
      <section className="bg-cream py-20 md:py-24">
        <div className="max-w-[860px] mx-auto px-8 text-center">
          <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
            Why a quick call
          </span>
          <h2 className="text-2xl md:text-4xl font-bold mb-6 max-w-[680px] mx-auto">
            Every Engagement Starts With a Conversation
          </h2>
          <p className="text-grey-3 text-lg leading-relaxed mb-4">
            We&apos;ve been doing franchise development for 30 years.
            The 9-framework system inside The Blueprint is the same
            playbook we&apos;ve run with every Navigator and Builder
            client — the only thing different is you&apos;re executing
            it self-paced instead of with weekly coaching.
          </p>
          <p className="text-grey-3 text-lg leading-relaxed">
            Fifteen minutes lets us confirm The Blueprint is the right
            tier for where you are, walk you through what&apos;s inside,
            and get you started right after the call. No sales tactics,
            no upsell pressure — if it&apos;s not a fit, we&apos;ll
            tell you and point you elsewhere.
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

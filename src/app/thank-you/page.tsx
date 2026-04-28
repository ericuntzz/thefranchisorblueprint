import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, Mail, Calendar } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Welcome to The Blueprint | The Franchisor Blueprint",
  description:
    "Your purchase is confirmed. Check your email for instant access and onboarding details.",
  robots: { index: false, follow: false },
};

export default function ThankYouPage() {
  return (
    <>
      <SiteNav />

      <PageHero
        eyebrow="You're In"
        title="Welcome to The Blueprint"
        subtitle="Your purchase is confirmed. We're already prepping your onboarding."
      />

      <section className="bg-white py-20 md:py-24">
        <div className="max-w-[760px] mx-auto px-8">
          <div className="bg-cream rounded-2xl border border-gold/30 p-8 md:p-10 text-center mb-10">
            <div className="inline-flex w-16 h-16 rounded-full bg-gradient-to-br from-navy to-navy-light items-center justify-center text-gold mb-5">
              <CheckCircle2 size={32} strokeWidth={2} />
            </div>
            <h2 className="text-navy font-extrabold text-2xl md:text-3xl mb-3">
              Payment Received
            </h2>
            <p className="text-grey-3 text-base md:text-lg leading-relaxed">
              A receipt is on its way to your inbox from Stripe. Your access details and onboarding instructions will follow shortly from our team.
            </p>
          </div>

          <div className="space-y-5">
            <div className="bg-white border border-navy/10 rounded-2xl p-7 flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold">
                <Mail size={18} />
              </div>
              <div>
                <h3 className="text-navy font-bold text-lg mb-1">Check your email</h3>
                <p className="text-grey-3 text-sm leading-relaxed">
                  Within a few minutes you&apos;ll receive a welcome email with your access link to the complete operating system and the nine implementation guides.
                </p>
              </div>
            </div>

            <div className="bg-white border border-navy/10 rounded-2xl p-7 flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold">
                <Calendar size={18} />
              </div>
              <div>
                <h3 className="text-navy font-bold text-lg mb-1">
                  Your 60-minute white-glove onboarding call
                </h3>
                <p className="text-grey-3 text-sm leading-relaxed">
                  We&apos;ll reach out within 1–2 business days to schedule your kickoff call with Jason. You&apos;ll leave that call with a clear plan for your first 30 days.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/"
              className="inline-block bg-transparent text-navy border-2 border-navy font-bold text-sm uppercase tracking-[0.1em] px-9 py-4 rounded-full hover:bg-navy hover:text-white transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}

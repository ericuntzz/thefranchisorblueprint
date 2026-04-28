import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, Calendar, BookOpen } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Thanks — We'll Be in Touch | The Franchisor Blueprint",
  description:
    "Your contact form submission has been received. We'll be in touch within one business day.",
  // No-index so this page doesn't show up in search results
  robots: { index: false, follow: false },
};

export default function ContactThankYouPage() {
  return (
    <>
      <SiteNav />

      <section className="bg-cream py-24 md:py-32">
        <div className="max-w-[760px] mx-auto px-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_12px_30px_rgba(16,185,129,0.30)] mb-6">
            <CheckCircle2 size={32} strokeWidth={2.5} />
          </div>

          <h1 className="text-navy text-4xl md:text-5xl font-bold leading-tight mb-5">
            Got it. We&apos;ll be in touch within one business day.
          </h1>
          <p className="text-grey-3 text-lg leading-relaxed mb-10 max-w-[580px] mx-auto">
            Your submission is in. Jason or someone on the team will reply with available times for your free strategy call. While you wait, two things you can do right now:
          </p>

          <div className="grid sm:grid-cols-2 gap-5 mb-12 text-left">
            <Link
              href="/strategy-call"
              className="group bg-white rounded-2xl p-6 border border-navy/10 shadow-[0_8px_24px_rgba(30,58,95,0.08)] hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(30,58,95,0.14)] transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold">
                  <Calendar size={18} />
                </div>
                <div className="text-gold-warm font-bold text-[11px] tracking-[0.14em] uppercase">
                  Skip the wait
                </div>
              </div>
              <div className="text-navy font-bold text-lg mb-1 group-hover:text-gold transition-colors">
                Book your call right now →
              </div>
              <p className="text-grey-3 text-sm leading-relaxed">
                Pick a 30-min slot from our live calendar instead of waiting for our reply.
              </p>
            </Link>

            <Link
              href="/blog"
              className="group bg-white rounded-2xl p-6 border border-navy/10 shadow-[0_8px_24px_rgba(30,58,95,0.08)] hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(30,58,95,0.14)] transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold">
                  <BookOpen size={18} />
                </div>
                <div className="text-gold-warm font-bold text-[11px] tracking-[0.14em] uppercase">
                  Read first
                </div>
              </div>
              <div className="text-navy font-bold text-lg mb-1 group-hover:text-gold transition-colors">
                The real cost of franchising →
              </div>
              <p className="text-grey-3 text-sm leading-relaxed">
                Our pricing breakdown so you walk into the call already knowing the landscape.
              </p>
            </Link>
          </div>

          <p className="text-grey-4 text-sm italic">
            If you don&apos;t see our reply within one business day, check spam or email us directly at{" "}
            <a href="mailto:hello@thefranchisorblueprint.com" className="text-navy underline font-semibold">
              hello@thefranchisorblueprint.com
            </a>
            .
          </p>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}

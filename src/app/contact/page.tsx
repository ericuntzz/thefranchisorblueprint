import Link from "next/link";
import type { Metadata } from "next";
import { Mail, ExternalLink, Calendar, ArrowRight, LifeBuoy } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Contact & Support | The Franchisor Blueprint",
  description:
    "Question about an existing purchase, refund, technical issue, or partnership inquiry? Send us a message and we'll respond within one business day.",
};

export default function ContactPage() {
  return (
    <>
      <SiteNav />

      <PageHero
        eyebrow="Contact & Support"
        title="How Can We Help?"
        subtitle="Question about an existing purchase, refund, technical issue, or partnership inquiry? Drop us a note — we respond within one business day."
      />

      {/* ===== Primary: redirect sales-intent visitors to the strategy call ===== */}
      <section className="bg-white py-16 md:py-20">
        <div className="max-w-[920px] mx-auto px-8">
          <div className="bg-gradient-to-br from-navy to-navy-light text-white rounded-2xl border border-navy/10 shadow-[0_20px_50px_rgba(30,58,95,0.15)] p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-10">
            <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-gold">
              <Calendar size={26} />
            </div>
            <div className="flex-1">
              <div className="text-gold font-bold text-[11px] tracking-[0.16em] uppercase mb-2">
                Thinking about working with us?
              </div>
              <h2 className="text-white font-extrabold text-2xl md:text-3xl mb-2 leading-tight">
                The fastest path is a free 30-minute strategy call
              </h2>
              <p className="text-white/75 text-[15px] leading-relaxed">
                We&apos;ll listen, diagnose, and tell you which tier fits — or that you&apos;re not ready yet. No pressure, no sales tactics.
              </p>
            </div>
            <Link
              href="/strategy-call"
              className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-7 py-4 rounded-full hover:bg-gold-dark transition-colors flex-shrink-0"
            >
              Book a Call
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* ===== Support form ===== */}
      <section className="bg-grey-1 py-20 md:py-24">
        <div className="max-w-[820px] mx-auto px-8">
          <div className="text-center mb-10">
            <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
              Send a Message
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Anything Else We Can Help With?
            </h2>
            <p className="text-grey-3 max-w-[620px] mx-auto">
              Use this form for support questions, billing issues, partnership inquiries, or anything that doesn&apos;t need a strategy call.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-navy/10 shadow-[0_12px_32px_rgba(30,58,95,0.08)] p-8 md:p-10">
            <form
              action="/api/contact"
              method="POST"
              className="grid md:grid-cols-2 gap-5"
            >
              <Field label="First name *" name="firstName" required />
              <Field label="Last name *" name="lastName" required />
              <Field label="Email address *" name="email" type="email" required full />
              <SelectField
                label="What's this about? *"
                name="topic"
                required
                full
                options={[
                  "Question about an existing purchase",
                  "Refund or billing issue",
                  "Technical / portal access issue",
                  "Partnership or media inquiry",
                  "Something else",
                ]}
              />
              <div className="md:col-span-2">
                <label className="block">
                  <span className="block text-navy font-semibold text-sm mb-2">
                    How can we help? *
                  </span>
                  <textarea
                    name="message"
                    rows={5}
                    required
                    className="w-full rounded-lg border border-navy/15 bg-white px-4 py-3 text-[15px] text-navy placeholder-grey-4 focus:border-gold focus:ring-2 focus:ring-gold/20 outline-none transition"
                    placeholder="Share enough detail that we can resolve it on the first reply — order numbers, screenshots, dates, etc."
                  />
                </label>
              </div>
              <div className="md:col-span-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
                <p className="text-xs text-grey-4 italic flex items-center gap-1.5">
                  <LifeBuoy size={13} className="text-gold" />
                  We respond within one business day.
                </p>
                <button
                  type="submit"
                  className="bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-8 py-4 rounded-full hover:bg-gold-dark transition-colors"
                >
                  Send Message
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* ===== Direct contact ===== */}
      <section className="bg-white py-20 md:py-24">
        <div className="max-w-[1100px] mx-auto px-8">
          <div className="text-center mb-12">
            <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
              Prefer Email?
            </span>
            <h2 className="text-3xl md:text-4xl font-bold">Reach Us Directly</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-6 max-w-[760px] mx-auto">
            <a
              href="mailto:info@thefranchisorblueprint.com"
              className="group bg-white rounded-2xl p-7 border border-navy/10 shadow-[0_8px_24px_rgba(30,58,95,0.08)] hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(30,58,95,0.14)] transition-all flex items-center gap-4"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold">
                <Mail size={22} />
              </div>
              <div>
                <div className="text-gold-warm font-bold text-[11px] tracking-[0.14em] uppercase mb-0.5">
                  Email
                </div>
                <div className="text-navy font-semibold group-hover:text-gold transition-colors">
                  info@thefranchisorblueprint.com
                </div>
              </div>
            </a>
            <a
              href="https://www.linkedin.com/in/jason-stowe-a8093539"
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-white rounded-2xl p-7 border border-navy/10 shadow-[0_8px_24px_rgba(30,58,95,0.08)] hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(30,58,95,0.14)] transition-all flex items-center gap-4"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold">
                <ExternalLink size={22} />
              </div>
              <div>
                <div className="text-gold-warm font-bold text-[11px] tracking-[0.14em] uppercase mb-0.5">
                  LinkedIn
                </div>
                <div className="text-navy font-semibold group-hover:text-gold transition-colors">
                  Connect with Jason →
                </div>
              </div>
            </a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  full,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  full?: boolean;
}) {
  return (
    <label className={`block ${full ? "md:col-span-2" : ""}`}>
      <span className="block text-navy font-semibold text-sm mb-2">{label}</span>
      <input
        type={type}
        name={name}
        required={required}
        className="w-full rounded-lg border border-navy/15 bg-white px-4 py-3 text-[15px] text-navy focus:border-gold focus:ring-2 focus:ring-gold/20 outline-none transition"
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  required,
  options,
  full,
}: {
  label: string;
  name: string;
  required?: boolean;
  options: string[];
  full?: boolean;
}) {
  return (
    <label className={`block ${full ? "md:col-span-2" : ""}`}>
      <span className="block text-navy font-semibold text-sm mb-2">{label}</span>
      <select
        name={name}
        required={required}
        defaultValue=""
        className="w-full rounded-lg border border-navy/15 bg-white px-4 py-3 text-[15px] text-navy focus:border-gold focus:ring-2 focus:ring-gold/20 outline-none transition"
      >
        <option value="" disabled>
          Select…
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { Mail, ExternalLink, Clock, MessageCircle, Target, ArrowRight } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Contact | Book a Strategy Call | The Franchisor Blueprint",
  description:
    "Schedule your free Franchise Readiness Call. No pressure, no sales tactics — just clarity on whether franchising is right for you.",
};

const expectations = [
  { Icon: MessageCircle, time: "10 min", title: "You talk, we listen", body: "Tell us about your brand, your customers, and what you want franchising to do for you." },
  { Icon: Target, time: "10 min", title: "Readiness check", body: "We evaluate where your business stands today against the franchise-ready bar." },
  { Icon: ArrowRight, time: "5 min", title: "Program fit", body: "We recommend Tier 1, 2, or 3 (or tell you to come back later) based on what we hear." },
  { Icon: Clock, time: "5 min", title: "Next steps", body: "If it's a match, we outline the path forward. If not, we'll tell you why and point you elsewhere." },
];

export default function ContactPage() {
  return (
    <>
      <SiteNav />

      <PageHero
        eyebrow="Contact Us"
        title="Let’s Talk About Your Franchise Future"
        subtitle="Ready to see if your business has what it takes to scale? Schedule a free discovery call — no pressure, no sales tactics, just clarity."
      />

      {/* ===== What to expect ===== */}
      <section className="bg-white py-24 md:py-28">
        <div className="max-w-[1200px] mx-auto px-8">
          <div className="text-center mb-14">
            <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
              What to Expect
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mb-5 max-w-[760px] mx-auto">
              30 Minutes That Will Save You Months of Guessing
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-[1100px] mx-auto">
            {expectations.map(({ Icon, time, title, body }) => (
              <div
                key={title}
                className="bg-white rounded-2xl p-7 border border-navy/10 shadow-[0_8px_24px_rgba(30,58,95,0.08)]"
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold">
                    <Icon size={20} />
                  </div>
                  <div className="text-gold-warm font-bold text-xs tracking-[0.14em] uppercase">
                    {time}
                  </div>
                </div>
                <h3 className="text-navy font-bold text-lg mb-2">{title}</h3>
                <p className="text-grey-3 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Contact Form ===== */}
      <section className="bg-grey-1 py-24 md:py-28">
        <div className="max-w-[920px] mx-auto px-8">
          <div className="bg-white rounded-2xl border border-navy/10 shadow-[0_20px_50px_rgba(30,58,95,0.10)] p-8 md:p-12">
            <div className="text-center mb-10">
              <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
                Free Strategy Call
              </span>
              <h2 className="text-3xl md:text-4xl font-bold mb-3">
                Request Your Free Franchise Readiness Call
              </h2>
              <p className="text-grey-3">
                Fill this out and we&apos;ll be in touch within one business day with available times.
              </p>
            </div>

            <form
              action="/api/contact"
              method="POST"
              className="grid md:grid-cols-2 gap-5"
            >
              <Field label="First name *" name="firstName" required />
              <Field label="Last name *" name="lastName" required />
              <Field label="Email address *" name="email" type="email" required full />
              <Field label="Business name *" name="business" required full />
              <SelectField
                label="Annual revenue *"
                name="revenue"
                required
                options={[
                  "Under $250k",
                  "$250k–$500k",
                  "$500k–$1M",
                  "$1M–$5M",
                  "$5M+",
                ]}
              />
              <SelectField
                label="Which program interests you?"
                name="program"
                options={[
                  "Not sure yet",
                  "Tier 1 — The Blueprint (DIY)",
                  "Tier 2 — Navigator (Coaching)",
                  "Tier 3 — Builder (Done-With-You)",
                ]}
              />
              <div className="md:col-span-2">
                <label className="block">
                  <span className="block text-navy font-semibold text-sm mb-2">
                    Tell us about your business
                  </span>
                  <textarea
                    name="message"
                    rows={4}
                    className="w-full rounded-lg border border-navy/15 bg-white px-4 py-3 text-[15px] text-navy placeholder-grey-4 focus:border-gold focus:ring-2 focus:ring-gold/20 outline-none transition"
                    placeholder="What does your business do? Where are you on the franchise journey?"
                  />
                </label>
              </div>
              <div className="md:col-span-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
                <p className="text-xs text-grey-4 italic">
                  We respond to all inquiries within 24 business hours.
                </p>
                <button
                  type="submit"
                  className="bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-8 py-4 rounded-full hover:bg-gold-dark transition-colors"
                >
                  Request My Free Strategy Call
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* ===== Other ways to connect ===== */}
      <section className="bg-white py-20 md:py-24">
        <div className="max-w-[1100px] mx-auto px-8">
          <div className="text-center mb-12">
            <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
              Other Ways to Reach Us
            </span>
            <h2 className="text-3xl md:text-4xl font-bold">Prefer to Skip the Form?</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-6 max-w-[760px] mx-auto">
            <a
              href="mailto:hello@thefranchisorblueprint.com"
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
                  hello@thefranchisorblueprint.com
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

      {/* ===== Quiz teaser ===== */}
      <section className="bg-cream py-20 md:py-24">
        <div className="max-w-[860px] mx-auto px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Not Ready to Talk Yet?</h2>
          <p className="text-grey-3 text-lg mb-8 max-w-[640px] mx-auto">
            Take our free 2-minute Franchise Readiness Assessment and find out instantly if your business is scalable.
          </p>
          <Link
            href="/assessment"
            className="inline-block bg-navy text-white font-bold text-sm uppercase tracking-[0.1em] px-9 py-4 rounded-full hover:bg-navy-dark transition-colors"
          >
            Take the Free Assessment
          </Link>
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
}: {
  label: string;
  name: string;
  required?: boolean;
  options: string[];
}) {
  return (
    <label className="block">
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

import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen, Mail } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Blog | The Franchisor Blueprint",
  description:
    "Insights, frameworks, and case studies on franchise development, FDD strategy, operations manuals, and scaling a franchise system.",
};

const upcomingTopics = [
  {
    category: "Readiness",
    title: "Is My Business Ready to Franchise? A 10-Point Checklist",
    excerpt: "The non-negotiable signals that separate a franchise-ready business from one that's still a great single location.",
  },
  {
    category: "Pricing",
    title: "The Real Cost of Franchising — Why You Don't Need $100K",
    excerpt: "Where the $40K–$80K consulting price tag actually comes from, and how to get the same outcome for a fraction.",
  },
  {
    category: "Legal",
    title: "FDD Explained: What It Is and Why You Need One",
    excerpt: "A plain-English walkthrough of the Franchise Disclosure Document — all 23 items, no legal jargon.",
  },
  {
    category: "Operations",
    title: "Operations Manuals: The Secret Sauce of Franchise Success",
    excerpt: "Why your ops manual is the most important sales tool you'll ever build — and how to structure it.",
  },
  {
    category: "Finance",
    title: "How to Calculate Franchise Royalties (and Find the Sweet Spot)",
    excerpt: "The royalty math that keeps franchisees profitable and franchisors growing — without strangling either side.",
  },
  {
    category: "Strategy",
    title: "DIY vs. Consultant vs. Attorney: Who Should I Hire?",
    excerpt: "When each role matters in your franchise journey, what they actually do, and how to sequence them.",
  },
  {
    category: "Launch",
    title: "The First 90 Days: What to Expect When Becoming a Franchisor",
    excerpt: "From FDD registration to your first franchisee call — the realistic timeline and what surprises most founders.",
  },
  {
    category: "Mistakes",
    title: "5 Mistakes New Franchisors Make (And How to Avoid Them)",
    excerpt: "The pattern I've seen in 30 years of advising emerging brands — and the cheap lesson before the expensive one.",
  },
];

export default function BlogPage() {
  return (
    <>
      <SiteNav />

      <PageHero
        eyebrow="Blog"
        title="Notes from the Franchise Trenches"
        subtitle="Frameworks, walkthroughs, and case studies for founders who are serious about franchising. Coming soon — subscribe below to get the first posts in your inbox."
      />

      {/* ===== Coming-soon notice ===== */}
      <section className="bg-white py-20 md:py-24">
        <div className="max-w-[760px] mx-auto px-8">
          <div className="bg-gradient-to-br from-navy to-navy-light rounded-2xl p-8 md:p-12 text-white text-center shadow-[0_20px_50px_rgba(30,58,95,0.25)]">
            <div className="w-14 h-14 mx-auto rounded-full bg-gold flex items-center justify-center text-navy mb-5">
              <BookOpen size={26} />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              The Blog Launches in 2026
            </h2>
            <p className="text-white/85 text-base md:text-lg leading-relaxed mb-7 max-w-[560px] mx-auto">
              We&apos;re finishing the first round of long-form posts now. Drop your email and you&apos;ll get the first one delivered the day it goes live — plus our free Franchise Readiness checklist as a thank-you.
            </p>
            {/* TODO (Eric): wire to ActiveCampaign */}
            <form
              action="/api/subscribe"
              method="POST"
              className="flex flex-col sm:flex-row gap-3 max-w-[460px] mx-auto"
            >
              <div className="flex-1 relative">
                <Mail
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-grey-4"
                />
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="you@yourcompany.com"
                  className="w-full pl-10 pr-4 py-3.5 rounded-full border-0 bg-white text-navy placeholder-grey-4 outline-none focus:ring-2 focus:ring-gold/50"
                />
              </div>
              <button
                type="submit"
                className="bg-gold text-navy font-bold text-xs uppercase tracking-[0.1em] px-6 py-3.5 rounded-full hover:bg-gold-dark transition-colors whitespace-nowrap"
              >
                Notify Me
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ===== Upcoming topics ===== */}
      <section className="bg-cream py-24 md:py-28">
        <div className="max-w-[1200px] mx-auto px-8">
          <div className="text-center mb-14">
            <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
              On the Editorial Calendar
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mb-5 max-w-[760px] mx-auto">
              What&apos;s Coming Up
            </h2>
            <p className="text-lg text-grey-3 max-w-[680px] mx-auto">
              Here&apos;s what we&apos;re writing first. Got a topic you want covered? Email us and we&apos;ll consider it.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingTopics.map((p) => (
              <article
                key={p.title}
                className="bg-white rounded-2xl p-7 border border-navy/10 shadow-[0_8px_24px_rgba(30,58,95,0.08)] flex flex-col"
              >
                <div className="text-gold-warm font-bold text-[11px] tracking-[0.14em] uppercase mb-3">
                  {p.category}
                </div>
                <h3 className="text-navy font-bold text-lg leading-tight mb-3">{p.title}</h3>
                <p className="text-grey-3 text-sm leading-relaxed mb-5 flex-1">{p.excerpt}</p>
                <div className="text-xs text-grey-4 italic">Coming soon</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="bg-white text-center py-20 md:py-24">
        <div className="max-w-[760px] mx-auto px-8">
          <h2 className="text-2xl md:text-4xl font-bold mb-4">
            Don&apos;t Want to Wait for Blog Posts?
          </h2>
          <p className="text-grey-3 text-lg mb-8">
            Take the Franchise Readiness Assessment now or book a strategy call to talk through your specific situation.
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
              Book a Strategy Call
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}

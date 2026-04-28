import Image from "next/image";
import Link from "next/link";
import {
  ListChecks,
  CalendarClock,
  DollarSign,
  BookMarked,
  GraduationCap,
  ScrollText,
  MapPin,
  Users,
  Presentation,
  CheckCircle2,
  XCircle,
  ShieldCheck,
} from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { Faq } from "@/components/Faq";
import { ClientLogos } from "@/components/ClientLogos";
import { DeviceMockups } from "@/components/DeviceMockups";
import { ComparisonTable } from "@/components/ComparisonTable";
import { Testimonials } from "@/components/Testimonials";
import { HowItWorks } from "@/components/HowItWorks";
import { VideoPlayer } from "@/components/VideoPlayer";

const docs = [
  { icon: ListChecks, title: "Fact-Finding Checklist", body: "150+ point audit to organize every detail of your business." },
  { icon: CalendarClock, title: "Development Timeline", body: "12-month Gantt chart roadmap to launch." },
  { icon: DollarSign, title: "Investment Overview", body: "Professional financial pro forma templates (Item 7 + Item 19)." },
  { icon: BookMarked, title: "Operations Manual", body: "17-chapter master template (100+ pages) — your brand bible." },
  { icon: GraduationCap, title: "Staff Training Program", body: "Detailed training & certification modules." },
  { icon: ScrollText, title: "FDD Explainer", body: "All 23 items decoded into plain English." },
  { icon: MapPin, title: "Site Selection Guide", body: "Proprietary scoring system for evaluating real estate." },
  { icon: Users, title: "Franchisee Scoring Matrix", body: "Qualify the right candidates instantly." },
  { icon: Presentation, title: "Discovery Day Deck", body: "29-slide presentation to close franchise deals." },
];

const yesList = [
  "You have a successful business generating $500k–$5M+ in revenue.",
  "You want to scale, but can't justify $40K–$80K in consulting fees.",
  "You are willing to do the work if you have the right guide.",
  "You want to retain control over your brand and culture.",
  "You value accountability and structured timelines.",
  "You want to launch your franchise in the next 6–12 months.",
];

const noList = [
  "Your business concept is not yet profitable or proven.",
  "You want legal advice (we are consultants, not attorneys).",
  "You want someone to do 100% of the work without your input.",
  "You're looking for a \"get rich quick\" scheme.",
];

const faqs = [
  {
    q: "Do I need an attorney to use your program?",
    a: "Yes. We are franchise consultants, not attorneys. We prepare the business framework, operations manual, and strategy — which saves you thousands in legal fees. You will still need a franchise attorney to finalize and file your FDD. We can refer you to several affordable options.",
  },
  {
    q: "How is this different from hiring a franchise attorney?",
    a: "Attorneys handle compliance. We handle business success. An attorney will write your contracts, but they won't teach you how to train franchisees, score real estate, qualify candidates, or sell your franchise. We fill that gap.",
  },
  {
    q: "What if I've never franchised before?",
    a: "That's exactly why we exist. The Blueprint is designed for first-time franchisors and breaks complex processes down into simple, sequential steps.",
  },
  {
    q: "Can I start with The Blueprint and upgrade to Navigator or Builder later?",
    a: "Absolutely. If you start with The Blueprint and realize you want more support, we credit your full $2,997 against the price of Navigator or Builder. No penalty for starting small.",
  },
  {
    q: "What happens right after I buy?",
    a: "For The Blueprint: you'll receive instant access to all 9 documents, a tier-specific intake form, and a Calendly link to book your 30-minute white-glove onboarding call within the next 1–2 business days. For Navigator and Builder: every purchase begins with a kickoff call where we map your specific 6 or 12-month engagement before any work starts.",
  },
];

export default function Home() {
  return (
    <>
      <SiteNav />

      {/* ===== 1. HERO ===== */}
      <section className="relative text-white min-h-[640px] flex items-center py-32 md:py-40 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 bg-cover bg-no-repeat"
          style={{
            backgroundImage:
              "linear-gradient(100deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.2) 55%, rgba(0,0,0,0) 100%), url('/images/hero-banner.png')",
            backgroundPosition: "right center",
          }}
          aria-hidden
        />
        <div className="max-w-[1400px] w-full mx-auto px-8">
          <span className="inline-block text-white font-semibold text-xs tracking-[0.16em] uppercase mb-6 border-b-2 border-gold pb-1">
            For business owners ready to scale
          </span>
          <h1 className="text-white font-bold text-4xl md:text-6xl leading-[1.1] tracking-tight max-w-[860px] mb-7">
            The Smartest, Most Affordable Path to Becoming a Franchisor
          </h1>
          <p className="text-white/85 text-lg md:text-xl leading-relaxed max-w-[620px] mb-10 font-light">
            A complete franchise system plus 6 months of 1:1 coaching — for a fraction of what the big firms charge. Built so you actually launch, not just file paperwork.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/assessment"
              className="bg-navy text-white font-bold text-sm uppercase tracking-[0.1em] px-9 py-4 rounded-full hover:bg-navy-dark hover:-translate-y-0.5 hover:shadow-lg transition-all"
            >
              Take the Free Assessment
            </Link>
            <Link
              href="/strategy-call"
              className="bg-transparent text-white border-2 border-white/80 font-bold text-sm uppercase tracking-[0.1em] px-9 py-4 rounded-full hover:bg-white hover:text-navy transition-colors"
            >
              Book a Strategy Call
            </Link>
          </div>
        </div>
      </section>

      {/* ===== 2. TRUST BAR (outcome-focused) ===== */}
      <div className="bg-navy text-white py-5">
        <div className="max-w-[1200px] mx-auto px-8 flex justify-center gap-x-12 gap-y-2 flex-wrap text-sm font-semibold tracking-wide text-center">
          <span>30+ Years in Franchising</span>
          <span className="hidden md:inline opacity-40">|</span>
          <span>The Only Coach-Led System</span>
          <span className="hidden md:inline opacity-40">|</span>
          <span>Launch in 6 Months, Not 18+</span>
          <span className="hidden md:inline opacity-40">|</span>
          <span>Up to 89% Less Than Big Firms</span>
        </div>
      </div>

      {/* ===== 3. PROBLEM (yellow) ===== */}
      <section className="text-center py-24 md:py-28" style={{ backgroundColor: "#d8a936" }}>
        <div className="max-w-[1100px] mx-auto px-8">
          <h2 className="text-navy text-3xl md:text-5xl font-bold mb-8 max-w-[800px] mx-auto">
            You&apos;ve Built Something Great. Now What?
          </h2>

          <p className="text-navy/85 text-lg md:text-xl leading-relaxed max-w-[760px] mx-auto mb-12">
            You&apos;ve got a profitable concept and customers who love your brand. You know franchising is the next move — but you&apos;re stuck between paying <strong>$80,000 to a big firm</strong> who hands you a binder and disappears, or trying to <strong>DIY a process you&apos;ve never done before</strong>.
          </p>

          {/* Hero video player (placeholder for Jason's intro video) */}
          <div className="mb-12">
            <VideoPlayer />
          </div>

          <div className="text-navy text-xs font-bold tracking-[0.2em] uppercase mb-7 opacity-70 mt-4">
            Trusted by Founders Who Build Brands That Last
          </div>
          <ClientLogos />
        </div>
      </section>

      {/* ===== 4. 3-STEP SOLUTION (clean warm grey, no pattern) ===== */}
      <section className="py-20 md:py-24" style={{ backgroundColor: "#cdcec9" }}>
        <div className="max-w-[1300px] mx-auto px-6">
          <div className="bg-blueprint rounded-2xl px-6 md:px-16 py-16 md:py-20">
            <h2 className="text-gold text-3xl md:text-4xl font-bold mb-14 text-center max-w-[820px] mx-auto">
              The Franchisor Blueprint: A Smarter Path to Franchise-Ready
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { iconSrc: "/icons/step-1-system.png", n: "Step 1", t: "Get the System", b: "Skip the guesswork. We provide you with a complete, 9-document franchise development system valued at over $33,500. Every checklist, template, and guide you need is ready to go." },
                { iconSrc: "/icons/step-2-coached.png", n: "Step 2", t: "Get Coached", b: "We don't disappear. For 6 months we work side by side with you through weekly coaching calls — holding you accountable and customizing the system to your specific brand." },
                { iconSrc: "/icons/step-3-launch.png", n: "Step 3", t: "Launch", b: "Complete the program, finalize your FDD with your attorney, and launch your franchise sales with a professional \"Franchise Ready\" certification. Scale faster, smarter, and cheaper." },
              ].map(({ iconSrc, n, t, b }) => (
                <div
                  key={n}
                  className="bg-white/[0.04] border border-white/10 rounded-lg p-8 text-center"
                >
                  <div className="mx-auto mb-7 flex items-center justify-center w-[88px] h-[88px]">
                    <Image
                      src={iconSrc}
                      alt={t}
                      width={80}
                      height={80}
                      className="w-20 h-20 object-contain"
                    />
                  </div>
                  <div className="text-gold font-semibold text-xs tracking-[0.16em] uppercase mb-2">{n}</div>
                  <h3 className="text-gold text-xl font-bold mb-5">{t}</h3>
                  <p className="text-white/75 text-sm leading-relaxed">{b}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== 5. 9-DOCUMENT SYSTEM (cream warmth + lifted white cards) ===== */}
      <section className="bg-cream py-24 md:py-28 relative overflow-hidden">
        {/* Dot grid accent — top right */}
        <div
          className="absolute -top-20 -right-20 w-[520px] h-[520px] pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, #1e3a5f 1px, transparent 1px)",
            backgroundSize: "30px 30px",
            maskImage: "radial-gradient(circle at top right, black 10%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(circle at top right, black 10%, transparent 70%)",
            opacity: 0.22,
          }}
          aria-hidden
        />
        <div className="max-w-[1200px] mx-auto px-8 relative">
          <div className="text-center mb-14">
            <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
              The Complete System
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mb-5 max-w-[900px] mx-auto">
              Everything You Need to Franchise Your Business — In One Complete System
            </h2>
            <p className="text-lg text-grey-3 max-w-[780px] mx-auto">
              Other firms charge $40,000 to $80,000 for documents alone. We give you a complete professional system{" "}
              <span className="text-gold-warm font-bold">valued at $33,500+</span> — plus the coaching to actually use it.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {docs.map(({ icon: Icon, title, body }, i) => (
              <div
                key={title}
                className="group bg-white p-7 rounded-xl shadow-[0_10px_30px_rgba(30,58,95,0.14)] flex gap-4 items-start hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(30,58,95,0.20)] transition-all border border-navy/10"
              >
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-navy to-navy-light rounded-xl flex items-center justify-center text-gold group-hover:scale-105 transition-transform">
                  <Icon size={22} />
                </div>
                <div>
                  <div className="text-gold-warm font-semibold text-[11px] tracking-[0.14em] uppercase mb-1">
                    Document {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3 className="text-base font-bold text-navy mb-1.5">{title}</h3>
                  <p className="text-grey-3 text-sm leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <Link
              href="/programs"
              className="inline-block bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-9 py-4 rounded-full hover:bg-gold-dark transition-colors"
            >
              See What&apos;s Included
            </Link>
          </div>
        </div>
      </section>

      {/* ===== 6. COACHING DIFFERENCE (dark navy + device mockups of real deliverables) ===== */}
      <section className="bg-blueprint text-white py-24 md:py-32 relative overflow-hidden">
        {/* Soft gold radial glow */}
        <div
          className="absolute -left-32 top-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, #d4af37 0%, transparent 70%)" }}
          aria-hidden
        />
        <div className="max-w-[1300px] mx-auto px-8 grid md:grid-cols-[1.1fr_1fr] gap-16 md:gap-20 items-center relative">
          {/* Left: Device mockups */}
          <div className="order-2 md:order-1">
            <DeviceMockups />
          </div>

          {/* Right: Copy */}
          <div className="order-1 md:order-2">
            <span className="inline-block text-gold font-semibold text-xs tracking-[0.16em] uppercase mb-4 border-b-2 border-gold pb-1">
              What you actually get
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white">
              We Don&apos;t Just Hand You a Binder. We Build It With You.
            </h2>
            <p className="text-white/75 text-base md:text-[17px] leading-relaxed mb-4">
              The number one reason emerging franchisors fail isn&apos;t bad paperwork — it&apos;s lack of guidance. Most consulting firms operate on a &ldquo;delivery&rdquo; model: they drop a 300-page manual on your desk, wish you luck, and walk away with your check.
            </p>
            <p className="text-white/75 text-base md:text-[17px] leading-relaxed">
              We operate on a &ldquo;partnership&rdquo; model. With our Navigator and Builder tiers you get structured, weekly coaching from someone who has spent 30 years inside the franchise industry. We review your work, answer your late-night questions, and hold you accountable to your launch timeline.
            </p>
            <div className="mt-8 italic text-xl md:text-2xl text-gold border-l-4 border-gold pl-6 py-4 font-light">
              We don&apos;t just give you the map. We sit in the passenger seat and help you navigate.
            </div>
          </div>
        </div>
      </section>

      {/* ===== 7. HOW IT WORKS (6-month coaching cadence) ===== */}
      <section className="bg-white py-24 md:py-28">
        <div className="max-w-[1100px] mx-auto px-8">
          <div className="text-center mb-16">
            <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
              How It Works
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mb-5 max-w-[860px] mx-auto">
              Your 6-Month Path from Concept to Franchise-Ready
            </h2>
            <p className="text-lg text-grey-3 max-w-[760px] mx-auto">
              Every Navigator engagement runs on the same proven cadence. Each month builds on the last, so by month six you have a fully documented, attorney-reviewed, sales-ready franchise system.
            </p>
          </div>
          <HowItWorks />
        </div>
      </section>

      {/* ===== 8. FOUNDER STORY (cream bg makes portrait pop) ===== */}
      <section className="bg-cream py-24 md:py-28 relative overflow-hidden">
        {/* Dot grid accent — bottom left */}
        <div
          className="absolute -bottom-20 -left-20 w-[520px] h-[520px] pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, #1e3a5f 1px, transparent 1px)",
            backgroundSize: "30px 30px",
            maskImage: "radial-gradient(circle at bottom left, black 10%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(circle at bottom left, black 10%, transparent 70%)",
            opacity: 0.22,
          }}
          aria-hidden
        />
        <div className="max-w-[1200px] mx-auto px-8 relative">
          <div className="grid md:grid-cols-[1fr_1.4fr] gap-10 md:gap-16 items-center">
            <div className="relative w-full aspect-[4/5] max-w-[320px] md:max-w-[420px] mx-auto rounded-2xl shadow-featured overflow-hidden bg-navy">
              <Image
                src="/images/jason.png"
                alt="Jason — Founder, The Franchisor Blueprint"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 320px, 420px"
              />
            </div>
            <div>
              <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.16em] uppercase mb-3 border-b-2 border-gold pb-1">
                Meet your coach
              </span>
              <h2 className="text-3xl md:text-5xl font-bold mb-6">
                30 Years in Franchising. Built for Founders Who Refuse to Wait.
              </h2>
              <p className="text-grey-3 text-base md:text-[17px] leading-relaxed mb-4">
                Jason has spent three decades inside the franchise industry — building, scaling, and advising emerging brands. He&apos;s seen the same story hundreds of times: a great business owner with a profitable concept and a real shot at scaling, priced out of franchising by consulting firms charging $40k to $80k just for paperwork.
              </p>
              <p className="text-grey-3 text-base md:text-[17px] leading-relaxed mb-6">
                The Franchisor Blueprint exists to change that. The same systems, documents, and strategies used by the big firms — packaged into an accessible, coach-led program for founders who deserve to scale.
              </p>

              {/* Credentials grid */}
              <div className="grid grid-cols-3 gap-4 md:gap-6 mb-8 pt-6 border-t border-navy/10">
                <div>
                  <div className="font-display text-3xl md:text-4xl font-extrabold text-navy leading-none mb-1">30+</div>
                  <div className="text-xs text-grey-3 font-semibold leading-tight">Years in the<br />franchise industry</div>
                </div>
                <div>
                  <div className="font-display text-3xl md:text-4xl font-extrabold text-navy leading-none mb-1">100s</div>
                  <div className="text-xs text-grey-3 font-semibold leading-tight">Brands advised<br />on franchising</div>
                </div>
                <div>
                  <div className="font-display text-3xl md:text-4xl font-extrabold text-navy leading-none mb-1">9</div>
                  <div className="text-xs text-grey-3 font-semibold leading-tight">Documents in<br />the system</div>
                </div>
              </div>

              <Link
                href="/about"
                className="inline-block bg-transparent text-navy border-2 border-navy font-bold text-sm uppercase tracking-[0.1em] px-9 py-4 rounded-full hover:bg-navy hover:text-white transition-colors"
              >
                Read Jason&apos;s Story
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 8. COMPARISON TABLE (white bg, anchors why we exist) ===== */}
      <section className="bg-white py-24 md:py-28">
        <div className="max-w-[1200px] mx-auto px-8">
          <div className="text-center mb-14">
            <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
              How We Compare
            </span>
            <h2 className="text-3xl md:text-5xl font-bold mb-5 max-w-[900px] mx-auto">
              The Smarter Middle Path Between DIY and $80K Consultants
            </h2>
            <p className="text-lg text-grey-3 max-w-[760px] mx-auto">
              Until now, founders had two choices: pay 5-figure firms for documents and figure execution out alone, or piece it together yourself and risk a costly misstep. We built the third option.
            </p>
          </div>
          <ComparisonTable />
          <div className="mt-8 text-center text-xs text-grey-4 max-w-[760px] mx-auto italic">
            Pricing for traditional consulting firms based on publicly available industry data and reported ranges. Actual pricing varies by firm and engagement scope.
          </div>
        </div>
      </section>

      {/* ===== 9. TESTIMONIALS (light grey, social proof before pricing) ===== */}
      <section className="bg-grey-1 py-24 md:py-28 relative overflow-hidden">
        <div className="max-w-[1300px] mx-auto px-8 relative">
          <div className="text-center mb-14">
            <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
              Founders Who&apos;ve Done This
            </span>
            <h2 className="text-3xl md:text-5xl font-bold max-w-[860px] mx-auto">
              Real Results from Real Founders
            </h2>
          </div>
          <Testimonials />
        </div>
      </section>

      {/* ===== 10. PRICING CARDS + GUARANTEE (cool tinted bg) ===== */}
      <section
        className="text-center py-24 md:py-28 relative overflow-hidden"
        style={{ backgroundColor: "#e3e8f0" }}
      >
        {/* Faint dot-grid texture (very subtle) */}
        <div
          className="absolute inset-0 opacity-[0.25] pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, #1e3a5f 1px, transparent 1px)",
            backgroundSize: "36px 36px",
            maskImage: "radial-gradient(ellipse at center, black 20%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 20%, transparent 70%)",
          }}
          aria-hidden
        />
        {/* Gold glow centered behind featured tier */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.22] blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, #d4af37 0%, transparent 70%)" }}
          aria-hidden
        />
        <div className="max-w-[1200px] mx-auto px-8 relative">
          <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
            Pricing
          </span>
          <h2 className="text-3xl md:text-5xl font-bold mb-14">
            Choose the Right Level of Support for Where You Are
          </h2>
          <div className="grid md:grid-cols-3 gap-7 items-stretch">
            {/* Tier 1 */}
            <div className="bg-white rounded-2xl p-10 text-left flex flex-col border border-navy/10 shadow-[0_12px_36px_rgba(30,58,95,0.18)] hover:-translate-y-1 hover:shadow-[0_24px_50px_rgba(30,58,95,0.24)] transition-all relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gold" aria-hidden />
              <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-gold-warm mb-2">Tier 1 — DIY</div>
              <h3 className="text-3xl font-bold mb-4">The Blueprint</h3>
              <div className="text-5xl font-extrabold text-navy leading-none mb-1 tracking-tight">$2,997</div>
              <div className="text-grey-4 text-sm mb-5">One-time payment</div>
              <p className="text-grey-3 text-[15px] italic mb-6">For the self-starter who just needs the tools.</p>
              <ul className="list-none flex-1 mb-8 space-y-2">
                {["Full 9-Document System", "60-Min White-Glove Onboarding Call", "30 Days Email Support"].map((f) => (
                  <li key={f} className="text-sm text-[#333] flex gap-2.5 items-start">
                    <span className="flex-shrink-0 mt-2 w-1.5 h-1.5 rounded-full bg-gold" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/programs/blueprint"
                className="block w-full text-center bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-6 py-4 rounded-full hover:bg-gold-dark transition-colors"
              >
                Buy the Blueprint
              </Link>
            </div>

            {/* Tier 2 - Featured */}
            <div className="bg-white rounded-2xl p-10 pt-10 text-left flex flex-col relative shadow-[0_24px_60px_rgba(30,58,95,0.28)] ring-1 ring-gold/30 md:-translate-y-4 hover:md:-translate-y-5 hover:shadow-[0_32px_72px_rgba(30,58,95,0.34)] transition-all">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gold text-navy px-5 py-1.5 rounded-full text-[11px] font-extrabold tracking-[0.14em] whitespace-nowrap">
                MOST POPULAR
              </div>
              <div className="bg-navy text-white -mx-10 -mt-10 mb-6 px-10 py-5 rounded-t-2xl">
                <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-gold mb-1">Tier 2</div>
                <h3 className="text-3xl font-bold text-white mb-0">Navigator</h3>
              </div>
              <div className="text-5xl font-extrabold text-navy leading-none mb-1 tracking-tight">$8,500</div>
              <div className="text-grey-4 text-sm mb-5">or $3,500 down + $1,000/mo × 6</div>
              <p className="text-grey-3 text-[15px] italic mb-6">The system + 6 months of expert coaching.</p>
              <ul className="list-none flex-1 mb-8 space-y-2">
                {["Everything in The Blueprint", "24 Weekly Coaching Calls", "Document Review & Feedback", "Unlimited Email/Slack Support"].map((f) => (
                  <li key={f} className="text-sm text-[#333] flex gap-2.5 items-start">
                    <span className="flex-shrink-0 mt-2 w-1.5 h-1.5 rounded-full bg-gold" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/strategy-call"
                className="block w-full text-center bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-6 py-4 rounded-full hover:bg-gold-dark transition-colors"
              >
                Talk to Us First
              </Link>
            </div>

            {/* Tier 3 */}
            <div className="bg-white rounded-2xl p-10 text-left flex flex-col border border-navy/10 shadow-[0_12px_36px_rgba(30,58,95,0.18)] hover:-translate-y-1 hover:shadow-[0_24px_50px_rgba(30,58,95,0.24)] transition-all relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-navy" aria-hidden />
              <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-gold-warm mb-2">Tier 3 — Done-With-You</div>
              <h3 className="text-3xl font-bold mb-4">Builder</h3>
              <div className="text-5xl font-extrabold text-navy leading-none mb-1 tracking-tight">$29,500</div>
              <div className="text-grey-4 text-sm mb-5">50% deposit + 50% at document handoff</div>
              <p className="text-grey-3 text-[15px] italic mb-6">We build it for you. Done-with-you service.</p>
              <ul className="list-none flex-1 mb-8 space-y-2">
                {["Everything in Navigator", "Done-With-You Build", "12-Month Engagement", "Vendor & Attorney Coordination"].map((f) => (
                  <li key={f} className="text-sm text-[#333] flex gap-2.5 items-start">
                    <span className="flex-shrink-0 mt-2 w-1.5 h-1.5 rounded-full bg-gold" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/strategy-call"
                className="block w-full text-center bg-navy text-white font-bold text-sm uppercase tracking-[0.1em] px-6 py-4 rounded-full hover:bg-navy-dark transition-colors"
              >
                Book Your Fit Call
              </Link>
            </div>
          </div>

          {/* Guarantee badge */}
          <div className="mt-12 mx-auto max-w-[760px] bg-white/80 backdrop-blur-sm border border-navy/10 rounded-2xl px-6 py-5 flex flex-col md:flex-row items-center gap-5 text-left shadow-[0_8px_24px_rgba(30,58,95,0.10)]">
            <div className="flex-shrink-0 w-14 h-14 rounded-full bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold">
              <ShieldCheck size={28} strokeWidth={2} />
            </div>
            <div>
              <div className="text-navy font-extrabold text-base mb-0.5">
                30-Day Satisfaction Guarantee on The Blueprint
              </div>
              <div className="text-grey-3 text-sm leading-relaxed">
                Buy Tier 1 risk-free. If the system isn&apos;t what you expected, email us within 30 days for a full refund — no friction, no hassle. <span className="text-grey-4">Coaching tiers begin with a kickoff call to confirm fit before any work starts.</span>
              </div>
            </div>
          </div>

          <div className="mt-8 text-base text-grey-3">
            Not sure which is right for you? →{" "}
            <Link href="/assessment" className="text-navy font-bold underline">
              Take the free Franchise Readiness Assessment
            </Link>
          </div>
        </div>
      </section>

      {/* ===== 11. WHO THIS IS FOR (white bg + bolder colored cards) ===== */}
      <section className="bg-white py-24 md:py-28">
        <div className="max-w-[1200px] mx-auto px-8">
          <div className="text-center mb-14">
            <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
              The Right Fit
            </span>
            <h2 className="text-3xl md:text-5xl font-bold">
              Is The Franchisor Blueprint Right for You?
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="relative p-10 md:p-12 rounded-2xl text-white overflow-hidden bg-gradient-to-br from-[#1f5d3a] to-[#2d8a55] shadow-[0_20px_50px_rgba(31,93,58,0.25)]">
              <div
                className="absolute -top-8 -right-8 w-64 h-64 pointer-events-none"
                style={{
                  backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
                  backgroundSize: "22px 22px",
                  maskImage: "radial-gradient(circle at top right, black 10%, transparent 70%)",
                  WebkitMaskImage: "radial-gradient(circle at top right, black 10%, transparent 70%)",
                  opacity: 0.28,
                }}
                aria-hidden
              />
              <div className="relative">
                <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm text-white text-xs font-bold tracking-widest uppercase px-3 py-1.5 rounded-full mb-6">
                  <CheckCircle2 size={14} /> A Fit
                </div>
                <h3 className="text-2xl md:text-3xl font-extrabold mb-7 text-white">
                  This IS for you if...
                </h3>
                <ul className="list-none space-y-3.5">
                  {yesList.map((item) => (
                    <li key={item} className="flex gap-3 items-start text-[15px] text-white/95 leading-relaxed">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center mt-0.5">
                        <CheckCircle2 className="text-white" size={14} />
                      </div>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="relative p-10 md:p-12 rounded-2xl overflow-hidden bg-gradient-to-br from-[#f5e8e8] to-[#fdf4f4] border border-[#e8d4d4]">
              <div
                className="absolute -top-8 -right-8 w-64 h-64 pointer-events-none"
                style={{
                  backgroundImage: "radial-gradient(circle, #8a3a3a 1px, transparent 1px)",
                  backgroundSize: "22px 22px",
                  maskImage: "radial-gradient(circle at top right, black 10%, transparent 70%)",
                  WebkitMaskImage: "radial-gradient(circle at top right, black 10%, transparent 70%)",
                  opacity: 0.22,
                }}
                aria-hidden
              />
              <div className="relative">
                <div className="inline-flex items-center gap-2 bg-[#8a3a3a]/10 text-[#8a3a3a] text-xs font-bold tracking-widest uppercase px-3 py-1.5 rounded-full mb-6">
                  <XCircle size={14} /> Not a Fit
                </div>
                <h3 className="text-2xl md:text-3xl font-extrabold mb-7 text-[#8a3a3a]">
                  This is NOT for you if...
                </h3>
                <ul className="list-none space-y-3.5">
                  {noList.map((item) => (
                    <li key={item} className="flex gap-3 items-start text-[15px] text-[#333] leading-relaxed">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#8a3a3a]/15 flex items-center justify-center mt-0.5">
                        <XCircle className="text-[#8a3a3a]" size={14} />
                      </div>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 12. FAQ (white bg + small gold detail) ===== */}
      <section className="bg-grey-1 py-24 md:py-28">
        <div className="max-w-[1200px] mx-auto px-8">
          <div className="text-center mb-12">
            <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
              Common Questions
            </span>
            <h2 className="text-3xl md:text-5xl font-bold">
              Frequently Asked Questions
            </h2>
          </div>
          <Faq items={faqs} />
        </div>
      </section>

      {/* ===== 13. FINAL CTA ===== */}
      <section className="bg-blueprint text-white text-center py-24 md:py-28 relative overflow-hidden">
        <div className="relative max-w-[1200px] mx-auto px-8">
          <h2 className="text-3xl md:text-6xl font-bold text-white mb-5">Ready to Scale Your Brand?</h2>
          <p className="text-lg md:text-xl text-white/85 mb-10 font-light">
            Stop dreaming about franchising and start building. Your blueprint is waiting.
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
              className="bg-transparent text-white border-2 border-white font-bold text-sm uppercase tracking-[0.1em] px-9 py-4 rounded-full hover:bg-white hover:text-navy transition-colors"
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

import Link from "next/link";
import {
  BookOpen,
  Compass,
  Rocket,
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
} from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { Faq } from "@/components/Faq";

const docs = [
  { icon: ListChecks, title: "1. Fact-Finding Checklist", body: "150+ point audit to organize every detail of your business." },
  { icon: CalendarClock, title: "2. Development Timeline", body: "12-month Gantt chart roadmap to launch." },
  { icon: DollarSign, title: "3. Investment Overview", body: "Professional financial pro forma templates (Item 7 + Item 19)." },
  { icon: BookMarked, title: "4. Operations Manual", body: "17-chapter master template (100+ pages) — your brand bible." },
  { icon: GraduationCap, title: "5. Staff Training Program", body: "Detailed training & certification modules." },
  { icon: ScrollText, title: "6. FDD Explainer", body: "All 23 items decoded into plain English." },
  { icon: MapPin, title: "7. Site Selection Guide", body: "Proprietary scoring system for evaluating real estate." },
  { icon: Users, title: "8. Franchisee Scoring Matrix", body: "Qualify the right candidates instantly." },
  { icon: Presentation, title: "9. Discovery Day Deck", body: "29-slide presentation to close franchise deals." },
];

const yesList = [
  "You have a successful business generating $500k–$5M+ in revenue.",
  "You want to scale, but can't justify $75k+ in consulting fees.",
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
      <section className="relative text-white min-h-[620px] flex items-center py-32 md:py-36">
        <div
          className="absolute inset-0 -z-10 bg-cover bg-center"
          style={{
            backgroundImage:
              "linear-gradient(135deg, rgba(30,58,95,0.92) 0%, rgba(30,58,95,0.7) 60%, rgba(30,58,95,0.45) 100%), url('https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1920&q=80')",
          }}
          aria-hidden
        />
        <div className="max-w-[1200px] w-full mx-auto px-8">
          <span className="inline-block text-gold font-bold text-xs tracking-[0.18em] uppercase mb-4">
            For business owners ready to scale
          </span>
          <h1 className="text-white font-bold text-4xl md:text-6xl leading-[1.1] max-w-[780px] mb-6">
            The Smartest, Most Affordable Path to Becoming a Franchisor
          </h1>
          <p className="text-white/90 text-lg md:text-xl leading-relaxed max-w-[680px] mb-10">
            Most consultants hand you a binder and disappear. We give you a complete, professional franchise system — plus 6 months of expert coaching to make sure you actually launch. All for a fraction of the cost of traditional firms.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/assessment"
              className="bg-gold text-navy font-bold text-sm uppercase tracking-wider px-8 py-4 rounded hover:bg-gold-dark hover:-translate-y-0.5 hover:shadow-lg transition-all"
            >
              Take the Free Assessment
            </Link>
            <Link
              href="/strategy-call"
              className="bg-transparent text-white border-2 border-white/50 font-bold text-sm uppercase tracking-wider px-8 py-4 rounded hover:bg-white hover:text-navy hover:border-white transition-colors"
            >
              Book a Strategy Call
            </Link>
          </div>
        </div>
      </section>

      {/* ===== 2. TRUST BAR ===== */}
      <div className="bg-navy text-white py-5">
        <div className="max-w-[1200px] mx-auto px-8 flex justify-center gap-x-12 gap-y-2 flex-wrap text-sm font-semibold tracking-wide text-center">
          <span>9 Professional Documents</span>
          <span className="hidden md:inline opacity-40">|</span>
          <span>$33,500+ in Value</span>
          <span className="hidden md:inline opacity-40">|</span>
          <span>6 Months of Expert Coaching</span>
          <span className="hidden md:inline opacity-40">|</span>
          <span>Fraction of Competitor Prices</span>
        </div>
      </div>

      {/* ===== 3. PROBLEM ===== */}
      <section className="bg-white text-center py-24 md:py-28">
        <div className="max-w-[820px] mx-auto px-8">
          <h2 className="text-4xl md:text-5xl font-bold mb-8">
            You&apos;ve Built Something Great. Now What?
          </h2>
          <div className="space-y-5 text-lg text-grey-3 leading-relaxed max-w-[760px] mx-auto">
            <p>You have a profitable business, a loyal customer base, and a brand people love. You know franchising is the next logical step to scale — but the path forward seems impossible.</p>
            <p>Traditional franchise consulting firms want $40,000 to $80,000 just to write your documents — leaving you with no budget to actually sell franchises. Trying to do it yourself feels risky, burying you in legal jargon and complex FDD requirements.</p>
            <p>You&apos;re stuck between &ldquo;too expensive&rdquo; and &ldquo;too complicated.&rdquo; You don&apos;t need a generic binder of paperwork. You need a partner who will help you build a system that works.</p>
          </div>
          <div className="mt-12 inline-block text-left border-l-4 border-gold pl-8 pr-6 py-4 font-display text-2xl md:text-3xl italic text-navy">
            There&apos;s a better way.
          </div>
        </div>
      </section>

      {/* ===== 4. 3-STEP SOLUTION ===== */}
      <section className="bg-grey-1 text-center py-24 md:py-28">
        <div className="max-w-[1200px] mx-auto px-8">
          <h2 className="text-4xl md:text-5xl font-bold mb-14 max-w-[780px] mx-auto">
            The Franchisor Blueprint: A Smarter Path to Franchise-Ready
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { Icon: BookOpen, n: "Step 1", t: "Get the System", b: "Skip the guesswork. We provide you with a complete, 9-document franchise development system valued at over $33,500. Every checklist, template, and guide you need is ready to go." },
              { Icon: Compass, n: "Step 2", t: "Get Coached", b: "We don't disappear. For 6 months we work side by side with you through weekly coaching calls — holding you accountable and customizing the system to your specific brand." },
              { Icon: Rocket, n: "Step 3", t: "Launch", b: "Complete the program, finalize your FDD with your attorney, and launch your franchise sales with a professional \"Franchise Ready\" certification. Scale faster, smarter, and cheaper." },
            ].map(({ Icon, n, t, b }) => (
              <div
                key={n}
                className="bg-white p-12 rounded-md shadow-card text-center hover:-translate-y-1 hover:shadow-card-hover transition-all"
              >
                <div className="mx-auto mb-6 bg-gold/10 rounded-full flex items-center justify-center text-gold w-[72px] h-[72px]">
                  <Icon size={32} />
                </div>
                <div className="text-gold font-bold text-xs tracking-widest uppercase mb-2">{n}</div>
                <h3 className="text-2xl font-bold mb-4">{t}</h3>
                <p className="text-grey-3 text-[15px] leading-relaxed">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 5. SOCIAL PROOF BAR ===== */}
      <div className="bg-grey-2 py-16 text-center">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-[1100px] mx-auto px-8">
          {[
            { num: "30+", label: "Years in Franchise Industry" },
            { num: "9", label: "Professional Documents" },
            { num: "$33.5K+", label: "System Value Delivered" },
            { num: "6 mo", label: "to Franchise-Ready" },
          ].map((s) => (
            <div key={s.label}>
              <div className="font-display text-4xl md:text-5xl font-bold text-navy leading-none mb-2">{s.num}</div>
              <div className="text-sm text-grey-3 font-semibold tracking-wide">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== 6. 9-DOCUMENT SYSTEM ===== */}
      <section className="bg-grey-1 py-24 md:py-28">
        <div className="max-w-[1200px] mx-auto px-8">
          <div className="text-center mb-14">
            <h2 className="text-4xl md:text-5xl font-bold mb-5 max-w-[900px] mx-auto">
              Everything You Need to Franchise Your Business — In One Complete System
            </h2>
            <p className="text-lg text-grey-3 max-w-[780px] mx-auto">
              Other firms charge $40,000 to $80,000 for documents alone. We give you a complete professional system{" "}
              <span className="text-gold font-bold">valued at $33,500+</span> — plus the coaching to actually use it.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {docs.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="bg-white p-7 rounded-md shadow-card flex gap-4 items-start hover:-translate-y-0.5 hover:shadow-card-hover transition-all"
              >
                <div className="flex-shrink-0 w-11 h-11 bg-navy/[0.08] rounded-lg flex items-center justify-center text-gold">
                  <Icon size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-navy font-sans mb-1.5">{title}</h3>
                  <p className="text-grey-3 text-sm leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <Link
              href="/programs"
              className="inline-block bg-gold text-navy font-bold text-sm uppercase tracking-wider px-8 py-4 rounded hover:bg-gold-dark transition-colors"
            >
              See What&apos;s Included
            </Link>
          </div>
        </div>
      </section>

      {/* ===== 7. PRICING CARDS ===== */}
      <section className="bg-white text-center py-24 md:py-28">
        <div className="max-w-[1200px] mx-auto px-8">
          <h2 className="text-4xl md:text-5xl font-bold mb-14">
            Choose the Right Level of Support for Where You Are
          </h2>
          <div className="grid md:grid-cols-3 gap-7 items-stretch">
            {/* Tier 1 */}
            <div className="bg-white border border-[#e5e5e5] rounded-lg p-10 text-left flex flex-col hover:-translate-y-1 hover:shadow-card-hover transition-all">
              <div className="text-[11px] font-bold tracking-widest uppercase text-gold mb-2">Tier 1 — DIY</div>
              <h3 className="text-3xl font-bold mb-4">The Blueprint</h3>
              <div className="font-display text-5xl font-bold text-navy leading-none mb-1">$2,997</div>
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
                className="block w-full text-center bg-gold text-navy font-bold text-sm uppercase tracking-wider px-6 py-4 rounded hover:bg-gold-dark transition-colors"
              >
                Buy the Blueprint
              </Link>
            </div>

            {/* Tier 2 - Featured */}
            <div className="bg-white rounded-lg p-10 pt-10 text-left flex flex-col relative shadow-featured md:-translate-y-4 hover:md:-translate-y-5 transition-all">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gold text-navy px-5 py-1.5 rounded-full text-[11px] font-extrabold tracking-widest whitespace-nowrap">
                MOST POPULAR
              </div>
              <div className="bg-navy text-white -mx-10 -mt-10 mb-6 px-10 py-5 rounded-t-lg">
                <div className="text-[11px] font-bold tracking-widest uppercase text-gold mb-1">Tier 2</div>
                <h3 className="text-3xl font-bold text-white mb-0">Navigator</h3>
              </div>
              <div className="font-display text-5xl font-bold text-navy leading-none mb-1">$8,500</div>
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
                className="block w-full text-center bg-gold text-navy font-bold text-sm uppercase tracking-wider px-6 py-4 rounded hover:bg-gold-dark transition-colors"
              >
                Talk to Us First
              </Link>
            </div>

            {/* Tier 3 */}
            <div className="bg-white border border-[#e5e5e5] rounded-lg p-10 text-left flex flex-col hover:-translate-y-1 hover:shadow-card-hover transition-all">
              <div className="text-[11px] font-bold tracking-widest uppercase text-gold mb-2">Tier 3 — Done-With-You</div>
              <h3 className="text-3xl font-bold mb-4">Builder</h3>
              <div className="font-display text-5xl font-bold text-navy leading-none mb-1">$29,500</div>
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
                className="block w-full text-center bg-navy text-white font-bold text-sm uppercase tracking-wider px-6 py-4 rounded hover:bg-navy-dark transition-colors"
              >
                Book Your Fit Call
              </Link>
            </div>
          </div>

          <div className="mt-10 text-base text-grey-3">
            Not sure which is right for you? →{" "}
            <Link href="/assessment" className="text-navy font-bold underline">
              Take the free Franchise Readiness Assessment
            </Link>
          </div>
        </div>
      </section>

      {/* ===== 8. COACHING DIFFERENCE ===== */}
      <section className="bg-white grid md:grid-cols-2 items-center min-h-[560px]">
        <div
          className="min-h-[300px] md:min-h-[560px]"
          style={{
            background:
              "linear-gradient(135deg, rgba(30,58,95,0.35), rgba(212,175,55,0.2)), url('https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&q=80') center/cover",
          }}
          aria-hidden
        />
        <div className="px-8 md:px-16 py-16 md:py-20">
          <span className="inline-block text-gold font-bold text-xs tracking-[0.18em] uppercase mb-4">
            What makes us different
          </span>
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            We Don&apos;t Just Hand You a Binder. We Build It With You.
          </h2>
          <p className="text-grey-3 text-base md:text-[17px] leading-relaxed mb-4">
            The number one reason emerging franchisors fail isn&apos;t bad paperwork — it&apos;s lack of guidance. Most consulting firms operate on a &ldquo;delivery&rdquo; model: they drop a 300-page manual on your desk, wish you luck, and walk away with your check.
          </p>
          <p className="text-grey-3 text-base md:text-[17px] leading-relaxed">
            We operate on a &ldquo;partnership&rdquo; model. With our Navigator and Builder tiers you get structured, weekly coaching from someone who has spent 30 years inside the franchise industry. We review your work, answer your late-night questions, and hold you accountable to your launch timeline.
          </p>
          <div className="mt-8 font-display italic text-xl md:text-2xl text-navy border-l-4 border-gold pl-6 py-4">
            We don&apos;t just give you the map. We sit in the passenger seat and help you navigate.
          </div>
        </div>
      </section>

      {/* ===== 9. WHO THIS IS FOR ===== */}
      <section className="bg-grey-1 py-24 md:py-28">
        <div className="max-w-[1200px] mx-auto px-8">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-14">
            Is The Franchisor Blueprint Right for You?
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="p-10 rounded-lg bg-green-tint border border-[#d4e5d4]">
              <h3 className="text-xl font-extrabold mb-6 font-sans text-[#2d6a2d]">
                This IS for you if...
              </h3>
              <ul className="list-none space-y-2.5">
                {yesList.map((item) => (
                  <li key={item} className="flex gap-3 items-start text-[15px] text-[#333] leading-relaxed">
                    <CheckCircle2 className="text-[#2d6a2d] flex-shrink-0 mt-0.5" size={20} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-10 rounded-lg bg-red-tint border border-[#e8d4d4]">
              <h3 className="text-xl font-extrabold mb-6 font-sans text-[#8a3a3a]">
                This is NOT for you if...
              </h3>
              <ul className="list-none space-y-2.5">
                {noList.map((item) => (
                  <li key={item} className="flex gap-3 items-start text-[15px] text-[#333] leading-relaxed">
                    <XCircle className="text-[#8a3a3a] flex-shrink-0 mt-0.5" size={20} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 10. FOUNDER STORY ===== */}
      <section className="bg-white py-24 md:py-28">
        <div className="max-w-[1200px] mx-auto px-8">
          <div className="grid md:grid-cols-[1fr_1.4fr] gap-10 md:gap-16 items-center">
            <div className="w-full aspect-[4/5] max-w-[280px] md:max-w-[400px] mx-auto rounded-lg shadow-featured flex items-center justify-center text-gold font-display text-[160px] font-bold bg-gradient-to-br from-navy to-navy-light">
              J
            </div>
            <div>
              <span className="inline-block text-gold font-bold text-xs tracking-[0.18em] uppercase mb-3">
                Meet your coach
              </span>
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                30 Years in Franchising. Built for Founders Who Refuse to Wait.
              </h2>
              <p className="text-grey-3 text-base md:text-[17px] leading-relaxed mb-4">
                After three decades in the franchise industry, Jason watched the same story play out hundreds of times: a great business owner with a profitable concept, a loyal customer base, and a real shot at scaling — priced out of franchising by consulting firms charging $40k to $80k just for paperwork.
              </p>
              <p className="text-grey-3 text-base md:text-[17px] leading-relaxed mb-6">
                The Franchisor Blueprint exists to change that. The same systems, documents, and strategies used by the big firms — packaged into an accessible, coach-led program for founders who deserve to scale.
              </p>
              <Link
                href="/about"
                className="inline-block bg-transparent text-navy border-2 border-navy font-bold text-sm uppercase tracking-wider px-8 py-4 rounded hover:bg-navy hover:text-white transition-colors"
              >
                Read Jason&apos;s Story
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 11. FAQ ===== */}
      <section className="bg-grey-1 py-24 md:py-28">
        <div className="max-w-[1200px] mx-auto px-8">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-12">
            Frequently Asked Questions
          </h2>
          <Faq items={faqs} />
        </div>
      </section>

      {/* ===== 12. FINAL CTA ===== */}
      <section className="bg-navy text-white text-center py-24 md:py-28 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-50"
          aria-hidden
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="relative max-w-[1200px] mx-auto px-8">
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-5">Ready to Scale Your Brand?</h2>
          <p className="text-lg md:text-xl text-white/85 mb-10">
            Stop dreaming about franchising and start building. Your blueprint is waiting.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/assessment"
              className="bg-gold text-navy font-bold text-sm uppercase tracking-wider px-8 py-4 rounded hover:bg-gold-dark transition-colors"
            >
              Take the Free Assessment
            </Link>
            <Link
              href="/strategy-call"
              className="bg-transparent text-white border-2 border-white font-bold text-sm uppercase tracking-wider px-8 py-4 rounded hover:bg-white hover:text-navy transition-colors"
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

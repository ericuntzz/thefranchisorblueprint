/**
 * Canonical Franchise Readiness Assessment.
 *
 * Source of truth: 03_Sales_Tools/The Franchisor Blueprint Franchise
 * Readiness Assessment_v3_2026-04-27.docx in Drive. 15 questions across
 * 7 categories. Each answer is worth 0–3 points (D/C/B/A). Total 0–45.
 *
 * Bands:
 *   38–45  franchise_ready
 *   28–37  nearly_there
 *   18–27  building_foundation
 *    < 18  early_stage
 *
 * The micro-insight on each question (insight) is what fires between
 * questions to turn the assessment from a survey into a 5-minute consult
 * with Jason. Insights are written in mentor voice, anchored to a real
 * benchmark or a specific Capability that maps to the gap. Edit freely —
 * these are reviewable copy, not load-bearing.
 */

export type AssessmentCategorySlug =
  | "business_model"
  | "financials"
  | "brand_ip"
  | "systems_ops"
  | "capital"
  | "legal"
  | "commitment";

export interface AssessmentCategory {
  slug: AssessmentCategorySlug;
  number: number; // 1–7
  title: string;
  /** Short readable label used in progress UI, e.g. "Financials". */
  shortLabel: string;
  /** Used on the result page to caption the category bar. */
  description: string;
}

export const CATEGORIES: AssessmentCategory[] = [
  {
    slug: "business_model",
    number: 1,
    title: "Business Model & Replicability",
    shortLabel: "Business Model",
    description:
      "Whether your concept can run without you and be taught to a new operator from a written system.",
  },
  {
    slug: "financials",
    number: 2,
    title: "Financials & Unit Economics",
    shortLabel: "Financials",
    description:
      "Whether your unit-level numbers can support a royalty AND your franchisee's profit AND your profit.",
  },
  {
    slug: "brand_ip",
    number: 3,
    title: "Brand Strength & IP",
    shortLabel: "Brand & IP",
    description:
      "Whether your brand is legally protected and recognizable enough that someone will pay to license it.",
  },
  {
    slug: "systems_ops",
    number: 4,
    title: "Systems & Operations",
    shortLabel: "Systems & Ops",
    description:
      "Whether the day-to-day actually runs to a documented standard — not just because you're in the room.",
  },
  {
    slug: "capital",
    number: 5,
    title: "Capital & Resources",
    shortLabel: "Capital",
    description:
      "Whether you can afford the legal, development, and support costs of becoming a franchisor in the first 12 months.",
  },
  {
    slug: "legal",
    number: 6,
    title: "Legal & Compliance Readiness",
    shortLabel: "Legal",
    description:
      "Whether you understand the FDD and have the right counsel — or know exactly how to find them.",
  },
  {
    slug: "commitment",
    number: 7,
    title: "Commitment & Readiness",
    shortLabel: "Commitment",
    description:
      "How serious you are right now, and whether your motivation will sustain a 6–12 month build.",
  },
];

/** Map for O(1) category lookup. */
export const CATEGORY_BY_SLUG: Record<AssessmentCategorySlug, AssessmentCategory> =
  Object.fromEntries(CATEGORIES.map((c) => [c.slug, c])) as Record<
    AssessmentCategorySlug,
    AssessmentCategory
  >;

export type AnswerLetter = "A" | "B" | "C" | "D";

export interface AssessmentAnswer {
  letter: AnswerLetter;
  /** The full canonical answer text. */
  text: string;
  /** Point value: A=3, B=2, C=1, D=0. */
  score: number;
}

export interface AssessmentQuestion {
  id: string; // 'q1' .. 'q15'
  number: number; // 1..15
  category: AssessmentCategorySlug;
  /** Conversational question phrasing. */
  prompt: string;
  /** Optional helper sentence shown below the prompt to frame the question. */
  helper?: string;
  answers: [AssessmentAnswer, AssessmentAnswer, AssessmentAnswer, AssessmentAnswer];
  /**
   * Mentor-voice context that fires AFTER the user answers, before the next
   * question slides in. Different message per answer letter — A is
   * affirming, D is honest about the gap. Keep ≤ 220 chars per the UI.
   * Optional — leave undefined to skip the insight beat for that question.
   */
  insight?: Partial<Record<AnswerLetter, string>>;
}

const A = (text: string): AssessmentAnswer => ({ letter: "A", text, score: 3 });
const B = (text: string): AssessmentAnswer => ({ letter: "B", text, score: 2 });
const C = (text: string): AssessmentAnswer => ({ letter: "C", text, score: 1 });
const D = (text: string): AssessmentAnswer => ({ letter: "D", text, score: 0 });

export const QUESTIONS: AssessmentQuestion[] = [
  // ─── Category 1: Business Model & Replicability ──────────────────────────
  {
    id: "q1",
    number: 1,
    category: "business_model",
    prompt: "How replicable is your core business model?",
    helper:
      "Could a trained stranger run it tomorrow without your daily input?",
    answers: [
      A("Any trained person can run it following a written system — no owner dependency."),
      B("Mostly replicable, but a few key steps still depend on me personally."),
      C("I haven't fully documented the process yet, but I believe it can be taught."),
      D("The business works largely because of my personal relationships or unique skill."),
    ],
    insight: {
      A: "That's the foundation 80% of franchise candidates lack. Everything else gets easier from here.",
      B: "Owner-dependent steps are the #1 thing we fix in Phase 1 — Codify Your Operations is built for exactly this.",
      C: "Replicability isn't intuition, it's a 17-chapter manual. Capability 04 (Codify Your Operations) handles this end-to-end.",
      D: "Honest answer. Most founders score themselves here on Q1. You can't franchise a business that depends on you — but the work to fix it is teachable.",
    },
  },
  {
    id: "q2",
    number: 2,
    category: "business_model",
    prompt: "How long has your business been operating profitably?",
    answers: [
      A("3+ years with consistent profitability and proven unit economics."),
      B("2–3 years with growing profitability."),
      C("1–2 years; still working through the numbers."),
      D("Less than 1 year, or not yet consistently profitable."),
    ],
    insight: {
      A: "3+ years of profit is the durability signal franchisees want to see in your FDD Item 19.",
      B: "Two profitable years is enough to franchise — your FDD Item 19 will lean on the trend.",
      C: "Most franchise attorneys want to see at least one full year of profit before filing. You're closer than you think.",
      D: "Franchising before unit-level profit is one of the fastest ways to lose your reputation. The Blueprint exists for the year you're in now.",
    },
  },
  {
    id: "q3",
    number: 3,
    category: "business_model",
    prompt: "Do you have a written Operations Manual or documented Standard Operating Procedures?",
    answers: [
      A("Yes — a complete, detailed manual covering all departments."),
      B("Partially — major processes are documented but gaps remain."),
      C("Informal notes and guides, but nothing formal."),
      D("Not yet — it's all in my head."),
    ],
    insight: {
      A: "Rare. Most successful operators are still in the 'partially' camp when they decide to franchise.",
      B: "You're further along than 70% of founders we talk to. Capability 04 turns 'mostly documented' into a 17-chapter franchisee-ready manual.",
      C: "Informal notes are a great starting point — that's the raw material we shape into a real Operations Manual in Phase 2.",
      D: "You don't need to write it alone. Capability 04 gives you the 100+ page template; you fill in your business's specifics.",
    },
  },
  // ─── Category 2: Financials & Unit Economics ─────────────────────────────
  {
    id: "q4",
    number: 4,
    category: "financials",
    prompt: "What's your current net profit margin at the unit level?",
    helper: "Per-location, after all costs but before franchise royalties.",
    answers: [
      A("20%+ — strong enough to absorb a 6–8% royalty and still thrive."),
      B("15–19% — workable with lean operations."),
      C("10–14% — possible but tight; royalty would be a challenge."),
      D("Below 10% — needs improvement before franchising."),
    ],
    insight: {
      A: "Healthy. You can comfortably price a 6–8% royalty without crushing your franchisee's economics.",
      B: "Workable. We'd model 5–6% royalty to keep franchisee profit attractive — Capability 03 (Model Your Unit Economics) runs the numbers.",
      C: "Tight. Below 15% margin means royalty design is the difference between a sellable franchise and a stalled one.",
      D: "Sub-10% margins make franchise math nearly impossible. The Blueprint's first 30 days are about getting unit economics right BEFORE the FDD work.",
    },
  },
  {
    id: "q5",
    number: 5,
    category: "financials",
    prompt: "Do you have a documented financial model showing how a franchisee would make money?",
    answers: [
      A("Yes — detailed pro forma with revenue projections, startup costs, and breakeven timeline."),
      B("A basic financial overview, but it needs refinement."),
      C("A general idea, but nothing documented."),
      D("No — I haven't developed this yet."),
    ],
    insight: {
      A: "This is what FDD Item 19 wants. You're already doing the work most founders skip.",
      B: "Refining this pro forma is exactly what Capability 03 (Model Your Unit Economics) is for — your draft + our template = FDD-ready.",
      C: "Until candidates can see the math, they can't sign. Capability 03 builds the pro forma your franchise sales process will live or die on.",
      D: "Don't worry — most founders haven't built this yet. The Blueprint hands you the template; you plug in your numbers.",
    },
  },
  // ─── Category 3: Brand Strength & IP ─────────────────────────────────────
  {
    id: "q6",
    number: 6,
    category: "brand_ip",
    prompt: "What's the status of your trademark?",
    answers: [
      A("Federally registered USPTO trademark (® symbol)."),
      B("Trademark application filed and pending."),
      C("Common-law trademark only (TM symbol) — not federally registered."),
      D("No trademark filed or in progress."),
    ],
    insight: {
      A: "® registered means your franchise attorney can move on FDD prep without delay.",
      B: "Pending is fine for filing the FDD — but the registration needs to land before you sign your first franchisee.",
      C: "TM-only protection breaks down the moment you cross state lines. Filing your federal trademark is usually month 1 of any serious franchise build.",
      D: "Filing a federal trademark is one of the very first things a franchise attorney will require. We coordinate this with FBLG (our recommended counsel) on day one of every Navigator engagement.",
    },
  },
  {
    id: "q7",
    number: 7,
    category: "brand_ip",
    prompt: "How would you describe your brand's market presence?",
    answers: [
      A("Strong regional or national recognition — customers seek us out."),
      B("Solid local following with growing awareness."),
      C("Early-stage brand — known primarily by repeat customers."),
      D("Brand identity is still being developed."),
    ],
    insight: {
      A: "Brand pull is what makes franchisee recruitment cheap. You're going to find people who already want to be you.",
      B: "Solid local recognition is what most successful first-time franchisors look like. Replicability matters more than scale right now.",
      C: "Early-stage is fine — you'll want a defensible brand voice, photography, and positioning before you ask someone to license it.",
      D: "Brand definition is upstream of franchising. Capability 06 covers what franchisees need to feel they're buying into something real.",
    },
  },
  // ─── Category 4: Systems & Operations ────────────────────────────────────
  {
    id: "q8",
    number: 8,
    category: "systems_ops",
    prompt: "How would you rate your current training program for new employees?",
    answers: [
      A("Comprehensive — structured onboarding, training manual, certification process."),
      B("Moderate — some structure but still evolving."),
      C("Informal — mostly on-the-job training and shadowing."),
      D("No formal training program in place."),
    ],
    insight: {
      A: "Comprehensive training is what lets your franchisee deliver your service quality from day one — that's the whole game.",
      B: "Moderate is workable — Capability 05 (Train Your Team to Replicate) takes your current training and turns it into a certification curriculum a franchisee can run.",
      C: "Shadowing doesn't transfer across state lines. Capability 05 builds the structured curriculum your franchisees need.",
      D: "Most pre-franchise businesses train this way. The training program is one of the biggest deliverables of Tier 2 Navigator.",
    },
  },
  {
    id: "q9",
    number: 9,
    category: "systems_ops",
    prompt: "How does the business run when you're not there?",
    helper: "Imagine you took 30 days off tomorrow with no contact.",
    answers: [
      A("Runs smoothly — a manager and systems handle daily operations without me."),
      B("Mostly fine, but I check in frequently to handle issues."),
      C("Requires significant owner involvement to maintain quality."),
      D("The business depends almost entirely on my presence."),
    ],
    insight: {
      A: "This is the answer that makes franchising real. If your business runs without you, it can run for someone else.",
      B: "Frequent check-ins usually trace to one or two undocumented decisions. Surfacing them is half the work of Capability 04.",
      C: "Owner-dependence isn't a character flaw — it's a documentation gap. Solvable, but it's the gap to close FIRST.",
      D: "Honest answer. Franchising someone else's daily presence isn't possible — but the system that replaces your presence is exactly what we build.",
    },
  },
  // ─── Category 5: Capital & Resources ─────────────────────────────────────
  {
    id: "q10",
    number: 10,
    category: "capital",
    prompt: "Do you have access to the capital needed to launch a franchise system?",
    helper: "Legal, development, marketing, and 12 months of franchisee support.",
    answers: [
      A("Yes — $75,000–$150,000+ allocated or accessible."),
      B("Somewhat — $35,000–$74,999 available or accessible."),
      C("Limited — $10,000–$34,999 accessible; would need to fundraise."),
      D("Not at this time — capital is a significant barrier."),
    ],
    insight: {
      A: "That's enough runway to build, file, market, and support your first 2–3 franchisees properly.",
      B: "Workable. You'll want to be selective about where every dollar goes — a Navigator engagement helps you sequence spend correctly.",
      C: "Tight. Tier 1 Blueprint at $2,997 + ~$25k of franchise legal fees is achievable here, but you'll move slower.",
      D: "Honest answer. The Blueprint isn't a substitute for capital, but it's the lowest-cost way to get every franchise asset built so you're ready when capital arrives.",
    },
  },
  {
    id: "q11",
    number: 11,
    category: "capital",
    prompt: "Do you have (or can you build) a support team for franchisee success?",
    answers: [
      A("Yes — I have or can quickly hire a training director, franchise support role, and operations lead."),
      B("Partially — I have a small team that can expand into these roles."),
      C("Currently a solo operator — would need to hire before launching."),
      D("Haven't considered this aspect of franchising yet."),
    ],
    insight: {
      A: "Having dedicated franchisee-success roles is what separates franchisors who stall at 3 units from ones who scale.",
      B: "Most successful first-time franchisors start exactly here — small team that grows into the support roles as units come online.",
      C: "Solo-operator-to-franchisor is doable but it's a real shift. Plan to hire Role #1 (franchisee support) before signing your second franchisee.",
      D: "Franchise support isn't optional — it's the product. We map the org you'll need in Phase 5 of any Navigator engagement.",
    },
  },
  // ─── Category 6: Legal & Compliance Readiness ────────────────────────────
  {
    id: "q12",
    number: 12,
    category: "legal",
    prompt: "What do you know about the Franchise Disclosure Document (FDD)?",
    answers: [
      A("I understand all 23 items and am ready to begin the drafting process."),
      B("I know the basics and have spoken with a franchise attorney."),
      C("I've heard of it but haven't dug into the details."),
      D("This is the first time I'm hearing about the FDD."),
    ],
    insight: {
      A: "Rare. You're already at the level most founders reach AFTER 30 days with us.",
      B: "Solid foundation. Capability 06 (Decode the FDD) gets you through the remaining 19 items so you walk into your attorney prepared.",
      C: "No problem — Capability 06 covers all 23 items in plain English. Most founders don't get past Item 7 without help; you'll skip that learning curve.",
      D: "If this is news, you're in the right place — that's exactly what Capability 06 handles. You'll know what an FDD actually is by the end of week one.",
    },
  },
  {
    id: "q13",
    number: 13,
    category: "legal",
    prompt: "Have you engaged or consulted with a franchise attorney?",
    answers: [
      A("Yes — I have a franchise attorney relationship established."),
      B("I've had an initial consultation but haven't retained one yet."),
      C("I've identified some attorneys but haven't reached out."),
      D("Not yet — I'm still in early exploration."),
    ],
    insight: {
      A: "Having counsel already is a major head start. The Blueprint hands you the prep work that makes their billable hours go further.",
      B: "Initial consult is the right move at this stage. We coordinate directly with FBLG (our recommended counsel) for clients who want a faster path.",
      C: "Common — the right time to retain is once your FDD prep work is done. We'll introduce you to FBLG when you're ready.",
      D: "Most founders haven't engaged counsel before this assessment. The Blueprint is built for this exact starting point.",
    },
  },
  // ─── Category 7: Commitment & Readiness ──────────────────────────────────
  {
    id: "q14",
    number: 14,
    category: "commitment",
    prompt: "How committed are you to franchising in the next 12 months?",
    answers: [
      A("Extremely — this is a top priority with dedicated time and budget."),
      B("Very interested — building toward it with some resources allocated."),
      C("Exploring seriously — researching and testing the idea."),
      D("Still in early curiosity stage — not sure if/when."),
    ],
    insight: {
      A: "Commitment is the variable that predicts launch success better than any other answer on this assessment.",
      B: "That's the energy a 6-month engagement runs on. The right tier for you depends on how much of the build you want to own yourself.",
      C: "Exploration is a real phase — and it's better than committing to the wrong path. The Blueprint is also a great way to TEST commitment before going further.",
      D: "Honest answer. We'd rather you do the foundation work first and come back when the commitment is real than oversell you a tier.",
    },
  },
  {
    id: "q15",
    number: 15,
    category: "commitment",
    prompt: "What best describes your primary motivation for franchising?",
    answers: [
      A("Build a scalable business system and create wealth through royalty income."),
      B("Expand locations faster than I can self-fund."),
      C("Get partners to carry my brand into new markets."),
      D("Someone suggested it — I'm still figuring out if it's right for me."),
    ],
    insight: {
      A: "That's the right reason. Royalty income on a system you don't run day-to-day is exactly what franchising is for.",
      B: "Capital efficiency is one of the strongest reasons to franchise. Done right, your franchisees fund your growth.",
      C: "Distributed ownership is a real advantage — your franchisees know their markets better than any corporate manager would.",
      D: "Curiosity is fine — but franchising is hard work, and the wrong reason for franchising sinks more brands than weak unit economics. Worth slowing down to confirm.",
    },
  },
];

if (QUESTIONS.length !== 15) {
  // Shouldn't happen — but if it does we'd rather fail loud than silently
  // miscount the score band thresholds.
  throw new Error(
    `Assessment registry is malformed: expected 15 questions, got ${QUESTIONS.length}`,
  );
}

/** Lookup map for O(1) access during scoring. */
export const QUESTION_BY_ID: Record<string, AssessmentQuestion> = Object.fromEntries(
  QUESTIONS.map((q) => [q.id, q]),
);

/** Maximum possible score = 15 questions × 3 points. */
export const MAX_SCORE = 45;

/**
 * Scoring + band classification + recommendation logic for the Franchise
 * Readiness Assessment.
 *
 * Pure functions — no Supabase calls. Caller is responsible for fetching
 * `AssessmentResponse[]` and feeding them in. Keeps this module trivially
 * unit-testable and identically reusable on the API routes and the result
 * page renderer.
 */

import type { AssessmentBand } from "@/lib/supabase/types";
import {
  CATEGORIES,
  CATEGORY_BY_SLUG,
  MAX_SCORE,
  QUESTION_BY_ID,
  QUESTIONS,
  type AssessmentCategorySlug,
  type AssessmentQuestion,
} from "./questions";

export interface ScoredResponse {
  question_id: string;
  answer_value: string;
  answer_score: number;
}

export interface CategoryResult {
  slug: AssessmentCategorySlug;
  title: string;
  shortLabel: string;
  description: string;
  /** Points scored in this category. */
  score: number;
  /** Maximum possible points for this category (number of questions × 3). */
  max: number;
  /** Score / max as 0–1 — useful for category bar widths. */
  ratio: number;
}

export interface AssessmentResult {
  totalScore: number;
  maxScore: number;
  band: AssessmentBand;
  bandTitle: string;
  bandHeadline: string;
  bandSummary: string;
  categories: CategoryResult[];
  /** Strongest category (highest ratio). */
  strongest: CategoryResult;
  /** Weakest category (lowest ratio). */
  weakest: CategoryResult;
  /** What to recommend on the result page + in email. */
  recommendation: BandRecommendation;
}

export interface BandRecommendation {
  /**
   * The primary CTA. Per the strategic doc reviewed with Eric:
   *   - franchise_ready / nearly_there → strategy_call
   *   - building_foundation            → buy_blueprint  (Tier 1, $2,997)
   *   - early_stage                    → roadmap_email  (lead-magnet, no call)
   */
  primary: PrimaryCta;
  /** Optional secondary action — usually the deferred path. */
  secondary?: SecondaryCta;
  /** Plain-English explanation shown above the CTA on the result page. */
  rationale: string;
}

export type PrimaryCta =
  | { kind: "strategy_call"; href: "/strategy-call"; label: "Book a strategy call"; emphasis: "high" }
  | { kind: "buy_blueprint"; href: "/programs/blueprint"; label: "Get The Blueprint — $2,997"; emphasis: "high" }
  | { kind: "roadmap_email"; href: null; label: "Your readiness roadmap is on its way"; emphasis: "calm" };

export type SecondaryCta =
  | { kind: "strategy_call"; href: "/strategy-call"; label: "Or book a strategy call" }
  | { kind: "buy_blueprint"; href: "/programs/blueprint"; label: "Or start with The Blueprint" }
  | { kind: "explore_programs"; href: "/programs"; label: "Or explore the programs" };

// ─── Score → band ──────────────────────────────────────────────────────────
export function bandForScore(totalScore: number): AssessmentBand {
  if (totalScore >= 38) return "franchise_ready";
  if (totalScore >= 28) return "nearly_there";
  if (totalScore >= 18) return "building_foundation";
  return "early_stage";
}

const BAND_COPY: Record<
  AssessmentBand,
  { title: string; headline: string; summary: string }
> = {
  franchise_ready: {
    title: "Franchise Ready",
    headline: "You're cleared for launch.",
    summary:
      "Your model is replicable, your numbers are real, and your mindset is in the right place. The remaining work is structural — documents, legal framework, sales system — not foundational.",
  },
  nearly_there: {
    title: "Nearly There",
    headline: "You're close. A few specific gaps to close.",
    summary:
      "Your business is showing strong franchise potential. The areas that need work are typically systems documentation, financial modeling, or legal preparation — all closeable in 60–90 days with the right guidance.",
  },
  building_foundation: {
    title: "Building the Foundation",
    headline: "Real potential. Foundational work first.",
    summary:
      "Your business has the bones of a franchisable concept, but there are foundational pieces — documentation, financials, brand infrastructure — that need to be built before you can sell franchises. Good news: this is exactly what The Blueprint is for.",
  },
  early_stage: {
    title: "Early Stage",
    headline: "Franchising may be in your future. Not yet.",
    summary:
      "Your business needs more seasoning before franchising makes sense. We'd rather tell you that now than sell you a tier you're not ready for. Use the roadmap below to track which gaps to close, and revisit in 6–12 months.",
  },
};

// ─── Recommendation logic ──────────────────────────────────────────────────
function recommendationFor(band: AssessmentBand): BandRecommendation {
  switch (band) {
    case "franchise_ready":
      return {
        primary: {
          kind: "strategy_call",
          href: "/strategy-call",
          label: "Book a strategy call",
          emphasis: "high",
        },
        rationale:
          "At your level, the next step is matching you to the right tier — which depends on how much of the build you want to own yourself. A 30-minute call with Jason locks that decision.",
      };
    case "nearly_there":
      return {
        primary: {
          kind: "strategy_call",
          href: "/strategy-call",
          label: "Book a strategy call",
          emphasis: "high",
        },
        secondary: {
          kind: "buy_blueprint",
          href: "/programs/blueprint",
          label: "Or start with The Blueprint",
        },
        rationale:
          "You're close enough that the conversation is about closing specific gaps, not whether to franchise. Book the call to map them out — or start with The Blueprint and bring your work to the call.",
      };
    case "building_foundation":
      return {
        primary: {
          kind: "buy_blueprint",
          href: "/programs/blueprint",
          label: "Get The Blueprint — $2,997",
          emphasis: "high",
        },
        secondary: {
          kind: "strategy_call",
          href: "/strategy-call",
          label: "Or book a strategy call",
        },
        rationale:
          "Your gaps are exactly what The Blueprint is built to close — replicability, documentation, financial modeling, FDD prep. Start there. If you want a coach for the build, Navigator is the upgrade path; if you want to talk first, the strategy call is open.",
      };
    case "early_stage":
      return {
        primary: {
          kind: "roadmap_email",
          href: null,
          label: "Your readiness roadmap is on its way",
          emphasis: "calm",
        },
        secondary: {
          kind: "explore_programs",
          href: "/programs",
          label: "Or explore the programs",
        },
        rationale:
          "We'd rather hand you a roadmap and check in in 6 months than sell you a tier you're not ready for. Watch your inbox — Jason will follow up personally with the gaps to close.",
      };
  }
}

// ─── Category aggregation ──────────────────────────────────────────────────
export function scoreCategory(
  category: AssessmentCategorySlug,
  responses: ScoredResponse[],
): CategoryResult {
  const meta = CATEGORY_BY_SLUG[category];
  const questionsInCategory = QUESTIONS.filter((q) => q.category === category);
  const max = questionsInCategory.length * 3;
  const score = responses
    .filter((r) => {
      const q = QUESTION_BY_ID[r.question_id];
      return q?.category === category;
    })
    .reduce((sum, r) => sum + r.answer_score, 0);
  const ratio = max === 0 ? 0 : score / max;
  return {
    slug: category,
    title: meta.title,
    shortLabel: meta.shortLabel,
    description: meta.description,
    score,
    max,
    ratio,
  };
}

// ─── Top-level: turn a list of responses into a full result ────────────────
export function computeResult(responses: ScoredResponse[]): AssessmentResult {
  const totalScore = responses.reduce((sum, r) => sum + r.answer_score, 0);
  const band = bandForScore(totalScore);
  const bandCopy = BAND_COPY[band];
  const categories = CATEGORIES.map((c) => scoreCategory(c.slug, responses));
  const sortedByRatio = [...categories].sort((a, b) => b.ratio - a.ratio);
  const strongest = sortedByRatio[0];
  const weakest = sortedByRatio[sortedByRatio.length - 1];
  return {
    totalScore,
    maxScore: MAX_SCORE,
    band,
    bandTitle: bandCopy.title,
    bandHeadline: bandCopy.headline,
    bandSummary: bandCopy.summary,
    categories,
    strongest,
    weakest,
    recommendation: recommendationFor(band),
  };
}

// ─── Convenience for category-scores JSON column ───────────────────────────
export function toCategoryScoresJson(
  categories: CategoryResult[],
): Record<AssessmentCategorySlug, number> {
  const out: Partial<Record<AssessmentCategorySlug, number>> = {};
  for (const c of categories) {
    out[c.slug] = c.score;
  }
  return out as Record<AssessmentCategorySlug, number>;
}

// ─── Validate a question_id + answer letter pair (used by the API) ─────────
export function validateAnswer(
  questionId: string,
  answerLetter: string,
):
  | { ok: true; question: AssessmentQuestion; score: number; letter: "A" | "B" | "C" | "D" }
  | { ok: false; reason: string } {
  const question = QUESTION_BY_ID[questionId];
  if (!question) return { ok: false, reason: `unknown question_id: ${questionId}` };
  const letter = answerLetter as "A" | "B" | "C" | "D";
  const answer = question.answers.find((a) => a.letter === letter);
  if (!answer) return { ok: false, reason: `unknown answer_value: ${answerLetter}` };
  return { ok: true, question, score: answer.score, letter };
}

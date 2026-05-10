/**
 * /assessment/result/[sessionId]
 *
 * Server-rendered result page. Reads the completed assessment_sessions row
 * and the per-question responses, recomputes the result with the same
 * scoring module the API route used (so this page survives even if the
 * stored category_scores JSON drifts), and renders:
 *
 *   - Hero band reveal (large score, band title, summary)
 *   - Strongest area + biggest gap callouts
 *   - Per-category breakdown bars (animated in via CSS)
 *   - Recommendation card with band-specific primary CTA
 *   - "Download branded PDF" button → /api/assessment/[sessionId]/pdf
 *
 * Access control: the result is gated by the resume_token. The token is
 * passed either as ?token=... (link from email) or via the resume cookie
 * (the user just finished the assessment in the same browser). Without
 * a matching token, we 404 — even though session IDs are unguessable
 * UUIDs, this prevents accidental link-sharing from leaking a result.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import {
  ArrowRight,
  Award,
  Calendar,
  Download,
  HelpCircle,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { AssessmentResponse, AssessmentSession } from "@/lib/supabase/types";
import { computeResult } from "@/lib/assessment/scoring";
import { CategoryBars } from "./CategoryBars";
import { AssessmentResultTracker } from "./AssessmentResultTracker";

const RESUME_COOKIE = "tfb_assessment_resume";

interface PageProps {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ token?: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    // Lead with "Your Score" so the tab label is identifiable even when
    // truncated. Matches the assessment page's title pattern.
    title: "Your Score | The Franchisor Blueprint | Franchise Readiness Report",
    robots: { index: false, follow: false },
  };
}

export default async function AssessmentResultPage({
  params,
  searchParams,
}: PageProps) {
  const { sessionId } = await params;
  const { token: queryToken } = await searchParams;
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(RESUME_COOKIE)?.value;
  const presented = queryToken ?? cookieToken;

  // No token at all → most likely the customer cleared cookies or is on
  // a different browser than where they took the quiz. Show a friendly
  // recovery view instead of a bare 404.
  if (!presented) {
    return <UnrecognizedLinkView />;
  }

  const supabase = getSupabaseAdmin();
  const { data: sessionData } = await supabase
    .from("assessment_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("resume_token", presented)
    .maybeSingle();
  const session = sessionData as AssessmentSession | null;

  // Session not found (link expired / shared incorrectly / token rotated).
  if (!session) {
    return <UnrecognizedLinkView />;
  }

  // Session exists but the customer didn't finish — push them back into
  // the resume flow rather than 404'ing.
  if (!session.completed_at) {
    return <NotFinishedView />;
  }

  const { data: responsesData } = await supabase
    .from("assessment_responses")
    .select("*")
    .eq("session_id", sessionId);
  const responses = (responsesData ?? []) as AssessmentResponse[];

  const result = computeResult(
    responses.map((r) => ({
      question_id: r.question_id,
      answer_value: r.answer_value,
      answer_score: r.answer_score,
    })),
  );

  const firstName = session.first_name ?? "there";
  const businessName = session.business_name;
  const reco = result.recommendation;
  const pdfUrl = `/api/assessment/${sessionId}/pdf?token=${encodeURIComponent(
    presented,
  )}`;

  return (
    <>
      {/* Fires GA4 `assessment_complete` once per page mount with score
          + recommended tier. Tiny client island; doesn't render anything. */}
      <AssessmentResultTracker score={result.totalScore} band={result.band} />
      <SiteNav />

      {/* ===== Hero reveal ===== */}
      <section className="bg-gradient-to-b from-grey-1/40 to-white border-b border-navy/5">
        <div className="max-w-[920px] mx-auto px-4 md:px-8 py-12 md:py-20">
          <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
            Your Franchise Readiness Report
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-navy leading-tight mb-2">
            {firstName}, here&apos;s your honest read.
          </h1>
          {businessName && (
            <p className="text-grey-3 text-base md:text-lg mb-8">
              Across {businessName}, scored against 7 categories of franchise readiness.
            </p>
          )}
          {!businessName && (
            <p className="text-grey-3 text-base md:text-lg mb-8">
              Scored across 7 categories of franchise readiness.
            </p>
          )}

          {/* Big score card */}
          <div className="bg-gradient-to-br from-navy to-navy-light text-white rounded-2xl p-8 md:p-12 shadow-[0_24px_60px_rgba(30,58,95,0.28)] flex flex-col md:flex-row items-start md:items-center gap-8">
            <div className="text-center md:text-left md:min-w-[180px]">
              <div className="text-[10px] font-bold tracking-[0.18em] uppercase text-gold mb-2">
                Score
              </div>
              <div className="text-7xl md:text-8xl font-extrabold text-gold leading-none mb-2 tracking-tight">
                {result.totalScore}
              </div>
              <div className="text-white/70 text-sm font-bold">
                of {result.maxScore} points
              </div>
            </div>
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 bg-gold/15 border border-gold/40 text-gold px-3 py-1 rounded-full text-[10px] font-extrabold tracking-[0.16em] uppercase mb-3">
                <Award size={12} />
                {result.bandTitle}
              </div>
              <h2 className="text-white font-bold text-2xl md:text-3xl leading-tight mb-3">
                {result.bandHeadline}
              </h2>
              <p className="text-white/85 text-base leading-relaxed">
                {result.bandSummary}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Strongest / weakest ===== */}
      <section className="bg-white py-12 md:py-16 border-b border-navy/5">
        <div className="max-w-[920px] mx-auto px-4 md:px-8">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-cream rounded-2xl border border-gold/30 p-6 md:p-8 shadow-[0_18px_40px_rgba(30,58,95,0.08)]">
              <div className="inline-flex items-center gap-2 text-gold-warm text-[10px] font-extrabold tracking-[0.16em] uppercase mb-3">
                <TrendingUp size={14} /> Strongest area
              </div>
              <h3 className="text-navy font-bold text-xl mb-2">
                {result.strongest.title}
              </h3>
              <p className="text-grey-3 text-sm md:text-[15px] leading-relaxed mb-3">
                {result.strongest.description}
              </p>
              <div className="text-navy/60 text-xs font-bold">
                {result.strongest.score} / {result.strongest.max} points
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-navy/15 p-6 md:p-8 shadow-[0_18px_40px_rgba(30,58,95,0.08)]">
              <div className="inline-flex items-center gap-2 text-navy/60 text-[10px] font-extrabold tracking-[0.16em] uppercase mb-3">
                <TrendingDown size={14} /> Biggest gap
              </div>
              <h3 className="text-navy font-bold text-xl mb-2">
                {result.weakest.title}
              </h3>
              <p className="text-grey-3 text-sm md:text-[15px] leading-relaxed mb-3">
                {result.weakest.description}
              </p>
              <div className="text-navy/60 text-xs font-bold">
                {result.weakest.score} / {result.weakest.max} points
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Category bars ===== */}
      <section className="bg-white py-12 md:py-16">
        <div className="max-w-[920px] mx-auto px-4 md:px-8">
          <div className="mb-8">
            <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-3 border-b-2 border-gold pb-1">
              Category breakdown
            </span>
            <h2 className="text-navy font-bold text-2xl md:text-3xl mb-2">
              Where you scored well — and where the work is.
            </h2>
            <p className="text-grey-3 text-base">
              Each category bar is your score over its maximum possible points.
            </p>
          </div>
          <CategoryBars categories={result.categories} />
        </div>
      </section>

      {/* ===== Recommendation + CTA ===== */}
      <section className="bg-cream py-14 md:py-20 border-y border-navy/5">
        <div className="max-w-[860px] mx-auto px-4 md:px-8">
          <div className="bg-white rounded-2xl border border-gold/40 p-7 md:p-12 shadow-[0_24px_60px_rgba(30,58,95,0.18)]">
            <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-3 border-b-2 border-gold pb-1">
              Your recommended next step
            </span>
            <h2 className="text-navy font-bold text-2xl md:text-3xl mb-4 leading-tight">
              {reco.primary.label}
            </h2>
            <p className="text-grey-3 text-base md:text-lg leading-relaxed mb-7">
              {reco.rationale}
            </p>
            <div className="flex flex-wrap items-center gap-4">
              {reco.primary.href ? (
                <Link
                  href={reco.primary.href}
                  className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-9 py-4 rounded-full hover:bg-gold-dark hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(212,175,55,0.35)] transition-all"
                >
                  {reco.primary.kind === "strategy_call" && <Calendar size={16} />}
                  {reco.primary.kind === "buy_blueprint" && <ShieldCheck size={16} />}
                  {reco.primary.label}
                  <ArrowRight size={16} />
                </Link>
              ) : (
                <div className="inline-flex items-center gap-2 bg-navy/5 text-navy/70 font-semibold text-sm tracking-wide px-6 py-3.5 rounded-full">
                  <ShieldCheck size={16} className="text-gold-warm" />
                  Roadmap email on its way
                </div>
              )}
              {reco.secondary?.href && (
                <Link
                  href={reco.secondary.href}
                  className="inline-flex items-center gap-1.5 text-navy/70 hover:text-navy text-sm font-semibold transition-colors"
                >
                  {reco.secondary.label}
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ===== Download PDF + share ===== */}
      <section className="bg-white py-12 md:py-16">
        <div className="max-w-[860px] mx-auto px-4 md:px-8">
          <div className="bg-grey-1/50 border border-navy/10 rounded-2xl p-6 md:p-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-navy font-bold text-lg mb-1">
                Save your results.
              </h3>
              <p className="text-grey-3 text-sm">
                Download a branded PDF of this report — same content, formatted for sharing or referencing later.
              </p>
            </div>
            <a
              href={pdfUrl}
              className="inline-flex items-center gap-2 bg-navy text-white font-bold text-sm uppercase tracking-[0.1em] px-6 py-3.5 rounded-full hover:bg-navy-dark transition-colors"
            >
              <Download size={16} />
              Download PDF
            </a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}

/**
 * Shown when no resume token is presented OR the token doesn't match
 * any stored session. Replaces the prior bare notFound() — most users
 * who hit this state are on a different browser than where they took
 * the quiz, or they cleared cookies. A 404 in that case feels punishing
 * for what is really just a recoverable "we don't know who you are"
 * state.
 */
function UnrecognizedLinkView() {
  return (
    <>
      <SiteNav />
      <section className="bg-cream py-20 md:py-28">
        <div className="max-w-[560px] mx-auto px-6 md:px-8">
          <div className="bg-white rounded-2xl border border-navy/10 shadow-[0_24px_60px_rgba(30,58,95,0.10)] p-8 md:p-12 text-center">
            <div className="inline-flex w-14 h-14 rounded-full bg-cream items-center justify-center text-gold-warm mb-5">
              <HelpCircle size={22} />
            </div>
            <h1 className="text-navy font-extrabold text-2xl md:text-3xl mb-3">
              We can&apos;t find your assessment result
            </h1>
            <p className="text-grey-3 text-base leading-relaxed mb-7">
              You&apos;re probably on a different browser than where you took
              the assessment, or your link has expired. The result is still
              saved — retake the assessment to get a fresh report, or email us
              if you think this is a mistake.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                href="/assessment"
                className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-7 py-3.5 rounded-full hover:bg-gold-dark transition-colors"
              >
                Take the assessment <ArrowRight size={14} />
              </Link>
              <a
                href="mailto:team@thefranchisorblueprint.com?subject=Assessment%20result%20link%20issue"
                className="inline-flex items-center gap-2 bg-transparent text-navy border-2 border-navy/15 font-bold text-sm uppercase tracking-[0.1em] px-7 py-3.5 rounded-full hover:border-navy hover:bg-navy hover:text-white transition-colors"
              >
                Email support
              </a>
            </div>
          </div>
        </div>
      </section>
      <SiteFooter />
    </>
  );
}

/**
 * Shown when the session token IS valid but the assessment isn't yet
 * complete. Pushes the customer back into the resume flow instead of
 * showing a bare 404. The /assessment page itself reads the same cookie
 * and resumes from where they left off.
 */
function NotFinishedView() {
  return (
    <>
      <SiteNav />
      <section className="bg-cream py-20 md:py-28">
        <div className="max-w-[560px] mx-auto px-6 md:px-8">
          <div className="bg-white rounded-2xl border border-gold/30 shadow-[0_24px_60px_rgba(212,162,76,0.14)] p-8 md:p-12 text-center">
            <div className="inline-flex w-14 h-14 rounded-full bg-gold/15 items-center justify-center text-gold-warm mb-5">
              <Calendar size={22} />
            </div>
            <h1 className="text-navy font-extrabold text-2xl md:text-3xl mb-3">
              Your assessment isn&apos;t finished yet
            </h1>
            <p className="text-grey-3 text-base leading-relaxed mb-7">
              You started this one but didn&apos;t answer all 15 questions, so
              there&apos;s no result to show yet. Pick up where you left off
              and we&apos;ll score you when you&apos;re done.
            </p>
            <Link
              href="/assessment"
              className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-8 py-3.5 rounded-full hover:bg-gold-dark transition-colors"
            >
              Pick up where you left off <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>
      <SiteFooter />
    </>
  );
}

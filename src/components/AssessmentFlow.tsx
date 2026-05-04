"use client";

/**
 * AssessmentFlow — the in-house Franchise Readiness Assessment UI.
 *
 * Replaces the JotForm embed at /assessment. Single-question-per-screen
 * with mentor-voice insight beats between questions, save-state cookie
 * for resume, and lead capture at the END (gated to results) rather than
 * the start.
 *
 * Design language matches the customer portal pages — cream / navy / gold
 * palette, 2xl rounded cards, gold-warm eyebrow with underline, gold
 * action buttons with `tracking-[0.1em] uppercase` styling, subtle navy
 * shadows. See src/app/portal/[capability]/page.tsx for the reference.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import {
  CATEGORY_BY_SLUG,
  QUESTIONS,
  type AnswerLetter,
  type AssessmentQuestion,
} from "@/lib/assessment/questions";

const RESUME_COOKIE = "tfb_assessment_resume";
const RESUME_MAX_AGE_DAYS = 7;

// ─── Cookie helpers (no dependencies) ──────────────────────────────────────
function setResumeCookie(token: string) {
  const expires = new Date(Date.now() + RESUME_MAX_AGE_DAYS * 86400_000).toUTCString();
  document.cookie =
    `${RESUME_COOKIE}=${encodeURIComponent(token)}; ` +
    `expires=${expires}; path=/; SameSite=Lax`;
}
function readResumeCookie(): string | null {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${RESUME_COOKIE}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}
function clearResumeCookie() {
  document.cookie = `${RESUME_COOKIE}=; max-age=0; path=/; SameSite=Lax`;
}

interface SessionState {
  sessionId: string;
  resumeToken: string;
  /** Indexed by question id, e.g. { q1: "A" }. */
  answers: Record<string, AnswerLetter>;
}

type Stage =
  | { kind: "loading" }
  | { kind: "intro" }
  | { kind: "question"; index: number }
  | { kind: "insight"; questionIndex: number; text: string; nextIndex: number }
  | { kind: "lead_capture" }
  | { kind: "submitting" };

interface LeadCaptureForm {
  firstName: string;
  email: string;
  businessName: string;
  websiteUrl: string;
  annualRevenue: string;
  urgency: string;
}

const REVENUE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "under_250k", label: "Under $250k" },
  { value: "250k_500k", label: "$250k – $500k" },
  { value: "500k_1m", label: "$500k – $1M" },
  { value: "1m_5m", label: "$1M – $5M" },
  { value: "5m_plus", label: "$5M+" },
];
const URGENCY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "ready_now", label: "I'm ready now" },
  { value: "3_months", label: "Within 3 months" },
  { value: "6_months", label: "Within 6 months" },
  { value: "exploring", label: "Just exploring" },
];

export function AssessmentFlow({ source }: { source?: string }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ kind: "loading" });
  const [session, setSession] = useState<SessionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lead, setLead] = useState<LeadCaptureForm>({
    firstName: "",
    email: "",
    businessName: "",
    websiteUrl: "",
    annualRevenue: "",
    urgency: "",
  });

  // ─── Bootstrap: try to resume from cookie, otherwise show the intro ──────
  useEffect(() => {
    const existing = readResumeCookie();
    if (!existing) {
      setStage({ kind: "intro" });
      return;
    }
    void resumeOrStart(existing).catch(() => setStage({ kind: "intro" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resumeOrStart(resumeToken: string | null) {
    setStage({ kind: "loading" });
    const res = await fetch("/api/assessment/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resumeToken: resumeToken ?? undefined,
        source: source ?? null,
      }),
    });
    if (!res.ok) {
      setError("We couldn't start the assessment. Please refresh.");
      setStage({ kind: "intro" });
      return;
    }
    const data: {
      sessionId: string;
      resumeToken: string;
      answers: Array<{ questionId: string; answerValue: AnswerLetter }>;
    } = await res.json();
    setResumeCookie(data.resumeToken);
    const answers: Record<string, AnswerLetter> = {};
    for (const a of data.answers ?? []) answers[a.questionId] = a.answerValue;
    setSession({ sessionId: data.sessionId, resumeToken: data.resumeToken, answers });
    // Resume to the first un-answered question (or 0 if fresh).
    const nextIndex = QUESTIONS.findIndex((q) => !(q.id in answers));
    if (nextIndex === -1) {
      setStage({ kind: "lead_capture" });
    } else {
      setStage({ kind: "question", index: nextIndex });
    }
  }

  // (Auto-scroll on stage transition was removed — it was causing the page
  // to jump on every click. Stage cards now share a min-height so the
  // section anchor stays put as content swaps.)

  // Tab-title nudge. While the user is mid-flow (answering a question or
  // reading an insight) AND tabs away from us, swap the tab title to a
  // "come back" prompt. Restored the moment they refocus the tab, and
  // also restored on cleanup so the title is never left in a weird state
  // if React unmounts mid-blur.
  useEffect(() => {
    const isMidFlow = stage.kind === "question" || stage.kind === "insight";
    if (!isMidFlow) return;
    if (typeof document === "undefined") return;
    const original = document.title;
    const nudgeTitle = "⏸ Resume your assessment";
    const handle = () => {
      document.title =
        document.visibilityState === "hidden" ? nudgeTitle : original;
    };
    document.addEventListener("visibilitychange", handle);
    return () => {
      document.removeEventListener("visibilitychange", handle);
      document.title = original;
    };
  }, [stage.kind]);

  // Send a single answer to the API. Retries once on a 404 by transparently
  // restarting the session — handles the case where the client's sessionId
  // doesn't exist on the server (deploy wiped state, browser was idle with
  // a stale session, etc). Returns the parsed insight if successful.
  async function postAnswer(
    s: SessionState,
    question: AssessmentQuestion,
    letter: AnswerLetter,
  ): Promise<{ ok: true; insight: string | null } | { ok: false; status: number }> {
    const res = await fetch("/api/assessment/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: s.sessionId,
        // resumeToken intentionally omitted — the /answer API no longer
        // gates on it (sessionId UUID is sufficient credential for a
        // free assessment) and keeping it out of the body avoids
        // confusing future readers about which fields are required.
        questionId: question.id,
        answerValue: letter,
      }),
    });
    if (res.ok) {
      const data: { insight: string | null } = await res.json();
      return { ok: true, insight: data.insight };
    }
    return { ok: false, status: res.status };
  }

  async function answerQuestion(question: AssessmentQuestion, letter: AnswerLetter) {
    if (!session) return;
    setError(null);
    // Optimistic update so the UI feels snappy.
    setSession({
      ...session,
      answers: { ...session.answers, [question.id]: letter },
    });

    let result = await postAnswer(session, question, letter);

    // Recovery path: server says our session doesn't exist. Spin up a fresh
    // one and re-submit. The user never sees a failure — the click "just
    // works" even if our local state has drifted from the server.
    if (!result.ok && result.status === 404) {
      try {
        const startRes = await fetch("/api/assessment/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: source ?? "answer_recovery" }),
        });
        if (startRes.ok) {
          const fresh: { sessionId: string; resumeToken: string } = await startRes.json();
          setResumeCookie(fresh.resumeToken);
          const refreshed: SessionState = {
            sessionId: fresh.sessionId,
            resumeToken: fresh.resumeToken,
            answers: { [question.id]: letter },
          };
          setSession(refreshed);
          result = await postAnswer(refreshed, question, letter);
        }
      } catch {
        /* fall through to the error UI below */
      }
    }

    if (!result.ok) {
      setError("We couldn't save your answer. Please try again.");
      return;
    }

    const currentIndex = QUESTIONS.findIndex((q) => q.id === question.id);
    const nextIndex = currentIndex + 1;
    if (result.insight) {
      setStage({
        kind: "insight",
        questionIndex: currentIndex,
        text: result.insight,
        nextIndex,
      });
    } else {
      advanceFrom(nextIndex);
    }
  }

  function advanceFrom(nextIndex: number) {
    if (nextIndex >= QUESTIONS.length) {
      setStage({ kind: "lead_capture" });
    } else {
      setStage({ kind: "question", index: nextIndex });
    }
  }

  function goBack() {
    if (stage.kind === "question" && stage.index > 0) {
      setStage({ kind: "question", index: stage.index - 1 });
    } else if (stage.kind === "lead_capture") {
      setStage({ kind: "question", index: QUESTIONS.length - 1 });
    }
  }

  async function submitLead() {
    if (!session) return;
    setError(null);
    setStage({ kind: "submitting" });
    const res = await fetch("/api/assessment/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        email: lead.email,
        firstName: lead.firstName,
        businessName: lead.businessName,
        // Captured here so the agentic-portal pre-fill scrape (Phase 1)
        // has a head start by the time the customer purchases. Optional.
        websiteUrl: lead.websiteUrl,
        annualRevenue: lead.annualRevenue,
        urgency: lead.urgency,
      }),
    });
    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as { error?: string };
      setError(errBody.error ?? "Something went wrong. Please try again.");
      setStage({ kind: "lead_capture" });
      return;
    }
    const data: { resultUrl: string } = await res.json();
    clearResumeCookie();
    router.push(data.resultUrl);
  }

  // ─── Render ────────────────────────────────────────────────────────────
  // Stage-key trick: every distinct stage gets a stable key so React
  // remounts the inner card on transition, which re-fires the
  // `tfb-stage-in` CSS animation. The error banner sits OUTSIDE the keyed
  // wrapper so it doesn't re-animate on every navigation.
  const stageKey =
    stage.kind === "question"
      ? `q-${stage.index}`
      : stage.kind === "insight"
        ? `i-${stage.questionIndex}`
        : stage.kind;

  return (
    <div className="max-w-[820px] mx-auto px-4 md:px-8">
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}
      <div key={stageKey} className="tfb-stage-in">
        {stage.kind === "loading" && <LoadingCard />}
        {stage.kind === "intro" && (
          <IntroCard onStart={() => void resumeOrStart(null)} />
        )}
        {stage.kind === "question" && session && QUESTIONS[stage.index] && (
          <QuestionCard
            question={QUESTIONS[stage.index]}
            index={stage.index}
            total={QUESTIONS.length}
            selected={session.answers[QUESTIONS[stage.index].id] ?? null}
            onAnswer={(letter) => void answerQuestion(QUESTIONS[stage.index], letter)}
            onBack={stage.index > 0 ? goBack : null}
          />
        )}
        {stage.kind === "insight" && (
          <InsightCard
            text={stage.text}
            onContinue={() => advanceFrom(stage.nextIndex)}
            progress={(stage.questionIndex + 1) / QUESTIONS.length}
          />
        )}
        {stage.kind === "lead_capture" && (
          <LeadCaptureCard
            values={lead}
            setValues={setLead}
            onBack={goBack}
            onSubmit={submitLead}
          />
        )}
        {stage.kind === "submitting" && <SubmittingCard />}
      </div>
    </div>
  );
}

// ─── Sub-components (kept in-file; this is the primary surface) ───────────

// Shared sizing constants. Every stage card uses these so the section
// reserves the same vertical space regardless of which stage is active —
// no "page jumps" when the user clicks an answer or the Continue button.
const CARD_BASE =
  "bg-white rounded-2xl border border-navy/10 shadow-[0_30px_60px_rgba(30,58,95,0.16),0_8px_18px_rgba(30,58,95,0.06)] min-h-[560px] md:min-h-[620px]";

function LoadingCard() {
  return (
    <div
      className={`${CARD_BASE} p-10 md:p-14 text-center flex flex-col items-center justify-center`}
    >
      <div className="inline-flex w-12 h-12 rounded-xl bg-cream items-center justify-center text-gold-warm mb-4">
        <Sparkles size={20} />
      </div>
      <p className="text-grey-3 text-sm">One moment — getting your assessment ready.</p>
    </div>
  );
}

function IntroCard({ onStart }: { onStart: () => void }) {
  return (
    <div
      className={`${CARD_BASE} p-10 md:p-14 text-center flex flex-col items-center justify-center`}
    >
      <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-4 border-b-2 border-gold pb-1">
        15 questions · 5–7 minutes
      </span>
      <h2 className="text-3xl md:text-4xl font-bold text-navy mb-4">
        Honest answers. Honest score. A real next step.
      </h2>
      <p className="text-grey-3 text-base md:text-lg leading-relaxed max-w-[640px] mx-auto mb-8">
        We&apos;ll walk through 15 questions across 7 readiness categories — the
        same ones a franchise attorney and your first franchisees will care
        about. You&apos;ll get an honest score and a tailored next step. No
        email required to start.
      </p>
      <button
        onClick={onStart}
        className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-9 py-4 rounded-full hover:bg-gold-dark hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(212,175,55,0.35)] transition-all"
      >
        Start the assessment
        <ArrowRight size={16} />
      </button>
    </div>
  );
}

function ProgressBar({ progress, label }: { progress: number; label: string }) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between text-[11px] font-bold tracking-[0.14em] uppercase text-grey-3 mb-2">
        <span>{label}</span>
        <span>{Math.round(progress * 100)}%</span>
      </div>
      <div
        className="h-1.5 bg-navy/10 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full bg-gradient-to-r from-gold to-gold-warm transition-[width] duration-500 ease-out"
          style={{ width: `${Math.max(2, progress * 100)}%` }}
        />
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  index,
  total,
  selected,
  onAnswer,
  onBack,
}: {
  question: AssessmentQuestion;
  index: number;
  total: number;
  selected: AnswerLetter | null;
  onAnswer: (letter: AnswerLetter) => void;
  onBack: (() => void) | null;
}) {
  const category = CATEGORY_BY_SLUG[question.category];
  const progress = (index + 1) / total;
  return (
    <div className={`${CARD_BASE} p-7 md:p-12 flex flex-col`}>
      <ProgressBar
        progress={progress}
        label={`Question ${index + 1} of ${total} · ${category.shortLabel}`}
      />
      <h2 className="text-2xl md:text-3xl font-bold text-navy leading-tight mt-6 mb-2">
        {question.prompt}
      </h2>
      {question.helper && (
        <p className="text-grey-3 text-base mb-6">{question.helper}</p>
      )}
      <div className="space-y-2.5 mt-6">
        {question.answers.map((a) => {
          const isSelected = selected === a.letter;
          return (
            <button
              key={a.letter}
              onClick={() => onAnswer(a.letter)}
              aria-pressed={isSelected}
              className={`w-full text-left rounded-xl border-2 px-5 py-4 transition-all flex gap-4 items-start ${
                isSelected
                  ? "border-gold bg-cream-light shadow-[0_4px_16px_rgba(212,175,55,0.18)]"
                  : "border-navy/10 bg-white hover:border-gold/50 hover:bg-cream/40"
              }`}
            >
              <span
                className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold ${
                  isSelected
                    ? "bg-gold text-navy"
                    : "bg-navy/5 text-navy/60"
                }`}
              >
                {a.letter}
              </span>
              <span className="text-[15px] leading-relaxed text-[#222]">
                {a.text}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-7 pt-5 border-t border-navy/5 flex items-center justify-between">
        {onBack ? (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-grey-3 hover:text-navy text-sm font-semibold transition-colors"
          >
            <ArrowLeft size={14} />
            Previous
          </button>
        ) : (
          <span />
        )}
        <span className="text-xs text-grey-4 italic">
          Pick the option that&apos;s honestly true today.
        </span>
      </div>
    </div>
  );
}

function InsightCard({
  text,
  onContinue,
  progress,
}: {
  text: string;
  onContinue: () => void;
  progress: number;
}) {
  return (
    <div
      className="bg-cream rounded-2xl border border-gold/30 shadow-[0_30px_60px_rgba(30,58,95,0.16),0_8px_18px_rgba(30,58,95,0.06)] min-h-[560px] md:min-h-[620px] p-7 md:p-10 flex flex-col"
    >
      <ProgressBar progress={progress} label="Quick beat from Jason" />
      <div className="flex gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold">
          <Sparkles size={18} />
        </div>
        <div className="flex-1">
          <div className="text-[10px] font-bold tracking-[0.18em] uppercase text-gold-warm mb-2">
            From Jason
          </div>
          <p className="text-navy text-base md:text-lg leading-relaxed font-medium">
            {text}
          </p>
        </div>
      </div>
      <div className="mt-7 flex justify-end">
        <button
          onClick={onContinue}
          className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-7 py-3.5 rounded-full hover:bg-gold-dark transition-colors"
        >
          Continue
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function LeadCaptureCard({
  values,
  setValues,
  onBack,
  onSubmit,
}: {
  values: LeadCaptureForm;
  setValues: (v: LeadCaptureForm) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const valid = useMemo(() => {
    return (
      values.firstName.trim().length > 0 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())
    );
  }, [values]);

  return (
    <div className={`${CARD_BASE} p-7 md:p-12`}>
      <div className="text-center mb-7">
        <div className="inline-flex w-12 h-12 rounded-xl bg-cream items-center justify-center text-gold-warm mb-3">
          <CheckCircle2 size={20} />
        </div>
        <span className="block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-3 border-b-2 border-gold pb-1 mx-auto w-fit">
          One more step · Then your score
        </span>
        <h2 className="text-2xl md:text-3xl font-bold text-navy mb-2 leading-tight">
          Where should we send your results?
        </h2>
        <p className="text-grey-3 text-base max-w-[520px] mx-auto leading-relaxed">
          You&apos;ll see your score on the next screen. We&apos;ll also email
          you a branded PDF report so you can come back to it.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSubmit();
        }}
        className="space-y-4 max-w-[600px] mx-auto"
      >
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="First name" required>
            <input
              type="text"
              required
              value={values.firstName}
              onChange={(e) => setValues({ ...values, firstName: e.target.value })}
              className="w-full bg-white border border-navy/15 rounded-xl px-4 py-3 text-[15px] text-navy focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
              placeholder="Jane"
            />
          </Field>
          <Field label="Email" required>
            <input
              type="email"
              required
              value={values.email}
              onChange={(e) => setValues({ ...values, email: e.target.value })}
              className="w-full bg-white border border-navy/15 rounded-xl px-4 py-3 text-[15px] text-navy focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
              placeholder="jane@yourbrand.com"
            />
          </Field>
        </div>
        <Field label="Business name">
          <input
            type="text"
            value={values.businessName}
            onChange={(e) => setValues({ ...values, businessName: e.target.value })}
            className="w-full bg-white border border-navy/15 rounded-xl px-4 py-3 text-[15px] text-navy focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
            placeholder="Optional — helps us personalize the call"
          />
        </Field>
        <Field label="Website">
          <input
            type="url"
            value={values.websiteUrl}
            onChange={(e) => setValues({ ...values, websiteUrl: e.target.value })}
            className="w-full bg-white border border-navy/15 rounded-xl px-4 py-3 text-[15px] text-navy focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
            placeholder="yourbrand.com (optional — speeds up your portal pre-fill if you join)"
          />
        </Field>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Annual revenue">
            <select
              value={values.annualRevenue}
              onChange={(e) => setValues({ ...values, annualRevenue: e.target.value })}
              className="w-full bg-white border border-navy/15 rounded-xl px-4 py-3 text-[15px] text-navy focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
            >
              <option value="">Optional</option>
              {REVENUE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="How urgent is this?">
            <select
              value={values.urgency}
              onChange={(e) => setValues({ ...values, urgency: e.target.value })}
              className="w-full bg-white border border-navy/15 rounded-xl px-4 py-3 text-[15px] text-navy focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
            >
              <option value="">Optional</option>
              {URGENCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="text-xs text-grey-4 leading-relaxed pt-1">
          We&apos;ll never share your info. Reply &quot;stop&quot; to any email
          and we&apos;ll never email you again.
        </p>
        <div className="pt-3 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-grey-3 hover:text-navy text-sm font-semibold transition-colors"
          >
            <ArrowLeft size={14} />
            Edit my last answer
          </button>
          <button
            type="submit"
            disabled={!valid}
            className={`inline-flex items-center gap-2 font-bold text-sm uppercase tracking-[0.1em] px-9 py-4 rounded-full transition-all ${
              valid
                ? "bg-gold text-navy hover:bg-gold-dark hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(212,175,55,0.35)]"
                : "bg-navy/10 text-navy/40 cursor-not-allowed"
            }`}
          >
            Show my score
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}

function SubmittingCard() {
  return (
    <div
      className={`${CARD_BASE} p-10 md:p-14 text-center flex flex-col items-center justify-center`}
    >
      <div className="inline-flex w-12 h-12 rounded-xl bg-gradient-to-br from-navy to-navy-light items-center justify-center text-gold mb-4">
        <Sparkles size={20} className="animate-pulse" />
      </div>
      <h3 className="text-navy font-bold text-xl mb-2">Calculating your score…</h3>
      <p className="text-grey-3 text-sm">Your results are loading.</p>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-bold tracking-[0.12em] uppercase text-navy/70 mb-1.5">
        {label}
        {required && <span className="text-gold-warm ml-1">*</span>}
      </span>
      {children}
    </label>
  );
}

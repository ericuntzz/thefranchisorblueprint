"use client";

/**
 * QuestionQueueClient — one-question-at-a-time guided flow.
 *
 * Lifts the schema's per-field metadata into a TurboTax-style card
 * sequence. State model is intentionally simple: an index into the
 * queue + the current draft value. After each save we advance the
 * index locally; the server has already persisted, and the next page
 * reload (which the user might not even trigger) will recompute a
 * fresh queue.
 *
 * Phase awareness:
 *   - When the customer crosses out of one phase into the next, we
 *     show a brief "Discover phase complete →" celebration card with
 *     a "Continue" CTA. The visual break lets the customer feel
 *     progress without us inventing an artificial gate.
 *
 * Skip behavior:
 *   - "Skip for now" advances without writing. The skipped item stays
 *     in Memory as empty, so it'll reappear next visit. This is the
 *     "I'll come back to this" affordance every TurboTax screen has.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Globe,
  Loader2,
  Sparkles,
} from "lucide-react";
import type { QueueItem, QueueSummary } from "@/lib/memory/queue";
import { PHASE_DOC_ANCHOR, type PhaseId } from "@/lib/memory/phases";
import { SchemaFieldInput } from "@/components/agent/SchemaFieldInput";
import { DocPromptCard } from "@/components/agent/DocPromptCard";
import { docPromptFor } from "@/lib/memory/doc-prompts";
import type { MemoryFileSlug } from "@/lib/memory/files";

type FieldValue = string | number | boolean | string[] | null;

type Props = {
  initialQueue: QueueItem[];
  initialSummary: QueueSummary;
  /** True when the customer has already added a website (and we ran
   *  the scrape). Suppresses the "skip the typing" banner. */
  hasWebsite: boolean;
  /** Per-chapter attachment count. Drives the inline doc-prompt
   *  banner — only show when current chapter has zero attachments
   *  (else the customer already gave us material for it). */
  attachmentCountBySlug: Record<string, number>;
  /** Server action — single-field save. */
  save: (args: {
    slug: string;
    fieldName: string;
    value: FieldValue;
  }) => Promise<void>;
};

export function QuestionQueueClient({
  initialQueue,
  initialSummary,
  hasWebsite,
  attachmentCountBySlug,
  save,
}: Props) {
  // The queue is a snapshot taken at page load. We don't mutate it
  // here — we track an index + a per-item-id Set of "completed"
  // items so the UI can show progress without a server round-trip.
  // A page refresh recomputes the canonical queue.
  const queue = initialQueue;
  const [draft, setDraft] = useState<FieldValue>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  // Phase-transition cards we've already shown this session. When the
  // customer crosses Discover → Economics, we render a celebration +
  // "got a P&L?" card BEFORE the next question; once they hit
  // Continue we mark the phase id seen so a Back / Save round-trip
  // doesn't replay the same card. Per-session only — a refresh
  // re-shows the transitions, which is fine: the docs they want to
  // upload haven't moved.
  const [seenTransitions, setSeenTransitions] = useState<Set<PhaseId>>(
    new Set(),
  );
  // Navigation: index + visited stack as ONE atomic state object.
  // Earlier had them as two separate useStates and Back skipped two
  // questions instead of one — race-prone because the Back handler
  // read `visited` from the closure while React batched updates from
  // the immediately-prior advance. Single setNav() pop avoids it.
  const [nav, setNav] = useState<{ index: number; visited: number[] }>({
    index: 0,
    visited: [],
  });
  const index = nav.index;
  // Slide direction for the question-card transition. "forward" =
  // Save/Skip (new card slides in from the right). "back" = Back
  // (new card slides in from the left). Initial render = "forward".
  const [lastDirection, setLastDirection] = useState<"forward" | "back">(
    "forward",
  );

  const current = queue[index];
  const phaseStart =
    index === 0 || queue[index - 1]?.phase.id !== current?.phase.id;
  // Show the transition card on every NEW phase boundary (not the
  // very first phase — there's no "previous phase" to celebrate).
  // Once dismissed for a given phase id, we skip it on revisits.
  const previousPhase =
    index > 0 ? queue[index - 1]?.phase ?? null : null;
  const showTransition =
    phaseStart &&
    index > 0 &&
    !!current &&
    !!previousPhase &&
    previousPhase.id !== current.phase.id &&
    !seenTransitions.has(current.phase.id);

  const phaseProgress = useMemo(() => {
    if (!current) return null;
    const inPhase = queue.filter((q) => q.phase.id === current.phase.id);
    const doneInPhase = inPhase.filter(
      (q) =>
        completed.has(q.id) || queue.indexOf(q) < index,
    ).length;
    return { done: doneInPhase, total: inPhase.length };
  }, [current, queue, completed, index]);

  // Done — every item processed.
  if (!current) {
    return (
      <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-8 text-center">
        <CheckCircle2
          size={32}
          className="text-emerald-600 mx-auto mb-3"
        />
        <h1 className="text-navy font-extrabold text-2xl md:text-3xl mb-3">
          That&apos;s the queue.
        </h1>
        <p className="text-emerald-900/85 mb-6 max-w-[520px] mx-auto leading-relaxed">
          Jason has everything he needs for a credible first pass on every
          foundational chapter. Head into the Blueprint to redraft what you
          want refreshed, or come back here later — new questions surface as
          earlier answers unlock new sections.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/portal/lab/blueprint"
            className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-xs uppercase tracking-[0.1em] px-5 py-3 rounded-full hover:bg-gold-dark transition-colors"
          >
            Open the Blueprint <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    );
  }

  async function onSave() {
    if (!current) return;
    setSaving(true);
    setErr(null);
    try {
      await save({
        slug: current.slug,
        fieldName: current.fieldDef.name,
        value: draft,
      });
      setCompleted((s) => new Set(s).add(current.id));
      advance();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function onSkip() {
    if (!current) return;
    advance();
  }

  function advance() {
    setLastDirection("forward");
    setNav((n) => ({ index: n.index + 1, visited: [...n.visited, n.index] }));
    setDraft(null);
    setErr(null);
  }

  function back() {
    setLastDirection("back");
    setNav((n) => {
      if (n.visited.length === 0) return n;
      const previous = n.visited[n.visited.length - 1];
      return { index: previous, visited: n.visited.slice(0, -1) };
    });
    setDraft(null);
    setErr(null);
  }

  return (
    <div className="space-y-5">
      {/* Website prompt — top-of-queue affordance when the customer
          hasn't pre-filled from their site yet. Eric: "ensure the
          website ingestion question is asked early on in this flow."
          One click → /portal/lab/intake which scrapes + auto-fills
          the foundational chapters. Subsequent queue questions then
          become reviews rather than blanks. */}
      {!hasWebsite && (
        <div className="rounded-2xl bg-navy text-cream px-5 py-4 flex items-start gap-3">
          <Globe size={18} className="text-gold mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em] text-gold font-bold mb-0.5">
              Skip a chunk of the typing
            </div>
            <p className="text-cream/90 text-sm leading-relaxed">
              Add your website and Jason will pre-fill the foundational
              chapters. The questions in this queue then become
              quick reviews instead of blanks to fill in from scratch.
            </p>
          </div>
          <Link
            href="/portal/lab/intake"
            className="inline-flex items-center gap-1.5 bg-gold text-navy hover:bg-gold-dark font-bold text-[11px] uppercase tracking-[0.12em] px-4 py-2 rounded-full transition-colors flex-shrink-0"
          >
            Add website
            <ArrowRight size={11} />
          </Link>
        </div>
      )}

      {/* Inline nav — Eric: "bring them down and place them above
          the yellow/white progress bar." Removes the separate white
          nav strip from the page so the buttons live in the
          question flow rather than a header band that competes for
          attention with the question itself. */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/portal"
          className="inline-flex items-center gap-1.5 text-navy bg-cream hover:bg-navy hover:text-cream border-2 border-navy/20 hover:border-navy font-bold text-[11px] uppercase tracking-[0.12em] px-4 py-2 rounded-full transition-colors"
        >
          <ArrowLeft size={12} />
          Back to portal
        </Link>
        <Link
          href="/portal/lab/blueprint"
          className="inline-flex items-center gap-1.5 text-navy bg-cream hover:bg-navy hover:text-cream border-2 border-navy/20 hover:border-navy font-bold text-[11px] uppercase tracking-[0.12em] px-4 py-2 rounded-full transition-colors"
        >
          View full Blueprint
          <ArrowRight size={12} />
        </Link>
      </div>

      {/* Slim progress bar — the phase intro carries phase context;
          this bar carries overall position. */}
      <div className="h-1 rounded-full bg-grey-1 overflow-hidden">
        <div
          className="h-full bg-gold transition-all duration-300"
          style={{
            width: `${Math.round((index / Math.max(1, queue.length)) * 100)}%`,
          }}
        />
      </div>

      {/* Phase intro stays visible for the whole phase. Customer
          always knows which phase they're in + how far through;
          counter updates as they advance. */}
      <PhaseIntroBlock
        id={current.phase.id}
        title={current.phase.title}
        subtitle={current.phase.subtitle}
        progress={phaseProgress}
      />

      {/* Phase-transition card — celebrates the phase the customer
          just completed and surfaces a phase-anchored doc prompt
          ("Got a P&L?" entering Economics) before revealing the
          next question. One-shot per phase id per session. */}
      {showTransition && previousPhase && (
        <PhaseTransitionCard
          previousPhase={previousPhase}
          nextPhase={current.phase}
          anchorSlug={PHASE_DOC_ANCHOR[current.phase.id]}
          anchorAttachmentCount={
            attachmentCountBySlug[PHASE_DOC_ANCHOR[current.phase.id]] ?? 0
          }
          onContinue={() => {
            setSeenTransitions((prev) => {
              const next = new Set(prev);
              next.add(current.phase.id);
              return next;
            });
          }}
        />
      )}

      {/* Inline doc-prompt — compact variant. Surfaces when the
          current question's chapter has zero attachments AND we
          have a prompt configured. The customer can drop a doc and
          skip a chunk of typing on this whole chapter. Hidden once
          they've added something OR dismissed the prompt.
          Suppressed while the phase-transition card is active so
          we don't double-stack two upload affordances. */}
      {!showTransition &&
        (attachmentCountBySlug[current.slug] ?? 0) === 0 &&
        docPromptFor(current.slug as MemoryFileSlug) && (
          <DocPromptCard
            key={`prompt-${current.slug}`}
            slug={current.slug}
            prompt={
              docPromptFor(
                current.slug as MemoryFileSlug,
              ) as NonNullable<ReturnType<typeof docPromptFor>>
            }
            compact
          />
        )}

      {/* Slide-in transition — re-keyed on each question so React
          unmounts + remounts the QuestionCard, triggering the CSS
          animation. Direction reflects forward (Save / Skip) vs
          backward (Back) navigation so the slide direction matches
          the customer's mental model. Hidden behind the phase
          transition card until the customer hits Continue. */}
      {!showTransition && (
        <div className="relative overflow-hidden">
          <QuestionCard
            key={current.id}
            item={current}
            value={draft}
            onChange={setDraft}
            saving={saving}
            err={err}
            direction={lastDirection}
            onSave={onSave}
            onSkip={onSkip}
            onBack={nav.visited.length > 0 ? back : null}
          />
        </div>
      )}
    </div>
  );
}

/**
 * PhaseTransitionCard — shown once per session at every phase
 * boundary. Celebrates the phase the customer just finished and
 * surfaces a phase-anchored doc-prompt for the chapter most likely
 * to have a real document attached. Customer hits Continue → we
 * mark the phase id seen → the next question reveals.
 */
function PhaseTransitionCard({
  previousPhase,
  nextPhase,
  anchorSlug,
  anchorAttachmentCount,
  onContinue,
}: {
  previousPhase: { id: PhaseId; title: string };
  nextPhase: { id: PhaseId; title: string; subtitle: string };
  anchorSlug: MemoryFileSlug;
  anchorAttachmentCount: number;
  onContinue: () => void;
}) {
  const anchorPrompt = docPromptFor(anchorSlug);
  // If the customer already attached something to the anchor
  // chapter, drop the doc-prompt section but still show the
  // celebration — they earned the moment of progress.
  const showDocPrompt = anchorAttachmentCount === 0 && !!anchorPrompt;

  return (
    <div className="rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-cream/40 p-5 sm:p-6">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-emerald-700 font-bold mb-2">
        <CheckCircle2 size={12} />
        {previousPhase.title} phase complete
      </div>
      <h2 className="text-navy font-extrabold text-2xl md:text-3xl leading-tight mb-1">
        Next up: {nextPhase.title}.
      </h2>
      <p className="text-grey-3 text-sm leading-relaxed mb-5 max-w-[560px]">
        {nextPhase.subtitle}
      </p>

      {showDocPrompt && anchorPrompt && (
        <div className="mb-5">
          <DocPromptCard
            slug={anchorSlug}
            prompt={anchorPrompt}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-emerald-200/60">
        <div className="text-[11px] text-emerald-900/70 font-semibold">
          {showDocPrompt
            ? "Drop a doc to skip a chunk of typing — or continue and answer the questions."
            : "Already gave us material here — continue when you're ready."}
        </div>
        <button
          type="button"
          onClick={onContinue}
          className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-xs uppercase tracking-[0.1em] px-5 py-3 rounded-full hover:bg-gold-dark transition-colors"
        >
          Continue to {nextPhase.title}
          <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}

/**
 * Phase intro card — a small "you're starting Discover now" header
 * shown at every phase boundary. Customer has spatial context for the
 * question they're about to answer.
 */
function PhaseIntroBlock({
  id,
  title,
  subtitle,
  progress,
}: {
  id: PhaseId;
  title: string;
  subtitle: string;
  progress: { done: number; total: number } | null;
}) {
  return (
    <div className="rounded-xl bg-navy text-cream px-5 py-4">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <div className="text-[10px] uppercase tracking-[0.18em] text-gold font-bold">
          {id} phase
        </div>
        {progress && (
          <div className="text-[10px] text-cream/70 font-semibold">
            {progress.done} of {progress.total}
          </div>
        )}
      </div>
      <div className="font-extrabold text-xl mb-0.5">{title}</div>
      <div className="text-sm text-cream/80">{subtitle}</div>
    </div>
  );
}

/**
 * Single-question card. The body of the guided flow.
 */
function QuestionCard({
  item,
  value,
  onChange,
  saving,
  err,
  direction,
  onSave,
  onSkip,
  onBack,
}: {
  item: QueueItem;
  value: FieldValue;
  onChange: (v: FieldValue) => void;
  saving: boolean;
  err: string | null;
  direction: "forward" | "back";
  onSave: () => void;
  onSkip: () => void;
  onBack: (() => void) | null;
}) {
  const fd = item.fieldDef;
  const canSave = !saving && value !== null && !valueIsEmpty(value);

  // Enter advances when valid. Multi-line inputs (textarea, list,
  // markdown) need Enter for newlines, so for those we require
  // Cmd/Ctrl+Enter. Single-line inputs save on plain Enter.
  //
  // CRITICAL: ignore Enter when the focused element is a button.
  // Buttons natively fire `click` on Enter, so the click handler
  // (onSave on Save & Next) ALREADY runs. If we also process the
  // bubbling keydown here, onSave fires twice → index advances by
  // two → "skipping a card" bug Eric reported.
  function onKeyDownAdvance(e: React.KeyboardEvent) {
    if (e.key !== "Enter") return;
    const target = e.target as HTMLElement | null;
    if (target && target.tagName === "BUTTON") return;
    const isMultiline =
      fd.type === "textarea" ||
      fd.type === "markdown" ||
      fd.type === "list_short" ||
      fd.type === "list_long";
    const cmdOrCtrl = e.metaKey || e.ctrlKey;
    if (isMultiline && !cmdOrCtrl) return;
    if (!canSave) return;
    e.preventDefault();
    onSave();
  }

  return (
    <div
      className={`rounded-2xl border border-navy/10 bg-white p-5 sm:p-6 md:p-8 ${
        direction === "forward"
          ? "queue-card-forward"
          : "queue-card-back"
      }`}
      onKeyDown={onKeyDownAdvance}
    >
      <style jsx>{`
        @keyframes queue-card-in-right {
          from {
            transform: translateX(24px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes queue-card-in-left {
          from {
            transform: translateX(-24px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .queue-card-forward {
          animation: queue-card-in-right 220ms ease-out;
        }
        .queue-card-back {
          animation: queue-card-in-left 220ms ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .queue-card-forward,
          .queue-card-back {
            animation: none;
          }
        }
      `}</style>
      <div className="text-[10px] uppercase tracking-[0.16em] text-gold-warm font-bold mb-2">
        {item.chapterTitle}
      </div>
      <h2 className="text-navy font-extrabold text-xl md:text-2xl leading-tight mb-2">
        {fd.label}
      </h2>
      {fd.helpText && (
        <p className="text-grey-3 text-sm leading-relaxed mb-4 max-w-[600px]">
          {fd.helpText}
        </p>
      )}

      <div className="mb-2">
        <SchemaFieldInput
          fieldDef={fd}
          value={value}
          onChange={onChange}
          autoFocus
        />
      </div>

      {/* Industry-suggested value (when the field declares
          suggestedFrom: industry_lookup AND we resolved a profile
          from the customer's industry_category). The customer can
          one-click accept the suggestion or type their own answer. */}
      {item.industrySuggestion != null &&
        (value == null || valueIsEmpty(value)) && (
          <button
            type="button"
            onClick={() => onChange(item.industrySuggestion as FieldValue)}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-full px-3 py-1.5 transition-colors mb-4"
          >
            <Sparkles size={11} />
            Use industry suggestion:{" "}
            <span className="tabular-nums">
              {formatSuggestion(fd.type, item.industrySuggestion)}
            </span>
          </button>
        )}
      {item.industrySuggestion == null && <div className="mb-3" />}

      {err && (
        <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-navy/5">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              disabled={saving}
              className="inline-flex items-center gap-1.5 text-grey-3 hover:text-navy text-xs font-semibold py-2 px-2 transition-colors disabled:opacity-50"
            >
              <ArrowLeft size={11} /> Back
            </button>
          )}
          <button
            type="button"
            onClick={onSkip}
            disabled={saving}
            className="text-grey-3 hover:text-navy text-xs font-semibold py-2 px-2 transition-colors disabled:opacity-50"
          >
            Skip for now
          </button>
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-xs uppercase tracking-[0.1em] px-5 py-3 rounded-full hover:bg-gold-dark disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <>
              <Loader2 size={13} className="animate-spin" /> Saving…
            </>
          ) : (
            <>
              <Sparkles size={13} /> Save &amp; next <ArrowRight size={12} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function valueIsEmpty(v: FieldValue): boolean {
  if (v === null) return true;
  if (typeof v === "string") return v.trim().length === 0;
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

/**
 * Format an industry-suggested value for the "Use suggestion" pill.
 * Currency gets a "$" prefix; percentage gets a "%" suffix; otherwise
 * passthrough.
 */
function formatSuggestion(
  type: QueueItem["fieldDef"]["type"],
  v: string | number,
): string {
  if (typeof v === "number") {
    if (type === "currency") {
      return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    }
    if (type === "percentage") {
      return `${v}%`;
    }
    return v.toLocaleString("en-US");
  }
  return v;
}

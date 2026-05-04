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
  Loader2,
  Sparkles,
} from "lucide-react";
import type { QueueItem, QueueSummary } from "@/lib/memory/queue";
import type { PhaseId } from "@/lib/memory/phases";
import { SchemaFieldInput } from "@/components/agent/SchemaFieldInput";

type FieldValue = string | number | boolean | string[] | null;

type Props = {
  initialQueue: QueueItem[];
  initialSummary: QueueSummary;
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
  save,
}: Props) {
  // The queue is a snapshot taken at page load. We don't mutate it
  // here — we track an index + a per-item-id Set of "completed"
  // items so the UI can show progress without a server round-trip.
  // A page refresh recomputes the canonical queue.
  const queue = initialQueue;
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<FieldValue>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  // Visited stack — Back pops the most recent visited index so the
  // customer always lands on the question they were just looking at,
  // not just the previous slot in the queue (which could be a Skipped
  // item they haven't seen). Eric's bug report: "I hit Back but it
  // didn't bring me to the last question I answered."
  const [visited, setVisited] = useState<number[]>([]);

  const current = queue[index];
  const phaseStart =
    index === 0 || queue[index - 1]?.phase.id !== current?.phase.id;

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
    setVisited((v) => [...v, index]);
    setIndex((i) => i + 1);
    setDraft(null);
    setErr(null);
  }

  function back() {
    if (visited.length === 0) return;
    const previous = visited[visited.length - 1];
    setVisited((v) => v.slice(0, -1));
    setIndex(previous);
    setDraft(null);
    setErr(null);
  }

  return (
    <div className="space-y-5">
      {/* Slim progress bar only — the prior "Question X of Y · 11
          required · 52 optional" microcopy was too much info up
          front. The phase intro carries phase context; the bar
          carries overall position. */}
      <div className="h-1 rounded-full bg-grey-1 overflow-hidden">
        <div
          className="h-full bg-gold transition-all duration-300"
          style={{
            width: `${Math.round((index / Math.max(1, queue.length)) * 100)}%`,
          }}
        />
      </div>

      {phaseStart && (
        <PhaseIntroBlock
          id={current.phase.id}
          title={current.phase.title}
          subtitle={current.phase.subtitle}
          progress={phaseProgress}
        />
      )}

      <QuestionCard
        item={current}
        value={draft}
        onChange={setDraft}
        saving={saving}
        err={err}
        onSave={onSave}
        onSkip={onSkip}
        onBack={visited.length > 0 ? back : null}
      />
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
  onSave,
  onSkip,
  onBack,
}: {
  item: QueueItem;
  value: FieldValue;
  onChange: (v: FieldValue) => void;
  saving: boolean;
  err: string | null;
  onSave: () => void;
  onSkip: () => void;
  onBack: (() => void) | null;
}) {
  const fd = item.fieldDef;
  const canSave = !saving && value !== null && !valueIsEmpty(value);

  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-5 sm:p-6 md:p-8">
      <div className="text-[10px] uppercase tracking-[0.16em] text-gold-warm font-bold mb-2">
        {item.chapterTitle}
        {item.isRequired && (
          <span className="ml-2 text-red-700">· Required</span>
        )}
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

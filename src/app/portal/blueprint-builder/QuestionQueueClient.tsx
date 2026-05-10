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

import { useEffect, useMemo, useState } from "react";
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
import { PHASE_DOC_ANCHOR, PHASES, type PhaseId } from "@/lib/memory/phases";
import { SchemaFieldInput } from "@/components/agent/SchemaFieldInput";
import { DocPromptCard } from "@/components/agent/DocPromptCard";
import { docPromptFor } from "@/lib/memory/doc-prompts";
import type { MemoryFileSlug } from "@/lib/memory/files";

type FieldValue = string | number | boolean | string[] | null;

type Props = {
  /** Supabase auth user id — used to namespace localStorage so two
   *  accounts on the same browser don't see each other's in-flight
   *  typing or last-position. */
  userId: string;
  initialQueue: QueueItem[];
  initialSummary: QueueSummary;
  /** True when the customer has already added a website (and we ran
   *  the scrape). Suppresses the "skip the typing" banner. */
  hasWebsite: boolean;
  /** Per-section attachment count. Drives the inline doc-prompt
   *  banner — only show when current section has zero attachments
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
  userId,
  initialQueue,
  initialSummary,
  hasWebsite,
  attachmentCountBySlug,
  save,
}: Props) {
  // localStorage keys, namespaced per-user so two accounts on the same
  // browser don't share state. Two persistence concerns live here:
  //
  //   - lsKeyValues:  the full valuesByItem map. Survives navigation
  //                   away from the builder (sidebar Dashboard click,
  //                   browser tab close, etc.) so a customer who typed
  //                   into a question but didn't hit "Save & Next"
  //                   doesn't lose their text on return. Eric flagged
  //                   this on 2026-05-10 — losing in-flight typing
  //                   when leaving + returning is the kind of friction
  //                   that erodes trust in the whole product.
  //
  //   - lsKeyLastAt:  the last `?at=<itemId>` the customer was viewing.
  //                   Sidebar's "Continue Building" links to bare
  //                   `/portal/blueprint-builder`; without this, every
  //                   click drops the customer at queue[0] (first
  //                   unanswered globally) regardless of where they
  //                   left off. With this, the mount effect below
  //                   reads it and replaceState's `?at=` into the URL,
  //                   landing them on their last position.
  const lsKeyValues = `tfb-builder:${userId}:values`;
  const lsKeyLastAt = `tfb-builder:${userId}:last-at`;
  // The queue is a snapshot taken at page load. We don't mutate it
  // here — we track an index + a per-item-id Set of "completed"
  // items so the UI can show progress without a server round-trip.
  // A page refresh recomputes the canonical queue.
  const queue = initialQueue;
  // Per-item value map. Keyed by queue item id (which embeds slug +
  // field name), so navigating Back / Skip-and-return restores the
  // value the customer had typed or saved. The previous flat `draft`
  // state was reset to null on every navigation — Eric 2026-05-09
  // flagged that the back button felt broken because revisiting a
  // question showed an empty input. Best-practice wizards (TurboTax,
  // Plaid, Typeform, NN/g guidance) all preserve previously-entered
  // data on backward navigation. The current question's value is a
  // derived view (`draft`) over this map.
  const [valuesByItem, setValuesByItem] = useState<
    Record<string, FieldValue>
  >(() => {
    // Lazy initializer: rehydrate from localStorage so a customer who
    // typed into a question, navigated away (Dashboard click, tab
    // close, etc.), then returned doesn't lose their text. Only runs
    // once per mount. Window-guard for SSR safety even though this is
    // a client component (Next.js still pre-renders the initial HTML).
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(lsKeyValues);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, FieldValue>;
      }
      return {};
    } catch {
      // Quota / corrupted JSON / disabled storage — start clean.
      return {};
    }
  });
  // Persist valuesByItem to localStorage on every change. The serialize
  // is small (typically <50 fields × short strings = a few KB) so we
  // don't bother debouncing. JSON.stringify is sync but fast at this
  // size; running it on every keystroke is fine.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        lsKeyValues,
        JSON.stringify(valuesByItem),
      );
    } catch {
      // Quota exceeded or storage disabled — drop silently. The
      // customer's in-flight typing won't survive navigation in that
      // case, but the rest of the experience still works.
    }
  }, [valuesByItem, lsKeyValues]);
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
  //
  // Initial index is recovered from `?at=<itemId>` if the URL has
  // it — that's how we keep refreshes anchored to the current
  // question instead of snapping back to "first unanswered." Eric
  // 2026-05-09: "when I refresh the portal/blueprint-builder page it
  // brings me back to the last question that I haven't answered rather
  // than staying on the same page I was currently viewing."
  const [nav, setNav] = useState<{ index: number; visited: number[] }>(
    () => {
      // Lazy initializer runs once per mount. SSR returns a stable
      // index 0 (no `window`); client hydration may bump it via the
      // useLayoutEffect below before paint to avoid a flash. We can't
      // read the URL during SSR or we'd cause hydration mismatches
      // when the initial `?at=` and the queue first-index disagree.
      return { index: 0, visited: [] };
    },
  );
  const index = nav.index;
  // Hydration gate. The restore-from-URL/localStorage effect below runs
  // ONCE on mount; the index→URL/localStorage sync effect must NOT fire
  // until that completes, otherwise it stomps the restored URL +
  // localStorage with `queue[0].id` (the initial nav.index = 0).
  // Eric hit exactly this on 2026-05-10: leave the builder mid-question,
  // return, and the URL pointed at queue[0] instead of where you were.
  // Pattern: state (not ref) so the sync effect re-fires after the
  // restore lands.
  const [hydrated, setHydrated] = useState(false);
  // Frozen-at-mount per-phase totals. Used as the DENOMINATOR for both
  // the "ANSWERED X / Y" counter and the segmented progress bar.
  //
  // Eric flagged 2026-05-10 that the counter "loaded weird" between
  // saves: it'd go 0/23 → 1/22 → 2/21 → 3/21 → 4/19 → 5/18, etc.
  // Root cause: the previous math used `queue.filter(...).length` as
  // the denominator, but `queue` is the SERVER-COMPUTED list of
  // unanswered fields. Each Save & Next triggers revalidatePath, the
  // server re-renders the page, and queue arrives with the just-saved
  // item removed — so the denominator decreases on every save.
  //
  // Reads to a customer as "X done of Y total" but Y is actually
  // "Y remaining"; the math is right, the UX is broken — it implies
  // total work is shrinking, when really it's the customer's own
  // progress chewing through it.
  //
  // Fix: freeze the per-phase total at mount, then count done as
  // (total - items currently in this phase ahead of cursor). Saved
  // items no longer in queue count as done. Items still in queue but
  // behind cursor (skipped, navigated past) count as done. Current
  // item doesn't count yet — they're on it.
  const [initialPhaseTotals] = useState<Record<PhaseId, number>>(() => {
    const totals = {} as Record<PhaseId, number>;
    for (const p of PHASES) {
      totals[p.id] = initialQueue.filter((q) => q.phase.id === p.id).length;
    }
    return totals;
  });

  // Sync URL `?at=<itemId>` ↔ current index. On mount, if the URL
  // has an `at` for an item still in the queue, jump to it.
  // Subsequent navigations push the new id back into the URL via
  // replaceState (no full Next.js navigation, no data refetch).
  //
  // We deliberately do NOT auto-mark phases as "seen" on URL
  // restore. An earlier attempt did (commit d17eb18) — the
  // intent was "if the user landed on Economics q5, they must
  // have crossed Discover→Economics already; don't replay the
  // celebration." But that broke the more common refresh-flow:
  // user lands on the transition card itself (URL ?at=<first_econ_q>),
  // refreshes to read it again or drop a doc, and instead got
  // pushed straight into the question — the "skipped to the next
  // question" bug Eric flagged 2026-05-10. The mid-phase case is
  // already safe because `phaseStart` is false on questions 2+
  // within a phase (queue[index-1].phase === current.phase), so
  // the transition can never fire there. Replaying the card on
  // refresh of the FIRST question of a phase is a feature, not
  // a bug — it lets the customer revisit the celebration + the
  // phase doc-prompt.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let at = new URL(window.location.href).searchParams.get("at");
    // If the URL has no `?at=` (typical when arriving via the sidebar's
    // bare /portal/blueprint-builder link), fall back to the last
    // position the customer was on per localStorage. This is the
    // "remember where I left off" half of the state-loss fix —
    // sidebar Continue Building no longer drops customers at queue[0]
    // every click.
    if (!at) {
      try {
        const stored = window.localStorage.getItem(lsKeyLastAt);
        if (stored && queue.some((q) => q.id === stored)) {
          at = stored;
          // Reflect in URL so the next sync useEffect doesn't fight us
          // and a refresh stays anchored.
          const url = new URL(window.location.href);
          url.searchParams.set("at", stored);
          window.history.replaceState({}, "", url);
        }
      } catch {
        // Storage disabled — fall through to default index 0.
      }
    }
    if (!at) {
      setHydrated(true);
      return;
    }
    const target = queue.findIndex((q) => q.id === at);
    if (target >= 0 && target !== nav.index) {
      setNav((n) => ({ ...n, index: target }));
    }
    // Mark hydrated so the sync effect can fire — but only AFTER
    // setNav has had a chance to land (which it will via the next
    // render triggered by setHydrated). Order matters: setNav first
    // schedules an index update; setHydrated triggers another render.
    // Both batch into one re-render where index is correct.
    setHydrated(true);
    // Run once on mount only — subsequent URL changes come FROM us,
    // not the browser address bar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Hydration gate — see the [hydrated] state declaration above for
    // why. Skipping this effect on the first render lets the restore
    // effect above land its setNav before we sync URL + localStorage.
    if (!hydrated) return;
    const cur = queue[index];
    if (!cur) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("at") !== cur.id) {
      url.searchParams.set("at", cur.id);
      // replaceState avoids polluting the browser back-stack with
      // every keystroke; the user's browser Back already maps to
      // their previous PAGE, not the previous question. In-app Back
      // is the proper question-by-question control.
      window.history.replaceState({}, "", url);
    }
    // Mirror current position to localStorage. On the next visit
    // (sidebar Continue Building click, refresh of bare URL, etc.)
    // the mount effect above reads this and restores the customer's
    // place. Updated even when URL didn't change so a fresh render
    // can still capture it.
    try {
      window.localStorage.setItem(lsKeyLastAt, cur.id);
    } catch {
      // Storage disabled — last-position won't survive the session.
    }
  }, [index, queue, lsKeyLastAt, hydrated]);
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
    const total = initialPhaseTotals[current.phase.id] ?? 0;
    // Items in the CURRENT queue that are in this phase AND still
    // ahead of (or at) the cursor. "Done" = total minus those.
    // Saved items have been removed from queue → counted toward done.
    // Skipped items remain in queue but cursor is past them → counted
    // toward done. The current item is at-cursor → not counted yet.
    let stillAhead = 0;
    for (let i = index; i < queue.length; i++) {
      if (queue[i].phase.id === current.phase.id) stillAhead++;
    }
    return { done: Math.max(0, total - stillAhead), total };
  }, [current, queue, index, initialPhaseTotals]);

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
          Jason AI has everything he needs for a credible first pass on every
          foundational section. Head into the Blueprint to redraft what you
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

  // Derived view of the current question's value. Reads/writes go
  // through valuesByItem so navigation preserves state.
  const draft: FieldValue = current ? valuesByItem[current.id] ?? null : null;
  const setDraft = (v: FieldValue) => {
    if (!current) return;
    setValuesByItem((m) => ({ ...m, [current.id]: v }));
  };

  // When the user navigated backward AND the previous question was
  // in a different section than the current one, surface a small
  // "Back to {section}" banner so the section change is announced
  // explicitly. Without this cue, repeatedly tapping Back across
  // section boundaries felt unanchored — Eric: "I can just keep
  // pressing the back button forever without it stopping between
  // sections." The banner auto-dismisses after a few seconds so
  // it doesn't get in the way of answering.
  const [backCrossedSection, setBackCrossedSection] = useState<{
    sectionTitle: string;
    forItemId: string;
  } | null>(null);
  useEffect(() => {
    if (!backCrossedSection) return;
    const t = setTimeout(() => setBackCrossedSection(null), 3500);
    return () => clearTimeout(t);
  }, [backCrossedSection]);

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
    setBackCrossedSection(null);
    setErr(null);
  }

  function back() {
    if (nav.visited.length === 0) return;
    const previousIdx = nav.visited[nav.visited.length - 1];
    const previousItem = queue[previousIdx];
    // Detect cross-section navigation so we can announce it.
    if (previousItem && current && previousItem.slug !== current.slug) {
      setBackCrossedSection({
        sectionTitle: previousItem.sectionTitle,
        forItemId: previousItem.id,
      });
    }
    setLastDirection("back");
    setNav((n) => {
      if (n.visited.length === 0) return n;
      const previous = n.visited[n.visited.length - 1];
      return { index: previous, visited: n.visited.slice(0, -1) };
    });
    setErr(null);
  }

  // Per-phase progress, in canonical phase order. Each phase is one
  // segment of the top progress bar — completed phases fill solid,
  // the active phase fills proportionally, future phases stay empty.
  // Eric's spec 2026-05-09: "I want the user to feel like they're
  // completing things more quickly." A 6-segment bar with chunky
  // milestone fills feels much faster than a single 30-step bar
  // where each click moves a sliver.
  const phaseSegments = useMemo(() => {
    return PHASES.map((p) => {
      const total = initialPhaseTotals[p.id] ?? 0;
      if (total === 0) return { id: p.id, pct: 0, isActive: false };
      // Same math as phaseProgress: done = frozen-total minus items
      // ahead of the cursor in this phase. Stable across server-side
      // queue refreshes (revalidatePath after a save), so the bar
      // only ticks forward.
      let stillAhead = 0;
      for (let i = index; i < queue.length; i++) {
        if (queue[i].phase.id === p.id) stillAhead++;
      }
      const done = Math.max(0, total - stillAhead);
      const isActive = current?.phase.id === p.id;
      return { id: p.id, pct: (done / total) * 100, isActive };
    });
  }, [queue, index, current, initialPhaseTotals]);

  return (
    <div className="space-y-6">
      {/* Website prompt — top-of-queue affordance when the customer
          hasn't pre-filled from their site yet. Eric: "ensure the
          website ingestion question is asked early on in this flow."
          One click → /portal/lab/intake which scrapes + auto-fills
          the foundational sections. Subsequent queue questions then
          become reviews rather than blanks. */}
      {!hasWebsite && (
        <div className="rounded-2xl bg-navy text-cream px-6 py-5 sm:px-7 sm:py-6 flex items-start gap-3">
          <Globe size={18} className="text-gold mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-[0.14em] text-gold font-bold mb-1">
              Skip a chunk of the typing
            </div>
            <p className="text-cream/90 text-base leading-relaxed">
              Add your website and Jason AI will pre-fill the foundational
              sections. The questions in this queue then become
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

      {/* Phase-segmented progress bar — replaces the old single-bar
          that mapped to (index / queue.length). Now each phase gets
          its own visible chunk; completing a phase = a clearly
          visible filled segment. Designed so the customer feels
          tangible progress at every phase milestone, not just every
          ~5% advancement. */}
      <PhaseSegmentedProgress segments={phaseSegments} />

      {/* Phase intro — hidden during the phase-transition celebration
          so the customer doesn't see two cards saying "Economics /
          Unit economics + the franchisee's investment math." back to
          back. The transition card carries the same context; the
          intro re-mounts after Continue with a slide-in animation. */}
      {!showTransition && (
        <PhaseIntroBlock
          id={current.phase.id}
          title={current.phase.title}
          subtitle={current.phase.subtitle}
          progress={phaseProgress}
        />
      )}

      {/* Phase-transition card — celebrates the phase the customer
          just completed and surfaces a phase-anchored doc prompt
          ("Got a P&L?" entering Economics) before revealing the
          next question. One-shot per phase id per session.
          Animates in on mount and out on Continue so the handoff to
          the next question doesn't feel like a state-jump. */}
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

      {/* Section-crossed banner — fires when the user used Back and
          landed in a different section than they were just in.
          Auto-dismisses after 3.5s. Eric flagged that without this
          the back button felt unanchored across section boundaries. */}
      {!showTransition &&
        backCrossedSection &&
        current &&
        backCrossedSection.forItemId === current.id && (
          <div className="rounded-lg bg-cream border border-gold/40 px-4 py-2.5 flex items-center gap-2 text-sm text-navy">
            <ArrowLeft size={13} className="text-gold-warm flex-shrink-0" />
            <span>
              Back to{" "}
              <strong className="font-bold">
                {backCrossedSection.sectionTitle}
              </strong>
              .{" "}
              {valuesByItem[current.id] != null &&
              !valueIsEmpty(valuesByItem[current.id]) ? (
                <span className="text-grey-3">
                  Your answer is restored — edit and save again, or skip ahead.
                </span>
              ) : (
                <span className="text-grey-3">
                  Pick up where you left off.
                </span>
              )}
            </span>
          </div>
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
            onBack={back}
            canGoBack={nav.visited.length > 0}
          />
        </div>
      )}

      {/* Bottom-anchored upload affordance. Eric 2026-05-09:
          "anchor the file upload container to the bottom of the
          containers where the user is answering questions once they
          hit continue, just in case they decide later on that they
          want to upload a doc."
          Uses the MINIMAL variant — drop zone + X dismiss only — so
          we don't repeat the prompt + example chips that the phase-
          transition card just showed. The customer's already in the
          phase context; the bottom anchor is pure action. */}
      {!showTransition &&
        (attachmentCountBySlug[current.slug] ?? 0) === 0 &&
        docPromptFor(current.slug as MemoryFileSlug) && (
          <DocPromptCard
            key={`prompt-bottom-${current.slug}`}
            slug={current.slug}
            prompt={
              docPromptFor(
                current.slug as MemoryFileSlug,
              ) as NonNullable<ReturnType<typeof docPromptFor>>
            }
            minimal
          />
        )}
    </div>
  );
}

/**
 * Phase-segmented progress bar. One segment per phase, separated by
 * thin gaps. Completed phases render fully filled; the active phase
 * fills proportionally to in-phase question completion; future
 * phases stay empty. The chunky milestone visual is intentional —
 * a single 30-step bar made customers feel slow.
 */
function PhaseSegmentedProgress({
  segments,
}: {
  segments: { id: PhaseId; pct: number; isActive: boolean }[];
}) {
  // Overall completion for a11y — average of each segment's pct.
  const overall = Math.round(
    segments.reduce((acc, s) => acc + s.pct, 0) / Math.max(1, segments.length),
  );
  return (
    <div
      role="progressbar"
      aria-valuenow={overall}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Overall progress across all phases"
      className="flex gap-1.5"
    >
      {segments.map((seg) => (
        <div
          key={seg.id}
          className="flex-1 h-1.5 rounded-full bg-grey-1 overflow-hidden"
        >
          <div
            className="h-full bg-gradient-to-r from-gold to-gold-warm transition-all duration-500 ease-out"
            style={{ width: `${seg.pct}%` }}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * PhaseTransitionCard — shown once per session at every phase
 * boundary. Celebrates the phase the customer just finished and
 * surfaces a phase-anchored doc-prompt for the section most likely
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
  // section, drop the doc-prompt section but still show the
  // celebration — they earned the moment of progress.
  const showDocPrompt = anchorAttachmentCount === 0 && !!anchorPrompt;

  // Exit animation: when the customer clicks Continue, fade + slide
  // the card up before unmounting. Without this, the click felt
  // glitchy — Eric: "almost as if there's a section that gets
  // skipped over." The 200ms exit overlaps with the next question's
  // 220ms slide-in so the visual handoff feels continuous instead of
  // "card pops out, blank moment, new card pops in."
  const [dismissing, setDismissing] = useState(false);
  function handleContinue() {
    if (dismissing) return;
    setDismissing(true);
    // Match `phase-card-exit` keyframe duration.
    setTimeout(onContinue, 200);
  }

  return (
    <div
      className={`rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-cream/40 p-6 sm:p-8 md:p-10 ${
        dismissing ? "phase-card-exit" : "phase-card-enter"
      }`}
    >
      <style jsx>{`
        @keyframes phase-card-in {
          from {
            transform: translateY(8px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes phase-card-out {
          from {
            transform: translateY(0);
            opacity: 1;
          }
          to {
            transform: translateY(-8px);
            opacity: 0;
          }
        }
        .phase-card-enter {
          animation: phase-card-in 220ms ease-out;
        }
        .phase-card-exit {
          animation: phase-card-out 200ms ease-out forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .phase-card-enter,
          .phase-card-exit {
            animation: none;
          }
        }
      `}</style>
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-emerald-700 font-bold mb-3">
        <CheckCircle2 size={13} />
        {previousPhase.title} phase complete
      </div>
      <h2 className="text-navy font-extrabold text-2xl md:text-3xl leading-tight mb-2">
        Next up: {nextPhase.title}.
      </h2>
      <p className="text-grey-3 text-base leading-relaxed mb-6 max-w-[600px]">
        {nextPhase.subtitle}
      </p>

      {showDocPrompt && anchorPrompt && (
        <div className="mb-6">
          <DocPromptCard
            slug={anchorSlug}
            prompt={anchorPrompt}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 pt-4 border-t border-emerald-200/60">
        {/* "Drop a doc to skip a chunk of typing — or continue and
            answer the questions." copy removed 2026-05-09 per Eric;
            it was redundant with the doc-prompt card right above
            and the Continue button. */}
        <button
          type="button"
          onClick={handleContinue}
          disabled={dismissing}
          className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-xs uppercase tracking-[0.1em] px-5 py-3 rounded-full hover:bg-gold-dark transition-colors disabled:opacity-70"
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
    <div className="rounded-xl bg-navy text-cream px-6 py-5 sm:px-7 sm:py-6">
      {/* Two-column layout: phase context on the left, big scoreboard
          counter on the right. Eric 2026-05-09: "the user will like
          seeing it, so maybe make it a different font and size." Big
          gold tabular-nums digit makes per-question progress feel
          like a real win, not a tiny corner stat. */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-[0.14em] text-gold font-bold mb-1.5">
            {id} phase
          </div>
          <div className="font-extrabold text-2xl mb-1">{title}</div>
          <div className="text-base text-cream/80 leading-relaxed">
            {subtitle}
          </div>
        </div>
        {progress && (
          <div className="flex-shrink-0 text-right tabular-nums">
            <div className="text-[10px] uppercase tracking-[0.16em] text-cream/60 font-bold mb-1">
              Answered
            </div>
            <div className="flex items-baseline justify-end gap-1.5 leading-none">
              <span className="font-extrabold text-4xl md:text-5xl text-gold">
                {progress.done}
              </span>
              <span className="text-base font-semibold text-cream/55">
                / {progress.total}
              </span>
            </div>
          </div>
        )}
      </div>
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
  canGoBack,
}: {
  item: QueueItem;
  value: FieldValue;
  onChange: (v: FieldValue) => void;
  saving: boolean;
  err: string | null;
  direction: "forward" | "back";
  onSave: () => void;
  onSkip: () => void;
  onBack: () => void;
  /** True when there's a previous question to go back to. False on
   *  the very first question of the session — the Back button stays
   *  visible (for spatial predictability, per Apple HIG / Material)
   *  but is disabled. */
  canGoBack: boolean;
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
      className={`rounded-2xl border border-card-border bg-white p-6 sm:p-8 md:p-10 ${
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
      <div className="text-xs uppercase tracking-[0.14em] text-gold-warm font-bold mb-3">
        {item.sectionTitle}
      </div>
      <h2 className="text-navy font-extrabold text-xl md:text-2xl leading-tight mb-3">
        {fd.label}
      </h2>
      {fd.helpText && (
        <p className="text-grey-3 text-base leading-relaxed mb-5 max-w-[640px]">
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
        <div className="flex items-center gap-1">
          {/* Back is ALWAYS rendered — disabled at session start so
              the customer has a stable spatial expectation of where
              the button lives. Apple HIG / Material guidance:
              hiding controls based on state breaks predictability.
              aria-disabled + a tooltip explain the bound. */}
          <button
            type="button"
            onClick={onBack}
            disabled={!canGoBack || saving}
            aria-disabled={!canGoBack || saving}
            title={
              canGoBack
                ? "Back to the previous question"
                : "You're at the start of this session"
            }
            className="inline-flex items-center gap-1.5 text-grey-3 hover:text-navy text-xs font-semibold py-2 px-2.5 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-grey-3"
          >
            <ArrowLeft size={11} /> Back
          </button>
          <span className="text-grey-3/40 text-xs select-none">·</span>
          <button
            type="button"
            onClick={onSkip}
            disabled={saving}
            title="Skip this question — your typed answer (if any) is kept; you can come back to it"
            className="text-grey-3 hover:text-navy text-xs font-semibold py-2 px-2.5 rounded-md transition-colors disabled:opacity-50"
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

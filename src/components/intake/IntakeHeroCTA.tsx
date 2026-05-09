"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  Sparkles,
} from "lucide-react";
import { track } from "@/lib/analytics";
import type { IntakeSnapshot } from "@/lib/intake/orchestrator";

/**
 * The hero CTA block for the home page. Replaces the old static
 * "Take the Free Assessment" / "Book a Strategy Call" buttons with a
 * URL-prefill lead magnet that streams progress + renders an FDD
 * Item 11-style Franchise Readiness Snapshot inline.
 *
 * State machine:
 *
 *   capped       — daily spend cap hit; show assessment CTA instead.
 *                  Decided on mount via /api/intake/cap-status.
 *   idle         — URL input + "Analyze →" button.
 *   streaming    — phases run; progressive checklist of what's done.
 *   snapshot     — final snapshot rendered + "Save" CTA + "deeper assessment" link.
 *   saving       — email submission in flight.
 *   saved        — confirmation card + sign-in nudge.
 *   error        — graceful fallback with a "talk to us" CTA.
 *
 * The cookie + sessionId persist across reloads (the cookie is HttpOnly).
 * If a sessionId comes back via ?intake=<id> URL param, we re-fetch
 * the snapshot from /api/intake/snapshot/<id> rather than re-running.
 */

type Phase =
  | "scrape"
  | "business"
  | "geocode"
  | "demographics"
  | "competitors"
  | "expansion"
  | "score"
  | "summary";

type View =
  | { kind: "loading" }
  | { kind: "capped" }
  | { kind: "idle" }
  | { kind: "streaming"; progress: PhaseStatus[]; activePhase: Phase | null }
  | { kind: "snapshot"; snapshot: IntakeSnapshot; sessionId: string }
  | { kind: "saving"; snapshot: IntakeSnapshot; sessionId: string }
  | { kind: "saved"; email: string }
  | { kind: "error"; message: string };

type PhaseStatus = {
  phase: Phase;
  label: string;
  status: "pending" | "active" | "done" | "skipped";
};

const PHASE_LABELS: Record<Phase, string> = {
  scrape: "Reading your website",
  business: "Identifying your business",
  geocode: "Mapping your trade area",
  demographics: "Pulling demographics",
  competitors: "Scanning competitive landscape",
  expansion: "Scoring expansion markets",
  score: "Building readiness score",
  summary: "Drafting prototype profile",
};

const PHASES_IN_ORDER: Phase[] = [
  "scrape",
  "business",
  "geocode",
  "demographics",
  "competitors",
  "expansion",
  "score",
  "summary",
];

function freshProgress(): PhaseStatus[] {
  return PHASES_IN_ORDER.map((phase) => ({
    phase,
    label: PHASE_LABELS[phase],
    status: "pending",
  }));
}

export function IntakeHeroCTA() {
  const [view, setView] = useState<View>({ kind: "loading" });
  const [urlInput, setUrlInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Refs hold the snapshot data through the saving → saved transition so
  // the saved-state SnapshotView can show the same snapshot unblurred
  // even though the View union narrows at "saved" to only { email }.
  const savedSnapshotRef = useRef<IntakeSnapshot | null>(null);
  const savedSessionIdRef = useRef<string | null>(null);

  // ─── On mount: check cap status + look for ?intake=<id> resume ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Check for ?intake=<id> resume parameter first.
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const intakeId = params.get("intake");
        if (intakeId && intakeId.length === 36) {
          try {
            const r = await fetch(`/api/intake/snapshot/${intakeId}`);
            if (r.ok) {
              const data = (await r.json()) as { snapshot: IntakeSnapshot; sessionId: string };
              if (!cancelled) {
                setView({ kind: "snapshot", snapshot: data.snapshot, sessionId: data.sessionId });
                return;
              }
            }
          } catch {
            // Fall through to normal cap-status check.
          }
        }
      }

      try {
        const r = await fetch("/api/intake/cap-status");
        if (!r.ok) {
          if (!cancelled) setView({ kind: "idle" });
          return;
        }
        const data = (await r.json()) as { capped: boolean };
        if (cancelled) return;
        setView({ kind: data.capped ? "capped" : "idle" });
      } catch {
        if (!cancelled) setView({ kind: "idle" });
      }
    })();
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, []);

  // ─── Submit URL → stream NDJSON ─────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = urlInput.trim();
    if (url.length < 4) return;

    track("cta_click", {
      cta_label: "intake_url_submit",
      cta_location: "intake_hero",
    });

    setView({ kind: "streaming", progress: freshProgress(), activePhase: null });

    const controller = new AbortController();
    abortRef.current = controller;

    let res: Response;
    try {
      res = await fetch("/api/intake/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal: controller.signal,
      });
    } catch (err) {
      setView({
        kind: "error",
        message: err instanceof Error ? err.message : "Couldn't reach the server.",
      });
      return;
    }

    if (res.status === 429) {
      // Cap hit between mount-time check and submit. Switch to capped.
      setView({ kind: "capped" });
      return;
    }
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setView({ kind: "error", message: data.error ?? `Server returned ${res.status}` });
      return;
    }

    // Cached short-circuit — server returned JSON instead of streaming.
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const data = (await res.json()) as { cached?: boolean; sessionId?: string };
      if (data.cached && data.sessionId) {
        const r2 = await fetch(`/api/intake/snapshot/${data.sessionId}`);
        if (r2.ok) {
          const snap = (await r2.json()) as { snapshot: IntakeSnapshot; sessionId: string };
          setView({ kind: "snapshot", snapshot: snap.snapshot, sessionId: snap.sessionId });
          return;
        }
      }
      setView({ kind: "error", message: "Couldn't load cached snapshot — try a different URL." });
      return;
    }

    // Stream NDJSON.
    if (!res.body) {
      setView({ kind: "error", message: "Streaming not supported in this browser." });
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let progress = freshProgress();
    let activePhase: Phase | null = null;
    let finalSnapshot: IntakeSnapshot | null = null;
    let finalSessionId: string | null = null;
    let errorMessage: string | null = null;

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let evt: {
            kind: string;
            phase?: Phase;
            message?: string;
            snapshot?: IntakeSnapshot;
            sessionId?: string;
          };
          try {
            evt = JSON.parse(trimmed);
          } catch {
            continue;
          }

          if (evt.kind === "progress" && evt.phase) {
            activePhase = evt.phase;
            progress = progress.map((p) =>
              p.phase === evt.phase
                ? { ...p, status: "active" }
                : p.status === "active"
                  ? { ...p, status: "done" }
                  : p,
            );
            setView({ kind: "streaming", progress, activePhase });
          } else if (evt.kind === "phase-done" && evt.phase) {
            progress = progress.map((p) =>
              p.phase === evt.phase ? { ...p, status: "done" } : p,
            );
            setView({ kind: "streaming", progress, activePhase });
          } else if (evt.kind === "complete" && evt.snapshot && evt.sessionId) {
            finalSnapshot = evt.snapshot;
            finalSessionId = evt.sessionId;
          } else if (evt.kind === "error") {
            errorMessage = evt.message ?? "Something went wrong during analysis.";
          }
        }
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : "Stream interrupted.";
    }

    if (finalSnapshot && finalSessionId) {
      track("generate_lead", {
        event_type: "intake_snapshot_complete",
        cta_location: "intake_hero",
        value: finalSnapshot.readiness.overall,
      });
      setView({ kind: "snapshot", snapshot: finalSnapshot, sessionId: finalSessionId });
    } else {
      setView({
        kind: "error",
        message:
          errorMessage ?? "We couldn't read enough from that URL — try a different page or skip ahead with our 15-question assessment.",
      });
    }
  }

  // ─── Save email ─────────────────────────────────────────────────
  async function handleSaveEmail(e: React.FormEvent) {
    e.preventDefault();
    if (view.kind !== "snapshot") return;
    const email = emailInput.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Please enter a valid email.");
      return;
    }
    setEmailError(null);
    const snapshot = view.snapshot;
    const sessionId = view.sessionId;
    // Stash snapshot + sessionId so the saved-state view can render
    // the same snapshot unblurred (the saved view's union narrows to
    // just { email } so we lose the snapshot from `view`).
    savedSnapshotRef.current = snapshot;
    savedSessionIdRef.current = sessionId;
    setView({ kind: "saving", snapshot, sessionId });

    try {
      const r = await fetch("/api/intake/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, sessionId }),
      });
      if (!r.ok) {
        const data = (await r.json().catch(() => ({}))) as { error?: string };
        setEmailError(data.error ?? "Couldn't save — try again.");
        setView({ kind: "snapshot", snapshot, sessionId });
        return;
      }
      track("cta_click", {
        cta_label: "intake_save_email",
        cta_location: "intake_hero_save",
      });
      setView({ kind: "saved", email });
    } catch {
      setEmailError("Network hiccup — try again.");
      setView({ kind: "snapshot", snapshot, sessionId });
    }
  }

  // ─── Render ─────────────────────────────────────────────────────
  if (view.kind === "loading") {
    return <HeroSkeletonCTA />;
  }

  if (view.kind === "capped") {
    return <CappedFallbackCTA />;
  }

  if (view.kind === "idle") {
    return <UrlInputForm urlInput={urlInput} setUrlInput={setUrlInput} onSubmit={handleSubmit} inputRef={inputRef} />;
  }

  if (view.kind === "streaming") {
    return <StreamingProgress progress={view.progress} activePhase={view.activePhase} urlInput={urlInput} />;
  }

  if (view.kind === "snapshot" || view.kind === "saving") {
    return (
      <SnapshotView
        snapshot={view.snapshot}
        sessionId={view.sessionId}
        emailInput={emailInput}
        setEmailInput={setEmailInput}
        emailError={emailError}
        onSubmit={handleSaveEmail}
        saving={view.kind === "saving"}
        revealAll={false}
      />
    );
  }

  if (view.kind === "saved") {
    // Same SnapshotView component, but unblurred (revealAll=true) and
    // with a green confirmation banner above replacing the save form.
    // Keeps the user in their context — they get the reveal AS the
    // confirmation rather than navigating to a separate "saved" screen.
    return (
      <SnapshotView
        snapshot={savedSnapshotRef.current ?? undefined}
        sessionId={savedSessionIdRef.current ?? ""}
        emailInput={emailInput}
        setEmailInput={setEmailInput}
        emailError={null}
        onSubmit={() => {}}
        saving={false}
        revealAll={true}
        savedEmail={view.email}
      />
    );
  }

  if (view.kind === "error") {
    return <ErrorState message={view.message} />;
  }

  return null;
}

// ─── State sub-components ──────────────────────────────────────────

function HeroSkeletonCTA() {
  return (
    <div className="max-w-[640px]">
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 flex gap-2 animate-pulse">
        <div className="flex-1 h-12 bg-white/20 rounded-xl" />
        <div className="w-32 h-12 bg-gold/40 rounded-xl" />
      </div>
    </div>
  );
}

function UrlInputForm({
  urlInput,
  setUrlInput,
  onSubmit,
  inputRef,
}: {
  urlInput: string;
  setUrlInput: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="max-w-[640px]">
      <p className="text-white/85 text-base md:text-lg mb-4 font-light">
        In 60 seconds, see if your business is ready to franchise — and your three best expansion markets.
      </p>
      <form onSubmit={onSubmit} className="bg-white rounded-2xl p-2 flex flex-col sm:flex-row gap-2 shadow-[0_12px_40px_rgba(0,0,0,0.3)]">
        <input
          ref={inputRef}
          type="text"
          inputMode="url"
          autoComplete="url"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="yourcompany.com"
          className="flex-1 px-4 py-3 text-navy text-base placeholder-grey-4 outline-none bg-transparent"
          required
          minLength={4}
          maxLength={2000}
        />
        <button
          type="submit"
          disabled={urlInput.trim().length < 4}
          className="bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-7 py-3 rounded-xl hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
        >
          Analyze
          <ArrowRight size={15} />
        </button>
      </form>
      <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:gap-6 text-white/70 text-sm">
        <span>
          Don&apos;t have a website?{" "}
          <Link href="/assessment" className="text-white font-semibold underline-offset-4 hover:underline">
            Take the 15-question Readiness Assessment →
          </Link>
        </span>
        <span className="hidden sm:inline opacity-40">·</span>
        <span>
          Just want to talk?{" "}
          <Link href="/strategy-call" className="text-white font-semibold underline-offset-4 hover:underline">
            Book a strategy call →
          </Link>
        </span>
      </div>
    </div>
  );
}

function CappedFallbackCTA() {
  return (
    <div className="max-w-[640px]">
      <div className="flex flex-wrap gap-4">
        <Link
          href="/assessment"
          className="bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-9 py-4 rounded-full hover:bg-gold-dark hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(212,175,55,0.35)] transition-all"
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
      <p className="mt-4 text-white/60 text-sm italic">
        Our instant URL analyzer is at capacity for today — try again tomorrow, or jump straight to the 15-question assessment.
      </p>
    </div>
  );
}

function StreamingProgress({
  progress,
  activePhase: _activePhase,
  urlInput,
}: {
  progress: PhaseStatus[];
  activePhase: Phase | null;
  urlInput: string;
}) {
  return (
    <div className="max-w-[640px] bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-6 md:p-7">
      <div className="flex items-center gap-3 mb-5">
        <Loader2 size={18} className="text-gold animate-spin" />
        <span className="text-white text-sm font-semibold tracking-wide">
          Analyzing <span className="text-gold">{urlInput}</span>…
        </span>
      </div>
      <ul className="space-y-2.5">
        {progress.map((p) => (
          <li key={p.phase} className="flex items-center gap-3 text-sm">
            {p.status === "done" && (
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gold flex items-center justify-center">
                <Check size={12} className="text-navy" strokeWidth={3} />
              </span>
            )}
            {p.status === "active" && (
              <Loader2 size={14} className="text-gold animate-spin flex-shrink-0" />
            )}
            {p.status === "pending" && (
              <span className="flex-shrink-0 w-5 h-5 rounded-full border border-white/30" />
            )}
            <span
              className={
                p.status === "done"
                  ? "text-white"
                  : p.status === "active"
                    ? "text-white font-semibold"
                    : "text-white/40"
              }
            >
              {p.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Tier-fit copy. Each tier suggestion gets a 3-4 sentence explainer
 * that names the artifact AND why it matters — written for first-time
 * visitors who've never heard of TFB before. Replaces the previous
 * single-line tier labels (e.g. "Not yet — let's talk first") that
 * Eric's QA flagged as too short and AI-speak-y.
 */
/**
 * Tier-fit copy. Each tier suggestion gets a 2-sentence explainer that
 * names the artifact AND gives the owner one clear next step.
 *
 * Length discipline: a small business owner scanning the snapshot needs
 * to know (1) which tier fits, (2) what they'll get for the money,
 * (3) what to do next. Anything past that is filler. Everything else
 * is on the destination /programs/blueprint or /strategy-call page.
 */
const TIER_COPY: Record<
  IntakeSnapshot["readiness"]["suggestedTier"],
  { headline: string; body: string }
> = {
  "not-yet": {
    headline: "Take a beat first — let's talk",
    body:
      "A few foundational pieces aren't quite in place yet for franchising to make financial sense. Owners who try to franchise too early often burn $40K–$80K on legal fees for a system that won't scale. Free 30-minute call: we'll tell you straight what to fix and roughly how long it'll take.",
  },
  blueprint: {
    headline: "Start with The Blueprint — $2,997",
    body:
      "You're close. The Blueprint is the complete 9-framework franchisor system you can run yourself: 17-section Operations Manual, FDD explainer for all 23 federal items, site-selection rubric, training scaffolding, and a Discovery Day deck. Most DIY-ready operators launch their first franchisee in about 6 months.",
  },
  navigator: {
    headline: "Navigator is your match — $8,500",
    body:
      "You're ready, but the legal and operational handoffs are where first-timers stumble. Navigator pairs the full Blueprint system with 24 weekly 1:1 coaching calls over 6 months, document review, and Franchise Ready certification. The structured cadence gets you to launch faster than going it alone.",
  },
  builder: {
    headline: "Builder is your match — $29,500",
    body:
      "Your business is ready for full done-with-you franchise development. We project-manage the 12-month build, coordinate your franchise attorney, generate the FDD, and assist with your first franchisee recruitment. You stay in the captain's chair on brand and operations.",
  },
};

function SnapshotView({
  snapshot,
  sessionId: _sessionId,
  emailInput,
  setEmailInput,
  emailError,
  onSubmit,
  saving,
  revealAll,
  savedEmail,
}: {
  snapshot: IntakeSnapshot | undefined;
  sessionId: string;
  emailInput: string;
  setEmailInput: (v: string) => void;
  emailError: string | null;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  /** When true, all 3 markets render unblurred and the save form
   *  is replaced with a green "snapshot saved" confirmation banner. */
  revealAll: boolean;
  /** Set in the saved view to render in the confirmation banner. */
  savedEmail?: string;
}) {
  // Defensive: the saved view falls back to refs that should always be
  // populated, but if they're not for any reason, render nothing rather
  // than crashing.
  if (!snapshot) return null;

  const score = snapshot.readiness.overall;
  const tier = snapshot.readiness.suggestedTier;
  const tierCopy = TIER_COPY[tier];

  // Display name: prefer the LLM-extracted business name; if extraction
  // failed entirely, fall back to a friendly humanized version of the
  // domain rather than the placeholder "Your Business" Eric flagged.
  const displayName = (() => {
    if (snapshot.business.name) return snapshot.business.name;
    return "Your business";
  })();

  // The reveal animation uses incremental delays. Each section gets a
  // class with a different transitionDelay value via inline style so
  // they fade-in staggered after the snapshot mounts. ~140ms gap reads
  // as deliberate without being slow.
  const fadeIn = "intake-fade-in";

  // Markets layout: #1 always visible. #2 + #3 blurred until revealAll.
  const markets = snapshot.expansion;
  const primaryMarket = markets[0];
  const lockedMarkets = markets.slice(1);

  return (
    <div className="max-w-[820px]">
      {/* Saved banner — replaces the save form when revealAll is true */}
      {revealAll && savedEmail && (
        <div
          className={`${fadeIn} mb-4 bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-5 flex items-start gap-3 shadow-[0_12px_40px_rgba(0,0,0,0.2)]`}
        >
          <CheckCircle2
            size={24}
            className="text-emerald-600 flex-shrink-0 mt-0.5"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-emerald-900 font-bold text-base mb-0.5">
              All three markets unlocked. Check your inbox.
            </p>
            <p className="text-emerald-800/85 text-sm leading-relaxed">
              We sent the full snapshot to{" "}
              <span className="font-semibold break-all">{savedEmail}</span>. You
              can scroll down to see all three expansion markets, your gaps,
              and what we'd recommend for your next move.
            </p>
          </div>
        </div>
      )}

      {/* Snapshot card */}
      <div
        className={`${fadeIn} bg-cream rounded-2xl border border-gold/30 shadow-[0_24px_60px_rgba(0,0,0,0.32)] p-6 md:p-9 text-navy`}
        style={{ animationDelay: "0ms" }}
      >
        {/* Header — eyebrow + business + score (sized to dominate) */}
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-4 pb-5 border-b border-navy/15">
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-[0.18em] uppercase text-gold-warm">
              Franchise Readiness Snapshot
            </p>
            <p className="text-navy font-bold text-2xl md:text-3xl mt-1.5 break-words leading-tight">
              {displayName}
            </p>
            {snapshot.business.oneLineConcept && (
              <p className="text-grey-3 text-base italic mt-1">
                {snapshot.business.oneLineConcept}
              </p>
            )}
          </div>
          <div className="flex sm:flex-col items-baseline sm:items-end gap-2 sm:gap-0 flex-shrink-0">
            <div className="text-5xl md:text-6xl font-extrabold text-navy tabular-nums leading-none">
              {score}
              <span className="text-grey-4 text-3xl font-bold">/100</span>
            </div>
            <p className="text-xs font-bold tracking-[0.15em] uppercase text-grey-4 sm:mt-1.5">
              Preliminary
            </p>
          </div>
        </div>

        {/* "Where Your Business Operates Today" — short paragraph; bumped to readable size */}
        <div
          className={`${fadeIn} mt-6`}
          style={{ animationDelay: "140ms" }}
        >
          <p className="text-xs font-bold tracking-[0.18em] uppercase text-gold-warm mb-2.5">
            Where your business operates today
          </p>
          <p className="text-navy/85 text-base md:text-[17px] leading-relaxed">
            {snapshot.prototype.narrative}
          </p>
        </div>

        {/* "Markets where we'd open next" — replaces "Top expansion markets" */}
        {markets.length > 0 && (
          <div
            className={`${fadeIn} mt-7 pt-6 border-t border-navy/10`}
            style={{ animationDelay: "280ms" }}
          >
            <p className="text-xs font-bold tracking-[0.18em] uppercase text-gold-warm mb-2.5">
              Markets where we'd open next
            </p>
            <p className="text-grey-3 text-base leading-relaxed mb-4">
              Each market is scored against your prototype's demographic
              signature, with bonus weight for whitespace (low competitor
              saturation). The full 4-pillar breakdown unlocks when you
              save your snapshot.
            </p>

            {/* Primary market — always visible, full detail */}
            {primaryMarket && (
              <MarketCard market={primaryMarket} index={0} blurred={false} showPillars={revealAll} />
            )}

            {/* Locked markets — blurred until revealAll, with a gating overlay */}
            {lockedMarkets.length > 0 && (
              <div className="relative mt-3 space-y-3">
                {lockedMarkets.map((m, i) => (
                  <MarketCard
                    key={m.zip}
                    market={m}
                    index={i + 1}
                    blurred={!revealAll}
                    showPillars={revealAll}
                  />
                ))}
                {!revealAll && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-navy/95 text-white rounded-xl px-6 py-4 shadow-2xl border border-gold/40 flex items-center gap-3 pointer-events-auto">
                      <Lock size={20} className="text-gold flex-shrink-0" aria-hidden />
                      <span className="text-base font-semibold">
                        Two more markets unlock when you save below
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* "What's standing between you and your first franchise" — gaps */}
        {snapshot.readiness.gaps.length > 0 && (
          <div
            className={`${fadeIn} mt-7 pt-6 border-t border-navy/10`}
            style={{ animationDelay: "420ms" }}
          >
            <p className="text-xs font-bold tracking-[0.18em] uppercase text-gold-warm mb-2.5">
              What's standing between you and your first franchise
            </p>
            <ol className="space-y-4 text-navy/85 text-base md:text-[17px] leading-relaxed">
              {snapshot.readiness.gaps.map((g, i) => (
                <li key={i} className="flex gap-3">
                  <span className="text-gold-warm font-bold flex-shrink-0 tabular-nums text-base">
                    {String(i + 1).padStart(2, "0")}.
                  </span>
                  <span>{g}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* "What we'd recommend next" — the most decision-driving section */}
        <div
          className={`${fadeIn} mt-7 pt-6 border-t border-navy/15`}
          style={{ animationDelay: "560ms" }}
        >
          <p className="text-xs font-bold tracking-[0.18em] uppercase text-gold-warm mb-2.5">
            What we'd recommend next
          </p>
          <p className="text-navy font-bold text-xl md:text-2xl mb-2.5 leading-tight">
            {tierCopy.headline}
          </p>
          <p className="text-navy/85 text-base md:text-[17px] leading-relaxed">
            {tierCopy.body}
          </p>
        </div>

        {/* Diagnostic footer — preserves the "30-year operator with software"
            framing. Stays small intentionally — it's reassurance, not action. */}
        <div className="mt-6 pt-5 border-t border-navy/10">
          <p className="text-grey-4 text-xs italic leading-relaxed">
            Built on Jason&apos;s 4-pillar / 100-point site-readiness diagnostic — the same
            rubric we&apos;ll codify into your FDD Item 11 site-criteria sheet inside The
            Blueprint.
          </p>
        </div>
      </div>

      {/* Save form — replaced with confirmation banner once saved */}
      {!revealAll && (
        <form
          onSubmit={onSubmit}
          className={`${fadeIn} mt-5 bg-white/95 backdrop-blur rounded-2xl p-6 md:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.25)]`}
          style={{ animationDelay: "700ms" }}
        >
          <p className="text-navy font-bold text-xl md:text-2xl mb-3 leading-tight">
            Unlock the full snapshot — and we'll save your work.
          </p>
          <ul className="text-navy/85 text-base leading-relaxed mb-5 space-y-2">
            <li className="flex gap-3">
              <span className="text-gold-warm font-bold flex-shrink-0 mt-0.5">→</span>
              <span>
                The other two markets unlock here, plus the full 4-pillar
                scoring on all three.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-gold-warm font-bold flex-shrink-0 mt-0.5">→</span>
              <span>
                If you ever build your franchise system with us, we already
                have a 15–20% head start on your data.
              </span>
            </li>
          </ul>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 relative">
              <Mail
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-grey-4"
                aria-hidden
              />
              <input
                type="email"
                required
                autoComplete="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="you@yourcompany.com"
                className="w-full rounded-xl border border-navy/15 pl-11 pr-3 py-4 text-base text-navy placeholder-grey-4 focus:border-gold focus:ring-2 focus:ring-gold/20 outline-none transition"
                disabled={saving}
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="bg-gold text-navy font-bold text-base uppercase tracking-[0.08em] px-8 py-4 rounded-xl hover:bg-gold-dark transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
              {saving ? "Saving…" : "Unlock all three markets"}
            </button>
          </div>
          {emailError && <p className="text-red-600 text-sm font-semibold mt-2">{emailError}</p>}
        </form>
      )}

      {/* Reveal-state CTAs — replace the assessment alt-link in the saved state */}
      {revealAll && (
        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          <Link
            href="/programs/blueprint"
            className="flex-1 bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-7 py-4 rounded-full hover:bg-gold-dark transition-colors text-center"
          >
            See The Blueprint →
          </Link>
          <Link
            href="/strategy-call/blueprint"
            className="flex-1 bg-white text-navy border-2 border-navy/15 font-bold text-sm uppercase tracking-[0.1em] px-7 py-4 rounded-full hover:bg-navy hover:text-white transition-colors text-center"
          >
            Book your kickoff call →
          </Link>
        </div>
      )}

      {/* Additive deeper assessment CTA — only in the unsaved state */}
      {!revealAll && (
        <div className="mt-3 text-center">
          <Link
            href="/assessment"
            className="inline-flex items-center gap-1.5 text-white/80 hover:text-white text-sm underline-offset-4 hover:underline"
          >
            <Sparkles size={14} />
            Want a sharper score? Add the 15-question Readiness Assessment (~5 min)
            <ArrowRight size={13} />
          </Link>
        </div>
      )}
    </div>
  );
}

/**
 * Single market card — used for the unblurred primary recommendation
 * AND the blurred locked recommendations.
 *
 * Density discipline: we used to render a 4-cell pillar grid by default
 * (Demographics 13/25, Traffic 22/25, Competition 8/25, Financial 25/25).
 * That grid is methodology detail, not decision input — a small business
 * owner skimming the snapshot doesn't need 4 sub-scores to decide whether
 * Atlanta or Austin looks promising. The overall score (e.g., 78/100) is
 * the decision signal; the pillars are evidence behind it. So we now
 * hide the breakdown by default and reveal it once the user has saved
 * their snapshot (showPillars=true on the saved view) — at that point
 * they're invested and the detail rewards the engagement.
 *
 * `blurred` wraps the card in a CSS filter so users see SHAPES of what's
 * coming for the locked #2 + #3 recommendations.
 */
function MarketCard({
  market,
  index,
  blurred,
  showPillars,
}: {
  market: IntakeSnapshot["expansion"][number];
  index: number;
  blurred: boolean;
  showPillars: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-xl border border-navy/10 p-5 md:p-6 ${
        blurred ? "select-none" : ""
      }`}
      style={
        blurred
          ? { filter: "blur(6px)", opacity: 0.7 }
          : undefined
      }
      aria-hidden={blurred}
    >
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div className="min-w-0">
          <span className="text-grey-4 text-base font-bold tabular-nums mr-2">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="text-navy font-bold text-lg md:text-xl">
            {market.label}
          </span>
          <div className="text-grey-4 text-sm tabular-nums mt-0.5 ml-7">
            {market.zip}, {market.state}
          </div>
        </div>
        <div className="text-navy font-extrabold text-3xl md:text-4xl tabular-nums leading-none">
          {market.score}
        </div>
      </div>
      <p className="text-grey-3 text-base leading-relaxed mt-2">
        {market.why}
      </p>
      {showPillars && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-navy/10 text-xs font-semibold uppercase tracking-wider">
          <PillarCell label="Demographics" score={market.pillars.demographicsAndMarket} max={25} />
          <PillarCell label="Traffic" score={market.pillars.trafficAndAccess} max={25} />
          <PillarCell label="Competition" score={market.pillars.competition} max={25} />
          <PillarCell label="Financial" score={market.pillars.financialAndLegal} max={25} />
        </div>
      )}
    </div>
  );
}

function PillarCell({ label, score, max }: { label: string; score: number; max: number }) {
  return (
    <div className="text-center">
      <div className="text-grey-4 mb-1">{label}</div>
      <div className="text-navy tabular-nums font-extrabold text-sm">
        {score}<span className="text-grey-4">/{max}</span>
      </div>
    </div>
  );
}

// SavedConfirmation removed: the saved state now renders SnapshotView with
// revealAll=true, which shows an emerald confirmation banner above the
// (now-unblurred) snapshot. Keeps the user in their context — the reveal
// IS the confirmation rather than a separate "saved" screen.

function ErrorState({ message }: { message: string }) {
  return (
    <div className="max-w-[640px] bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-6 text-white">
      <p className="font-bold mb-1">We hit a snag.</p>
      <p className="text-white/80 text-sm leading-relaxed mb-4">{message}</p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/assessment"
          className="bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-7 py-3 rounded-full hover:bg-gold-dark transition-colors"
        >
          Take the 15-question Assessment
        </Link>
        <Link
          href="/strategy-call"
          className="bg-transparent text-white border-2 border-white/60 font-bold text-sm uppercase tracking-[0.1em] px-7 py-3 rounded-full hover:bg-white hover:text-navy transition-colors"
        >
          Book a strategy call
        </Link>
      </div>
    </div>
  );
}

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

/**
 * Orchestrator phases (server-side enum). These map onto a smaller set
 * of display phases the visitor actually sees — Eric flagged 8 grey
 * "todo" circles as anxiety-inducing and asked us to consolidate
 * (2026-05-10). Display rename also lands title case + per-step
 * findings reveal (TurboTax-style confidence checkpoint pattern).
 */
type ServerPhase =
  | "scrape"
  | "business"
  | "geocode"
  | "demographics"
  | "competitors"
  | "expansion"
  | "score"
  | "summary";

/**
 * What the visitor sees in the loading card. Six steps, title-cased,
 * verb-first. Each consolidates 1-2 server phases:
 *   research      = scrape + business
 *   geography     = geocode + demographics
 *   competitors   = competitors
 *   expansion     = expansion
 *   readiness     = score
 *   summary       = summary
 */
type DisplayPhase =
  | "research"
  | "geography"
  | "competitors"
  | "expansion"
  | "readiness"
  | "summary";

const SERVER_TO_DISPLAY: Record<ServerPhase, DisplayPhase> = {
  scrape: "research",
  business: "research",
  geocode: "geography",
  demographics: "geography",
  competitors: "competitors",
  expansion: "expansion",
  score: "readiness",
  summary: "summary",
};

type View =
  | { kind: "loading" }
  | { kind: "capped" }
  | { kind: "idle" }
  | { kind: "streaming"; progress: PhaseStatus[]; activePhase: DisplayPhase | null }
  | { kind: "snapshot"; snapshot: IntakeSnapshot; sessionId: string }
  | { kind: "saving"; snapshot: IntakeSnapshot; sessionId: string }
  | { kind: "saved"; email: string }
  | { kind: "error"; message: string };

type PhaseStatus = {
  phase: DisplayPhase;
  label: string;
  status: "pending" | "active" | "done" | "skipped";
  /**
   * Plain-English finding surfaced under each completed step ("Looks
   * like Costa Vida — fast-casual fresh Mexican grill."). Empty until
   * the matching server phase emits enough data to populate it.
   */
  finding?: string;
};

const DISPLAY_PHASE_LABELS: Record<DisplayPhase, string> = {
  research: "Researching Your Business",
  geography: "Mapping Your Location(s) and Demographics",
  competitors: "Scanning Competitive Landscape",
  expansion: "Scoring Expansion Markets",
  readiness: "Building Readiness Score",
  summary: "Drafting Your Home-Market Summary",
};

const DISPLAY_PHASES_IN_ORDER: DisplayPhase[] = [
  "research",
  "geography",
  "competitors",
  "expansion",
  "readiness",
  "summary",
];

function freshProgress(): PhaseStatus[] {
  return DISPLAY_PHASES_IN_ORDER.map((phase) => ({
    phase,
    label: DISPLAY_PHASE_LABELS[phase],
    status: "pending",
  }));
}

/**
 * Last server phase that maps to a given display phase. Used by the
 * stream consumer to decide when to flip a display step from 'active'
 * to 'done'. For consolidated steps (research = scrape + business), we
 * wait for the second sub-phase to complete before showing ✓.
 */
function lastServerPhaseFor(display: DisplayPhase): ServerPhase {
  switch (display) {
    case "research":
      return "business";
    case "geography":
      return "demographics";
    case "competitors":
      return "competitors";
    case "expansion":
      return "expansion";
    case "readiness":
      return "score";
    case "summary":
      return "summary";
  }
}

/**
 * Derive a one-line finding to show under a completed display phase.
 * Falls back to undefined (no caption) if we don't have enough data
 * for a clean sentence — "no caption" reads cleaner than a half-empty
 * one. All copy intentionally avoids spoiling the score reveal.
 */
function deriveFinding(
  display: DisplayPhase,
  serverPhase: ServerPhase,
  data: unknown,
): string | undefined {
  // Narrow the data shape per-phase. Keep this defensive — the API
  // shape is partially typed; bad casts here just hide the caption.
  if (display === "research" && serverPhase === "business") {
    const b = data as { name?: string | null; oneLineConcept?: string | null } | null;
    if (b?.name && b.oneLineConcept) {
      return `Looks like ${b.name} — ${b.oneLineConcept}.`;
    }
    if (b?.name) return `Looks like ${b.name}.`;
    return undefined;
  }
  if (display === "geography" && serverPhase === "demographics") {
    const d = data as {
      demographics?: { medianHouseholdIncome?: number; medianAge?: number; population?: number } | null;
    } | null;
    if (d?.demographics) {
      const inc = d.demographics.medianHouseholdIncome;
      const age = d.demographics.medianAge;
      const parts: string[] = [];
      if (typeof inc === "number") parts.push(`median income $${Math.round(inc / 1000)}K`);
      if (typeof age === "number") parts.push(`median age ${age}`);
      return parts.length ? parts.join(" · ") : undefined;
    }
    return undefined;
  }
  if (display === "expansion" && serverPhase === "expansion") {
    const list = Array.isArray(data) ? (data as unknown[]) : null;
    if (list && list.length > 0) {
      return `Scored 60 candidate metros — narrowed to top ${list.length}.`;
    }
    return undefined;
  }
  if (display === "readiness" && serverPhase === "score") {
    const r = data as { overall?: number } | null;
    if (typeof r?.overall === "number") {
      return `Preliminary readiness: ${r.overall}/100.`;
    }
    return undefined;
  }
  // research/scrape, geography/geocode, competitors/competitors, summary —
  // these don't carry useful data for a one-line finding (or aren't
  // observed via phase-done events today). Caption stays empty.
  return undefined;
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
    let activePhase: DisplayPhase | null = null;
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
            phase?: ServerPhase;
            message?: string;
            data?: unknown;
            snapshot?: IntakeSnapshot;
            sessionId?: string;
          };
          try {
            evt = JSON.parse(trimmed);
          } catch {
            continue;
          }

          if (evt.kind === "progress" && evt.phase) {
            const display = SERVER_TO_DISPLAY[evt.phase];
            activePhase = display;
            progress = progress.map((p) => {
              if (p.phase === display) {
                // Don't downgrade a 'done' phase back to 'active' if a
                // sub-phase fires its progress event (e.g. server phase
                // 'business' lands after 'scrape' both inside display
                // phase 'research').
                return p.status === "done" ? p : { ...p, status: "active" };
              }
              // Mark any earlier display phase that's still 'active'
              // as 'done' since the server moved on past it.
              if (
                p.status === "active" &&
                DISPLAY_PHASES_IN_ORDER.indexOf(p.phase) <
                  DISPLAY_PHASES_IN_ORDER.indexOf(display)
              ) {
                return { ...p, status: "done" };
              }
              return p;
            });
            setView({ kind: "streaming", progress, activePhase });
          } else if (evt.kind === "phase-done" && evt.phase) {
            const display = SERVER_TO_DISPLAY[evt.phase];
            const finding = deriveFinding(display, evt.phase, evt.data);
            progress = progress.map((p) => {
              if (p.phase !== display) return p;
              // Only flip to 'done' if this server phase is the LAST
              // server phase that maps to this display phase. Otherwise
              // keep the display step in 'active' so the spinner shows
              // through the second sub-phase.
              const lastForDisplay = lastServerPhaseFor(display);
              const status: PhaseStatus["status"] =
                evt.phase === lastForDisplay ? "done" : p.status;
              // Only overwrite an existing finding if the new one is
              // more informative (we prefer last-emit-wins for findings
              // that come from the terminal sub-phase).
              const nextFinding = finding ?? p.finding;
              return { ...p, status, finding: nextFinding };
            });
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
      {/* Lead-in copy was here; now lives in the home page hero <p>
          ("In less than 60 seconds, see if your business is ready...")
          since Eric wanted it as the primary subhead-replacement, sized
          to match the original eyebrow paragraph styling. */}
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
          // No `disabled:opacity-50` — visual fade was confusing visitors
          // who already understand the input is required. The native
          // disabled state still prevents an empty submit; we just don't
          // visually broadcast it. cursor-not-allowed kept on disabled
          // so hover communicates "fill the field first."
          className="bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-7 py-3 rounded-xl hover:bg-gold-dark transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
        >
          Analyze
          <ArrowRight size={15} />
        </button>
      </form>
      {/* "Here's what we actually look at" — a one-line trust statement
          that defuses the obvious skeptic question ("can they really
          tell anything from a URL?") without forcing the visitor to
          click through a disclosure. Eric flagged that even he is
          suspicious of the value prop, so we name our inputs in plain
          English right at the point of skepticism. */}
      <p className="mt-3 text-white/70 text-sm leading-relaxed">
        We read your homepage and About page, pull demographics on your
        home market from US Census data, check competitor density via
        Google Maps, and score 60 high-potential expansion markets the
        same way.
      </p>
      <p className="mt-4 text-white/85 text-base md:text-lg whitespace-normal sm:whitespace-nowrap">
        Don&apos;t have a website?{" "}
        <Link
          href="/assessment"
          className="text-gold font-bold underline-offset-4 hover:underline"
        >
          Take the Franchise Readiness Assessment →
        </Link>
      </p>
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
  activePhase: DisplayPhase | null;
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
      <ul className="space-y-3">
        {progress.map((p) => (
          <li key={p.phase} className="text-sm">
            <div className="flex items-center gap-3">
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
            </div>
            {/* Per-step finding — shown under completed steps so the
                wait turns into a story of what we found. Pad the icon
                column so the caption lines up under the label, not the
                circle. */}
            {p.status === "done" && p.finding && (
              <p className="mt-1 ml-8 text-xs text-white/55 leading-relaxed">
                {p.finding}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Tier-fit copy.
 *
 * Eric flagged 2026-05-10: a $29.5K "Builder" CTA on a snapshot a
 * stranger just generated is too aggressive for a first touchpoint.
 * Owners need a low-friction next step ("book a 15-min call")
 * regardless of internal tier routing. Pricing belongs on the
 * destination /programs page, not the snapshot. Internal sales sees
 * the suggestedTier flag in the lead-notification email so they can
 * prepare for the call appropriately.
 *
 * All four tier copies now (1) lead with a benefit, (2) name the path
 * forward in plain English, (3) end on a low-friction "let's talk"
 * framing. The unified CTA below the section is "Book a 15-min call"
 * for every tier — same conversion mechanic regardless of routing.
 */
const TIER_COPY: Record<
  IntakeSnapshot["readiness"]["suggestedTier"],
  { headline: string; body: string }
> = {
  "not-yet": {
    headline: "Talk to us before you spend a dollar on franchising.",
    body:
      "A few foundational pieces aren't quite in place yet, and owners who try to franchise too early often burn $40K to $80K on legal fees for a system that won't scale. A 15-minute call gets you a candid read on what to fix first and a realistic timeline.",
  },
  blueprint: {
    headline: "You're closer to franchise-ready than most.",
    body:
      "You have the foundations to run a structured franchise development project. A 15-minute call lets us pressure-test that read against your specific situation and map the cleanest path to your first franchisee, usually inside six months.",
  },
  navigator: {
    headline: "You'd benefit from a guide for the legal and operational handoffs.",
    body:
      "You're ready to franchise, but the FDD, the operations manual, and the first franchisee recruitment are where most first-timers stumble. A 15-minute call lets us walk you through what coached franchise development looks like so you can decide if it's the right fit.",
  },
  builder: {
    headline: "You're ready for the highest-touch path.",
    body:
      "Your business has the maturity for done-with-you franchise development. A 15-minute call lets us walk you through what that engagement actually looks like, what we'd own versus what you'd own, and whether the timing is right.",
  },
};

/**
 * Recommended-next-step copy for the existing-franchisor branch.
 * Triggered when detectFranchiseSignals classifies the URL as already
 * operating as a franchisor (Eric flagged 2026-05-10 — Costa Vida
 * scoring 53/100 "readiness" was nonsense for a 94-location franchise
 * that's been selling franchises for 20 years).
 *
 * The copy pivots from "are you ready to franchise?" framing into
 * "you're already there — let's talk growth." Different sales
 * conversation, different lead qualification, different close.
 */
const EXISTING_FRANCHISOR_COPY = {
  headline: "You're already franchising — let's talk growth, not setup.",
  body:
    "Your website signals you're past the readiness phase: existing franchisees, multi-state footprint, and a system already in market. The 15-minute call we offer to first-time franchisors doesn't fit your stage — but a portfolio strategy conversation might. Tell us what you're trying to scale next and we'll see if there's a fit.",
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
  const isExisting = snapshot.existingFranchisor?.isFranchising === true;
  // Existing-franchisor branch: hide the readiness number entirely
  // (a 53/100 "readiness" label on a 94-location franchise reads as
  // the model failing) and pivot the recommended-next-step copy from
  // "let's coach you through becoming a franchisor" to "let's talk
  // portfolio strategy." Eric's 2026-05-10 ask. The internal-team
  // notification still includes the suggestedTier flag if any so
  // sales has context.
  const tierCopy = isExisting
    ? EXISTING_FRANCHISOR_COPY
    : TIER_COPY[tier];

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

  // Tranche 6: geographic preference toggle. Default = "near home"
  // (proximity-weighted ranking). Alt = "anywhere" (pure 4-pillar
  // ranking). Only shown when the two rankings actually differ —
  // server returns empty expansionAnywhere when they collide.
  const [marketPreference, setMarketPreference] = useState<"near" | "anywhere">(
    "near",
  );
  const hasAnywhereOption =
    Array.isArray(snapshot.expansionAnywhere) &&
    snapshot.expansionAnywhere.length > 0;
  // Markets layout: #1 always visible. #2 + #3 blurred until revealAll.
  const markets =
    marketPreference === "anywhere" && hasAnywhereOption
      ? snapshot.expansionAnywhere
      : snapshot.expansion;
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
            {/* "Franchise Readiness Snapshot" eyebrow removed per Eric's
                QA (2026-05-10). The business name + score below already
                anchor the card. */}
            <p className="text-navy font-bold text-2xl md:text-3xl break-words leading-tight">
              {displayName}
            </p>
            {snapshot.business.oneLineConcept && (
              <p className="text-grey-3 text-base italic mt-1">
                {snapshot.business.oneLineConcept}
              </p>
            )}
          </div>
          <div className="flex sm:flex-col items-baseline sm:items-end gap-2 sm:gap-0 flex-shrink-0">
            {isExisting ? (
              // Existing-franchisor badge replaces the readiness number.
              // A 53/100 "preliminary readiness" label is meaningless
              // when the business has already been franchising for
              // years; the badge surfaces what we DID detect (active
              // franchise sales, multi-unit, etc.) without forcing the
              // reader to translate a candidate-stage score.
              <div className="flex flex-col items-end">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold/15 border border-gold/40">
                  <span className="w-2 h-2 rounded-full bg-gold-warm" />
                  <span className="text-navy font-bold text-sm tracking-wide">
                    Already franchising
                  </span>
                </span>
                {snapshot.existingFranchisor?.locationCount ? (
                  <p className="text-xs text-grey-3 mt-1.5 sm:mt-2 tabular-nums">
                    {snapshot.existingFranchisor.locationCount.toLocaleString()}+ locations detected
                  </p>
                ) : null}
              </div>
            ) : (
              <>
                <div className="text-5xl md:text-6xl font-extrabold text-navy tabular-nums leading-none">
                  {score}
                  <span className="text-grey-4 text-3xl font-bold">/100</span>
                </div>
                <p className="text-xs font-bold tracking-[0.15em] uppercase text-grey-4 sm:mt-1.5">
                  Preliminary
                </p>
              </>
            )}
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
            {snapshot.homeMarket.narrative}
          </p>
        </div>

        {/* "Markets where we'd open next" — replaces "Top expansion markets" */}
        {markets.length > 0 && (
          <div
            className={`${fadeIn} mt-7 pt-6 border-t border-navy/10`}
            style={{ animationDelay: "280ms" }}
          >
            <p className="text-xs font-bold tracking-[0.18em] uppercase text-gold-warm mb-2.5">
              Markets where we&apos;d open next
            </p>
            <p className="text-grey-3 text-base leading-relaxed mb-4">
              We match each candidate market against the demographic
              fingerprint of your home market and give bonus weight to
              areas where comparable concepts haven&apos;t saturated the
              trade area yet. The full 4-pillar breakdown unlocks when
              you save your snapshot below.
            </p>

            {/* Tranche 6: geographic-preference toggle. Eric's
                ask was a TurboTax-style "expand within driving
                distance, or are you open to anywhere?" guided choice.
                Two segmented buttons; clicking re-renders the markets
                list against the alternate ranking. Hidden when the
                server determined both rankings would surface the same
                top 3 (no toggle = no decision to make). */}
            {hasAnywhereOption && (
              <div className="mb-5 flex items-center gap-2">
                <span className="text-xs font-bold tracking-[0.12em] uppercase text-grey-3 mr-1">
                  Show:
                </span>
                <div className="inline-flex p-0.5 bg-navy/5 border border-navy/10 rounded-full">
                  <button
                    type="button"
                    onClick={() => setMarketPreference("near")}
                    aria-pressed={marketPreference === "near"}
                    className={
                      "px-3.5 py-1.5 rounded-full text-sm font-bold transition-colors " +
                      (marketPreference === "near"
                        ? "bg-navy text-white"
                        : "text-navy/70 hover:text-navy cursor-pointer")
                    }
                  >
                    Near home
                  </button>
                  <button
                    type="button"
                    onClick={() => setMarketPreference("anywhere")}
                    aria-pressed={marketPreference === "anywhere"}
                    className={
                      "px-3.5 py-1.5 rounded-full text-sm font-bold transition-colors " +
                      (marketPreference === "anywhere"
                        ? "bg-navy text-white"
                        : "text-navy/70 hover:text-navy cursor-pointer")
                    }
                  >
                    Open to anywhere
                  </button>
                </div>
              </div>
            )}

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
                    <button
                      type="button"
                      onClick={() => {
                        const form = document.getElementById("intake-save-form");
                        form?.scrollIntoView({ behavior: "smooth", block: "center" });
                        // Focus the email input after the smooth scroll
                        // settles. 480ms matches typical smooth-scroll
                        // duration; a touch longer feels less janky.
                        window.setTimeout(() => {
                          const input = form?.querySelector<HTMLInputElement>(
                            'input[type="email"]',
                          );
                          input?.focus();
                        }, 520);
                      }}
                      className="bg-navy/95 hover:bg-navy text-white rounded-xl px-6 py-4 shadow-2xl border border-gold/40 hover:border-gold flex items-center gap-3 pointer-events-auto cursor-pointer transition-all hover:scale-[1.02]"
                    >
                      <Lock size={20} className="text-gold flex-shrink-0" aria-hidden />
                      <span className="text-base font-semibold">
                        Unlock Two More Markets
                      </span>
                      <ArrowRight size={18} className="text-gold flex-shrink-0" aria-hidden />
                    </button>
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

        {/* "What we'd recommend next" — the most decision-driving section.
            Every tier routes to a low-friction "book a 15-min call" CTA;
            pricing belongs on /programs, not the snapshot. Internal sales
            sees the suggestedTier flag in the lead-notification email. */}
        <div
          className={`${fadeIn} mt-7 pt-6 border-t border-navy/15`}
          style={{ animationDelay: "560ms" }}
        >
          <p className="text-xs font-bold tracking-[0.18em] uppercase text-gold-warm mb-2.5">
            {isExisting ? "Where we'd take this conversation" : "What we'd recommend next"}
          </p>
          <p className="text-navy font-bold text-xl md:text-2xl mb-2.5 leading-tight">
            {tierCopy.headline}
          </p>
          <p className="text-navy/85 text-base md:text-[17px] leading-relaxed mb-5">
            {tierCopy.body}
          </p>
          <Link
            href="/strategy-call"
            className="inline-flex items-center gap-2 bg-gold hover:bg-gold-dark text-navy font-bold text-base px-7 py-3.5 rounded-full transition-colors"
          >
            {isExisting ? "Book a portfolio strategy call" : "Book a 15-min call"}
            <ArrowRight size={18} aria-hidden />
          </Link>
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

      {/* Save form — replaced with confirmation banner once saved.
          The id="intake-save-form" is the scroll target for the
          "Unlock Two More Markets" lock overlay above. */}
      {!revealAll && (
        <form
          id="intake-save-form"
          onSubmit={onSubmit}
          className={`${fadeIn} mt-5 bg-white/95 backdrop-blur rounded-2xl p-6 md:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.25)] scroll-mt-24`}
          style={{ animationDelay: "700ms" }}
        >
          <p className="text-navy font-bold text-xl md:text-2xl mb-3 leading-tight">
            Unlock the full snapshot.
          </p>
          <ul className="text-navy/85 text-base leading-relaxed mb-5 space-y-2">
            <li className="flex gap-3">
              <span className="text-gold-warm font-bold flex-shrink-0 mt-0.5">→</span>
              <span>
                See the other two markets and the full 4-pillar scoring
                on all three.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-gold-warm font-bold flex-shrink-0 mt-0.5">→</span>
              <span>
                Use this data to get a 20% head start on franchising
                your business.
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

      {/* Additive deeper-assessment CTA — only in the unsaved state.
          Eric flagged the old text-sm white/70 link as too easy to
          miss. Now: bigger type, gold accent, benefits-led headline. */}
      {!revealAll && (
        <Link
          href="/assessment"
          className="mt-5 flex items-start gap-3 bg-white/10 hover:bg-white/15 backdrop-blur border border-white/15 hover:border-gold/40 rounded-xl px-5 py-4 transition-all group"
        >
          <Sparkles
            size={20}
            className="text-gold flex-shrink-0 mt-0.5"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="text-white font-bold text-base md:text-lg leading-tight">
              Get a more accurate score in 5 minutes.
            </p>
            <p className="text-white/75 text-sm mt-0.5 leading-relaxed">
              Answer 15 honest questions about your business and we&apos;ll
              sharpen the read on your readiness, your gaps, and the
              right next step.
            </p>
          </div>
          <ArrowRight
            size={18}
            className="text-gold flex-shrink-0 mt-1.5 group-hover:translate-x-1 transition-transform"
            aria-hidden
          />
        </Link>
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

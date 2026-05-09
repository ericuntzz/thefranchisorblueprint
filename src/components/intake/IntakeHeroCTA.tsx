"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
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
      />
    );
  }

  if (view.kind === "saved") {
    return <SavedConfirmation email={view.email} />;
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

function SnapshotView({
  snapshot,
  sessionId: _sessionId,
  emailInput,
  setEmailInput,
  emailError,
  onSubmit,
  saving,
}: {
  snapshot: IntakeSnapshot;
  sessionId: string;
  emailInput: string;
  setEmailInput: (v: string) => void;
  emailError: string | null;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
}) {
  const score = snapshot.readiness.overall;
  const tier = snapshot.readiness.suggestedTier;
  const tierLabel: Record<typeof tier, string> = {
    blueprint: "The Blueprint (DIY)",
    navigator: "Navigator (6-month coached)",
    builder: "Builder (12-month done-with-you)",
    "not-yet": "Not yet — let's talk first",
  };

  return (
    <div className="max-w-[820px]">
      {/* Snapshot card — designed to read as an FDD Item 11 site-criteria sheet,
          not a tech dashboard. Hand-set headers, plain English, four pillars. */}
      <div className="bg-cream rounded-2xl border border-gold/30 shadow-[0_24px_60px_rgba(0,0,0,0.32)] p-6 md:p-8 text-navy">
        {/* Header — stacks on mobile, side-by-side on sm+ to keep score visible */}
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-3 sm:gap-4 pb-4 border-b border-navy/15">
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-gold-warm">
              Franchise Readiness Snapshot
            </p>
            <p className="text-navy font-bold text-lg md:text-xl mt-1 break-words">
              {snapshot.business.name ?? "Your Business"}
            </p>
            {snapshot.business.oneLineConcept && (
              <p className="text-grey-3 text-sm italic mt-0.5">
                {snapshot.business.oneLineConcept}
              </p>
            )}
          </div>
          <div className="flex sm:flex-col items-baseline sm:items-end gap-2 sm:gap-0 flex-shrink-0">
            <div className="text-4xl md:text-5xl font-extrabold text-navy tabular-nums leading-none">
              {score}
              <span className="text-grey-4 text-2xl font-bold">/100</span>
            </div>
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-grey-4 sm:mt-1">
              Preliminary
            </p>
          </div>
        </div>

        {/* Prototype profile */}
        <div className="mt-5">
          <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-gold-warm mb-2">
            Prototype profile
          </p>
          <p className="text-navy/85 text-[15px] leading-relaxed">
            {snapshot.prototype.narrative}
          </p>
        </div>

        {/* Top expansion markets */}
        {snapshot.expansion.length > 0 && (
          <div className="mt-6">
            <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-gold-warm mb-3">
              Top expansion markets
            </p>
            <ol className="space-y-3">
              {snapshot.expansion.map((m, i) => (
                <li key={m.zip} className="bg-white rounded-xl border border-navy/10 p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <div>
                      <span className="text-grey-4 text-sm font-bold tabular-nums mr-2">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-navy font-bold text-base">{m.label}</span>
                      <span className="text-grey-4 text-xs ml-2 tabular-nums">
                        {m.zip}, {m.state}
                      </span>
                    </div>
                    <div className="text-navy font-extrabold text-xl tabular-nums">{m.score}</div>
                  </div>
                  <p className="text-grey-3 text-[13px] leading-relaxed mt-1.5">{m.why}.</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-[10px] font-semibold uppercase tracking-wider">
                    <PillarCell label="Demographics" score={m.pillars.demographicsAndMarket} max={25} />
                    <PillarCell label="Traffic" score={m.pillars.trafficAndAccess} max={25} />
                    <PillarCell label="Competition" score={m.pillars.competition} max={25} />
                    <PillarCell label="Financial" score={m.pillars.financialAndLegal} max={25} />
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Named gaps */}
        {snapshot.readiness.gaps.length > 0 && (
          <div className="mt-6">
            <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-gold-warm mb-2">
              Top gaps to close
            </p>
            <ul className="space-y-1.5 text-navy/85 text-[14px]">
              {snapshot.readiness.gaps.map((g, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="text-gold-warm font-bold">{String(i + 1).padStart(2, "0")}.</span>
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tier suggestion */}
        <div className="mt-5 pt-5 border-t border-navy/15">
          <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-gold-warm mb-1">
            Suggested path
          </p>
          <p className="text-navy font-bold text-base">{tierLabel[tier]}</p>
        </div>

        {/* Diagnostic footer — reinforces "30-year expert with software"
            framing rather than "AI startup with APIs". The 4-pillar /
            100-point structure mirrors how real FDD Item 11 site-criteria
            sheets are written. */}
        <div className="mt-4 pt-4 border-t border-navy/10">
          <p className="text-grey-4 text-[11px] italic leading-relaxed">
            Built on Jason&apos;s 4-pillar / 100-point site-readiness diagnostic — the same
            rubric we&apos;ll codify into your FDD Item 11 site-criteria sheet inside The
            Blueprint.
          </p>
        </div>
      </div>

      {/* Save form — primary CTA */}
      <form
        onSubmit={onSubmit}
        className="mt-5 bg-white/95 backdrop-blur rounded-2xl p-5 md:p-6 shadow-[0_12px_40px_rgba(0,0,0,0.25)]"
      >
        <p className="text-navy font-bold text-base mb-1">Save your snapshot.</p>
        <p className="text-grey-3 text-sm mb-4">
          We&apos;ll email you the snapshot, and pre-fill <strong>~15-20% of your full Blueprint</strong> with this data when you sign up to build it out.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-grey-4" aria-hidden />
            <input
              type="email"
              required
              autoComplete="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="you@yourcompany.com"
              className="w-full rounded-xl border border-navy/15 pl-10 pr-3 py-3 text-[15px] text-navy placeholder-grey-4 focus:border-gold focus:ring-2 focus:ring-gold/20 outline-none transition"
              disabled={saving}
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-7 py-3 rounded-xl hover:bg-gold-dark transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
            {saving ? "Saving…" : "Save snapshot"}
          </button>
        </div>
        {emailError && <p className="text-red-600 text-xs font-semibold mt-2">{emailError}</p>}
      </form>

      {/* Additive deeper assessment CTA */}
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

function SavedConfirmation({ email }: { email: string }) {
  return (
    <div className="max-w-[640px] bg-white rounded-2xl p-6 md:p-7 shadow-[0_12px_40px_rgba(0,0,0,0.3)] text-navy">
      <div className="flex items-start gap-3 mb-3">
        <CheckCircle2 size={28} className="text-emerald-600 flex-shrink-0" />
        <div>
          <p className="font-bold text-lg">Saved.</p>
          <p className="text-grey-3 text-sm leading-relaxed">
            We sent your snapshot to <span className="font-semibold text-navy break-all">{email}</span>. When you&apos;re ready to build out the full Blueprint, we&apos;ll pre-fill what we already know about your business so you start at ~15-20% complete instead of zero.
          </p>
        </div>
      </div>
      <div className="mt-5 pt-5 border-t border-navy/10 flex flex-col sm:flex-row gap-3">
        <Link
          href="/programs/blueprint"
          className="bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-7 py-3 rounded-full hover:bg-gold-dark transition-colors text-center"
        >
          See The Blueprint →
        </Link>
        <Link
          href="/strategy-call/blueprint"
          className="bg-transparent text-navy border-2 border-navy/15 font-bold text-sm uppercase tracking-[0.1em] px-7 py-3 rounded-full hover:bg-navy hover:text-white transition-colors text-center"
        >
          Book your kickoff call →
        </Link>
      </div>
    </div>
  );
}

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

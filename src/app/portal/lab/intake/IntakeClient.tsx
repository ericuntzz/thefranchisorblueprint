"use client";

/**
 * Day 1 wow flow — runs at /portal/lab/intake.
 *
 * State machine:
 *   1. Idle: show URL field (pre-filled from profile/assessment if known).
 *   2. Scraping: stream the agent's progress while the website scraper
 *      runs. The scrape endpoint isn't itself streamed — we show our own
 *      progress narration with timed reveals so the page never feels
 *      frozen during the 5-15s of latency.
 *   3. Done: show what we extracted (title, og image, brand voice + story
 *      previews) with a CTA to view the full Blueprint.
 *   4. Error: graceful fail with retry.
 *
 * Mounting the JasonChatDock here lets the customer ask Jason questions
 * about what just happened, which is the magic part — they SEE the
 * agent already knows about their business.
 */

import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Globe, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { JasonChatDock } from "@/components/agent/JasonChatDock";
import { TypedHeading } from "@/components/agent/TypedHeading";

type ScrapeResponse = {
  ok: true;
  websiteUrl: string;
  title: string | null;
  metaDescription: string | null;
  ogImage: string | null;
  foundAboutPage: boolean;
  brandVoicePreview: string;
  businessOverviewPreview: string;
};

type Props = {
  firstName: string | null;
  initialWebsiteUrl: string | null;
};

const PROGRESS_STEPS = [
  { delay: 0, label: "Reaching your site…" },
  { delay: 1800, label: "Pulling your home page…" },
  { delay: 3600, label: "Looking for an About page…" },
  { delay: 5400, label: "Reading your brand voice…" },
  { delay: 8000, label: "Drafting your Brand Standards chapter…" },
  { delay: 11000, label: "Drafting your Concept & Story chapter…" },
];

type Phase = "idle" | "scraping" | "done" | "error";

export function IntakeClient({ firstName, initialWebsiteUrl }: Props) {
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsiteUrl ?? "");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progressIdx, setProgressIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScrapeResponse | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      timersRef.current.forEach(clearTimeout);
    },
    [],
  );

  async function startScrape() {
    if (!websiteUrl.trim()) {
      setError("Add a website URL to start.");
      return;
    }
    setError(null);
    setPhase("scraping");
    setProgressIdx(0);

    // Fire off the timed progress narration. These are intentionally
    // generous — the scrape is real work and we'd rather understate
    // progress than overpromise.
    timersRef.current.forEach(clearTimeout);
    timersRef.current = PROGRESS_STEPS.map((step, idx) =>
      setTimeout(() => setProgressIdx(idx), step.delay),
    );

    try {
      const res = await fetch("/api/agent/scrape-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: websiteUrl.trim() }),
      });
      const json = (await res.json().catch(() => ({}))) as
        | ScrapeResponse
        | { error?: string };
      if (!res.ok || !("ok" in json)) {
        const msg =
          ("error" in json && json.error) || `Scrape failed (${res.status})`;
        throw new Error(msg);
      }
      // Snap to "done" the moment we have results; cancel pending steps.
      timersRef.current.forEach(clearTimeout);
      setProgressIdx(PROGRESS_STEPS.length - 1);
      setResult(json);
      setPhase("done");
    } catch (e) {
      timersRef.current.forEach(clearTimeout);
      setError(e instanceof Error ? e.message : "Something went sideways.");
      setPhase("error");
    }
  }

  return (
    <>
      <div className="max-w-[920px] mx-auto px-6 md:px-8 py-12 md:py-16">
        {/* ===== Welcome heading (typed) ===== */}
        <div className="mb-8">
          <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-3 border-b-2 border-gold pb-1">
            Day 1 · Pre-fill from your website
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold text-navy leading-tight">
            <TypedHeading
              text={firstName ? `Welcome, ${firstName}.` : "Welcome."}
            />
          </h1>
          <p className="mt-3 text-grey-3 text-base md:text-lg max-w-[680px]">
            Drop your website link and I&apos;ll learn your brand, voice, and
            concept story before we even talk. By the time you&apos;re done
            reading this paragraph, I&apos;ll be ~30% of the way to drafting
            your Blueprint.
          </p>
        </div>

        {/* ===== URL form / scraping / done ===== */}
        {phase === "idle" || phase === "error" ? (
          <div className="rounded-2xl border-2 border-navy/10 bg-white p-6 md:p-8 shadow-[0_8px_28px_rgba(30,58,95,0.08)]">
            <label className="block">
              <span className="block text-navy font-semibold text-sm mb-2 flex items-center gap-2">
                <Globe size={14} className="text-gold" />
                Your business website
              </span>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="thefranchisorblueprint.com"
                className="w-full rounded-lg border border-navy/15 bg-white px-4 py-3 text-[15px] text-navy focus:border-gold focus:ring-2 focus:ring-gold/20 outline-none transition"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void startScrape();
                  }
                }}
              />
            </label>
            {error && (
              <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
                {error}
              </div>
            )}
            <button
              type="button"
              onClick={() => void startScrape()}
              disabled={!websiteUrl.trim()}
              className="mt-5 w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-7 py-4 rounded-full hover:bg-gold-dark disabled:opacity-50 transition-colors active-pulse"
            >
              <Sparkles size={15} />
              Pre-fill my Blueprint
              <ArrowRight size={15} />
            </button>
            <p className="mt-3 text-xs text-grey-4">
              Takes about 15 seconds. We don&apos;t share your URL — it&apos;s
              just used to seed your private Blueprint Memory.
            </p>
            <style jsx>{`
              @keyframes active-pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.02); }
              }
              .active-pulse {
                animation: active-pulse 3.5s ease-in-out infinite;
              }
            `}</style>
          </div>
        ) : null}

        {phase === "scraping" && (
          <div className="rounded-2xl border-2 border-navy/10 bg-white p-6 md:p-8 shadow-[0_8px_28px_rgba(30,58,95,0.08)]">
            <div className="mb-4 flex items-center gap-3">
              <Loader2 size={18} className="text-gold animate-spin" />
              <div className="text-navy font-bold text-sm">
                Working on{" "}
                <span className="font-mono text-gold-warm">{websiteUrl}</span>…
              </div>
            </div>
            <ul className="space-y-2.5">
              {PROGRESS_STEPS.map((step, idx) => {
                const isPast = idx < progressIdx;
                const isCurrent = idx === progressIdx;
                return (
                  <li
                    key={step.label}
                    className={`flex items-center gap-3 text-sm ${
                      isPast
                        ? "text-grey-3"
                        : isCurrent
                          ? "text-navy font-semibold"
                          : "text-grey-4 opacity-50"
                    }`}
                  >
                    {isPast ? (
                      <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                    ) : isCurrent ? (
                      <Loader2 size={14} className="text-gold animate-spin flex-shrink-0" />
                    ) : (
                      <span className="block w-3.5 h-3.5 rounded-full border border-grey-4/40 flex-shrink-0" />
                    )}
                    {step.label}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {phase === "done" && result && (
          <div className="space-y-6">
            <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-6 md:p-8">
              <div className="mb-3 flex items-center gap-2 text-emerald-700">
                <CheckCircle2 size={18} />
                <span className="text-sm font-bold uppercase tracking-wider">
                  Pre-fill complete
                </span>
              </div>
              <h2 className="text-navy font-extrabold text-xl mb-3">
                I learned about{" "}
                <span className="text-gold-warm">
                  {result.title ?? new URL(result.websiteUrl).hostname}
                </span>
              </h2>
              {result.metaDescription && (
                <p className="text-grey-3 text-sm italic mb-4">
                  &ldquo;{result.metaDescription}&rdquo;
                </p>
              )}
              <ul className="text-sm text-grey-3 space-y-1.5 mb-5">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-500" />
                  Pulled your home page
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-500" />
                  {result.foundAboutPage
                    ? "Pulled your About page"
                    : "(No About page found — we worked from the home page)"}
                </li>
                {result.ogImage && (
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={13} className="text-emerald-500" />
                    Captured your logo / hero image
                  </li>
                )}
              </ul>
            </div>

            {result.brandVoicePreview && (
              <PreviewCard
                label="Brand Standards · draft"
                slug="brand_voice"
                excerpt={result.brandVoicePreview}
              />
            )}
            {result.businessOverviewPreview && (
              <PreviewCard
                label="Concept & Story · draft"
                slug="business_overview"
                excerpt={result.businessOverviewPreview}
              />
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/portal/lab/blueprint"
                className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-7 py-4 rounded-full hover:bg-gold-dark transition-colors"
              >
                Open the full Blueprint
                <ArrowRight size={15} />
              </Link>
              <button
                type="button"
                onClick={() => {
                  setPhase("idle");
                  setResult(null);
                }}
                className="inline-flex items-center gap-2 bg-transparent text-navy border-2 border-navy font-bold text-sm uppercase tracking-[0.1em] px-7 py-4 rounded-full hover:bg-navy hover:text-cream transition-colors"
              >
                Try a different URL
              </button>
            </div>
          </div>
        )}
      </div>

      <JasonChatDock pageContext="/portal/lab/intake (Day 1)" firstName={firstName} />
    </>
  );
}

function PreviewCard({
  label,
  slug,
  excerpt,
}: {
  label: string;
  slug: string;
  excerpt: string;
}) {
  return (
    <div className="rounded-2xl border border-navy/10 bg-white p-5 md:p-6">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.14em] text-gold-warm font-bold">
          {label}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-grey-4">
          chapter: {slug}
        </span>
      </div>
      <p className="text-navy text-sm leading-relaxed whitespace-pre-wrap">
        {excerpt}
        {excerpt.length >= 280 && <span className="text-grey-4">…</span>}
      </p>
    </div>
  );
}

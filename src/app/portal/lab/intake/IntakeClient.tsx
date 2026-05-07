"use client";

/**
 * Day 1 multi-step intake — runs at /portal/lab/intake.
 *
 * Walks new customers through a card-by-card sequence that captures
 * the most pre-fillable inputs in the first 5 minutes:
 *
 *   1. Website URL (scrape) — same wow-moment as before, narrated
 *      progress + previews of what we extracted.
 *   2. Operations docs — ops manuals, opening checklists, SOPs.
 *      Routes to operating_model.
 *   3. Brand + marketing — guidelines, marketing plans, screenshots.
 *      Routes to brand_voice.
 *   4. Training + people — training manuals, employee handbook.
 *      Routes to training_program.
 *   5. Financials — P&L, COGS, fee schedule.
 *      Routes to unit_economics.
 *   6. Legal — existing FDD, attorney letters.
 *      Routes to compliance_legal.
 *   7. Done — "Let's build your Blueprint" → /portal.
 *
 * Each step has Skip + Next. Files in upload steps drag-drop OR
 * click; multiple files per step. Slide transition between steps
 * matches the question queue.
 *
 * Design rationale (per Eric): customers don't always know what
 * docs to bring up-front. Walking them through one category at a
 * time gives them time to think + go look + come back, and the
 * skip option means low-friction completion for customers who
 * don't have everything.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Globe,
  Loader2,
  Sparkles,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { TypedHeading } from "@/components/agent/TypedHeading";
import {
  MEMORY_FILE_TITLES,
  isValidMemoryFileSlug,
  type MemoryFileSlug,
} from "@/lib/memory/files";

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

type UploadStep = {
  kind: "upload";
  slug: MemoryFileSlug;
  /** Eyebrow label, e.g. "Operations". */
  category: string;
  /** Big card heading. */
  title: string;
  /** One-sentence prompt. */
  subtitle: string;
  /** Example doc names rendered as scannable chips. */
  examples: string[];
};

type Step =
  | { kind: "url" }
  | UploadStep
  | { kind: "done" };

const UPLOAD_STEPS: UploadStep[] = [
  {
    kind: "upload",
    slug: "operating_model",
    category: "Operations",
    title: "Got an ops manual or opening checklist?",
    subtitle:
      "Drop anything that describes how a single location runs day-to-day. Jason will pull procedures, timings, and standards out of it.",
    examples: [
      "operations manual",
      "opening checklist",
      "closing procedures",
      "shift handoff doc",
      "POS / inventory SOPs",
    ],
  },
  {
    kind: "upload",
    slug: "brand_voice",
    category: "Brand + marketing",
    title: "Got brand guidelines or marketing materials?",
    subtitle:
      "Style guides, brand books, marketing plans, ad creative, or even a screenshot of your homepage all help Jason match your voice.",
    examples: [
      "brand guidelines",
      "style guide",
      "marketing plan",
      "logo + assets",
      "homepage screenshots",
    ],
  },
  {
    kind: "upload",
    slug: "training_program",
    category: "Training + people",
    title: "Got training materials or HR docs?",
    subtitle:
      "Training manuals, onboarding curricula, employee handbooks, transcripts of training videos — anything that teaches new staff.",
    examples: [
      "training manual",
      "employee handbook",
      "onboarding curriculum",
      "video transcripts",
      "HR policies",
    ],
  },
  {
    kind: "upload",
    slug: "unit_economics",
    category: "Financials",
    title: "Got a P&L, COGS breakdown, or fee schedule?",
    subtitle:
      "Anything with the numbers. Jason will pull AUV, COGS percentages, royalty rates, and investment ranges so you don't have to retype them.",
    examples: [
      "P&L",
      "COGS breakdown",
      "investment summary",
      "fee schedule",
      "revenue model",
    ],
  },
  {
    kind: "upload",
    slug: "compliance_legal",
    category: "Legal",
    title: "Got an existing FDD or attorney correspondence?",
    subtitle:
      "If you've started an FDD, have a franchise agreement template, or letters from your attorney, drop them here so Jason mirrors the legal posture you're already working toward.",
    examples: [
      "existing FDD",
      "franchise agreement template",
      "attorney letter",
      "state registration",
    ],
  },
];

const TOTAL_STEPS = 1 + UPLOAD_STEPS.length + 1; // url + uploads + done

export function IntakeClient({ firstName, initialWebsiteUrl }: Props) {
  // Step machine. The customer always starts at the URL step; we
  // advance via Next/Skip. Direction drives the slide-transition
  // animation (forward = right→left, back = left→right).
  const [stepIdx, setStepIdx] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");

  const steps: Step[] = useMemo(
    () => [{ kind: "url" }, ...UPLOAD_STEPS, { kind: "done" }],
    [],
  );
  const step = steps[stepIdx];

  function next() {
    setDirection("forward");
    setStepIdx((i) => Math.min(i + 1, steps.length - 1));
  }
  function back() {
    setDirection("back");
    setStepIdx((i) => Math.max(i - 1, 0));
  }

  return (
    <>
      <div className="max-w-[920px] mx-auto px-4 sm:px-6 md:px-8 py-10 md:py-14">
        {/* Welcome heading + slim progress strip */}
        <div className="mb-6">
          <span className="inline-block text-gold-warm font-semibold text-xs tracking-[0.18em] uppercase mb-3 border-b-2 border-gold pb-1">
            Day 1 · Pre-fill from what you already have
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold text-navy leading-tight">
            <TypedHeading
              text={firstName ? `Welcome, ${firstName}.` : "Welcome."}
            />
          </h1>
          <p className="mt-3 text-grey-3 text-base md:text-lg max-w-[680px]">
            A few quick steps to seed your Blueprint with everything you
            already have. Each step is skippable — you can come back to
            any of them from your dashboard.
          </p>
        </div>

        <div
          role="progressbar"
          aria-valuenow={Math.round(((stepIdx + 1) / TOTAL_STEPS) * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Intake progress"
          className="mb-5 h-1 rounded-full bg-grey-1 overflow-hidden"
        >
          <div
            className="h-full bg-gold transition-all duration-300"
            style={{
              width: `${Math.round(((stepIdx + 1) / TOTAL_STEPS) * 100)}%`,
            }}
          />
        </div>

        {/* Step counter + back affordance — sits inline above the
            card so the customer always knows where they are. */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-[10px] uppercase tracking-[0.16em] text-grey-3 font-bold">
            Step {stepIdx + 1} of {TOTAL_STEPS}
          </span>
          {stepIdx > 0 && (
            <button
              type="button"
              onClick={back}
              className="inline-flex items-center gap-1.5 text-grey-3 hover:text-navy text-xs font-semibold transition-colors"
            >
              <ArrowLeft size={11} />
              Back a step
            </button>
          )}
        </div>

        {/* Step body — re-keyed so React unmounts/remounts the card
            on every step change, triggering the slide animation. */}
        <div className="relative overflow-hidden">
          {step.kind === "url" && (
            <UrlStepCard
              key="step-url"
              direction={direction}
              initialWebsiteUrl={initialWebsiteUrl}
              onAdvance={next}
            />
          )}
          {step.kind === "upload" && (
            <UploadStepCard
              key={`step-upload-${step.slug}`}
              direction={direction}
              step={step}
              onAdvance={next}
            />
          )}
          {step.kind === "done" && <DoneStepCard key="step-done" direction={direction} />}
        </div>
      </div>

    </>
  );
}

/* ---------------------------------------------------------------- */
/* Step 1 — Website URL                                             */
/* ---------------------------------------------------------------- */

function UrlStepCard({
  direction,
  initialWebsiteUrl,
  onAdvance,
}: {
  direction: "forward" | "back";
  initialWebsiteUrl: string | null;
  onAdvance: () => void;
}) {
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsiteUrl ?? "");
  type Phase = "idle" | "scraping" | "done" | "error";
  const [phase, setPhase] = useState<Phase>(initialWebsiteUrl ? "idle" : "idle");
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
    <SlideCard direction={direction}>
      <div className="text-[10px] uppercase tracking-[0.16em] text-gold-warm font-bold mb-2 flex items-center gap-1.5">
        <Globe size={11} />
        Your website
      </div>
      <h2 className="text-navy font-extrabold text-2xl md:text-3xl leading-tight mb-2">
        Have a site? Let&apos;s start there.
      </h2>
      <p className="text-grey-3 text-sm leading-relaxed mb-5 max-w-[640px]">
        Drop your URL and Jason reads your site, drafts your Brand Standards
        + Concept & Story chapters, and pulls structured facts (founder,
        locations, year founded) automatically. Takes about 15 seconds.
      </p>

      {(phase === "idle" || phase === "error") && (
        <>
          <input
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="thefranchisorblueprint.com"
            className="w-full rounded-lg border border-navy/15 bg-white px-4 py-3 text-[15px] text-navy placeholder-grey-4 placeholder:italic focus:border-gold focus:ring-2 focus:ring-gold/20 outline-none transition mb-3"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void startScrape();
              }
            }}
          />
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800 mb-3">
              {error}
            </div>
          )}
        </>
      )}

      {phase === "scraping" && (
        <div className="rounded-xl border border-navy/10 bg-cream/40 p-4 mb-3">
          <div className="mb-3 flex items-center gap-2">
            <Loader2 size={14} className="text-gold animate-spin" />
            <div className="text-navy font-bold text-xs">
              Working on{" "}
              <span className="font-mono text-gold-warm">{websiteUrl}</span>…
            </div>
          </div>
          <ul className="space-y-2">
            {PROGRESS_STEPS.map((s, idx) => {
              const isPast = idx < progressIdx;
              const isCurrent = idx === progressIdx;
              return (
                <li
                  key={s.label}
                  className={`flex items-center gap-2.5 text-[13px] ${
                    isPast
                      ? "text-grey-3"
                      : isCurrent
                        ? "text-navy font-semibold"
                        : "text-grey-4 opacity-50"
                  }`}
                >
                  {isPast ? (
                    <CheckCircle2
                      size={12}
                      className="text-emerald-500 flex-shrink-0"
                    />
                  ) : isCurrent ? (
                    <Loader2
                      size={12}
                      className="text-gold animate-spin flex-shrink-0"
                    />
                  ) : (
                    <span className="block w-3 h-3 rounded-full border border-grey-4/40 flex-shrink-0" />
                  )}
                  {s.label}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {phase === "done" && result && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 mb-3">
          <div className="flex items-center gap-2 text-emerald-700 mb-1">
            <CheckCircle2 size={14} />
            <span className="text-xs font-bold uppercase tracking-wider">
              Pre-fill complete
            </span>
          </div>
          <p className="text-navy text-sm">
            Read your home page
            {result.foundAboutPage ? " + About page" : ""}.
            {" "}Drafted{" "}
            <strong className="font-bold">Brand Standards</strong> +{" "}
            <strong className="font-bold">Concept &amp; Story</strong>.
          </p>
        </div>
      )}

      <StepFooter
        onSkip={onAdvance}
        skipLabel="Skip — I don't have a site yet"
        primary={
          phase === "done" ? (
            <button
              type="button"
              onClick={onAdvance}
              className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-xs uppercase tracking-[0.1em] px-5 py-3 rounded-full hover:bg-gold-dark transition-colors"
            >
              Continue
              <ArrowRight size={12} />
            </button>
          ) : phase === "scraping" ? (
            <span className="inline-flex items-center gap-2 bg-cream text-grey-3 font-bold text-xs uppercase tracking-[0.1em] px-5 py-3 rounded-full">
              <Loader2 size={12} className="animate-spin" />
              Working…
            </span>
          ) : (
            <button
              type="button"
              onClick={() => void startScrape()}
              disabled={!websiteUrl.trim()}
              className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-xs uppercase tracking-[0.1em] px-5 py-3 rounded-full hover:bg-gold-dark disabled:opacity-50 transition-colors"
            >
              <Sparkles size={12} />
              Pre-fill from my site
              <ArrowRight size={12} />
            </button>
          )
        }
      />
    </SlideCard>
  );
}

/* ---------------------------------------------------------------- */
/* Steps 2-6 — Document upload by category                          */
/* ---------------------------------------------------------------- */

function UploadStepCard({
  direction,
  step,
  onAdvance,
}: {
  direction: "forward" | "back";
  step: UploadStep;
  onAdvance: () => void;
}) {
  type Uploaded = {
    id: string;
    label: string;
    /** Additional chapter slugs the auto-classifier fanned the
     *  file out to (does NOT include the primary step slug). */
    alsoAttachedTo: string[];
  };
  const [uploads, setUploads] = useState<Uploaded[]>([]);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  async function uploadOne(file: File) {
    setErr(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("slug", step.slug);
      fd.append("file", file);
      // Intake uploads always opt into auto-classification — a
      // first-run customer's "operations manual" is overwhelmingly
      // likely to also feed training_program, recipes_and_menu,
      // and vendor_supply_chain. Sonnet decides; we fan out.
      fd.append("autoClassify", "true");
      const res = await fetch("/api/agent/chapter-attachment", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(
          (j as { error?: string }).error ?? `HTTP ${res.status}`,
        );
      }
      const j = (await res.json()) as {
        attachment?: { id?: string; label?: string };
        alsoAttachedTo?: string[];
      };
      setUploads((prev) => [
        ...prev,
        {
          id: j.attachment?.id ?? `local-${Date.now()}`,
          label: j.attachment?.label ?? file.name,
          alsoAttachedTo: j.alsoAttachedTo ?? [],
        },
      ]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function uploadMany(files: FileList | null) {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      // Sequential to keep server load + visible progress predictable.
      // Three or four files per step is the typical case; not worth
      // the complexity of parallel uploads for the variance.
      // eslint-disable-next-line no-await-in-loop
      await uploadOne(file);
    }
  }

  function onDragEnter(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (uploading) return;
    setDragActive(true);
  }
  function onDragOver(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!dragActive) setDragActive(true);
  }
  function onDragLeave(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }
  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (uploading) return;
    void uploadMany(e.dataTransfer.files);
  }

  return (
    <SlideCard direction={direction}>
      <div className="text-[10px] uppercase tracking-[0.16em] text-gold-warm font-bold mb-2 flex items-center gap-1.5">
        <Upload size={11} />
        {step.category}
      </div>
      <h2 className="text-navy font-extrabold text-2xl md:text-3xl leading-tight mb-2">
        {step.title}
      </h2>
      <p className="text-grey-3 text-sm leading-relaxed mb-3 max-w-[640px]">
        {step.subtitle}
      </p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {step.examples.map((ex) => (
          <span
            key={ex}
            className="inline-flex items-center text-[10px] uppercase tracking-wider font-bold text-grey-3 bg-grey-1 border border-navy/10 px-2 py-0.5 rounded-full"
          >
            {ex}
          </span>
        ))}
      </div>

      <label
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-sm transition-colors cursor-pointer mb-4 ${
          dragActive
            ? "border-gold bg-gold/10"
            : "border-navy/20 bg-cream/40 hover:border-gold hover:bg-gold/5"
        } ${uploading ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        {uploading ? (
          <>
            <Loader2 size={20} className="animate-spin text-gold-warm" />
            <span className="text-navy font-semibold">Uploading…</span>
          </>
        ) : (
          <>
            <Upload size={20} className="text-gold-warm" />
            <span className="text-navy font-semibold">
              Drop files or click to choose
            </span>
            <span className="text-grey-4 text-xs">
              PDF, DOC, TXT, MD, or images · multiple files OK
            </span>
          </>
        )}
        <input
          type="file"
          className="sr-only"
          multiple
          accept=".pdf,.docx,.doc,.txt,.md,.markdown,.csv,.json,.xml,.yaml,.yml,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/*,image/*"
          disabled={uploading}
          onChange={(e) => void uploadMany(e.target.files)}
        />
      </label>

      {uploads.length > 0 && (
        <ul className="mb-4 space-y-1.5">
          {uploads.map((u) => {
            const fanOutTitles = u.alsoAttachedTo
              .filter(isValidMemoryFileSlug)
              .map((s) => MEMORY_FILE_TITLES[s]);
            return (
              <li
                key={u.id}
                className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    size={13}
                    className="text-emerald-600 flex-shrink-0"
                  />
                  <span className="text-navy font-semibold truncate">
                    {u.label}
                  </span>
                  <span className="text-emerald-700 ml-auto text-[10px] uppercase tracking-wider font-bold">
                    Uploaded
                  </span>
                </div>
                {fanOutTitles.length > 0 && (
                  <p className="mt-1 ml-5 text-[11px] text-emerald-800/80 leading-snug">
                    <span className="font-semibold">Also indexed to:</span>{" "}
                    {fanOutTitles.join(" · ")}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {err && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800 mb-3">
          {err}
        </div>
      )}

      <StepFooter
        onSkip={onAdvance}
        skipLabel={
          uploads.length > 0
            ? `Continue (${uploads.length} uploaded)`
            : "Skip — I don't have these"
        }
        primary={
          uploads.length > 0 ? (
            <button
              type="button"
              onClick={onAdvance}
              className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-xs uppercase tracking-[0.1em] px-5 py-3 rounded-full hover:bg-gold-dark transition-colors"
            >
              Continue
              <ArrowRight size={12} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onAdvance}
              className="inline-flex items-center gap-2 bg-cream text-navy hover:bg-navy hover:text-cream border-2 border-navy/20 hover:border-navy font-bold text-xs uppercase tracking-[0.1em] px-5 py-3 rounded-full transition-colors"
            >
              Skip for now
              <ArrowRight size={12} />
            </button>
          )
        }
      />
    </SlideCard>
  );
}

/* ---------------------------------------------------------------- */
/* Step 7 — Done                                                    */
/* ---------------------------------------------------------------- */

function DoneStepCard({ direction }: { direction: "forward" | "back" }) {
  return (
    <SlideCard direction={direction}>
      <div className="text-[10px] uppercase tracking-[0.16em] text-emerald-700 font-bold mb-2 flex items-center gap-1.5">
        <CheckCircle2 size={11} />
        That&apos;s the intake
      </div>
      <h2 className="text-navy font-extrabold text-2xl md:text-3xl leading-tight mb-3">
        Time to build your Blueprint.
      </h2>
      <p className="text-grey-3 text-base leading-relaxed mb-5 max-w-[640px]">
        Jason has everything you just gave him loaded. He&apos;ll pre-fill
        what he can across the 16 chapters; you&apos;ll see &ldquo;Suggested
        / Inferred&rdquo; markers showing which fields to verify. Anything
        you skipped, you can always come back to from your dashboard.
      </p>
      <Link
        href="/portal"
        className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-6 py-3 rounded-full hover:bg-gold-dark transition-colors"
      >
        <Sparkles size={14} />
        Open my dashboard
        <ArrowRight size={14} />
      </Link>
    </SlideCard>
  );
}

/* ---------------------------------------------------------------- */
/* Shared bits                                                      */
/* ---------------------------------------------------------------- */

function SlideCard({
  direction,
  children,
}: {
  direction: "forward" | "back";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border border-navy/10 bg-white p-5 sm:p-6 md:p-8 shadow-[0_8px_28px_rgba(30,58,95,0.08)] ${
        direction === "forward" ? "intake-slide-forward" : "intake-slide-back"
      }`}
    >
      <style jsx>{`
        @keyframes intake-slide-in-right {
          from {
            transform: translateX(28px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes intake-slide-in-left {
          from {
            transform: translateX(-28px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .intake-slide-forward {
          animation: intake-slide-in-right 240ms ease-out;
        }
        .intake-slide-back {
          animation: intake-slide-in-left 240ms ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .intake-slide-forward,
          .intake-slide-back {
            animation: none;
          }
        }
      `}</style>
      {children}
    </div>
  );
}

function StepFooter({
  onSkip,
  skipLabel,
  primary,
}: {
  onSkip: () => void;
  skipLabel: string;
  primary: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-navy/5">
      <button
        type="button"
        onClick={onSkip}
        className="text-grey-3 hover:text-navy text-xs font-semibold py-2 transition-colors"
      >
        {skipLabel}
      </button>
      {primary}
    </div>
  );
}

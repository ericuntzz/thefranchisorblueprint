"use client";

/**
 * One chapter on the Blueprint canvas. Renders the markdown content as
 * polished prose, with a "Draft with Jason" CTA when the chapter is empty
 * or stale, and a confidence pill that quietly tells the customer where
 * the content came from.
 *
 * Provenance UI: invisible by default. The customer can click the small
 * `provenance` button to expand a list of every source that fed this
 * chapter. We keep this off the main read path so the page reads as a
 * polished document, not an audit trail.
 */

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Clock,
  Globe,
  Loader2,
  MessageCircle,
  Pencil,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { CustomerMemoryProvenance } from "@/lib/supabase/types";
import { type ChapterSchema, type FieldDef } from "@/lib/memory/schemas";
import { isValidMemoryFileSlug } from "@/lib/memory/files";
import {
  computeAllFormulas,
  hasCalc,
  type MemoryFieldsMap,
} from "@/lib/calc";
import { ChapterFieldEditor } from "./ChapterFieldEditor";

type FieldValue = string | number | boolean | string[] | null;

type Props = {
  slug: string;
  title: string;
  contentMd: string;
  confidence: "verified" | "inferred" | "draft" | "empty";
  lastUpdatedBy: "agent" | "user" | "jason" | "scraper" | null;
  updatedAt: string | null;
  provenance: CustomerMemoryProvenance[];
  /** Structured fields for THIS chapter. Empty object if none yet. */
  fields: Record<string, FieldValue>;
  /** Cross-chapter field state — for computed-field formulas. */
  otherChaptersFields: MemoryFieldsMap;
  /**
   * The chapter's field schema (from src/lib/memory/schemas.ts). Null
   * when the chapter has no schema yet (e.g. brand_voice — deferred to
   * Phase 1.5b). Null = render prose only, no field editor.
   */
  schema: ChapterSchema | null;
  /**
   * Server action to save field changes. Called by the editor's onSave.
   * Receives `{ slug, changes }` and persists via writeMemoryFields.
   */
  saveFields: (args: {
    slug: string;
    changes: Record<string, FieldValue>;
  }) => Promise<void>;
};

export function ChapterCard({
  slug,
  title,
  contentMd,
  confidence,
  lastUpdatedBy,
  updatedAt,
  provenance,
  fields,
  otherChaptersFields,
  schema,
  saveFields,
}: Props) {
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [insufficientCtx, setInsufficientCtx] = useState<string | null>(null);
  const [showProvenance, setShowProvenance] = useState(false);
  const [editing, setEditing] = useState(false);

  async function draftThis() {
    setDrafting(true);
    setDraftError(null);
    setInsufficientCtx(null);
    try {
      const res = await fetch("/api/agent/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      // 422 = the API refused to draft because Memory is too thin to
      // produce anything but a skeleton. Swap to the routing UI rather
      // than render this as a generic red error — the customer needs
      // direction, not an error code.
      if (res.status === 422) {
        const j = (await res.json().catch(() => ({}))) as {
          reason?: string;
          message?: string;
        };
        if (j.reason === "insufficient_context") {
          setInsufficientCtx(
            j.message ??
              "Jason needs more context about your business before he can draft this.",
          );
          setDrafting(false);
          return;
        }
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? `draft ${res.status}`);
      }
      // Soft refresh — re-fetch the canvas so the new draft renders.
      // Using full reload here keeps the v1 simple; we can switch to
      // router.refresh() + state-based update later.
      window.location.reload();
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : "draft failed");
      setDrafting(false);
    }
  }

  const isEmpty = !contentMd.trim() && Object.keys(fields).length === 0;
  const filledFieldCount = countFilledFields(fields, schema);

  // Edit mode: replace the chapter body with the field editor. The
  // header + confidence pill stay so the customer keeps spatial
  // context. Save commits via server action; cancel discards.
  async function handleSaveFields(changes: Record<string, FieldValue>) {
    if (!isValidMemoryFileSlug(slug)) {
      throw new Error(`Unknown chapter: ${slug}`);
    }
    await saveFields({ slug, changes });
    setEditing(false);
    // Server action revalidates /portal/lab/blueprint, so a soft
    // navigation will show the new state. Force a window reload to
    // be safe — same pattern as Draft / Redraft.
    if (typeof window !== "undefined") window.location.reload();
  }

  return (
    <article id={`chapter-${slug}`} className="rounded-2xl border border-navy/10 bg-white p-6 md:p-8 scroll-mt-20">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-gold-warm font-bold mb-1">
            <span className="font-mono">{slug}</span>
            {schema && filledFieldCount.total > 0 && !editing && (
              <span className="ml-2 text-grey-4 normal-case tracking-normal">
                — {filledFieldCount.filled} of {filledFieldCount.total} filled
              </span>
            )}
          </div>
          <h2 className="text-navy font-extrabold text-xl md:text-2xl leading-tight">
            {title}
          </h2>
          {schema && editing && (
            <p className="text-grey-3 text-sm mt-2 max-w-[640px]">
              {schema.description}
            </p>
          )}
        </div>
        <ConfidencePill confidence={confidence} />
      </header>

      {editing && schema ? (
        <ChapterFieldEditor
          schema={schema}
          initialFields={fields}
          otherChaptersFields={otherChaptersFields}
          onSave={handleSaveFields}
          onCancel={() => setEditing(false)}
        />
      ) : isEmpty ? (
        insufficientCtx ? (
          <InsufficientContextPanel
            message={insufficientCtx}
            schema={schema}
            onFillFields={() => {
              setInsufficientCtx(null);
              setEditing(true);
            }}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-navy/15 bg-grey-1 px-5 py-8 text-center">
            <p className="text-grey-3 text-sm mb-4">
              This chapter is empty. Jason can take a first pass from
              everything you&apos;ve given the system so far — or you can fill
              in the details yourself.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={draftThis}
                disabled={drafting}
                className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-xs uppercase tracking-[0.1em] px-5 py-3 rounded-full hover:bg-gold-dark disabled:opacity-50 transition-colors"
              >
                {drafting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Drafting…
                  </>
                ) : (
                  <>
                    <Sparkles size={13} /> Draft with Jason{" "}
                    <ArrowRight size={12} />
                  </>
                )}
              </button>
              {schema && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  disabled={drafting}
                  className="inline-flex items-center gap-2 bg-transparent text-navy border-2 border-navy font-bold text-xs uppercase tracking-[0.1em] px-5 py-3 rounded-full hover:bg-navy hover:text-cream disabled:opacity-50 transition-colors"
                >
                  <Pencil size={13} /> Fill in directly
                </button>
              )}
            </div>
            {drafting && (
              <p className="mt-3 text-xs text-grey-4 italic">
                Jason is reading your full Memory and writing a chapter from
                scratch. This usually takes 60–90 seconds — the page will
                refresh when he&apos;s done.
              </p>
            )}
            {draftError && (
              <p className="mt-3 text-xs text-red-700">{draftError}</p>
            )}
          </div>
        )
      ) : (
        <>
          <div className="chapter-prose text-navy/90 leading-relaxed">
            <NeedsInputProse
              md={contentMd
                // Drop claim anchors (they're stored in customer_memory_provenance).
                .replace(/<!--\s*claim:[^>]*-->/g, "")
                // Drop the trailing ```json provenance``` fenced block
                // when the agent included it. Provenance is rendered in
                // the dedicated panel below — leaving the raw JSON in
                // the prose makes the chapter unreadable AND blew out the
                // page width via the un-wrappable `<code>` block.
                .replace(/```json(?:\s*provenance)?\s*\n[\s\S]*?\n```\s*$/i, "")
                .trim()}
              onFillFields={
                schema ? () => setEditing(true) : undefined
              }
            />
          </div>
          <style jsx>{`
            .chapter-prose {
              /* Long URLs / tokens in scraped content (e.g.
                 "https://www.thefranchisorblueprint.com/opengraph-image?9425c002f44aadf5"
                 from the brand_voice scrape) will otherwise blow out the
                 grid track and cause page-wide horizontal overflow. */
              overflow-wrap: anywhere;
              word-break: break-word;
            }
            .chapter-prose :global(h1),
            .chapter-prose :global(h2) {
              font-weight: 700;
              color: rgb(30 58 95);
              margin: 1.25em 0 0.5em;
              font-size: 1.05rem;
            }
            .chapter-prose :global(h3) {
              font-weight: 600;
              color: rgb(30 58 95);
              margin: 1em 0 0.4em;
              font-size: 0.97rem;
            }
            .chapter-prose :global(p) {
              margin: 0 0 0.85em;
              font-size: 0.92rem;
              line-height: 1.6;
            }
            .chapter-prose :global(ul),
            .chapter-prose :global(ol) {
              margin: 0 0 0.85em 1.2em;
              font-size: 0.92rem;
              line-height: 1.55;
            }
            .chapter-prose :global(li) {
              margin: 0.2em 0;
            }
            .chapter-prose :global(strong) {
              color: rgb(30 58 95);
              font-weight: 600;
            }
            .chapter-prose :global(em) {
              color: rgb(120 113 108);
            }
            .chapter-prose :global(code) {
              background: rgb(245 245 244);
              padding: 0.1em 0.35em;
              border-radius: 0.25em;
              font-size: 0.85em;
            }
            /* Defensive: any future fenced code block scrolls inside its
               own box rather than blowing out the chapter card width. */
            .chapter-prose :global(pre) {
              max-width: 100%;
              overflow-x: auto;
              background: rgb(245 245 244);
              padding: 0.85em 1em;
              border-radius: 0.5em;
              margin: 0.85em 0;
              font-size: 0.85em;
              line-height: 1.4;
            }
            .chapter-prose :global(pre code) {
              background: transparent;
              padding: 0;
            }
            .chapter-prose :global(blockquote) {
              border-left: 3px solid rgb(202 138 4 / 0.45);
              padding-left: 0.9em;
              margin: 0.85em 0;
              color: rgb(120 113 108);
              font-style: italic;
            }
            .chapter-prose :global(hr) {
              border: 0;
              border-top: 1px solid rgb(30 58 95 / 0.1);
              margin: 1.25em 0;
            }
          `}</style>
          <footer className="mt-5 pt-4 border-t border-navy/5 flex flex-wrap items-center justify-between gap-2 text-xs text-grey-4">
            <span className="inline-flex items-center gap-1.5">
              <Clock size={11} />
              {lastUpdatedBy && updatedAt
                ? `Updated by ${lastUpdatedBy === "scraper" ? "the scraper" : lastUpdatedBy} ${formatRelative(updatedAt)}`
                : "Never updated"}
            </span>
            <div className="flex items-center gap-3">
              {provenance.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowProvenance((v) => !v)}
                  className="inline-flex items-center gap-1 text-grey-3 hover:text-navy transition-colors"
                >
                  <ShieldCheck size={11} />
                  {showProvenance
                    ? "Hide provenance"
                    : `Show provenance (${provenance.length})`}
                </button>
              )}
              {schema && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1 text-grey-3 hover:text-navy font-semibold transition-colors"
                >
                  <Pencil size={11} /> Edit fields
                </button>
              )}
              <button
                type="button"
                onClick={draftThis}
                disabled={drafting}
                className="text-gold-warm hover:text-gold-dark font-semibold disabled:opacity-50"
              >
                {drafting ? "Redrafting…" : "Redraft with Jason"}
              </button>
            </div>
          </footer>
          {showProvenance && (
            <div className="mt-4 rounded-xl bg-grey-1 border border-navy/10 px-4 py-3 text-xs text-grey-3 space-y-2">
              {provenance.map((p) => (
                <div key={p.id} className="flex gap-2">
                  <span className="font-mono text-gold-warm flex-shrink-0">
                    [{p.claim_id}]
                  </span>
                  <div>
                    <div>
                      <span className="font-semibold text-navy">
                        {prettySource(p.source_type)}
                      </span>
                      {p.source_ref && (
                        <span className="ml-2 text-grey-4">{p.source_ref}</span>
                      )}
                    </div>
                    {p.source_excerpt && (
                      <div className="italic text-grey-3 mt-0.5">
                        &ldquo;{p.source_excerpt.slice(0, 240)}
                        {p.source_excerpt.length > 240 ? "…" : ""}&rdquo;
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {insufficientCtx && (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900 flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{insufficientCtx}</span>
            </div>
          )}
          {draftError && (
            <p className="mt-3 text-xs text-red-700">{draftError}</p>
          )}
        </>
      )}
    </article>
  );
}

/**
 * Shown when the draft API refuses (422 insufficient_context). Routes
 * the customer toward the three things that will give Jason something
 * real to work from: scrape their site, fill in the structured fields,
 * or open the chat dock to talk it through.
 *
 * Why this exists: clicking "Draft with Jason" on a brand-new account
 * with no Memory used to return a skeleton riddled with `[NEEDS INPUT:
 * ...]` placeholders. Eric's note: confusing, indistinguishable from
 * intentional content. Better to refuse cleanly and show the customer
 * the ramp.
 */
function InsufficientContextPanel({
  message,
  schema,
  onFillFields,
}: {
  message: string;
  schema: ChapterSchema | null;
  onFillFields: () => void;
}) {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-6">
      <div className="flex items-start gap-3 mb-4">
        <AlertCircle
          size={18}
          className="text-amber-700 mt-0.5 flex-shrink-0"
        />
        <div>
          <div className="text-amber-900 font-bold text-sm mb-1">
            Jason needs more to work with
          </div>
          <p className="text-amber-900/85 text-sm leading-relaxed">
            {message} Pick one of these to seed the system — Jason can draft
            the rest from there.
          </p>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <Link
          href="/portal/lab/intake"
          className="flex items-start gap-2 rounded-lg bg-white border border-amber-300 hover:border-navy/40 hover:bg-cream px-3 py-3 text-xs transition-colors"
        >
          <Globe
            size={14}
            className="text-gold-warm mt-0.5 flex-shrink-0"
          />
          <span>
            <span className="block text-navy font-bold mb-0.5">
              Pre-fill from your website
            </span>
            <span className="block text-grey-3">
              ~90 seconds. Jason scrapes your site and seeds the foundational
              chapters.
            </span>
          </span>
        </Link>
        {schema ? (
          <button
            type="button"
            onClick={onFillFields}
            className="flex items-start gap-2 rounded-lg bg-white border border-amber-300 hover:border-navy/40 hover:bg-cream px-3 py-3 text-xs transition-colors text-left"
          >
            <Pencil
              size={14}
              className="text-gold-warm mt-0.5 flex-shrink-0"
            />
            <span>
              <span className="block text-navy font-bold mb-0.5">
                Fill in the fields here
              </span>
              <span className="block text-grey-3">
                Type the basics for this chapter directly. Jason picks it up
                from there.
              </span>
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("jason:open-dock"));
              }
            }}
            className="flex items-start gap-2 rounded-lg bg-white border border-amber-300 hover:border-navy/40 hover:bg-cream px-3 py-3 text-xs transition-colors text-left"
          >
            <MessageCircle
              size={14}
              className="text-gold-warm mt-0.5 flex-shrink-0"
            />
            <span>
              <span className="block text-navy font-bold mb-0.5">
                Talk it through with Jason
              </span>
              <span className="block text-grey-3">
                Open the chat dock and answer a few questions. Jason captures
                what he hears.
              </span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Renders chapter markdown with `[NEEDS INPUT: ...]` patterns extracted
 * into visually distinct callout boxes.
 *
 * Why a custom renderer: passing the raw markdown to ReactMarkdown
 * leaves `[NEEDS INPUT: ...]` as plain text inside paragraphs, which
 * blends visually with the surrounding instructional prose. Eric's
 * feedback: "input sections blend with instructions, and vice versa".
 *
 * Approach: split the markdown at every `[NEEDS INPUT: ...]` occurrence,
 * render each text segment with ReactMarkdown, and interleave the
 * extracted prompts as styled callouts. This keeps real prose styled by
 * react-markdown and gives the gaps a distinct, scannable treatment.
 *
 * Tradeoff: splitting mid-stream can technically break a markdown
 * construct that straddles the boundary (e.g. a list with `[NEEDS
 * INPUT]` between bullets). In practice the agent emits these as their
 * own line / block, so the split is clean. If we hit cases where it
 * isn't, the next iteration is a remark plugin that walks the AST.
 */
function NeedsInputProse({
  md,
  onFillFields,
}: {
  md: string;
  onFillFields?: () => void;
}) {
  // Tolerant pattern: `[NEEDS INPUT:` ... `]`. Doesn't match nested
  // brackets, but the agent's outputs don't use those inside the prompt
  // text — confirmed by inspecting a dozen sample drafts.
  const re = /\[NEEDS INPUT:\s*([^\]]+)\]/g;
  const parts: Array<
    { kind: "md"; text: string } | { kind: "needs"; prompt: string }
  > = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    if (m.index > last) parts.push({ kind: "md", text: md.slice(last, m.index) });
    parts.push({ kind: "needs", prompt: m[1].trim() });
    last = m.index + m[0].length;
  }
  if (last < md.length) parts.push({ kind: "md", text: md.slice(last) });

  // No prompts → just render the whole thing as a single ReactMarkdown
  // pass (cheaper, no risk of split artefacts).
  if (!parts.some((p) => p.kind === "needs")) {
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml={true}>
        {md}
      </ReactMarkdown>
    );
  }

  return (
    <>
      {parts.map((p, i) =>
        p.kind === "md" ? (
          p.text.trim() ? (
            <ReactMarkdown
              key={i}
              remarkPlugins={[remarkGfm]}
              skipHtml={true}
            >
              {p.text}
            </ReactMarkdown>
          ) : null
        ) : (
          <NeedsInputCallout
            key={i}
            prompt={p.prompt}
            onFillFields={onFillFields}
          />
        ),
      )}
    </>
  );
}

/**
 * One styled `[NEEDS INPUT: ...]` callout. Visually distinct from
 * surrounding prose — amber rule, AlertCircle icon, "Needs input"
 * label, and (when the chapter has a schema) a "Fill in fields" CTA
 * that flips the card into edit mode. The customer always knows what
 * Jason wrote vs what Jason is asking for.
 */
function NeedsInputCallout({
  prompt,
  onFillFields,
}: {
  prompt: string;
  onFillFields?: () => void;
}) {
  return (
    <div className="my-4 rounded-lg border-l-4 border-amber-400 bg-amber-50/70 pl-4 pr-3 py-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] font-bold text-amber-800 mb-1">
        <AlertCircle size={11} />
        Needs input
      </div>
      <div className="text-sm text-amber-950/90 leading-snug">{prompt}</div>
      {onFillFields && (
        <button
          type="button"
          onClick={onFillFields}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-900 hover:text-navy transition-colors"
        >
          <Pencil size={11} /> Fill in fields
        </button>
      )}
    </div>
  );
}

function ConfidencePill({
  confidence,
}: {
  confidence: Props["confidence"];
}) {
  const styles: Record<Props["confidence"], string> = {
    verified: "bg-emerald-50 text-emerald-700 border-emerald-200",
    inferred: "bg-amber-50 text-amber-800 border-amber-200",
    draft: "bg-navy/5 text-navy border-navy/15",
    empty: "bg-grey-1 text-grey-4 border-grey-3/30",
  };
  const labels: Record<Props["confidence"], string> = {
    verified: "Verified",
    inferred: "Inferred",
    draft: "Draft",
    empty: "Empty",
  };
  return (
    <span
      className={`inline-block text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full border ${styles[confidence]}`}
    >
      {labels[confidence]}
    </span>
  );
}

function prettySource(source: CustomerMemoryProvenance["source_type"]): string {
  switch (source) {
    case "scraper":
      return "Website scrape";
    case "voice_session":
      return "Voice intake";
    case "upload":
      return "Uploaded document";
    case "form":
      return "You typed this";
    case "agent_inference":
      return "Inferred by Jason";
    case "jason_playbook":
      return "Jason's playbook";
    case "research":
      return "External research";
    case "assessment":
      return "Pre-purchase assessment";
  }
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Count how many non-advanced, non-computed fields have been filled in.
 * Used to render the "X of Y filled" microcopy under the chapter title.
 * Computed fields don't count (they're derived); advanced fields don't
 * count toward the "primary" total (they're hidden by default).
 */
function countFilledFields(
  fields: Record<string, FieldValue>,
  schema: ChapterSchema | null,
): { filled: number; total: number } {
  if (!schema) return { filled: 0, total: 0 };
  let filled = 0;
  let total = 0;
  for (const fd of schema.fields) {
    if (fd.advanced) continue;
    if (hasCalc(schema.slug, fd.name)) continue;
    total += 1;
    const v = fields[fd.name];
    if (v == null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    filled += 1;
  }
  return { filled, total };
}

// Re-export for parents that don't already import these.
export type { FieldDef } from "@/lib/memory/schemas";

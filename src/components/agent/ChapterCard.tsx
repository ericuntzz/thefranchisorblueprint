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

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  ChevronRight,
  Clock,
  Globe,
  Lock,
  Loader2,
  MessageCircle,
  Pencil,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  ChapterAttachment,
  CustomerMemoryProvenance,
} from "@/lib/supabase/types";
import { ChapterAttachments } from "./ChapterAttachments";
import { DraftWithJasonModal } from "./DraftWithJasonModal";
import type { MemoryFileSlug } from "@/lib/memory/files";
import { type ChapterSchema, type FieldDef } from "@/lib/memory/schemas";
import { isValidMemoryFileSlug } from "@/lib/memory/files";
import {
  computeAllFormulas,
  hasCalc,
  type MemoryFieldsMap,
} from "@/lib/calc";
import { parseSections } from "@/lib/memory/sections";
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
  /** Per-chapter attachments (files + links). */
  attachments: ChapterAttachment[];
  /**
   * Every attachment across the customer's chapters — used by the
   * pre-draft modal to show a cross-chapter checkbox list. The page
   * already has this data from its single Memory read; passing it
   * down avoids a second round-trip when the modal opens.
   */
  allAttachmentsByChapter: Array<{
    slug: MemoryFileSlug;
    attachments: ChapterAttachment[];
  }>;
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
  /**
   * Server action to save one section's edits. Called by SectionBlock
   * when the customer hits Save inside an inline section editor.
   * Splices the new body into content_md at the given index and wraps
   * it in a user-locked span.
   */
  saveSection: (args: {
    slug: string;
    sectionIndex: number;
    body: string;
    heading?: string | null;
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
  attachments,
  allAttachmentsByChapter,
  fields,
  otherChaptersFields,
  schema,
  saveFields,
  saveSection,
}: Props) {
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [insufficientCtx, setInsufficientCtx] = useState<string | null>(null);
  const [showProvenance, setShowProvenance] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftModalOpen, setDraftModalOpen] = useState(false);

  // Click handler for the Draft / Redraft buttons. Just opens the
  // pre-draft modal — the actual API call happens when the customer
  // confirms inside the modal (with their extra context + selected
  // attachments). Keeps the click-to-draft flow consistent for empty
  // chapters and redrafts.
  function openDraftModal() {
    setDraftError(null);
    setInsufficientCtx(null);
    setDraftModalOpen(true);
  }

  // Called by the modal's onConfirm. Posts to /api/agent/draft with
  // the modal's gathered inputs, handles the 422 insufficient-context
  // signal, and reloads on success.
  async function performDraft(args: {
    extraContext: string;
    referencedAttachmentIds: string[];
  }) {
    setDrafting(true);
    setDraftError(null);
    setInsufficientCtx(null);
    try {
      const res = await fetch("/api/agent/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          extraContext: args.extraContext,
          referencedAttachmentIds: args.referencedAttachmentIds,
        }),
      });
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
          setDraftModalOpen(false);
          setDrafting(false);
          return;
        }
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? `draft ${res.status}`);
      }
      // Success: full reload so the new draft + extracted fields land
      // on the canvas. Modal will be torn down by the unmount.
      window.location.reload();
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : "draft failed");
      setDrafting(false);
      throw err; // re-throw so the modal surfaces it inline too
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
    <article id={`chapter-${slug}`} className="rounded-2xl border border-navy/10 bg-white p-5 sm:p-6 md:p-8 scroll-mt-20">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.18em] text-gold-warm font-bold mb-1">
            <span className="font-mono">{slug}</span>
            {schema && filledFieldCount.total > 0 && !editing && (
              <span className="ml-2 text-grey-4 normal-case tracking-normal">
                — {filledFieldCount.filled} of {filledFieldCount.total} filled
              </span>
            )}
          </div>
          <h2 className="text-navy font-extrabold text-xl md:text-2xl leading-tight break-words">
            {title}
          </h2>
          {schema && editing && (
            <p className="text-grey-3 text-sm mt-2 max-w-[640px]">
              {schema.description}
            </p>
          )}
        </div>
        <div className="flex-shrink-0">
          <ConfidencePill confidence={confidence} />
        </div>
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
                onClick={openDraftModal}
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
          {/* Per-section render: each `## heading` slice becomes its
              own block with its own hover-edit affordance. Editing one
              section leaves the others rendered as polished prose, so
              the customer never sees the whole chapter as one
              raw-markdown textarea (Eric: "feels like editing a
              codebase"). The chapter-wide overlay is gone. */}
          <div className="chapter-prose text-navy/90 leading-relaxed">
            <ChapterSections
              slug={slug}
              contentMd={contentMd}
              saveSection={saveSection}
              onFillFields={schema ? () => setEditing(true) : undefined}
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
          {/* Footer wraps to a second row on narrow screens. Each
              button has `py-1.5` so the tap target hits the ~30px
              comfortable-touch threshold (44px is the iOS guideline
              minimum, but for grouped controls of this density the
              perceived target is a bit larger thanks to the row's
              line-height and visual whitespace). */}
          <footer className="mt-5 pt-4 border-t border-navy/5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-grey-4">
            <span className="inline-flex items-center gap-1.5">
              <Clock size={11} />
              {lastUpdatedBy && updatedAt
                ? `Updated by ${lastUpdatedBy === "scraper" ? "the scraper" : lastUpdatedBy} ${formatRelative(updatedAt)}`
                : "Never updated"}
            </span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {provenance.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowProvenance((v) => !v)}
                  className="inline-flex items-center gap-1 text-grey-3 hover:text-navy transition-colors py-1.5"
                >
                  <ShieldCheck size={11} />
                  {showProvenance
                    ? "Hide provenance"
                    : `Show provenance (${provenance.length})`}
                </button>
              )}
              {/* "Edit prose" lives on the prose itself as a hover
                  affordance — see the prose container above. */}
              {schema && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1 text-grey-3 hover:text-navy font-semibold transition-colors py-1.5"
                >
                  <Pencil size={11} /> Edit fields
                </button>
              )}
              <button
                type="button"
                onClick={openDraftModal}
                disabled={drafting}
                className="text-gold-warm hover:text-gold-dark font-semibold disabled:opacity-50 py-1.5"
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
      {/* Attachments live below all branches except the active field
          editor — they're chapter-scoped material the customer adds
          to enrich Jason's drafting context. Per-section prose edits
          happen inline inside ChapterSections, so attachments stay
          visible during them; only the field editor swaps the whole
          surface and hides this. */}
      {!editing && (
        <ChapterAttachments slug={slug} attachments={attachments} />
      )}
      {draftModalOpen && isValidMemoryFileSlug(slug) && (
        <DraftWithJasonModal
          slug={slug}
          chapterTitle={title}
          thisChapterAttachments={attachments}
          allAttachmentsByChapter={allAttachmentsByChapter}
          isRedraft={!isEmpty}
          onClose={() => {
            if (!drafting) setDraftModalOpen(false);
          }}
          onConfirm={performDraft}
        />
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
  // Two patterns to recognize, in priority order:
  //
  //   1. `<!-- user-locked:ID -->...<!-- /user-locked:ID -->` — text
  //      the customer hand-authored. Renders with a subtle left rule
  //      and a tiny "Locked" indicator so they can see at a glance
  //      what's theirs vs what's Jason's.
  //
  //   2. `[NEEDS INPUT: ...]` — gaps Jason noted while drafting.
  //      Renders as the amber callout (NeedsInputCallout).
  //
  // Order matters because a locked span could theoretically contain a
  // [NEEDS INPUT] (the user typed one in) — we want the lock to win
  // and render the inner text as prose, not extract it as a prompt.
  type Part =
    | { kind: "md"; text: string }
    | { kind: "needs"; prompt: string }
    | { kind: "locked"; text: string; id: string };
  const parts: Part[] = [];

  const lockRe =
    /<!--\s*user-locked:([a-z0-9]+)\s*-->([\s\S]*?)<!--\s*\/user-locked:\1\s*-->/gi;
  let cursor = 0;
  let lm: RegExpExecArray | null;
  while ((lm = lockRe.exec(md)) !== null) {
    if (lm.index > cursor)
      pushNonLocked(parts, md.slice(cursor, lm.index));
    parts.push({ kind: "locked", id: lm[1], text: lm[2].trim() });
    cursor = lm.index + lm[0].length;
  }
  if (cursor < md.length) pushNonLocked(parts, md.slice(cursor));

  // No special parts at all → single ReactMarkdown pass (cheapest,
  // no split artefacts).
  if (
    parts.length === 1 &&
    parts[0].kind === "md" &&
    !parts.some((p) => p.kind !== "md")
  ) {
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml={true}>
        {md}
      </ReactMarkdown>
    );
  }

  return (
    <>
      {parts.map((p, i) => {
        if (p.kind === "md") {
          return p.text.trim() ? (
            <ReactMarkdown
              key={i}
              remarkPlugins={[remarkGfm]}
              skipHtml={true}
            >
              {p.text}
            </ReactMarkdown>
          ) : null;
        }
        if (p.kind === "needs") {
          return (
            <NeedsInputCallout
              key={i}
              prompt={p.prompt}
              onFillFields={onFillFields}
            />
          );
        }
        return <UserLockedBlock key={i} text={p.text} />;
      })}
    </>
  );
}

/**
 * Helper: a chunk of markdown that is NOT inside a user-locked span
 * gets further split on `[NEEDS INPUT: ...]` patterns. Locked content
 * is intentionally NOT split that way — locked text reads as the
 * customer's words, full stop.
 */
function pushNonLocked(
  parts: Array<
    | { kind: "md"; text: string }
    | { kind: "needs"; prompt: string }
    | { kind: "locked"; text: string; id: string }
  >,
  md: string,
) {
  const needsRe = /\[NEEDS INPUT:\s*([^\]]+)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = needsRe.exec(md)) !== null) {
    if (m.index > last) parts.push({ kind: "md", text: md.slice(last, m.index) });
    parts.push({ kind: "needs", prompt: m[1].trim() });
    last = m.index + m[0].length;
  }
  if (last < md.length) parts.push({ kind: "md", text: md.slice(last) });
}

/**
 * Renders a user-locked span. Subtle emerald left rule + small "Your
 * words" badge in the corner. The visual cue is intentionally quiet
 * (you're meant to read the prose, not constantly notice the chrome)
 * but distinct enough that the customer can see what's theirs vs
 * what's Jason's at a glance.
 */
function UserLockedBlock({ text }: { text: string }) {
  return (
    <div className="my-3 relative rounded-r-lg border-l-2 border-emerald-400/70 bg-emerald-50/30 pl-4 pr-3 py-2 group">
      <div className="absolute -top-2 left-3 inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.14em] font-bold text-emerald-700 bg-white px-1.5 py-0.5 rounded">
        <Lock size={9} />
        Your words
      </div>
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml={true}>
        {text}
      </ReactMarkdown>
    </div>
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

/**
 * Per-section render with FAQ-style collapse.
 *
 * Splits the chapter at every `##` heading; each headed section starts
 * collapsed and expands when the customer clicks its heading row. Only
 * one section is open at a time — opening another collapses the prior
 * (Eric: "auto collapse when another section opens up"). Section 0
 * (anything before the first heading) is always visible, since there's
 * no clickable heading to toggle it.
 *
 * Edit-mode lifts up here too: starting an edit on section i implicitly
 * opens it and closes any other open section so the editor has visual
 * space.
 */
function ChapterSections({
  slug,
  contentMd,
  saveSection,
  onFillFields,
}: {
  slug: string;
  contentMd: string;
  saveSection: (args: {
    slug: string;
    sectionIndex: number;
    body: string;
    heading?: string | null;
  }) => Promise<void>;
  onFillFields?: () => void;
}) {
  // Strip bookkeeping (claim anchors, trailing provenance JSON) before
  // parsing so the section view is reading-grade clean. User-locked
  // markers stay intact — SectionBlock decides how to render them.
  const cleaned = contentMd
    .replace(/<!--\s*claim:[^>]*-->/g, "")
    .replace(/```json(?:\s*provenance)?\s*\n[\s\S]*?\n```\s*$/i, "")
    .trim();
  const sections = parseSections(cleaned);

  // Open & edit indices live up here so the FAQ-collapse rule (only
  // one open at a time) is enforced across siblings. `null` = all
  // headed sections collapsed; section 0 (no heading) ignores this and
  // always renders.
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const startEdit = (i: number) => {
    setEditingIndex(i);
    setOpenIndex(i); // editing implies open
  };
  const cancelEdit = () => setEditingIndex(null);
  const toggleOpen = (i: number) => {
    // Toggling another section while one is being edited cancels the
    // edit (any unsaved changes are discarded). v1 simplification —
    // a "discard unsaved?" warning is a nice-to-have.
    setEditingIndex(null);
    setOpenIndex((prev) => (prev === i ? null : i));
  };

  return (
    <>
      {sections.map((s, i) => (
        <SectionBlock
          key={i}
          slug={slug}
          sectionIndex={i}
          heading={s.heading}
          body={s.body}
          isOpen={s.heading == null || openIndex === i}
          isEditing={editingIndex === i}
          onToggle={() => toggleOpen(i)}
          onStartEdit={() => startEdit(i)}
          onCancelEdit={cancelEdit}
          saveSection={saveSection}
          onFillFields={onFillFields}
        />
      ))}
    </>
  );
}

/**
 * One slice of the chapter.
 *
 * Three render states:
 *   1. Collapsed (only when `heading != null` and `!isOpen`):
 *      heading row only, with chevron + needs-input badge if any
 *      [NEEDS INPUT] prompts are inside. Click anywhere on the row
 *      to expand.
 *   2. Open + reading: heading + body as polished prose, hover
 *      reveals an "Edit" pill in the top-right.
 *   3. Open + editing: heading input + body textarea + save/cancel.
 *
 * Section 0 (heading=null) has only states 2 and 3 — it's the
 * always-visible intro region.
 */
function SectionBlock({
  slug,
  sectionIndex,
  heading,
  body,
  isOpen,
  isEditing,
  onToggle,
  onStartEdit,
  onCancelEdit,
  saveSection,
  onFillFields,
}: {
  slug: string;
  sectionIndex: number;
  heading: string | null;
  body: string;
  isOpen: boolean;
  isEditing: boolean;
  onToggle: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  saveSection: (args: {
    slug: string;
    sectionIndex: number;
    body: string;
    heading?: string | null;
  }) => Promise<void>;
  onFillFields?: () => void;
}) {
  const [draftBody, setDraftBody] = useState(stripBodyForEditing(body));
  const [draftHeading, setDraftHeading] = useState(heading ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Reset local draft state when the parent forces this section out
  // of edit mode (e.g. customer opened another section while
  // mid-edit) OR when the underlying body/heading changes (after a
  // server reload). Without this, re-opening the editor would show
  // stale typed text instead of the current canonical content.
  useEffect(() => {
    if (!isEditing) {
      setDraftBody(stripBodyForEditing(body));
      setDraftHeading(heading ?? "");
      setErr(null);
    }
  }, [isEditing, body, heading]);

  async function onSave() {
    setSaving(true);
    setErr(null);
    try {
      await saveSection({
        slug,
        sectionIndex,
        body: draftBody,
        heading:
          heading == null
            ? undefined
            : draftHeading.trim() && draftHeading !== heading
              ? draftHeading
              : undefined,
      });
      if (typeof window !== "undefined") window.location.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
      setSaving(false);
    }
  }

  // EDIT MODE -----------------------------------------------------------
  if (isEditing) {
    return (
      <div className="my-4 rounded-xl border-2 border-gold/60 bg-cream/40 p-4 space-y-3">
        {heading != null && (
          <input
            type="text"
            value={draftHeading}
            onChange={(e) => setDraftHeading(e.target.value)}
            className="w-full rounded-lg border border-navy/15 bg-white px-3 py-2 text-[15px] font-bold text-navy placeholder-grey-4 focus:border-gold focus:ring-2 focus:ring-gold/20 outline-none transition"
            placeholder="## Section heading"
          />
        )}
        <textarea
          value={draftBody}
          onChange={(e) => setDraftBody(e.target.value)}
          rows={Math.max(6, draftBody.split("\n").length + 1)}
          className="w-full rounded-lg border border-navy/15 bg-white px-3 py-2 text-[14px] text-navy leading-relaxed focus:border-gold focus:ring-2 focus:ring-gold/20 outline-none transition resize-y"
          placeholder="Type this section. Markdown supported (**bold**, - lists, [links](url))…"
          autoFocus
        />
        {/* Lock-message + buttons row. Stacks vertically on small
            screens where the message is too long to share a row with
            two buttons. */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-1.5 text-[11px] text-emerald-700">
            <Lock size={11} className="mt-0.5 flex-shrink-0" />
            <span>
              Your words are locked once saved — Jason won&apos;t rewrite
              them.
            </span>
          </div>
          <div className="flex items-center justify-end gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                onCancelEdit();
                setDraftBody(stripBodyForEditing(body));
                setDraftHeading(heading ?? "");
                setErr(null);
              }}
              disabled={saving}
              className="text-grey-3 hover:text-navy font-semibold text-xs px-3 py-1.5 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving || draftBody === stripBodyForEditing(body)}
              className="inline-flex items-center gap-1.5 bg-gold text-navy font-bold text-[10px] uppercase tracking-[0.1em] px-4 py-2 rounded-full hover:bg-gold-dark disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <>
                  <Loader2 size={11} className="animate-spin" /> Saving…
                </>
              ) : (
                <>Save section</>
              )}
            </button>
          </div>
        </div>
        {err && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800">
            {err}
          </div>
        )}
      </div>
    );
  }

  // READING MODE — for unheaded section 0, just render body + edit
  // pill. The pill is always visible on touch devices (max-md:
  // breakpoint) and only hover-revealed on hover-capable screens.
  // Touch users never get hover, so a hover-only affordance was
  // effectively invisible to them.
  if (heading == null) {
    return (
      <div className="relative group/sec my-2 -mx-2 px-2 py-1 rounded-lg transition-colors hover:bg-cream/40">
        {body.trim() && (
          <NeedsInputProse md={body} onFillFields={onFillFields} />
        )}
        <button
          type="button"
          onClick={onStartEdit}
          className="absolute top-2 right-2 inline-flex items-center gap-1.5 bg-navy text-cream font-bold text-[10px] uppercase tracking-[0.1em] px-3 py-1.5 rounded-full hover:bg-gold hover:text-navy shadow-sm transition-opacity opacity-100 md:opacity-0 md:group-hover/sec:opacity-100 focus-visible:opacity-100"
          title="Edit this section"
        >
          <Pencil size={10} /> Edit
        </button>
      </div>
    );
  }

  // READING MODE — headed section, FAQ-style toggle.
  const headingText = heading.replace(/^##\s+/, "");
  const needsInputCount = (body.match(/\[NEEDS INPUT:/gi) ?? []).length;
  return (
    <div className="my-1 border-b border-navy/5 last:border-b-0">
      {/* Toggle row + Edit pill as flex siblings. Earlier the Edit
          pill was absolutely positioned, which worked for the
          desktop hover-only state but overlapped the heading text
          on mobile when the pill was forced visible. Sibling layout
          handles both — chevron + heading take the available width,
          pill takes its intrinsic width, no overlap. */}
      <div className="flex items-center gap-2 group/sec">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="flex items-center gap-2 flex-1 min-w-0 py-2 text-left hover:text-gold transition-colors"
        >
          <ChevronRight
            size={14}
            className={`text-grey-3 flex-shrink-0 transition-transform ${
              isOpen ? "rotate-90" : ""
            }`}
          />
          <span className="font-bold text-navy text-[15px] truncate">
            {headingText}
          </span>
          {needsInputCount > 0 && !isOpen && (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex-shrink-0">
              <AlertCircle size={9} />
              <span className="hidden sm:inline">
                {needsInputCount} needs input
              </span>
              <span className="sm:hidden">{needsInputCount}</span>
            </span>
          )}
        </button>
        {isOpen && (
          <button
            type="button"
            onClick={onStartEdit}
            className="inline-flex items-center gap-1.5 bg-navy text-cream font-bold text-[10px] uppercase tracking-[0.1em] px-3 py-1.5 rounded-full hover:bg-gold hover:text-navy shadow-sm transition-opacity opacity-100 md:opacity-0 md:group-hover/sec:opacity-100 focus-visible:opacity-100 flex-shrink-0"
            title="Edit this section"
          >
            <Pencil size={10} /> Edit
          </button>
        )}
      </div>
      {/* Body — only rendered when expanded. */}
      {isOpen && body.trim() && (
        <div className="pb-3 pl-6">
          <NeedsInputProse md={body} onFillFields={onFillFields} />
        </div>
      )}
    </div>
  );
}

/**
 * Strip user-locked markers (but keep the inner text) for display in
 * the editing textarea. The customer types clean text; the server
 * re-wraps on save. Lock IDs are an implementation detail.
 */
function stripBodyForEditing(body: string): string {
  return body
    .replace(/<!--\s*user-locked:[a-z0-9]+\s*-->\n?/gi, "")
    .replace(/<!--\s*\/user-locked:[a-z0-9]+\s*-->\n?/gi, "")
    .trim();
}

// Re-export for parents that don't already import these.
export type { FieldDef } from "@/lib/memory/schemas";

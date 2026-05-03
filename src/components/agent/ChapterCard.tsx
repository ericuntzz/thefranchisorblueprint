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
import { ArrowRight, Clock, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { CustomerMemoryProvenance } from "@/lib/supabase/types";

type Props = {
  slug: string;
  title: string;
  contentMd: string;
  confidence: "verified" | "inferred" | "draft" | "empty";
  lastUpdatedBy: "agent" | "user" | "jason" | "scraper" | null;
  updatedAt: string | null;
  provenance: CustomerMemoryProvenance[];
};

export function ChapterCard({
  slug,
  title,
  contentMd,
  confidence,
  lastUpdatedBy,
  updatedAt,
  provenance,
}: Props) {
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [showProvenance, setShowProvenance] = useState(false);

  async function draftThis() {
    setDrafting(true);
    setDraftError(null);
    try {
      const res = await fetch("/api/agent/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
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

  const isEmpty = !contentMd.trim();

  return (
    <article id={`chapter-${slug}`} className="rounded-2xl border border-navy/10 bg-white p-6 md:p-8 scroll-mt-20">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-gold-warm font-bold mb-1">
            Chapter · <span className="font-mono">{slug}</span>
          </div>
          <h2 className="text-navy font-extrabold text-xl md:text-2xl leading-tight">
            {title}
          </h2>
        </div>
        <ConfidencePill confidence={confidence} />
      </header>

      {isEmpty ? (
        <div className="rounded-xl border border-dashed border-navy/15 bg-grey-1 px-5 py-8 text-center">
          <p className="text-grey-3 text-sm mb-4">
            This chapter is empty. Jason can take a first pass from everything
            you&apos;ve given the system so far.
          </p>
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
                <Sparkles size={13} /> Draft with Jason <ArrowRight size={12} />
              </>
            )}
          </button>
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
      ) : (
        <>
          <div className="chapter-prose text-navy/90 leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              // Strip the embedded `<!-- claim:X -->` anchors from the
              // visible render — they're meaningful to the provenance
              // layer, not to the human reader.
              skipHtml={true}
            >
              {contentMd
                // Drop claim anchors (they're stored in customer_memory_provenance).
                .replace(/<!--\s*claim:[^>]*-->/g, "")
                // Drop the trailing ```json provenance``` fenced block
                // when the agent included it. Provenance is rendered in
                // the dedicated panel below — leaving the raw JSON in
                // the prose makes the chapter unreadable AND blew out the
                // page width via the un-wrappable `<code>` block.
                .replace(/```json(?:\s*provenance)?\s*\n[\s\S]*?\n```\s*$/i, "")
                .trim()}
            </ReactMarkdown>
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
          {draftError && (
            <p className="mt-3 text-xs text-red-700">{draftError}</p>
          )}
        </>
      )}
    </article>
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

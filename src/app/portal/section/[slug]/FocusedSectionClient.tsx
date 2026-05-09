"use client";

/**
 * Focused single-section workspace.
 *
 * The customer's primary editing surface for ONE section. Lifts the
 * field editor out of the long Blueprint canvas and gives it its own
 * page with full breathing room. The Blueprint canvas remains
 * available as the assembled-document view; this is where the actual
 * structured-data work happens.
 *
 * Layout (top → bottom):
 *   1. Hero: section title, slug eyebrow, ReadinessPill, schema
 *      description.
 *   2. Field editor (primary) — full width, sticky save bar.
 *   3. Drafted-prose preview (read-only, collapsible) with a deep
 *      link into the Blueprint canvas if the customer wants to edit
 *      the prose itself.
 *   4. Attachments panel (existing component, no changes).
 *   5. Action row: Approve as verified + Redraft with Jason +
 *      previous/next section navigation.
 */

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  SectionAttachment,
  CustomerMemoryProvenance,
} from "@/lib/supabase/types";
import type { SectionSchema } from "@/lib/memory/schemas";
import type { MemoryFileSlug } from "@/lib/memory/files";
import type { MemoryFieldsMap } from "@/lib/calc";
import type { ReadinessState } from "@/lib/memory/readiness";
import { SectionFieldEditor } from "@/components/agent/SectionFieldEditor";
import { SectionAttachments } from "@/components/agent/SectionAttachments";
import { DocPromptCard } from "@/components/agent/DocPromptCard";
import { DraftWithJasonModal } from "@/components/agent/DraftWithJasonModal";
import { docPromptFor } from "@/lib/memory/doc-prompts";

type FieldValue = string | number | boolean | string[] | null;

type Props = {
  slug: MemoryFileSlug;
  title: string;
  schema: SectionSchema | null;
  schemaDescription: string;
  readinessState: ReadinessState;
  confidence: "verified" | "inferred" | "draft" | "empty";
  fields: Record<string, FieldValue>;
  fieldStatus?: Record<
    string,
    {
      source:
        | "voice_session"
        | "upload"
        | "form"
        | "agent_inference"
        | "research"
        | "scraper"
        | "user_correction"
        | "user_typed";
      updated_at?: string;
      note?: string;
    }
  >;
  otherSectionsFields: MemoryFieldsMap;
  contentMd: string;
  attachments: SectionAttachment[];
  allAttachmentsBySection: Array<{
    slug: MemoryFileSlug;
    attachments: SectionAttachment[];
  }>;
  provenance: CustomerMemoryProvenance[];
  lastUpdatedBy: "agent" | "user" | "jason" | "scraper" | null;
  updatedAt: string | null;
  previousSlug: MemoryFileSlug | null;
  nextSlug: MemoryFileSlug | null;
  previousTitle: string | null;
  nextTitle: string | null;
  saveFields: (args: {
    slug: string;
    changes: Record<string, FieldValue>;
  }) => Promise<void>;
  saveSection: (args: {
    slug: string;
    sectionIndex: number;
    body: string;
    heading?: string | null;
  }) => Promise<void>;
  setConfidence: (args: {
    slug: string;
    confidence: "verified" | "inferred" | "draft";
  }) => Promise<void>;
};

export function FocusedSectionClient(props: Props) {
  const {
    slug,
    title,
    schema,
    schemaDescription,
    readinessState,
    confidence,
    fields,
    fieldStatus,
    otherSectionsFields,
    contentMd,
    attachments,
    allAttachmentsBySection,
    lastUpdatedBy,
    updatedAt,
    previousSlug,
    nextSlug,
    previousTitle,
    nextTitle,
    saveFields,
    setConfidence,
  } = props;

  const [draftModalOpen, setDraftModalOpen] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [insufficientCtx, setInsufficientCtx] = useState<string | null>(null);
  const [showProse, setShowProse] = useState(false);
  const [approving, setApproving] = useState(false);

  async function handleSaveFields(changes: Record<string, FieldValue>) {
    // Autosave path — no reload. The page navigates away when the
    // user is done, and at that point the next route shows fresh
    // server-rendered state. Reloading mid-edit would just disrupt
    // their flow.
    await saveFields({ slug, changes });
  }

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
        throw new Error(
          (j as { error?: string }).error ?? `draft ${res.status}`,
        );
      }
      window.location.reload();
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : "draft failed");
      setDrafting(false);
      throw err;
    }
  }

  async function flipConfidence(next: "verified" | "draft") {
    if (approving) return;
    setApproving(true);
    try {
      await setConfidence({ slug, confidence: next });
      if (typeof window !== "undefined") window.location.reload();
    } catch (err) {
      console.error("flipConfidence failed:", err);
      setApproving(false);
    }
  }

  // Derived completion: every required field is filled. Surfaced as
  // a small green checkmark next to the section title — replaces the
  // manual "Approve as verified" button.
  const completion = (() => {
    if (!schema) return { filled: 0, total: 0 };
    let filled = 0;
    let total = 0;
    for (const fd of schema.fields) {
      if (fd.advanced) continue;
      // Skip computed fields — server doesn't track them as user input.
      total += 1;
      const v = fields[fd.name];
      if (v == null) continue;
      if (typeof v === "string" && v.trim() === "") continue;
      if (Array.isArray(v) && v.length === 0) continue;
      filled += 1;
    }
    return { filled, total };
  })();
  const isComplete =
    completion.total > 0 && completion.filled === completion.total;

  // Strip prose for the read-only preview — the prose ITSELF is best
  // edited in the Blueprint canvas where section-level editing +
  // locked-span machinery live. Here it's a "this is what we have so
  // far" reference panel.
  const cleanedProse = contentMd
    .replace(/<!--\s*claim:[^>]*-->/g, "")
    .replace(/<!--\s*user-locked:[a-z0-9]+\s*-->\n?/gi, "")
    .replace(/<!--\s*\/user-locked:[a-z0-9]+\s*-->\n?/gi, "")
    .replace(/```json(?:\s*provenance)?\s*\n[\s\S]*?\n```\s*$/i, "")
    .trim();
  const hasProse = cleanedProse.length > 0;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <header>
        <div className="min-w-0">
          <h1 className="text-navy font-extrabold text-2xl md:text-4xl leading-tight mb-2 break-words flex items-center gap-3 flex-wrap">
            <span>{title}</span>
            {isComplete && (
              <span
                className="inline-flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-full bg-emerald-600 text-white flex-shrink-0"
                title="All required fields filled"
                aria-label="All required fields filled"
              >
                <Check size={16} strokeWidth={3} />
              </span>
            )}
          </h1>
          {schemaDescription && (
            <p className="text-grey-3 text-[17px] leading-relaxed max-w-[640px] mb-3">
              {schemaDescription}
            </p>
          )}
          {/* "Compiles into: ..." chip removed 2026-05-09 per Eric — see
              SectionFieldsCard for matching rationale on the dashboard. */}
        </div>
      </header>

      {/* Doc-prompt banner — Eric's "skip the typing" affordance.
          Surfaces above the field editor when this section has zero
          attachments AND we have a prompt configured for it. Once
          the customer uploads OR dismisses, it disappears. */}
      {attachments.length === 0 && docPromptFor(slug) && (
        <DocPromptCard
          slug={slug}
          prompt={docPromptFor(slug) as NonNullable<ReturnType<typeof docPromptFor>>}
        />
      )}

      {/* Field editor — primary surface. */}
      {schema ? (
        <section className="rounded-2xl border border-card-border bg-white p-5 sm:p-6 md:p-8 shadow-[0_8px_24px_rgba(30,58,95,0.06)]">
          <SectionFieldEditor
            schema={schema}
            initialFields={fields}
            fieldStatus={fieldStatus}
            otherSectionsFields={otherSectionsFields}
            onSave={handleSaveFields}
          />
        </section>
      ) : (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 sm:p-6 md:p-8">
          <div className="text-amber-900 font-bold text-sm mb-1">
            This section has no structured fields yet.
          </div>
          <p className="text-amber-900/85 text-sm leading-relaxed">
            It&apos;s edited as freeform prose in the Blueprint canvas. Use
            the &ldquo;View in Blueprint&rdquo; link at the top of the page
            to work on the body text directly.
          </p>
        </section>
      )}

      {/* Drafted-prose preview — collapsible read-only. */}
      {hasProse && (
        <section className="rounded-2xl border border-card-border bg-white">
          <button
            type="button"
            onClick={() => setShowProse((v) => !v)}
            aria-expanded={showProse}
            className="w-full flex items-center justify-between gap-3 px-5 sm:px-6 py-4 text-left hover:bg-cream-soft transition-colors rounded-2xl"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-[0.14em] text-gold-text font-bold">
                Drafted content
              </span>
              <span className="text-xs uppercase tracking-[0.12em] text-grey-3 font-bold">
                · Read-only preview
              </span>
            </div>
            {showProse ? (
              <ChevronUp size={16} className="text-grey-3 flex-shrink-0" />
            ) : (
              <ChevronDown size={16} className="text-grey-3 flex-shrink-0" />
            )}
          </button>
          {showProse && (
            <div className="px-5 sm:px-6 pb-5 sm:pb-6">
              <div className="border-t border-navy/5 pt-4">
                <div className="prose-preview text-navy/90 leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml={true}>
                    {cleanedProse}
                  </ReactMarkdown>
                </div>
                <div className="mt-4 pt-3 border-t border-navy/5 text-sm text-grey-3 leading-relaxed">
                  To edit prose section-by-section, attach uploaded
                  references, or redraft with locked-span preservation,{" "}
                  <Link
                    href={`/portal/lab/blueprint#section-${slug}`}
                    className="text-gold-text hover:text-navy font-semibold underline transition-colors"
                  >
                    open this section in the Blueprint canvas →
                  </Link>
                </div>
                <style jsx>{`
                  .prose-preview {
                    overflow-wrap: anywhere;
                    word-break: break-word;
                  }
                  .prose-preview :global(h1),
                  .prose-preview :global(h2) {
                    font-weight: 700;
                    color: rgb(30 58 95);
                    margin: 1.25em 0 0.5em;
                    font-size: 1.05rem;
                  }
                  .prose-preview :global(h3) {
                    font-weight: 600;
                    color: rgb(30 58 95);
                    margin: 1em 0 0.4em;
                    font-size: 0.97rem;
                  }
                  .prose-preview :global(p) {
                    margin: 0 0 0.85em;
                    font-size: 0.92rem;
                    line-height: 1.6;
                  }
                  .prose-preview :global(ul),
                  .prose-preview :global(ol) {
                    margin: 0 0 0.85em 1.2em;
                    font-size: 0.92rem;
                    line-height: 1.55;
                  }
                  .prose-preview :global(strong) {
                    color: rgb(30 58 95);
                    font-weight: 600;
                  }
                `}</style>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Attachments — same component as the Blueprint canvas. */}
      <SectionAttachments slug={slug} attachments={attachments} />

      {/* Action row — Approve + Redraft + Last-updated. Sits below
          everything as the "I'm done with this section, what now"
          surface. */}
      <section className="rounded-2xl border border-card-border bg-white p-5 sm:p-6 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-grey-3">
          {lastUpdatedBy && updatedAt
            ? `Updated by ${lastUpdatedBy === "scraper" ? "the scraper" : lastUpdatedBy} ${formatRelative(updatedAt)}`
            : "Never updated"}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDraftError(null);
              setInsufficientCtx(null);
              setDraftModalOpen(true);
            }}
            disabled={drafting}
            className="inline-flex items-center gap-2 bg-white text-navy hover:bg-navy hover:text-cream border-2 border-navy/30 hover:border-navy font-bold text-[11px] uppercase tracking-[0.1em] px-4 py-2 rounded-full transition-colors disabled:opacity-50"
          >
            <Sparkles size={12} />
            {drafting
              ? "Drafting…"
              : hasProse
                ? "Redraft with Jason"
                : "Draft with Jason"}
          </button>
          {/* MOCK: "Approve as verified" / "Verified · re-open" buttons
              removed. Completion is now derived from filled-field count
              and rendered as a checkmark next to the section title. */}
        </div>
      </section>

      {insufficientCtx && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          {insufficientCtx}
        </div>
      )}
      {draftError && (
        <div className="rounded-2xl border border-red-300 bg-red-50 px-5 py-4 text-sm text-red-800">
          {draftError}
        </div>
      )}

      {/* Adjacent section navigation — TurboTax-style "prev / next"
          so the customer can keep working through sections without
          bouncing back to the dashboard between each one. */}
      <nav className="flex flex-wrap items-stretch justify-between gap-3 pt-2">
        {previousSlug && previousTitle ? (
          <Link
            href={`/portal/section/${previousSlug}`}
            className="flex-1 min-w-[260px] flex items-center gap-3 rounded-2xl border border-card-border bg-white hover:bg-cream-soft hover:border-navy/30 px-5 py-4 transition-colors group"
          >
            <ArrowLeft
              size={16}
              className="text-grey-3 group-hover:text-navy flex-shrink-0 transition-colors"
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs uppercase tracking-[0.12em] text-grey-3 font-bold">
                Previous
              </div>
              <div className="text-navy font-bold truncate">{previousTitle}</div>
            </div>
          </Link>
        ) : (
          <div className="flex-1 min-w-[260px]" aria-hidden />
        )}
        {nextSlug && nextTitle ? (
          <Link
            href={`/portal/section/${nextSlug}`}
            className="flex-1 min-w-[260px] flex items-center gap-3 rounded-2xl border border-card-border bg-white hover:bg-cream-soft hover:border-navy/30 px-5 py-4 transition-colors group text-right"
          >
            <div className="min-w-0 flex-1">
              <div className="text-xs uppercase tracking-[0.12em] text-grey-3 font-bold">
                Next
              </div>
              <div className="text-navy font-bold truncate">{nextTitle}</div>
            </div>
            <ArrowRight
              size={16}
              className="text-grey-3 group-hover:text-navy flex-shrink-0 transition-colors"
            />
          </Link>
        ) : (
          <div className="flex-1 min-w-[260px]" aria-hidden />
        )}
      </nav>

      {/* Pre-draft modal — same component as the Blueprint canvas
          uses, identical UX surface. */}
      {draftModalOpen && (
        <DraftWithJasonModal
          slug={slug}
          sectionTitle={title}
          thisSectionAttachments={attachments}
          allAttachmentsBySection={allAttachmentsBySection}
          isRedraft={hasProse}
          onClose={() => {
            if (!drafting) setDraftModalOpen(false);
          }}
          onConfirm={performDraft}
        />
      )}
    </div>
  );
}

/** Same relative-time helper used in SectionCard — small enough to
 *  duplicate rather than wire up an import dance. */
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


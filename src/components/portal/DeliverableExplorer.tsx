"use client";

/**
 * DeliverableExplorer — primary "build + ship" surface on the dashboard.
 *
 * Replaces the prior pair of components:
 *   - DeliverableChecklist (per-phase chapter readiness grid — flat)
 *   - ExportsSection ("Download what you've built" — flat)
 *
 * with a single nested structure: deliverable cards expand to reveal
 * the contributing chapter rows; each chapter row expands again to
 * show the full editor inline. Same surface, deliverable-aware
 * grouping, no jumping to /portal/lab/blueprint or /portal/chapter/[slug]
 * to edit.
 *
 * Two-level expansion model:
 *   Level 1: One deliverable expanded at a time (others stay collapsed)
 *   Level 2: Inside an expanded deliverable, one chapter editor open
 *            at a time (others show their summary row)
 *
 * Bundle download UI (multi-select + ZIP) preserved at the top of
 * the section. Users still tick boxes across collapsed cards and
 * hit "Download bundle" without ever expanding anything.
 */

import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Loader2,
  PackageOpen,
} from "lucide-react";
import {
  DELIVERABLES,
  DELIVERABLE_DISPLAY_ORDER,
} from "@/lib/export/deliverables";
import { MEMORY_FILE_TITLES } from "@/lib/memory/files";
import type { MemoryFileSlug } from "@/lib/memory/files";
import type { DeliverableReview } from "@/lib/export/deliverable-readiness";
import type { DeliverableId } from "@/lib/export/types";
import type { ChapterReadiness } from "@/lib/memory/readiness";
import { ChapterCard } from "@/components/agent/ChapterCard";
import { DeliverablePreviewModal } from "@/components/portal/DeliverablePreviewModal";
import type {
  ChapterAttachment,
  CustomerMemoryProvenance,
} from "@/lib/supabase/types";
import type { ChapterSchema } from "@/lib/memory/schemas";
import type { MemoryFieldsMap } from "@/lib/calc";

type FieldValue = string | number | boolean | string[] | null;
type ConfidenceValue = "verified" | "inferred" | "draft" | "empty";

/** Shape of everything one ChapterCard needs to render inline. The
 *  dashboard server component pre-computes all of these per chapter
 *  so the client component is a pure render. */
export type ChapterDataBundle = {
  slug: MemoryFileSlug;
  title: string;
  contentMd: string;
  confidence: ConfidenceValue;
  readinessState: ChapterReadiness["state"];
  lastUpdatedBy: "agent" | "user" | "jason" | "scraper" | null;
  updatedAt: string | null;
  provenance: CustomerMemoryProvenance[];
  attachments: ChapterAttachment[];
  allAttachmentsByChapter: Array<{
    slug: MemoryFileSlug;
    attachments: ChapterAttachment[];
  }>;
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
  otherChaptersFields: MemoryFieldsMap;
  schema: ChapterSchema | null;
};

export type DeliverableViewModel = {
  id: DeliverableId;
  name: string;
  description: string;
  kind: "doc" | "slides";
  review: DeliverableReview;
  sourceChapters: ChapterDataBundle[];
};

type SaveFieldsArgs = {
  slug: string;
  changes: Record<string, FieldValue>;
};
type SaveSectionArgs = {
  slug: string;
  sectionIndex: number;
  body: string;
  heading?: string | null;
};
type SetConfidenceArgs = {
  slug: string;
  confidence: "verified" | "inferred" | "draft";
};

type Props = {
  deliverables: DeliverableViewModel[];
  saveFields: (args: SaveFieldsArgs) => Promise<void>;
  saveSection: (args: SaveSectionArgs) => Promise<void>;
  setConfidence: (args: SetConfidenceArgs) => Promise<void>;
  /** True when the customer has filled exactly nothing yet. Drives a
   *  warmer first-run hero in place of the standard "17 deliverables"
   *  pitch, and auto-expands the first deliverable so they have one
   *  obvious place to start. */
  isFirstRun?: boolean;
  firstName?: string | null;
};

export function DeliverableExplorer({
  deliverables,
  saveFields,
  saveSection,
  setConfidence,
  isFirstRun = false,
  firstName = null,
}: Props) {
  // Multi-select for bundle download — independent of expansion state
  // so a customer can tick boxes across the grid without having to
  // expand every card.
  const [selected, setSelected] = useState<Set<DeliverableId>>(new Set());
  const [bundling, setBundling] = useState(false);
  const [bundleErr, setBundleErr] = useState<string | null>(null);
  // Two-level expansion: only one deliverable open, only one chapter
  // editor open inside that deliverable. First-run accounts get the
  // first deliverable expanded automatically so they have one obvious
  // place to start; otherwise everything stays collapsed and the
  // customer drives expansion themselves.
  const [expandedDeliverableId, setExpandedDeliverableId] = useState<
    DeliverableId | null
  >(isFirstRun && deliverables.length > 0 ? deliverables[0].id : null);
  const [openChapterSlug, setOpenChapterSlug] = useState<MemoryFileSlug | null>(
    null,
  );
  // Preview-before-download modal state. Either previewing a single
  // deliverable (clicked from a card's "Preview" button) or the whole
  // selected bundle (clicked from the bundle action bar). null = closed.
  const [preview, setPreview] = useState<
    | { mode: "single"; deliverable: DeliverableViewModel }
    | { mode: "bundle"; deliverables: DeliverableViewModel[] }
    | null
  >(null);

  const allIds = useMemo(
    () =>
      DELIVERABLE_DISPLAY_ORDER.filter((id) =>
        deliverables.some((d) => d.id === id),
      ),
    [deliverables],
  );
  const allSelected =
    allIds.length > 0 && allIds.every((id) => selected.has(id));
  const noneSelected = selected.size === 0;

  function toggleSelect(id: DeliverableId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectAll() {
    setSelected(new Set(allIds));
  }
  function clearAll() {
    setSelected(new Set());
  }
  function toggleDeliverable(id: DeliverableId) {
    setExpandedDeliverableId((prev) => (prev === id ? null : id));
    // Collapsing a deliverable also closes any chapter editor inside it.
    setOpenChapterSlug(null);
  }
  function toggleChapter(slug: MemoryFileSlug) {
    setOpenChapterSlug((prev) => (prev === slug ? null : slug));
  }

  async function downloadBundle() {
    if (selected.size === 0 || bundling) return;
    setBundling(true);
    setBundleErr(null);
    try {
      const res = await fetch("/api/agent/export/bundle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliverableIds: Array.from(selected) }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(
          (j as { error?: string }).error ??
            `Bundle export failed (HTTP ${res.status})`,
        );
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const today = new Date().toISOString().slice(0, 10);
      a.download = `Franchisor-Blueprint-Bundle-${today}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setBundleErr(e instanceof Error ? e.message : "Bundle download failed");
    } finally {
      setBundling(false);
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-card-border p-5 sm:p-6 md:p-8">
      <div className="text-xs uppercase tracking-[0.14em] text-gold-text font-bold mb-1">
        Your Blueprint
      </div>
      {isFirstRun ? (
        <>
          <h2 className="text-navy font-extrabold text-xl md:text-2xl mb-1">
            {firstName ? `${firstName}, here's where it all assembles.` : "Here's where it all assembles."}
          </h2>
          <p className="text-grey-3 text-sm md:text-base leading-relaxed mb-5 max-w-[680px]">
            We opened the first card for you. Fill in a few fields
            and watch the readiness number climb. You can move at
            your own pace — nothing has to be done in one sitting.
          </p>
        </>
      ) : (
        <>
          <h2 className="text-navy font-extrabold text-xl md:text-2xl mb-1">
            Build, edit, and download what you&apos;re shipping
          </h2>
          <p className="text-grey-3 text-sm md:text-base leading-relaxed mb-5 max-w-[680px]">
            Each card is a document in your franchise package. Click
            to edit it. Tick boxes and hit &ldquo;Preview docs&rdquo;
            to grab several at once.
          </p>
        </>
      )}

      {/* Bundle action bar */}
      <div className="rounded-xl border border-card-border bg-cream/40 p-3 mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={allSelected ? clearAll : selectAll}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-navy hover:text-gold-warm transition-colors"
        >
          <input
            type="checkbox"
            checked={allSelected}
            readOnly
            className="w-4 h-4 accent-gold-warm cursor-pointer"
          />
          {allSelected ? "Clear all" : "Select all"}
        </button>
        <span className="text-[11px] text-grey-3">
          {selected.size > 0
            ? `${selected.size} selected`
            : "Pick the docs you want"}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() =>
            setPreview({
              mode: "bundle",
              deliverables: deliverables.filter((d) => selected.has(d.id)),
            })
          }
          disabled={noneSelected || bundling}
          className="inline-flex items-center gap-2 bg-navy text-cream hover:bg-navy-light disabled:opacity-40 disabled:cursor-not-allowed font-bold text-xs uppercase tracking-[0.1em] px-4 py-2.5 rounded-full transition-colors"
        >
          {bundling ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Building…
            </>
          ) : (
            <>
              <PackageOpen size={14} />
              {selected.size > 0
                ? `Preview ${selected.size} docs`
                : "Preview docs"}
            </>
          )}
        </button>
      </div>

      {bundleErr && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800 mb-4">
          {bundleErr}
        </div>
      )}

      {/* Deliverable cards */}
      <div className="grid gap-3">
        {deliverables.map((d) => (
          <DeliverableEntry
            key={d.id}
            deliverable={d}
            expanded={expandedDeliverableId === d.id}
            onToggleExpand={() => toggleDeliverable(d.id)}
            isSelected={selected.has(d.id)}
            onToggleSelect={() => toggleSelect(d.id)}
            openChapterSlug={
              expandedDeliverableId === d.id ? openChapterSlug : null
            }
            onToggleChapter={toggleChapter}
            saveFields={saveFields}
            saveSection={saveSection}
            setConfidence={setConfidence}
            onPreview={(d) => setPreview({ mode: "single", deliverable: d })}
          />
        ))}
      </div>

      {/* Preview-before-download modal. Renders only when `preview` is
          non-null; iframe inside loads /api/agent/export/<id>?format=pdf
          &inline=1 so the customer sees what they're about to save. */}
      {preview && preview.mode === "single" && (
        <DeliverablePreviewModal
          open
          onClose={() => setPreview(null)}
          mode="single"
          deliverable={{
            id: preview.deliverable.id,
            name: preview.deliverable.name,
            kind: preview.deliverable.kind,
          }}
        />
      )}
      {preview && preview.mode === "bundle" && (
        <DeliverablePreviewModal
          open
          onClose={() => setPreview(null)}
          mode="bundle"
          deliverables={preview.deliverables.map((d) => ({
            id: d.id,
            name: d.name,
            kind: d.kind,
            readinessPct: d.review.overallPct,
          }))}
          onDownloadBundle={async () => {
            await downloadBundle();
            setPreview(null);
          }}
        />
      )}
    </section>
  );
}

function DeliverableEntry({
  deliverable,
  expanded,
  onToggleExpand,
  isSelected,
  onToggleSelect,
  openChapterSlug,
  onToggleChapter,
  saveFields,
  saveSection,
  setConfidence,
  onPreview,
}: {
  deliverable: DeliverableViewModel;
  expanded: boolean;
  onToggleExpand: () => void;
  isSelected: boolean;
  onToggleSelect: () => void;
  openChapterSlug: MemoryFileSlug | null;
  onToggleChapter: (slug: MemoryFileSlug) => void;
  saveFields: (args: SaveFieldsArgs) => Promise<void>;
  saveSection: (args: SaveSectionArgs) => Promise<void>;
  setConfidence: (args: SetConfidenceArgs) => Promise<void>;
  onPreview: (deliverable: DeliverableViewModel) => void;
}) {
  const def = DELIVERABLES[deliverable.id];
  if (!def) return null;
  const review = deliverable.review;
  const isSlides = deliverable.kind === "slides";
  const previewLabel = isSlides
    ? "Preview & download .pptx"
    : "Preview & download";

  return (
    <article
      id={`deliverable-${deliverable.id}`}
      className={`rounded-xl border transition-colors scroll-mt-4 ${
        isSelected
          ? "border-gold bg-gold/5"
          : "border-card-border bg-cream/30"
      }`}
    >
      {/* Header row — click anywhere except the checkbox to expand. */}
      <div className="flex flex-wrap items-start gap-4 p-4 sm:p-5">
        {/* Checkbox column — opt-in for the bundle. */}
        <label
          className="flex-shrink-0 cursor-pointer pt-1"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="w-5 h-5 accent-gold-warm cursor-pointer"
            aria-label={`Add ${deliverable.name} to bundle`}
          />
        </label>
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          className="flex-1 min-w-[260px] flex items-start gap-3 text-left"
        >
          <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold">
            <FileText size={18} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
              <span className="text-navy font-bold text-base">
                {deliverable.name}
              </span>
              <ReadinessBadge pct={review.overallPct} gaps={review.totalGaps} />
              {isSlides && (
                <span className="text-xs uppercase tracking-wider font-bold text-grey-3 bg-grey-1/40 border border-card-border rounded-full px-2 py-0.5">
                  .pptx
                </span>
              )}
            </span>
            <span className="block text-grey-3 text-sm leading-relaxed">
              {deliverable.description}
            </span>
          </span>
        </button>
      </div>

      {/* Expanded content: readiness card + chapter rows. Sits
          between the header and the footer actions so the editing
          flow reads top-to-bottom. */}
      {expanded && (
        <div className="border-t border-card-border bg-white px-4 sm:px-5 py-4 space-y-4">
          <ReadinessBar
            review={review}
            onJumpToChapter={(slug) => onToggleChapter(slug)}
            openChapterSlug={openChapterSlug}
          />

          <div className="space-y-3">
            {deliverable.sourceChapters.map((chapter) => {
              const isOpen = openChapterSlug === chapter.slug;
              return (
                <ChapterRow
                  key={chapter.slug}
                  chapter={chapter}
                  isOpen={isOpen}
                  onToggle={() => onToggleChapter(chapter.slug)}
                  saveFields={saveFields}
                  saveSection={saveSection}
                  setConfidence={setConfidence}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Preview & download — always at the bottom of the card,
          before the show-more toggle. When the card is collapsed
          this gives a one-click path to the deliverable; when
          expanded it reads as the "ship it" final step after
          editing the chapters. */}
      <div className="border-t border-card-border px-4 sm:px-5 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <button
          type="button"
          onClick={() => onPreview(deliverable)}
          className="inline-flex items-center gap-1.5 text-navy hover:text-navy-light font-bold uppercase tracking-[0.1em] py-1 transition-colors"
        >
          <Download size={12} />
          {previewLabel}
        </button>
      </div>

      {/* SHOW MORE / SHOW LESS toggle — centered at the very
          bottom. Same disclosure idiom as ActivityFeed. */}
      <button
        type="button"
        onClick={onToggleExpand}
        aria-expanded={expanded}
        className="w-full flex items-center justify-center gap-1.5 border-t border-card-border py-2.5 text-xs uppercase tracking-[0.1em] font-bold text-grey-3 hover:text-navy hover:bg-cream-soft transition-colors"
      >
        {expanded ? (
          <>
            Show less
            <ChevronUp size={13} />
          </>
        ) : (
          <>
            Show more
            <ChevronDown size={13} />
          </>
        )}
      </button>
    </article>
  );
}

function ReadinessBar({
  review,
  onJumpToChapter,
  openChapterSlug,
}: {
  review: DeliverableReview;
  onJumpToChapter: (slug: MemoryFileSlug) => void;
  openChapterSlug: MemoryFileSlug | null;
}) {
  const pct = review.overallPct;
  const allGaps = review.chapters.flatMap((c) => c.gaps);
  const visibleGaps = allGaps.slice(0, 12);
  return (
    <div className="rounded-xl border border-card-border bg-cream/30 p-4">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <span className="text-navy font-bold text-sm">Document readiness</span>
        <span className="text-navy font-bold tabular-nums text-sm">
          {pct}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-grey-1 overflow-hidden mb-3">
        <div
          className={`h-full transition-all duration-500 ${
            pct >= 95
              ? "bg-emerald-500"
              : pct >= 50
                ? "bg-amber-500"
                : "bg-grey-3"
          }`}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
      {review.totalGaps === 0 ? (
        <div className="inline-flex items-center gap-1.5 text-emerald-700 text-xs font-semibold">
          <CheckCircle2 size={13} /> Every required field is filled. Safe
          to download.
        </div>
      ) : (
        <>
          <div className="text-navy text-xs font-bold mb-1.5">
            Gaps to fill:
          </div>
          <ul className="space-y-1 list-disc pl-5 marker:text-amber-600">
            {visibleGaps.map((g) => (
              <li
                key={`${g.chapterSlug}.${g.fieldName}`}
                className="text-sm text-navy"
              >
                <button
                  type="button"
                  onClick={() => {
                    if (openChapterSlug !== g.chapterSlug) {
                      onJumpToChapter(g.chapterSlug);
                    }
                    window.setTimeout(() => {
                      const target = document.getElementById(
                        `chapter-row-${g.chapterSlug}`,
                      );
                      if (target) {
                        target.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      }
                    }, 50);
                  }}
                  className="text-left hover:underline"
                >
                  <span className="font-semibold">{g.fieldLabel}</span>
                  <span className="text-grey-3 text-xs">
                    {" "}
                    · {g.chapterTitle}
                  </span>
                </button>
              </li>
            ))}
            {allGaps.length > visibleGaps.length && (
              <li className="text-xs text-grey-3 italic list-none pl-0">
                + {allGaps.length - visibleGaps.length} more
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}

function ChapterRow({
  chapter,
  isOpen,
  onToggle,
  saveFields,
  saveSection,
  setConfidence,
}: {
  chapter: ChapterDataBundle;
  isOpen: boolean;
  onToggle: () => void;
  saveFields: (args: SaveFieldsArgs) => Promise<void>;
  saveSection: (args: SaveSectionArgs) => Promise<void>;
  setConfidence: (args: SetConfidenceArgs) => Promise<void>;
}) {
  const filled = countFilled(chapter);
  const stateColor = STATE_DOT_COLOR[chapter.readinessState];
  return (
    <div
      id={`chapter-row-${chapter.slug}`}
      className="rounded-lg border border-card-border bg-cream/30 overflow-hidden scroll-mt-4"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full flex flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-cream/60 transition-colors"
      >
        <span
          className={`flex-shrink-0 w-2 h-2 rounded-full ${stateColor}`}
          aria-hidden="true"
        />
        <span className="flex-1 min-w-0 text-navy font-semibold text-sm truncate">
          {MEMORY_FILE_TITLES[chapter.slug]}
        </span>
        {filled.total > 0 && (
          <span className="text-xs uppercase tracking-[0.1em] text-grey-3 font-bold tabular-nums whitespace-nowrap">
            {filled.filled} / {filled.total}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.1em] text-navy font-bold whitespace-nowrap">
          {isOpen ? (
            <>
              Close <ChevronUp size={12} />
            </>
          ) : (
            <>
              Edit <ChevronDown size={12} />
            </>
          )}
        </span>
      </button>
      {isOpen && (
        <div className="border-t border-card-border bg-white p-4 sm:p-5 md:p-6">
          <ChapterCard
            slug={chapter.slug}
            title={chapter.title}
            contentMd={chapter.contentMd}
            confidence={chapter.confidence}
            readinessState={chapter.readinessState}
            lastUpdatedBy={chapter.lastUpdatedBy}
            updatedAt={chapter.updatedAt}
            provenance={chapter.provenance}
            attachments={chapter.attachments}
            allAttachmentsByChapter={chapter.allAttachmentsByChapter}
            fields={chapter.fields}
            fieldStatus={chapter.fieldStatus}
            otherChaptersFields={chapter.otherChaptersFields}
            schema={chapter.schema}
            saveFields={saveFields}
            saveSection={saveSection}
            setConfidence={setConfidence}
          />
        </div>
      )}
    </div>
  );
}

function countFilled(chapter: ChapterDataBundle): { filled: number; total: number } {
  if (!chapter.schema) return { filled: 0, total: 0 };
  let filled = 0;
  let total = 0;
  for (const fd of chapter.schema.fields) {
    if (fd.advanced) continue;
    total += 1;
    const v = chapter.fields[fd.name];
    if (v == null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    filled += 1;
  }
  return { filled, total };
}

const STATE_DOT_COLOR: Record<ChapterReadiness["state"], string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-400",
  red: "bg-amber-400",
  gray: "bg-grey-3/40",
};

function ReadinessBadge({ pct, gaps }: { pct: number; gaps: number }) {
  if (pct >= 95) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
        <CheckCircle2 size={11} />
        Ready
      </span>
    );
  }
  if (pct >= 50) {
    return (
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
        {pct}% · {gaps} gap{gaps === 1 ? "" : "s"}
      </span>
    );
  }
  return (
    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-grey-3 bg-grey-1/50 border border-card-border rounded-full px-2 py-0.5">
      {pct}% complete
    </span>
  );
}

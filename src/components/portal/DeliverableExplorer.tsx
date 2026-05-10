"use client";

/**
 * DeliverableExplorer — primary "build + ship" surface on the dashboard.
 *
 * Replaces the prior pair of components:
 *   - DeliverableChecklist (per-phase section readiness grid — flat)
 *   - ExportsSection ("Download what you've built" — flat)
 *
 * with a single nested structure: deliverable cards expand to reveal
 * the contributing section rows; each section row expands again to
 * show the full editor inline. Same surface, deliverable-aware
 * grouping, no jumping to /portal/lab/blueprint or /portal/section/[slug]
 * to edit.
 *
 * Two-level expansion model:
 *   Level 1: One deliverable expanded at a time (others stay collapsed)
 *   Level 2: Inside an expanded deliverable, one section editor open
 *            at a time (others show their summary row)
 *
 * Bundle download UI (multi-select + ZIP) preserved at the top of
 * the section. Users still tick boxes across collapsed cards and
 * hit "Download bundle" without ever expanding anything.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Download,
  Loader2,
  PackageOpen,
  Paperclip,
  Sparkles,
} from "lucide-react";
import {
  DELIVERABLES,
  DELIVERABLE_DISPLAY_ORDER,
} from "@/lib/export/deliverables";
import { MEMORY_FILE_TITLES } from "@/lib/memory/files";
import type { MemoryFileSlug } from "@/lib/memory/files";
import type { DeliverableReview } from "@/lib/export/deliverable-readiness";
import type { DeliverableId } from "@/lib/export/types";
import type { SectionReadiness } from "@/lib/memory/readiness";
import { SectionFieldsCard } from "@/components/portal/SectionFieldsCard";
import { DeliverablePreviewModal } from "@/components/portal/DeliverablePreviewModal";
import { AnimatedDisclosure } from "@/components/ui/AnimatedDisclosure";
import type {
  SectionAttachment,
  CustomerMemoryProvenance,
} from "@/lib/supabase/types";
import type { SectionSchema } from "@/lib/memory/schemas";
import type { MemoryFieldsMap } from "@/lib/calc";

type FieldValue = string | number | boolean | string[] | null;
type ConfidenceValue = "verified" | "inferred" | "draft" | "empty";

/** Shape of everything one SectionCard needs to render inline. The
 *  dashboard server component pre-computes all of these per section
 *  so the client component is a pure render. */
export type SectionDataBundle = {
  slug: MemoryFileSlug;
  title: string;
  contentMd: string;
  confidence: ConfidenceValue;
  readinessState: SectionReadiness["state"];
  lastUpdatedBy: "agent" | "user" | "jason" | "scraper" | null;
  updatedAt: string | null;
  provenance: CustomerMemoryProvenance[];
  attachments: SectionAttachment[];
  allAttachmentsBySection: Array<{
    slug: MemoryFileSlug;
    attachments: SectionAttachment[];
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
  otherSectionsFields: MemoryFieldsMap;
  schema: SectionSchema | null;
};

export type DeliverableViewModel = {
  id: DeliverableId;
  name: string;
  description: string;
  kind: "doc" | "slides";
  review: DeliverableReview;
  sourceSections: SectionDataBundle[];
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
  // Two-level expansion: only one deliverable open, only one section
  // editor open inside that deliverable. First-run accounts get the
  // first deliverable expanded automatically so they have one obvious
  // place to start; otherwise everything stays collapsed and the
  // customer drives expansion themselves.
  const [expandedDeliverableId, setExpandedDeliverableId] = useState<
    DeliverableId | null
  >(isFirstRun && deliverables.length > 0 ? deliverables[0].id : null);
  const [openSectionSlug, setOpenSectionSlug] = useState<MemoryFileSlug | null>(
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
    // Collapsing a deliverable also closes any section editor inside it.
    setOpenSectionSlug(null);
  }
  function toggleSection(slug: MemoryFileSlug) {
    setOpenSectionSlug((prev) => (prev === slug ? null : slug));
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
          <p className="text-grey-3 text-sm md:text-base leading-relaxed mb-5 max-w-[920px]">
            We opened the first card for you. Fill in a few fields
            and watch the readiness number climb. You can move at
            your own pace — nothing has to be done in one sitting.
          </p>
        </>
      ) : (
        <>
          <h2 className="text-navy font-extrabold text-xl md:text-2xl mb-1">
            Edit and Download Your Franchisor Blueprint Documents
          </h2>
          <p className="text-grey-3 text-sm md:text-base leading-relaxed mb-5 max-w-[920px]">
            This is where every document for your franchise lives.
            Click a card to edit what&apos;s inside, preview the
            finished doc before you send it out, or tick a few boxes
            and grab them all as a bundle.
          </p>
        </>
      )}

      {/* Bundle action bar — navy so it stands out from the cream
          deliverable cards below it instead of blending in. */}
      <div className="rounded-xl bg-navy text-cream p-3 mb-4 flex flex-wrap items-center gap-3 shadow-[0_2px_8px_rgba(30,58,95,0.12)]">
        <button
          type="button"
          onClick={allSelected ? clearAll : selectAll}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-cream hover:text-gold transition-colors"
        >
          <input
            type="checkbox"
            checked={allSelected}
            readOnly
            className="w-4 h-4 accent-gold cursor-pointer"
          />
          {allSelected ? "Clear all" : "Select all"}
        </button>
        {selected.size > 0 && (
          <span className="text-[11px] text-cream/65">
            {selected.size} selected
          </span>
        )}
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
          className="inline-flex items-center gap-2 bg-gold text-navy hover:bg-gold-dark disabled:opacity-40 disabled:cursor-not-allowed font-bold text-xs uppercase tracking-[0.1em] px-4 py-2.5 rounded-full transition-colors"
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
            openSectionSlug={
              expandedDeliverableId === d.id ? openSectionSlug : null
            }
            onToggleSection={toggleSection}
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
  openSectionSlug,
  onToggleSection,
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
  openSectionSlug: MemoryFileSlug | null;
  onToggleSection: (slug: MemoryFileSlug) => void;
  saveFields: (args: SaveFieldsArgs) => Promise<void>;
  saveSection: (args: SaveSectionArgs) => Promise<void>;
  setConfidence: (args: SetConfidenceArgs) => Promise<void>;
  onPreview: (deliverable: DeliverableViewModel) => void;
}) {
  const def = DELIVERABLES[deliverable.id];
  if (!def) return null;
  const review = deliverable.review;
  const isSlides = deliverable.kind === "slides";
  // Compact label so the corner button doesn't crowd the readiness
  // badge / .pptx pill. The modal it opens still has prominent
  // download actions inside.
  const previewLabel = isSlides ? "Preview .pptx" : "Preview";

  return (
    <article
      id={`deliverable-${deliverable.id}`}
      className={`rounded-xl border transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out scroll-mt-4 ${
        isSelected
          ? "border-gold bg-gold/5 shadow-[0_4px_12px_rgba(212,162,76,0.12)]"
          : "border-card-border bg-cream/30 hover:border-navy/15 hover:bg-cream/50 hover:shadow-[0_4px_14px_rgba(30,58,95,0.06)] motion-safe:hover:-translate-y-0.5"
      }`}
    >
      {/* Header row — click anywhere except the checkbox or
          preview button to expand. Preview & Download lives in
          the top-right corner so it stays put when the card
          expands and doesn't add to the visual stack at the
          bottom. */}
      <div className="flex flex-wrap items-start gap-3 sm:gap-4 p-4 sm:p-5">
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
          {/* Navy document icon removed — the card title + description
              already make the "this is a document" point; the icon
              was visual chrome that didn't earn its place. */}
          <span className="flex-1 min-w-0">
            <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
              <span className="text-navy font-bold text-base">
                {deliverable.name}
              </span>
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
        {/* Top-right action cluster: Complete Section (gold, only
            when this deliverable has gaps) + Preview (outlined,
            always). Both stop propagation so the click doesn't
            also expand the card. */}
        {review.totalGaps > 0 && (
          <Link
            href={`/portal/blueprint-builder?focus=${deliverable.id}`}
            onClick={(e) => e.stopPropagation()}
            title={`Complete the ${review.totalGaps} unfilled field${review.totalGaps === 1 ? "" : "s"} for ${deliverable.name}`}
            className="flex-shrink-0 inline-flex items-center gap-1.5 bg-gold text-navy hover:bg-gold-dark font-bold text-[11px] uppercase tracking-[0.1em] px-3 py-2 rounded-full transition-colors"
          >
            <Sparkles size={12} />
            Complete section
            <ArrowRight size={12} />
          </Link>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPreview(deliverable);
          }}
          className="flex-shrink-0 inline-flex items-center gap-1.5 text-navy hover:bg-cream-soft border border-card-border hover:border-navy/30 font-bold text-[11px] uppercase tracking-[0.1em] px-3 py-2 rounded-full transition-colors"
        >
          <Download size={12} />
          {previewLabel}
        </button>
      </div>

      {/* Expanded content: readiness card + section rows. Wrapped
          in AnimatedDisclosure so the card opens with a smooth
          height transition instead of snapping. The 320ms duration
          + ease-out feels intentional without being slow — Linear /
          Notion / Stripe Dashboard all use a similar timing for
          expand-in-place. */}
      <AnimatedDisclosure open={expanded} duration={320}>
        <div className="border-t border-card-border bg-white px-4 sm:px-5 py-4 space-y-4">
          <ReadinessBar
            review={review}
            onJumpToSection={(slug) => onToggleSection(slug)}
            openSectionSlug={openSectionSlug}
          />

          <div className="space-y-3">
            {deliverable.sourceSections.map((section) => {
              const isOpen = openSectionSlug === section.slug;
              return (
                <SectionRow
                  key={section.slug}
                  section={section}
                  isOpen={isOpen}
                  onToggle={() => onToggleSection(section.slug)}
                  saveFields={saveFields}
                  saveSection={saveSection}
                  setConfidence={setConfidence}
                />
              );
            })}
          </div>
        </div>
      </AnimatedDisclosure>

      {/* SHOW MORE row: readiness pill on the left, toggle button
          centered, blank spacer on the right to keep the toggle
          truly centered on the row. The pill was previously
          alongside the title — moving it here puts the readiness
          signal closest to the action ("oh I'm at 83%, let me see
          what's left"). */}
      <div className="border-t border-card-border flex items-center px-4 py-2.5 relative">
        <div className="flex-1 min-w-0">
          <ReadinessBadge pct={review.overallPct} gaps={review.totalGaps} />
        </div>
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          className="absolute left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.1em] font-bold text-grey-3 hover:text-navy transition-colors duration-200"
        >
          {expanded ? "Show less" : "Show more"}
          <ChevronDown
            size={13}
            className="transition-transform duration-[320ms] motion-reduce:transition-none"
            style={{
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        </button>
        <div className="flex-1" aria-hidden="true" />
      </div>
    </article>
  );
}

function ReadinessBar({
  review,
  onJumpToSection,
  openSectionSlug,
}: {
  review: DeliverableReview;
  onJumpToSection: (slug: MemoryFileSlug) => void;
  openSectionSlug: MemoryFileSlug | null;
}) {
  const pct = review.overallPct;
  const allGaps = review.sections.flatMap((c) => c.gaps);
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
                key={`${g.sectionSlug}.${g.fieldName}`}
                className="text-sm text-navy"
              >
                <button
                  type="button"
                  onClick={() => {
                    if (openSectionSlug !== g.sectionSlug) {
                      onJumpToSection(g.sectionSlug);
                    }
                    window.setTimeout(() => {
                      const target = document.getElementById(
                        `section-row-${g.sectionSlug}`,
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
                    · {g.sectionTitle}
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

function SectionRow({
  section,
  isOpen,
  onToggle,
  saveFields,
  saveSection,
  setConfidence,
}: {
  section: SectionDataBundle;
  isOpen: boolean;
  onToggle: () => void;
  saveFields: (args: SaveFieldsArgs) => Promise<void>;
  saveSection: (args: SaveSectionArgs) => Promise<void>;
  setConfidence: (args: SetConfidenceArgs) => Promise<void>;
}) {
  const stateColor = STATE_DOT_COLOR[section.readinessState];
  // Increment-on-click signal — every Attach press bumps this. The
  // attachments panel inside SectionFieldsCard listens for changes
  // and pops its composer open. Initial 0 = "no intent yet"; any
  // value > 0 means "open the composer." Using an incrementing
  // counter (instead of a boolean) means a second click after the
  // user dismissed the composer still re-opens it cleanly.
  const [attachSignal, setAttachSignal] = useState(0);

  const handleAttach = () => {
    setAttachSignal((n) => n + 1);
    if (!isOpen) onToggle();
  };

  return (
    <div
      id={`section-row-${section.slug}`}
      className={`rounded-lg border bg-cream/30 overflow-hidden scroll-mt-4 transition-[border-color,background-color,box-shadow] duration-200 ease-out ${
        isOpen
          ? "border-navy/20 bg-white shadow-[0_2px_8px_rgba(30,58,95,0.05)]"
          : "border-card-border hover:border-navy/15 hover:bg-cream/50"
      }`}
    >
      {/* Header is a flex row, not a single button — we need the
          Attach button to be its own click target alongside Open
          (which toggles), and nesting buttons is invalid. The
          title region is its own button so clicking the section
          name still toggles the row. */}
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="flex flex-1 items-center gap-3 min-w-0 text-left rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          <span
            className={`flex-shrink-0 w-2 h-2 rounded-full ${stateColor}`}
            aria-hidden="true"
          />
          <span className="flex-1 min-w-0 text-navy font-semibold text-sm truncate">
            {MEMORY_FILE_TITLES[section.slug]}
          </span>
        </button>

        {/* Attach + Open share the same compact pill shape (small
            border, white bg, navy uppercase label) so they read as
            a paired action set. Distinctions per Eric:
              - Attach has a gold paperclip icon (the brand's
                "uploaded thing" cue from the activity feed)
              - Open has the directional chevron that flips on
                expand
            Clicking Attach when the row is collapsed expands it
            AND signals the composer to open — see attachSignal. */}
        <button
          type="button"
          onClick={handleAttach}
          aria-label="Attach a file or link to this section"
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.1em] text-navy font-bold whitespace-nowrap px-2.5 py-1 rounded-md border border-navy/15 bg-white hover:bg-cream hover:border-gold/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          <Paperclip size={11} className="text-gold-warm" />
          Attach
        </button>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.1em] text-navy font-bold whitespace-nowrap px-2.5 py-1 rounded-md border border-navy/15 bg-white hover:bg-cream hover:border-navy/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          {isOpen ? "Close" : "Open"}
          <ChevronDown
            size={12}
            className="transition-transform duration-[320ms] motion-reduce:transition-none"
            style={{
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        </button>
      </div>

      {/* Data-entry view (SectionFieldsCard) — fields editor +
          attachments + bridge to the Blueprint page for prose
          review. Prose lives on /portal/lab/blueprint where the
          customer can read what's been drafted and polish it
          inline. unmountWhenClosed so we don't keep 16 editor
          trees mounted just to animate. */}
      <AnimatedDisclosure open={isOpen} duration={320} unmountWhenClosed>
        <div className="border-t border-card-border bg-white p-4 sm:p-5">
          <SectionFieldsCard
            slug={section.slug}
            title={section.title}
            schema={section.schema}
            attachments={section.attachments}
            fields={section.fields}
            fieldStatus={section.fieldStatus}
            otherSectionsFields={section.otherSectionsFields}
            lastUpdatedBy={section.lastUpdatedBy}
            updatedAt={section.updatedAt}
            provenance={section.provenance}
            attachOpenSignal={attachSignal}
            saveFields={saveFields}
            saveSection={saveSection}
            setConfidence={setConfidence}
          />
        </div>
      </AnimatedDisclosure>
    </div>
  );
}

// countFilled() helper removed 2026-05-09 — its only consumer was the
// "11 / 11" text on the section row header, which Eric removed as
// fluff. The same data is conveyed by the readiness dot + the
// dashboard's overall progress bar.

const STATE_DOT_COLOR: Record<SectionReadiness["state"], string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-400",
  red: "bg-amber-400",
  gray: "bg-grey-3/40",
};

function ReadinessBadge({ pct, gaps }: { pct: number; gaps: number }) {
  // Two states only: Ready (≥95%) or in-progress. The earlier
  // gray-vs-amber split read as inconsistent — same data
  // ("how done is this doc"), different colors based on a
  // 50% threshold that wasn't surfaced anywhere else. Now any
  // doc that isn't Ready uses the same amber pill, so the
  // colors carry one signal each: emerald = ready to ship,
  // amber = still has gaps. Gap count appears when there are
  // any required gaps; otherwise just the percentage.
  if (pct >= 95) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
        <CheckCircle2 size={11} />
        Ready
      </span>
    );
  }
  return (
    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
      {pct}% complete
      {gaps > 0 && ` · ${gaps} gap${gaps === 1 ? "" : "s"}`}
    </span>
  );
}

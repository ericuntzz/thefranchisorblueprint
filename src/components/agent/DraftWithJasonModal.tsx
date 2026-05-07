"use client";

/**
 * Pre-draft modal — appears when the customer clicks "Draft with Jason"
 * (or "Redraft with Jason") on a chapter card. Lets them seed the
 * upcoming Opus draft with:
 *
 *   1. Free-form instruction text ("focus on the back-of-house ops",
 *      "use a more formal tone", "we just opened a third location",
 *      etc.) — appended to the default drafting instruction.
 *
 *   2. New file uploads (this chapter's `customer-uploads` bucket).
 *      Posts to /api/agent/chapter-attachment; new attachments appear
 *      in the modal's "for this chapter" list immediately, pre-checked.
 *
 *   3. A checkbox list of every existing attachment across all of
 *      the customer's chapters. This-chapter attachments are
 *      pre-checked (they'd be loaded automatically anyway).
 *      Attachments on OTHER chapters are unchecked — the customer
 *      opts in if they want Jason to consider them when drafting.
 *
 * On confirm: calls onConfirm({extraContext, referencedAttachmentIds})
 * which the parent ChapterCard wires up to /api/agent/draft.
 *
 * UX rationale (from the TurboTax reference): give the customer a
 * brief, opinionated chance to add context BEFORE the long-running
 * agent call, so they don't watch a 90-second draft come back missing
 * the one thing they wanted to highlight. Pre-selecting the obvious
 * inputs keeps the friction low.
 */

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckSquare,
  ExternalLink,
  FileText,
  Link as LinkIcon,
  Loader2,
  Sparkles,
  Square,
  Upload,
  X,
} from "lucide-react";
import type { ChapterAttachment } from "@/lib/supabase/types";
import type { FieldDef } from "@/lib/memory/schemas";
import { SchemaFieldInput } from "./SchemaFieldInput";
import { MEMORY_FILE_TITLES } from "@/lib/memory/files";
import type { MemoryFileSlug } from "@/lib/memory/files";

type AttachmentsByChapter = Array<{
  slug: MemoryFileSlug;
  attachments: ChapterAttachment[];
}>;

type Props = {
  slug: MemoryFileSlug;
  chapterTitle: string;
  thisChapterAttachments: ChapterAttachment[];
  allAttachmentsByChapter: AttachmentsByChapter;
  /** True when the parent is mid-redraft (chapter already has prose). */
  isRedraft: boolean;
  onClose: () => void;
  onConfirm: (args: {
    extraContext: string;
    referencedAttachmentIds: string[];
  }) => Promise<void>;
};

export function DraftWithJasonModal({
  slug,
  chapterTitle,
  thisChapterAttachments,
  allAttachmentsByChapter,
  isRedraft,
  onClose,
  onConfirm,
}: Props) {
  const [extraContext, setExtraContext] = useState("");
  // Pre-select every attachment on THIS chapter — Jason loads them
  // automatically anyway, but checking them here makes the relationship
  // obvious. Other-chapter attachments start unchecked.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(thisChapterAttachments.map((a) => a.id)),
  );
  // Locally-uploaded files added during this modal session — kept here
  // so we don't have to round-trip through the page reload to show
  // them. They start checked and merge into the "this chapter"
  // section below.
  const [sessionUploads, setSessionUploads] = useState<ChapterAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  // Wall-clock time when the customer pressed "Start drafting." Drives
  // the phased-progress view so its phase indicators advance over time
  // even though we don't get real-time progress signals from the
  // synchronous /api/agent/draft endpoint. Will be replaced by real
  // job phases once the background-job refactor lands.
  const [submittingStartedAt, setSubmittingStartedAt] = useState<number | null>(null);
  // True while a draggable file is hovering the dropzone. Used to highlight
  // the border + background so the customer gets immediate visual feedback
  // that the area is "armed."
  const [dragActive, setDragActive] = useState(false);

  // ---- Proactive Jason: pre-draft readiness check ----
  // Fetched once when the modal opens. While loading, we render a
  // small placeholder. If the chapter is below MIN_DRAFTABLE_SCORE
  // (60), we swap the body to a "Jason can draft, but it'll be weak
  // unless we answer these:" panel with inline inputs for the top
  // blockers. Customer can save those, then proceed to drafting.
  // "Draft anyway" is always available so we don't trap power users.
  type Blocker = { fieldName: string; fieldDef: FieldDef };
  type Readiness = {
    score: number;
    filledRequired: number;
    totalRequired: number;
    blockers: Blocker[];
  };
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(true);
  const [blockerValues, setBlockerValues] = useState<
    Record<string, string | number | boolean | string[] | null>
  >({});
  const [savingBlockers, setSavingBlockers] = useState(false);
  const [overrideReadinessGate, setOverrideReadinessGate] = useState(false);

  useEffect(() => {
    let alive = true;
    setReadinessLoading(true);
    fetch(`/api/agent/draft-readiness?slug=${slug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        if (!alive) return;
        setReadiness({
          score: data.score,
          filledRequired: data.filledRequired,
          totalRequired: data.totalRequired,
          blockers: data.blockers ?? [],
        });
      })
      .catch((err) => {
        // Non-fatal: if readiness fetch fails, we just fall through
        // to the normal modal body. Score=100 unblocks the gate.
        console.warn("[DraftWithJasonModal] readiness fetch failed:", err);
        if (alive)
          setReadiness({
            score: 100,
            filledRequired: 0,
            totalRequired: 0,
            blockers: [],
          });
      })
      .finally(() => {
        if (alive) setReadinessLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  /** True iff the chapter is below the draftability threshold AND
   *  the customer hasn't explicitly said "draft anyway". */
  const showBlockerGate =
    !!readiness &&
    readiness.score < 60 &&
    readiness.blockers.length > 0 &&
    !overrideReadinessGate;

  function setBlocker(fieldName: string, v: typeof blockerValues[string]) {
    setBlockerValues((prev) => ({ ...prev, [fieldName]: v }));
  }

  /** Save every blocker that has a non-empty value, then either
   *  (a) re-fetch readiness so the customer sees an updated score,
   *  or (b) if everything was answered, drop into the normal modal
   *  view. We don't auto-trigger the draft — the customer chooses
   *  when to start. */
  async function saveBlockers(): Promise<void> {
    if (!readiness) return;
    setSavingBlockers(true);
    try {
      // POST to the queue's saveQueueAnswer is server-action only.
      // For modal use, we hit a thin endpoint via the same route.
      // Easiest path: reuse /api/agent/chapter-attachment-style
      // contract isn't quite right; we need a generic field write.
      // The chat tool's update_memory_field server-side function is
      // best, but it's only invokable through the chat. Simplest:
      // call writeMemoryFields via a new tiny server action wrapper
      // — but to avoid that round-trip we POST to a small dedicated
      // endpoint /api/agent/save-fields.
      const toSave: Record<string, unknown> = {};
      for (const b of readiness.blockers) {
        const v = blockerValues[b.fieldName];
        if (v == null) continue;
        if (typeof v === "string" && v.trim() === "") continue;
        if (Array.isArray(v) && v.length === 0) continue;
        toSave[b.fieldName] = v;
      }
      if (Object.keys(toSave).length === 0) {
        setOverrideReadinessGate(true); // nothing to save → user just wants to proceed
        return;
      }
      const res = await fetch("/api/agent/save-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, changes: toSave }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      // Re-fetch readiness so the score + remaining blockers update.
      const refreshed = await fetch(
        `/api/agent/draft-readiness?slug=${slug}`,
      ).then((r) => r.json());
      setReadiness({
        score: refreshed.score,
        filledRequired: refreshed.filledRequired,
        totalRequired: refreshed.totalRequired,
        blockers: refreshed.blockers ?? [],
      });
      setBlockerValues({});
      // If we cleared every blocker, also drop the gate so the modal
      // moves on to the normal view automatically.
      if (refreshed.score >= 60 || (refreshed.blockers ?? []).length === 0) {
        setOverrideReadinessGate(true);
      }
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingBlockers(false);
    }
  }

  // ESC closes; trap is intentionally light — page underneath is
  // still scrollable but the modal is centered and high-z so any
  // mis-clicks don't break flow.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting && !uploading) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, submitting, uploading]);

  // Merge session uploads into the "this chapter" list so they appear
  // alongside pre-existing ones with consistent UX.
  const thisChapterAll = useMemo(
    () => [...thisChapterAttachments, ...sessionUploads],
    [thisChapterAttachments, sessionUploads],
  );
  const otherChapters = useMemo(
    () => allAttachmentsByChapter.filter((c) => c.slug !== slug),
    [allAttachmentsByChapter, slug],
  );

  function toggleId(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Native HTML5 drag-and-drop wiring for the upload zone. The dropzone
  // is a <label> wrapping a hidden <input type="file"> — that gives us
  // click-to-choose for free (clicking the label opens the OS file
  // picker, which fires the input's `change` event). But drag-and-drop
  // requires explicit handlers: the browser's default on a `drop` event
  // is to *navigate to* the dropped file (or open it in a new tab),
  // which is why dropping a file did nothing useful before this. The
  // four handlers below intercept the gesture and pipe the file through
  // `uploadFile()`.
  //
  // `dragOver` and `dragEnter` MUST call preventDefault — that's the
  // contract that tells the browser "yes, this element accepts drops."
  // Without it, the drop event never fires.
  function onDragEnter(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (uploading || submitting) return;
    setDragActive(true);
  }
  function onDragOver(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (uploading || submitting) return;
    // Hint the cursor — improves the UX in browsers that don't already.
    e.dataTransfer.dropEffect = "copy";
    if (!dragActive) setDragActive(true);
  }
  function onDragLeave(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    // Bubbling drag events fire dragleave when entering child elements,
    // so we only clear the highlight when the drag has truly left the
    // label's bounding box. relatedTarget is the element being entered;
    // null means we've left the document, and otherwise we check
    // containment.
    const next = e.relatedTarget as Node | null;
    if (!next || !e.currentTarget.contains(next)) setDragActive(false);
  }
  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (uploading || submitting) return;
    const file = e.dataTransfer?.files?.[0];
    if (file) void uploadFile(file);
  }

  async function uploadFile(file: File) {
    setUploadErr(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("slug", slug);
      fd.append("file", file);
      const res = await fetch("/api/agent/chapter-attachment", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const j = (await res.json()) as { attachment: ChapterAttachment };
      // Append + auto-select.
      setSessionUploads((prev) => [...prev, j.attachment]);
      setSelectedIds((prev) => new Set(prev).add(j.attachment.id));
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function confirm() {
    setSubmitErr(null);
    setSubmittingStartedAt(Date.now());
    setSubmitting(true);
    try {
      await onConfirm({
        extraContext: extraContext.trim(),
        referencedAttachmentIds: [...selectedIds],
      });
      // Parent owns the success path (typically: triggers a draft +
      // reloads the page when done). We don't close on success — if
      // the parent reloads, the modal disappears anyway.
    } catch (e) {
      setSubmitErr(e instanceof Error ? e.message : "Draft failed");
      setSubmitting(false);
    }
  }

  // Has the customer typed notes or changed selections? If so, a
  // backdrop click is more likely to be an accidental dismiss than
  // an intent to abandon. We require an explicit close.
  const hasUnsavedInput =
    extraContext.trim().length > 0 ||
    sessionUploads.length > 0 ||
    // Selection drift from "default = this chapter's attachments" means
    // the customer has touched the checkbox list.
    !setEqualsByMembership(
      selectedIds,
      thisChapterAttachments.map((a) => a.id),
    );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-2 sm:p-4 bg-navy/40 backdrop-blur-sm"
      onClick={(e) => {
        // Click on backdrop closes — but only if we're not in the
        // middle of an upload/submit (would be jarring) AND the user
        // hasn't typed anything yet. Once they have unsaved input,
        // require explicit close so a stray tap doesn't wipe their work.
        if (
          e.target === e.currentTarget &&
          !submitting &&
          !uploading &&
          !hasUnsavedInput
        ) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-[640px] w-full max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-navy/5">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.18em] text-gold-warm font-bold mb-0.5">
                {isRedraft ? "Redraft" : "Draft"} with Jason
              </div>
              <h2 className="text-navy font-extrabold text-xl leading-tight">
                {chapterTitle}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting || uploading}
              className="-mr-1 -mt-1 p-2 rounded-full text-grey-3 hover:text-navy hover:bg-grey-1 transition-colors disabled:opacity-50 flex-shrink-0"
              title="Close"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
          <p className="text-grey-3 text-sm mt-2">
            {submitting
              ? "Sit tight. We'll keep you posted as Jason works through your context."
              : "Anything else Jason should know before drafting? Add notes, drop in references, or pick from what you've already uploaded."}
          </p>
        </div>

        {submitting && submittingStartedAt !== null && (
          <DraftingProgressView startedAt={submittingStartedAt} />
        )}

        {/* Body — scrollable so long attachment lists don't blow out
            the viewport. Hidden while a draft is in flight; the
            DraftingProgressView replaces it with phased progress. */}
        <div
          className={`px-5 sm:px-6 py-5 space-y-5 overflow-y-auto ${submitting ? "hidden" : ""}`}
        >
          {readinessLoading ? (
            <div className="flex items-center gap-2 text-grey-3 text-xs italic">
              <Loader2 size={12} className="animate-spin" />
              Checking what Jason needs to write a credible draft…
            </div>
          ) : showBlockerGate ? (
            <BlockerGate
              readiness={readiness}
              values={blockerValues}
              onChange={setBlocker}
              saving={savingBlockers}
              onSave={saveBlockers}
              onSkip={() => setOverrideReadinessGate(true)}
            />
          ) : (
            <>
          {/* Free-form instruction */}
          <div>
            <label className="block text-[11px] uppercase tracking-[0.16em] text-gold-warm font-bold mb-2">
              Notes for Jason
            </label>
            <textarea
              value={extraContext}
              onChange={(e) => setExtraContext(e.target.value)}
              rows={3}
              placeholder="e.g. Focus on the drive-through workflow. Or: We just opened our 3rd location in Tupelo — make sure it shows up. Or: Use a more formal tone."
              disabled={submitting}
              className="w-full rounded-lg border border-navy/15 bg-white px-3 py-2 text-[14px] text-navy placeholder-grey-4 placeholder:italic focus:border-gold focus:ring-2 focus:ring-gold/20 outline-none transition resize-y min-h-[88px] disabled:opacity-50"
            />
          </div>

          {/* Upload */}
          <div>
            <label className="block text-[11px] uppercase tracking-[0.16em] text-gold-warm font-bold mb-2">
              Add a new reference
            </label>
            <label
              onDragEnter={onDragEnter}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-1.5 sm:gap-3 rounded-lg border-2 border-dashed px-5 py-5 sm:py-6 text-sm cursor-pointer transition-colors ${
                dragActive
                  ? "border-gold bg-gold/15 ring-2 ring-gold/30"
                  : "border-navy/20 bg-cream/30 hover:border-gold hover:bg-gold/5"
              } ${
                uploading || submitting ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              {uploading ? (
                <>
                  <Loader2 size={20} className="animate-spin text-gold-warm" />
                  <span className="text-navy font-semibold text-[15px]">
                    Uploading…
                  </span>
                </>
              ) : dragActive ? (
                <span className="inline-flex items-center gap-2.5">
                  <Upload size={20} className="text-gold flex-shrink-0" />
                  <span className="text-navy font-bold text-[15px]">
                    Release to upload
                  </span>
                </span>
              ) : (
                <>
                  <span className="inline-flex items-center gap-2.5">
                    <Upload
                      size={20}
                      className="text-gold-warm flex-shrink-0"
                    />
                    <span className="text-navy font-semibold text-[15px]">
                      Drop a file or click to choose
                    </span>
                  </span>
                  <span className="text-grey-4 text-xs sm:text-[13px] sm:before:content-['—_'] sm:before:mr-0.5">
                    auto-attached + pre-selected below
                  </span>
                </>
              )}
              <input
                type="file"
                className="sr-only"
                accept=".pdf,.docx,.doc,.txt,.md,.markdown,.csv,.json,.xml,.yaml,.yml,.toml,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/*"
                disabled={uploading || submitting}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadFile(f);
                  // Reset so picking the same file twice in a row still fires.
                  e.target.value = "";
                }}
              />
            </label>
            {uploadErr && (
              <p className="mt-2 text-xs text-red-700">{uploadErr}</p>
            )}
          </div>

          {/* This chapter's attachments */}
          {thisChapterAll.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] uppercase tracking-[0.16em] text-gold-warm font-bold">
                  References on this chapter
                </label>
                <span className="text-[10px] text-grey-4">
                  Pre-selected — Jason loads these by default
                </span>
              </div>
              <ul className="space-y-1.5">
                {thisChapterAll.map((a) => (
                  <AttachmentCheckRow
                    key={a.id}
                    attachment={a}
                    checked={selectedIds.has(a.id)}
                    onToggle={() => toggleId(a.id)}
                    fromLabel={null}
                  />
                ))}
              </ul>
            </div>
          )}

          {/* Other chapters' attachments */}
          {otherChapters.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] uppercase tracking-[0.16em] text-gold-warm font-bold">
                  References on other chapters
                </label>
                <span className="text-[10px] text-grey-4">
                  Tick any that should inform this draft
                </span>
              </div>
              <ul className="space-y-1.5">
                {otherChapters.flatMap((c) =>
                  c.attachments.map((a) => (
                    <AttachmentCheckRow
                      key={a.id}
                      attachment={a}
                      checked={selectedIds.has(a.id)}
                      onToggle={() => toggleId(a.id)}
                      fromLabel={MEMORY_FILE_TITLES[c.slug]}
                    />
                  )),
                )}
              </ul>
            </div>
          )}

          {thisChapterAll.length === 0 && otherChapters.length === 0 && (
            <p className="text-xs text-grey-4 italic">
              No references uploaded yet. You can drop one in above, or just
              hit &ldquo;Start drafting&rdquo; — Jason will work from your
              Memory.
            </p>
          )}

          {submitErr && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800 flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{submitErr}</span>
            </div>
          )}
            </>
          )}
        </div>

        {/* Footer — hidden during draft submission so the
            DraftingProgressView is the visual focal point. The
            controls below are inert anyway while submitting=true,
            and removing them removes a competing visual element. */}
        {!submitting && !showBlockerGate && (
          <div className="px-5 sm:px-6 py-4 border-t border-navy/5 bg-cream/20 flex items-center justify-end gap-2 rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="text-grey-3 hover:text-navy font-semibold text-sm px-4 py-2 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={uploading}
              className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-xs uppercase tracking-[0.1em] px-6 py-3 rounded-full hover:bg-gold-dark disabled:opacity-50 transition-colors"
            >
              <Sparkles size={13} /> Start drafting
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * True iff the set contains exactly the members listed (regardless of
 * order). Used to detect whether the customer has touched the
 * checkbox list — if it's still equal to this-chapter-default, a
 * backdrop click is safe to dismiss.
 */
function setEqualsByMembership<T>(set: Set<T>, members: T[]): boolean {
  if (set.size !== members.length) return false;
  for (const m of members) if (!set.has(m)) return false;
  return true;
}

/**
 * Phased progress surface shown while a draft is in flight.
 *
 * The /api/agent/draft endpoint is currently synchronous — it doesn't
 * stream phase events back. We compensate by mapping wall-clock time
 * to a believable phase progression based on observed Opus draft
 * timings:
 *
 *   0–6s     Reading your Memory
 *   6–14s    Reviewing references
 *   14s+     Drafting your chapter (held until completion)
 *
 * When the background-job refactor lands (chapter_draft_jobs table +
 * worker writing real `phase` values), this component swaps to read
 * those values via polling — same UI, real signals.
 *
 * UX rationale: the prior "Drafting…" pill at the bottom of the modal
 * gave the customer no signal of progress over a 30–90 second wait,
 * which lengthened perceived time and pulled them toward refresh-the-
 * page. Phased copy is lower-stress because every few seconds
 * something visibly changes — even if the underlying signal is timed
 * rather than measured.
 */
function DraftingProgressView({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const elapsedSec = Math.max(0, (now - startedAt) / 1000);

  const phases: Array<{ id: string; label: string; startsAt: number }> = [
    { id: "reading", label: "Reading your Memory", startsAt: 0 },
    { id: "reviewing", label: "Reviewing your references", startsAt: 6 },
    { id: "drafting", label: "Drafting your chapter", startsAt: 14 },
  ];

  const phaseStatus: Array<"done" | "active" | "pending"> = phases.map(
    (p, i) => {
      const next = phases[i + 1];
      // Last phase stays "active" indefinitely — the request will
      // resolve and the modal will close before this misleads anyone.
      if (next && elapsedSec >= next.startsAt) return "done";
      if (elapsedSec >= p.startsAt) return "active";
      return "pending";
    },
  );

  // Friendly elapsed display: "0:34". Resets on remount, which is
  // what we want — each draft attempt starts at zero.
  const mm = Math.floor(elapsedSec / 60);
  const ss = Math.floor(elapsedSec % 60).toString().padStart(2, "0");
  const elapsedLabel = `${mm}:${ss}`;

  return (
    <div className="px-5 sm:px-7 py-7 sm:py-9 flex flex-col items-center text-center">
      {/* Animated icon — gold sparkle inside a soft halo */}
      <div className="relative w-16 h-16 mb-4">
        <div
          className="absolute inset-0 rounded-full bg-gold/15 animate-ping"
          aria-hidden
          style={{ animationDuration: "2s" }}
        />
        <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-navy to-navy-light flex items-center justify-center text-gold shadow-md">
          <Sparkles size={26} className="animate-pulse" style={{ animationDuration: "1.6s" }} />
        </div>
      </div>

      <h3 className="text-navy font-extrabold text-lg sm:text-xl leading-tight mb-1">
        Jason is drafting your chapter
      </h3>
      <p className="text-grey-3 text-sm sm:text-[15px] mb-6 max-w-[420px]">
        This typically takes 30–90 seconds. Feel free to keep this open — we&apos;ll show you what&apos;s happening as it goes.
      </p>

      {/* Phased checklist */}
      <ul className="w-full max-w-[360px] space-y-2.5 mb-5">
        {phases.map((p, i) => {
          const status = phaseStatus[i];
          return (
            <li
              key={p.id}
              className={`flex items-center gap-3 rounded-lg px-4 py-2.5 border transition-colors ${
                status === "active"
                  ? "bg-gold/10 border-gold/30"
                  : status === "done"
                    ? "bg-cream/40 border-navy/5"
                    : "bg-grey-1 border-transparent"
              }`}
            >
              <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                {status === "done" ? (
                  <CheckSquare size={18} className="text-emerald-600" />
                ) : status === "active" ? (
                  <Loader2 size={16} className="animate-spin text-gold-warm" />
                ) : (
                  <Square size={16} className="text-grey-4" />
                )}
              </span>
              <span
                className={`text-sm font-semibold ${
                  status === "active"
                    ? "text-navy"
                    : status === "done"
                      ? "text-navy/70"
                      : "text-grey-4"
                }`}
              >
                {p.label}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-3 text-xs text-grey-4">
        <span className="tabular-nums font-semibold text-navy/60">{elapsedLabel}</span>
        <span aria-hidden>·</span>
        <span className="italic">
          Don&apos;t refresh — your draft is on the way.
        </span>
      </div>
    </div>
  );
}

function AttachmentCheckRow({
  attachment,
  checked,
  onToggle,
  fromLabel,
}: {
  attachment: ChapterAttachment;
  checked: boolean;
  onToggle: () => void;
  fromLabel: string | null;
}) {
  const Icon = attachment.kind === "file" ? FileText : LinkIcon;
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-start gap-2 rounded-lg px-3 py-2 text-xs text-left transition-colors ${
          checked
            ? "bg-gold/10 border border-gold/40"
            : "bg-grey-1 border border-transparent hover:bg-grey-1/60"
        }`}
      >
        {checked ? (
          <CheckSquare
            size={14}
            className="text-gold-warm mt-0.5 flex-shrink-0"
          />
        ) : (
          <Square size={14} className="text-grey-3 mt-0.5 flex-shrink-0" />
        )}
        <Icon size={13} className="text-grey-3 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-navy font-semibold truncate inline-flex items-center gap-1">
            {attachment.label}
            {attachment.kind === "link" && (
              <ExternalLink size={9} className="text-grey-4 flex-shrink-0" />
            )}
          </div>
          {fromLabel && (
            <div className="text-grey-4 text-[10px] uppercase tracking-wider truncate">
              from {fromLabel}
            </div>
          )}
        </div>
      </button>
    </li>
  );
}

/**
 * Blocker gate — the proactive-Jason face of the modal.
 *
 * Rendered when the chapter readiness score is below 60. Each
 * blocker row uses the same SchemaFieldInput primitive the Question
 * Queue uses — same look + same input behavior across surfaces.
 *
 * Two exits:
 *   1. "Save & continue" — write the inline answers, re-fetch
 *      readiness; the parent drops the gate when score crosses 60
 *      OR every blocker has been answered.
 *   2. "Skip for now, draft anyway" — explicit override. Customer
 *      sees the warning and knows the draft will be skeleton-y; we
 *      let them through because trapping them is worse UX than a
 *      weak draft.
 */
function BlockerGate({
  readiness,
  values,
  onChange,
  saving,
  onSave,
  onSkip,
}: {
  readiness: {
    score: number;
    filledRequired: number;
    totalRequired: number;
    blockers: Array<{ fieldName: string; fieldDef: FieldDef }>;
  };
  values: Record<string, string | number | boolean | string[] | null>;
  onChange: (
    fieldName: string,
    v: string | number | boolean | string[] | null,
  ) => void;
  saving: boolean;
  onSave: () => Promise<void>;
  onSkip: () => void;
}) {
  const filledHere = Object.values(values).filter((v) => {
    if (v == null) return false;
    if (typeof v === "string") return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  }).length;
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-2">
        <AlertCircle
          size={16}
          className="text-amber-700 mt-0.5 flex-shrink-0"
        />
        <div>
          <div className="text-amber-900 font-bold text-sm mb-0.5">
            Jason can draft this — but it&apos;ll be weak.
          </div>
          <p className="text-amber-900/85 text-xs leading-relaxed">
            You&apos;re at <strong>{readiness.score}%</strong> of the
            required inputs ({readiness.filledRequired} of{" "}
            {readiness.totalRequired}). Answer the {readiness.blockers.length}{" "}
            below and Jason can write something the customer should actually
            verify.
          </p>
        </div>
      </div>

      <ul className="space-y-4">
        {readiness.blockers.map((b) => (
          <li key={b.fieldName} className="space-y-1.5">
            <label className="block text-sm font-semibold text-navy">
              {b.fieldDef.label}
              <span className="text-gold-warm ml-1">*</span>
            </label>
            {b.fieldDef.helpText && (
              <p className="text-xs text-grey-3 leading-relaxed">
                {b.fieldDef.helpText}
              </p>
            )}
            <SchemaFieldInput
              fieldDef={b.fieldDef}
              value={values[b.fieldName] ?? null}
              onChange={(v) => onChange(b.fieldName, v)}
              compact
            />
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-navy/5">
        <button
          type="button"
          onClick={onSkip}
          disabled={saving}
          className="text-grey-3 hover:text-navy text-xs font-semibold py-2 transition-colors disabled:opacity-50"
        >
          Skip and draft anyway
        </button>
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={saving || filledHere === 0}
          className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-xs uppercase tracking-[0.1em] px-5 py-3 rounded-full hover:bg-gold-dark disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <>
              <Loader2 size={13} className="animate-spin" /> Saving…
            </>
          ) : (
            <>
              Save {filledHere > 0 ? `${filledHere} ` : ""}&amp; continue
            </>
          )}
        </button>
      </div>
    </div>
  );
}

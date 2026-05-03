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
  // True while a draggable file is hovering the dropzone. Used to highlight
  // the border + background so the customer gets immediate visual feedback
  // that the area is "armed."
  const [dragActive, setDragActive] = useState(false);

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
    setSubmitting(true);
    setSubmitErr(null);
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
            Anything else Jason should know before drafting? Add notes, drop in
            references, or pick from what you&apos;ve already uploaded.
          </p>
        </div>

        {/* Body — scrollable so long attachment lists don't blow out
            the viewport. */}
        <div className="px-5 sm:px-6 py-5 space-y-5 overflow-y-auto">
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
              className={`flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-1 sm:gap-2 rounded-lg border-2 border-dashed px-4 py-3 text-xs cursor-pointer transition-colors ${
                dragActive
                  ? "border-gold bg-gold/15 ring-2 ring-gold/30"
                  : "border-navy/20 bg-cream/30 hover:border-gold hover:bg-gold/5"
              } ${
                uploading || submitting ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              {uploading ? (
                <>
                  <Loader2 size={16} className="animate-spin text-gold-warm" />
                  <span className="text-navy font-semibold">Uploading…</span>
                </>
              ) : dragActive ? (
                <span className="inline-flex items-center gap-2">
                  <Upload size={16} className="text-gold flex-shrink-0" />
                  <span className="text-navy font-bold">
                    Release to upload
                  </span>
                </span>
              ) : (
                <>
                  <span className="inline-flex items-center gap-2">
                    <Upload
                      size={16}
                      className="text-gold-warm flex-shrink-0"
                    />
                    <span className="text-navy font-semibold">
                      Drop a file or click to choose
                    </span>
                  </span>
                  <span className="text-grey-4 sm:before:content-['—_'] sm:before:mr-0.5">
                    auto-attached + pre-selected below
                  </span>
                </>
              )}
              <input
                type="file"
                className="sr-only"
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
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-navy/5 bg-cream/20 flex items-center justify-end gap-2 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting || uploading}
            className="text-grey-3 hover:text-navy font-semibold text-sm px-4 py-2 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={submitting || uploading}
            className="inline-flex items-center gap-2 bg-gold text-navy font-bold text-xs uppercase tracking-[0.1em] px-6 py-3 rounded-full hover:bg-gold-dark disabled:opacity-50 transition-colors"
          >
            {submitting ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Drafting…
              </>
            ) : (
              <>
                <Sparkles size={13} /> Start drafting
              </>
            )}
          </button>
        </div>
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

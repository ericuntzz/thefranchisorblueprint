"use client";

/**
 * DocPromptCard — the inline "got a doc?" upload affordance shown on
 * chapter pages and the question queue.
 *
 * Only renders when the chapter has zero attachments AND a doc prompt
 * is configured for that chapter (see lib/memory/doc-prompts.ts) AND
 * the customer hasn't dismissed it this session.
 *
 * Drag-drop OR click-to-upload. On success, the file goes through
 * /api/agent/chapter-attachment scoped to the given slug — same
 * pipeline as the in-chapter References panel. Page revalidates so
 * the prompt disappears (chapter now has an attachment).
 *
 * Designed to land in one breath: prompt sentence + 3 example chips
 * + a single dropzone + Skip / Dismiss. No multi-step UI inside the
 * card — that's what the multi-step intake flow is for.
 */

import { useState } from "react";
import { Loader2, Plus, Sparkles, Upload, X } from "lucide-react";
import type { DocPrompt } from "@/lib/memory/doc-prompts";

type Props = {
  slug: string;
  /** The DocPrompt config for this chapter. */
  prompt: DocPrompt;
  /** Compact variant — used inside the Question Queue's question
   *  card where vertical space is limited. */
  compact?: boolean;
};

export function DocPromptCard({ slug, prompt, compact }: Props) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [uploaded, setUploaded] = useState<string | null>(null);

  if (dismissed) return null;

  async function uploadFile(file: File) {
    setErr(null);
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
      const j = (await res.json()) as { attachment?: { label?: string } };
      setUploaded(j.attachment?.label ?? file.name);
      // Soft refresh so the parent re-reads attachments and the
      // prompt naturally drops out (chapter no longer has zero
      // attachments). Page reload mirrors the existing attachment-
      // upload pattern elsewhere in the app.
      setTimeout(() => {
        if (typeof window !== "undefined") window.location.reload();
      }, 800);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
      setUploading(false);
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
    if (uploading) return;
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
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  }

  // Success state — short-lived; the page reload above replaces it.
  if (uploaded) {
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 flex items-center gap-2">
        <Sparkles size={14} className="text-emerald-600 flex-shrink-0" />
        <span className="text-sm text-emerald-900">
          <strong className="font-bold">{uploaded}</strong> uploaded — refreshing
          so Jason can pull from it…
        </span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 relative">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="absolute top-2 right-2 text-amber-700/60 hover:text-amber-900 transition-colors"
        >
          <X size={12} />
        </button>
        <div className="flex items-start gap-2 pr-5">
          <Plus
            size={14}
            className="text-amber-700 mt-0.5 flex-shrink-0"
          />
          <div className="text-sm text-amber-950 leading-snug pr-1">
            <span className="font-semibold">Got {prompt.shortLabel}?</span>{" "}
            <label
              className={`underline decoration-amber-400 decoration-2 underline-offset-2 cursor-pointer hover:text-amber-900 ${uploading ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              {uploading ? "Uploading…" : "Drop it here"}
              <input
                type="file"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadFile(f);
                }}
              />
            </label>{" "}
            and Jason answers most of this for you.
          </div>
        </div>
        {err && (
          <p className="text-xs text-red-700 mt-1.5 ml-6">{err}</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-5 relative shadow-sm">
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss prompt"
        className="absolute top-3 right-3 p-1.5 text-amber-800 hover:text-amber-950 hover:bg-amber-200 rounded-full transition-colors"
        title="Skip — I'll add docs later"
      >
        <X size={14} />
      </button>
      <div className="flex items-start gap-3 mb-3 pr-6">
        <Sparkles size={18} className="text-amber-700 mt-0.5 flex-shrink-0" />
        <div>
          <div className="text-[11px] uppercase tracking-[0.12em] text-amber-800 font-bold mb-1">
            Skip the typing
          </div>
          <p className="text-amber-950 text-[15px] leading-relaxed">
            {prompt.prompt}
          </p>
        </div>
      </div>

      {/* Example chips — operator can scan to know what we mean. */}
      <div className="flex flex-wrap gap-1.5 mb-3 pl-9">
        {prompt.examples.map((ex) => (
          <span
            key={ex}
            className="inline-flex items-center text-[11px] uppercase tracking-[0.06em] font-bold text-amber-900 bg-amber-200 border border-amber-300 px-2 py-0.5 rounded-full"
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
        className={`flex items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-4 text-sm transition-colors cursor-pointer ${
          dragActive
            ? "border-amber-500 bg-amber-100"
            : "border-amber-300 bg-white hover:border-amber-500 hover:bg-amber-50"
        } ${uploading ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        {uploading ? (
          <>
            <Loader2 size={16} className="animate-spin text-amber-700" />
            <span className="text-amber-900 font-semibold">Uploading…</span>
          </>
        ) : (
          <>
            <Upload size={16} className="text-amber-700" />
            <span className="text-amber-900 font-semibold">
              Drop a file or click to choose
            </span>
            <span className="text-amber-700/70 text-xs">
              · PDF, DOC, TXT, MD, or images
            </span>
          </>
        )}
        <input
          type="file"
          className="sr-only"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadFile(f);
          }}
        />
      </label>

      {err && <p className="mt-2 text-xs text-red-700">{err}</p>}
    </div>
  );
}

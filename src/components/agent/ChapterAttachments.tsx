"use client";

/**
 * Per-chapter attachments panel. Renders the list of files + links the
 * customer has added to this chapter, plus an "Attach reference" CTA
 * that pops a small composer for either a file upload or a URL save.
 *
 * Sits in the chapter card footer (or, when the chapter is empty, near
 * the empty-state CTAs). Uses the /api/agent/chapter-attachment endpoint
 * for both directions.
 *
 * The agent reads attachments at draft time — labels + excerpts get
 * threaded into Opus's prompt context so chapters drafted after an
 * attachment lands incorporate the new material.
 */

import { useState } from "react";
import {
  ExternalLink,
  FileText,
  Link as LinkIcon,
  Loader2,
  Paperclip,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { ChapterAttachment } from "@/lib/supabase/types";

type Props = {
  slug: string;
  attachments: ChapterAttachment[];
};

export function ChapterAttachments({ slug, attachments }: Props) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function deleteOne(id: string) {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/agent/chapter-attachment", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, attachmentId: id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      if (typeof window !== "undefined") window.location.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 pt-3 border-t border-navy/5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-bold text-navy mb-0.5">
            <Paperclip size={12} className="text-gold-warm" />
            Upload docs to auto-fill answers
            {attachments.length > 0 && (
              <span className="text-grey-3 font-semibold">({attachments.length})</span>
            )}
          </div>
          {/* The empty-state benefit copy used to render only when
              there were no attachments, but the value prop applies
              both ways — uploading more always speeds up the
              draft. Keeping it persistent saves the customer from
              having to remember why they'd want to attach. */}
          <p className="text-xs text-grey-3 leading-relaxed">
            Drop a P&amp;L, brand guide, ops manual, or anything else you
            already have. Jason AI reads each one and pre-fills the
            fields below — no re-typing what&apos;s in your existing docs.
          </p>
        </div>
        {!composerOpen && (
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            disabled={busy}
            className="flex-shrink-0 inline-flex items-center gap-1.5 bg-gold text-navy hover:bg-gold-dark font-bold text-xs uppercase tracking-[0.1em] px-4 py-2 rounded-full transition-colors disabled:opacity-50"
          >
            <Plus size={12} /> Attach
          </button>
        )}
      </div>

      {attachments.length > 0 && (
        <ul className="space-y-1.5 mb-2">
          {attachments.map((a) => (
            <AttachmentRow
              key={a.id}
              attachment={a}
              onDelete={() => deleteOne(a.id)}
              busy={busy}
            />
          ))}
        </ul>
      )}

      {composerOpen && (
        <AttachmentComposer
          slug={slug}
          onClose={() => setComposerOpen(false)}
          onError={setErr}
        />
      )}

      {err && (
        <div className="mt-2 rounded-lg bg-red-50 border border-red-200 px-2 py-1 text-xs text-red-800">
          {err}
        </div>
      )}
    </div>
  );
}

function AttachmentRow({
  attachment,
  onDelete,
  busy,
}: {
  attachment: ChapterAttachment;
  onDelete: () => void;
  busy: boolean;
}) {
  const Icon = attachment.kind === "file" ? FileText : LinkIcon;
  const sizeLabel =
    attachment.kind === "file" && attachment.size_bytes != null
      ? formatBytes(attachment.size_bytes)
      : null;
  return (
    <li className="flex items-start gap-2 rounded-lg bg-grey-1 px-3 py-2 text-xs">
      <Icon
        size={13}
        className="text-gold-warm mt-0.5 flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-navy font-semibold truncate">
          {attachment.kind === "link" ? (
            <a
              href={attachment.ref}
              target="_blank"
              rel="noreferrer noopener"
              className="hover:text-gold transition-colors inline-flex items-center gap-1 truncate"
            >
              <span className="truncate">{attachment.label}</span>
              <ExternalLink size={9} className="flex-shrink-0" />
            </a>
          ) : (
            <span className="truncate">{attachment.label}</span>
          )}
        </div>
        {(attachment.kind === "link" || sizeLabel) && (
          <div className="text-grey-3 text-xs truncate">
            {attachment.kind === "link" ? attachment.ref : sizeLabel}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        title="Remove"
        className="text-grey-3 hover:text-red-700 transition-colors flex-shrink-0 mt-0.5 disabled:opacity-50"
      >
        <Trash2 size={11} />
      </button>
    </li>
  );
}

function AttachmentComposer({
  slug,
  onClose,
  onError,
}: {
  slug: string;
  onClose: () => void;
  onError: (msg: string | null) => void;
}) {
  const [mode, setMode] = useState<"file" | "link">("file");
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  async function uploadFile(file: File) {
    onError(null);
    setBusy(true);
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
      if (typeof window !== "undefined") window.location.reload();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Upload failed");
      setBusy(false);
    }
  }

  async function saveLink(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    onError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/agent/chapter-attachment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          url: url.trim(),
          label: label.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      if (typeof window !== "undefined") window.location.reload();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Save failed");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-navy/15 bg-cream/50 p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="inline-flex rounded-full bg-white border border-card-border p-0.5 text-xs uppercase tracking-wider font-bold">
          <button
            type="button"
            onClick={() => setMode("file")}
            disabled={busy}
            className={`px-3 py-1 rounded-full transition-colors ${
              mode === "file"
                ? "bg-navy text-cream"
                : "text-grey-3 hover:text-navy"
            }`}
          >
            File
          </button>
          <button
            type="button"
            onClick={() => setMode("link")}
            disabled={busy}
            className={`px-3 py-1 rounded-full transition-colors ${
              mode === "link"
                ? "bg-navy text-cream"
                : "text-grey-3 hover:text-navy"
            }`}
          >
            Link
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="text-grey-3 hover:text-navy transition-colors disabled:opacity-50"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>

      {mode === "file" ? (
        <label
          className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-navy/20 bg-white px-4 py-6 text-xs text-grey-3 hover:border-gold hover:bg-gold/5 cursor-pointer transition-colors ${
            busy ? "opacity-60 cursor-not-allowed" : ""
          }`}
        >
          {busy ? (
            <>
              <Loader2 size={20} className="animate-spin text-gold-warm" />
              <span className="text-navy font-semibold">Uploading…</span>
            </>
          ) : (
            <>
              <Upload size={20} className="text-gold-warm" />
              <span className="text-navy font-semibold">
                Drop a file or click to choose
              </span>
              <span className="text-grey-3 text-[11px]">
                Up to 10 MB. Text/markdown files are ingested directly; PDFs &amp; images attach as references.
              </span>
            </>
          )}
          <input
            type="file"
            className="sr-only"
            accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.png,.jpg,.jpeg,.heic,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain,image/*"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadFile(f);
            }}
          />
        </label>
      ) : (
        <form onSubmit={saveLink} className="space-y-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/page-with-useful-info"
            disabled={busy}
            className="w-full rounded-lg border border-navy/15 bg-white px-3 py-2 text-[13px] text-navy placeholder-grey-4 placeholder:italic focus:border-gold focus:ring-2 focus:ring-gold/20 outline-none transition"
            required
          />
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional — defaults to the page title)"
            disabled={busy}
            className="w-full rounded-lg border border-navy/15 bg-white px-3 py-2 text-[13px] text-navy placeholder-grey-4 placeholder:italic focus:border-gold focus:ring-2 focus:ring-gold/20 outline-none transition"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy || !url.trim()}
              className="inline-flex items-center gap-1.5 bg-navy text-cream font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-full hover:bg-navy-dark disabled:opacity-50 transition-colors"
            >
              {busy ? (
                <>
                  <Loader2 size={11} className="animate-spin" /> Saving…
                </>
              ) : (
                <>Save link</>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return "<1 KB";
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

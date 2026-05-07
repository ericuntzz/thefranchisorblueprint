"use client";

/**
 * CustomerRedlinesPanel — slide-out drawer the customer opens to see
 * the full thread of redline notes Jason (or another admin reviewer)
 * has left on their chapter.
 *
 * Mirrors the admin RedlineThread component but read-mostly: the
 * customer can mark redlines resolved/unresolved, but cannot create,
 * edit, or delete them. Reads + writes via /api/agent/redlines, which
 * RLS-scopes to the current customer's own rows.
 *
 * Triggered by clicking the redline badge in ChapterToolbar. Panel
 * slides in from the right; backdrop click + Esc dismiss it.
 */

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Stamp,
  X,
} from "lucide-react";
import type { ChapterRedline } from "@/lib/supabase/types";
import type { MemoryFileSlug } from "@/lib/memory/files";

type Props = {
  slug: MemoryFileSlug;
  open: boolean;
  onClose: () => void;
  /** Optional callback so the parent can refresh the badge counts
   *  after the customer resolves a redline. */
  onChange?: () => void;
};

export function CustomerRedlinesPanel({ slug, open, onClose, onChange }: Props) {
  const [redlines, setRedlines] = useState<ChapterRedline[]>([]);
  const [approvedAt, setApprovedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Fetch when opened.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/agent/redlines?slug=${encodeURIComponent(slug)}`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = (await res.json()) as {
          redlines?: ChapterRedline[];
          approved?: boolean;
        };
        if (cancelled) return;
        setRedlines(j.redlines ?? []);
        setApprovedAt(j.approved ? new Date().toISOString() : null);
      } catch (e) {
        if (!cancelled)
          setErr(e instanceof Error ? e.message : "Failed to load redlines");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, slug]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function toggleResolved(id: string, currentlyResolved: boolean) {
    setBusyId(id);
    setErr(null);
    try {
      const res = await fetch("/api/agent/redlines", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          resolved: !currentlyResolved,
          slug,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      setRedlines((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                resolved_at: currentlyResolved ? null : new Date().toISOString(),
              }
            : r,
        ),
      );
      onChange?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setBusyId(null);
    }
  }

  if (!open) return null;

  const open_ = redlines.filter((r) => !r.resolved_at);
  const resolved = redlines.filter((r) => r.resolved_at);
  const blockerCount = open_.filter((r) => r.severity === "blocker").length;

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close redlines"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-navy/30 backdrop-blur-[2px] cursor-default"
      />
      {/* Drawer */}
      <aside
        role="dialog"
        aria-label="Reviewer notes"
        className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[480px] bg-cream-soft shadow-[-16px_0_36px_rgba(30,58,95,0.18)] flex flex-col animate-slideIn"
      >
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-card-border bg-navy text-cream">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-gold" />
            <span className="text-xs uppercase tracking-[0.14em] font-bold">
              Reviewer notes
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-cream/70 hover:bg-cream/10 transition-colors"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {/* Approval state */}
          {approvedAt && (
            <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Stamp size={14} className="text-emerald-700" />
                <span className="text-xs uppercase tracking-[0.14em] font-bold text-emerald-800">
                  Jason approved
                </span>
              </div>
              <p className="text-sm text-emerald-900 leading-snug">
                Jason has reviewed this chapter and stamped it ready. The
                contents on this page are what the export bundle will produce.
              </p>
            </div>
          )}

          {/* Summary */}
          {!loading && redlines.length > 0 && (
            <div className="rounded-xl border border-card-border bg-white p-4">
              <h2 className="text-navy font-bold text-base mb-1">
                {open_.length === 0
                  ? "All notes resolved"
                  : blockerCount > 0
                    ? `${blockerCount} blocker${blockerCount === 1 ? "" : "s"} to resolve`
                    : `${open_.length} note${open_.length === 1 ? "" : "s"} to review`}
              </h2>
              <p className="text-sm text-grey-3 leading-snug">
                {open_.length === 0
                  ? approvedAt
                    ? "No outstanding notes. Jason has stamped this chapter approved."
                    : "All reviewer notes have been resolved. Jason can stamp this chapter approved next."
                  : blockerCount > 0
                    ? "Blockers must be resolved before this chapter can be approved for export."
                    : "These are suggestions, not blockers — resolve them when you've addressed the feedback."}
              </p>
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-grey-3 text-sm px-1">
              <Loader2 size={14} className="animate-spin" />
              Loading reviewer notes…
            </div>
          )}

          {!loading && redlines.length === 0 && (
            <div className="rounded-xl border border-card-border bg-white p-5 text-center">
              <MessageSquare size={20} className="text-grey-4 mx-auto mb-2" />
              <h2 className="text-navy font-bold text-sm mb-1">
                No reviewer notes yet
              </h2>
              <p className="text-xs text-grey-3 leading-snug">
                When Jason reviews this chapter, his notes appear here. You can
                resolve them in place once you&apos;ve addressed the feedback.
              </p>
            </div>
          )}

          {/* Open notes */}
          {open_.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs uppercase tracking-[0.14em] font-bold text-gold-text">
                Open
              </h3>
              {open_.map((r) => (
                <RedlineCard
                  key={r.id}
                  redline={r}
                  busy={busyId === r.id}
                  onToggle={() => void toggleResolved(r.id, false)}
                />
              ))}
            </section>
          )}

          {/* Resolved notes (collapsed below open) */}
          {resolved.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs uppercase tracking-[0.14em] font-bold text-grey-3">
                Resolved ({resolved.length})
              </h3>
              {resolved.map((r) => (
                <RedlineCard
                  key={r.id}
                  redline={r}
                  busy={busyId === r.id}
                  onToggle={() => void toggleResolved(r.id, true)}
                />
              ))}
            </section>
          )}

          {err && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
              {err}
            </div>
          )}
        </div>

        <style jsx>{`
          @keyframes slideIn {
            from {
              transform: translateX(100%);
            }
            to {
              transform: translateX(0);
            }
          }
          aside {
            animation: slideIn 220ms ease-out;
          }
          @media (prefers-reduced-motion: reduce) {
            aside {
              animation: none;
            }
          }
        `}</style>
      </aside>
    </>
  );
}

function RedlineCard({
  redline,
  busy,
  onToggle,
}: {
  redline: ChapterRedline;
  busy: boolean;
  onToggle: () => void;
}) {
  const resolved = !!redline.resolved_at;
  const sevMeta = {
    blocker: {
      label: "Blocker",
      icon: AlertTriangle,
      pillClass: "bg-red-50 text-red-700 border-red-200",
      cardBorder: resolved ? "border-card-border" : "border-red-200",
      cardBg: resolved ? "bg-grey-1/30" : "bg-red-50/40",
    },
    warning: {
      label: "Suggestion",
      icon: AlertTriangle,
      pillClass: "bg-amber-50 text-amber-700 border-amber-200",
      cardBorder: resolved ? "border-card-border" : "border-amber-200",
      cardBg: resolved ? "bg-grey-1/30" : "bg-amber-50/40",
    },
    info: {
      label: "Note",
      icon: MessageSquare,
      pillClass: "bg-cream/60 text-grey-3 border-card-border",
      cardBorder: "border-card-border",
      cardBg: resolved ? "bg-grey-1/30" : "bg-white",
    },
  }[redline.severity];

  const Icon = sevMeta.icon;

  return (
    <article
      className={`rounded-xl border ${sevMeta.cardBorder} ${sevMeta.cardBg} p-4 transition-colors ${resolved ? "opacity-60" : ""}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span
          className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] font-bold border rounded-full px-2 py-0.5 ${sevMeta.pillClass}`}
        >
          <Icon size={10} />
          {sevMeta.label}
        </span>
        {resolved && (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] font-bold text-emerald-700">
            <CheckCircle2 size={10} />
            Resolved
          </span>
        )}
      </div>
      <p className="text-sm text-navy leading-snug whitespace-pre-wrap mb-3">
        {redline.comment}
      </p>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-grey-3">
          {redline.reviewer_name ?? "Reviewer"} ·{" "}
          {formatTime(redline.created_at)}
        </p>
        <button
          type="button"
          onClick={onToggle}
          disabled={busy}
          className={`inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.1em] px-3 py-1.5 rounded-full transition-colors disabled:opacity-50 ${
            resolved
              ? "bg-cream text-navy hover:bg-navy hover:text-cream border border-navy/20"
              : "bg-emerald-600 text-white hover:bg-emerald-700"
          }`}
        >
          {busy ? (
            <Loader2 size={11} className="animate-spin" />
          ) : resolved ? (
            "Reopen"
          ) : (
            <>
              <CheckCircle2 size={11} />
              Mark resolved
            </>
          )}
        </button>
      </div>
    </article>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const diffHr = (Date.now() - d.getTime()) / 3_600_000;
    if (diffHr < 1) {
      const m = Math.max(1, Math.floor(diffHr * 60));
      return `${m}m ago`;
    }
    if (diffHr < 24) return `${Math.floor(diffHr)}h ago`;
    if (diffHr < 24 * 7)
      return `${Math.floor(diffHr / 24)}d ago`;
    return d.toLocaleDateString();
  } catch {
    return "";
  }
}

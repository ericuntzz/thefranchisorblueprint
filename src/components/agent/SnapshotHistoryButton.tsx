"use client";

/**
 * SnapshotHistoryButton — small "version history" affordance on the
 * section page. Click to open a panel listing recent snapshots; click
 * a row to roll the section back to that point. Rollback itself
 * captures a fresh snapshot first so the operation is reversible.
 */

import { useEffect, useState } from "react";
import { Clock, RotateCcw, Loader2 } from "lucide-react";

type Snapshot = {
  id: string;
  reason: string | null;
  source: string;
  createdAt: string;
};

type Props = {
  slug: string;
  /** Called after a successful rollback so the parent can refresh. */
  onRolledBack?: () => void;
  /** When provided, the open/close state is controlled by the parent
   *  (e.g. an overflow-menu item triggers the panel). The component
   *  still owns the panel UI itself. */
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
  /** Hide the standalone "Version history" trigger pill. Useful when
   *  the parent already provides a trigger (overflow menu item) and
   *  this component just renders the panel. */
  hideTrigger?: boolean;
};

export function SnapshotHistoryButton({
  slug,
  onRolledBack,
  externalOpen,
  onExternalOpenChange,
  hideTrigger,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen ?? internalOpen;
  const setOpen = (next: boolean | ((prev: boolean) => boolean)) => {
    const value = typeof next === "function" ? next(open) : next;
    if (onExternalOpenChange) {
      onExternalOpenChange(value);
    } else {
      setInternalOpen(value);
    }
  };
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); // snapshot id being rolled back to
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/agent/snapshots?slug=${encodeURIComponent(slug)}`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = (await res.json()) as {
          snapshots: Array<{
            id: string;
            reason: string | null;
            source: string;
            createdAt: string;
          }>;
        };
        if (!cancelled) setSnapshots(j.snapshots ?? []);
      } catch (e) {
        if (!cancelled)
          setErr(e instanceof Error ? e.message : "Failed to load history");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, slug]);

  async function rollback(snapshotId: string) {
    if (!confirm("Roll this section back to this version? Your current draft will be saved as a new snapshot first.")) {
      return;
    }
    setBusy(snapshotId);
    setErr(null);
    try {
      const res = await fetch("/api/agent/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, snapshotId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      onRolledBack?.();
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Rollback failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="relative">
      {!hideTrigger && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 bg-cream text-navy hover:bg-navy hover:text-cream border-2 border-navy/30 hover:border-navy font-bold text-[11px] uppercase tracking-[0.1em] px-4 py-2 rounded-full transition-colors"
        >
          <Clock size={12} />
          Version history
        </button>
      )}
      {open && (
        <>
          {/* Click-outside backdrop. */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute z-40 right-0 mt-2 w-[360px] rounded-xl border border-navy/15 bg-white shadow-[0_16px_36px_rgba(30,58,95,0.18)] overflow-hidden">
            <div className="px-3 py-2 border-b border-navy/10 text-xs uppercase tracking-[0.14em] font-bold text-grey-3">
              Recent versions
            </div>
            {loading && (
              <div className="px-3 py-4 text-grey-3 text-sm flex items-center gap-2">
                <Loader2 size={12} className="animate-spin" />
                Loading…
              </div>
            )}
            {!loading && snapshots.length === 0 && (
              <div className="px-3 py-4 text-grey-3 text-sm">
                No snapshots yet — they accumulate as you draft and edit.
              </div>
            )}
            <ul className="max-h-[320px] overflow-y-auto">
              {snapshots.map((s) => (
                <li
                  key={s.id}
                  className="border-b border-navy/5 last:border-b-0 px-3 py-2 hover:bg-cream/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-navy font-semibold leading-tight">
                        {s.reason ?? humanizeSource(s.source)}
                      </div>
                      <div className="text-xs uppercase tracking-wider text-grey-3">
                        {formatTime(s.createdAt)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void rollback(s.id)}
                      disabled={busy !== null}
                      className="flex-shrink-0 inline-flex items-center gap-1 text-xs uppercase tracking-wider font-bold text-navy hover:bg-navy/5 px-2 py-1 rounded-md transition-colors disabled:opacity-50"
                    >
                      {busy === s.id ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : (
                        <>
                          <RotateCcw size={10} />
                          Restore
                        </>
                      )}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {err && (
              <div className="px-3 py-2 text-xs text-red-700 border-t border-red-100 bg-red-50">
                {err}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function humanizeSource(s: string): string {
  switch (s) {
    case "pre_draft":
      return "Before draft";
    case "pre_redraft":
      return "Before redraft";
    case "pre_scrape":
      return "Before website scrape";
    case "pre_user_edit":
      return "Before user edit";
    case "pre_extract":
      return "Before extraction";
    case "pre_field_save":
      return "Before field save";
    case "manual":
      return "Manual checkpoint";
    default:
      return s;
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "";
  }
}

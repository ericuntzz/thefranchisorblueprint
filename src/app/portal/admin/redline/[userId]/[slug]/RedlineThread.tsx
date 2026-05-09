"use client";

/**
 * Client component for the redline thread sidebar. Shows existing
 * redlines (resolve / delete inline) and a "leave new note" composer
 * with severity dropdown.
 *
 * Wired to /api/admin/redlines (CRUD) and /api/admin/approve-section
 * (Jason-approved stamp).
 */

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Stamp,
  Trash2,
} from "lucide-react";
import type { SectionRedline } from "@/lib/supabase/types";
import type { MemoryFileSlug } from "@/lib/memory/files";

type Props = {
  userId: string;
  slug: MemoryFileSlug;
  initialRedlines: SectionRedline[];
  jasonApprovedAt: string | null;
};

export function RedlineThread({
  userId,
  slug,
  initialRedlines,
  jasonApprovedAt: initialApprovedAt,
}: Props) {
  const [redlines, setRedlines] = useState<SectionRedline[]>(initialRedlines);
  const [approvedAt, setApprovedAt] = useState<string | null>(initialApprovedAt);
  const [comment, setComment] = useState("");
  const [severity, setSeverity] = useState<"info" | "warning" | "blocker">(
    "info",
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const openBlockers = redlines.filter(
    (r) => r.severity === "blocker" && !r.resolved_at,
  ).length;

  async function leaveNote() {
    if (!comment.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/redlines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, slug, comment, severity }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const j = (await res.json()) as { redline: SectionRedline };
      setRedlines((prev) => [j.redline, ...prev]);
      setComment("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save redline");
    } finally {
      setBusy(false);
    }
  }

  async function toggleResolved(id: string, currentlyResolved: boolean) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/redlines", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, resolved: !currentlyResolved }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setBusy(false);
    }
  }

  async function deleteRedline(id: string) {
    if (!confirm("Delete this redline note?")) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/redlines?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRedlines((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setBusy(false);
    }
  }

  async function toggleApproved() {
    setBusy(true);
    setErr(null);
    try {
      const method = approvedAt ? "DELETE" : "POST";
      const res = await fetch("/api/admin/approve-section", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, slug }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      setApprovedAt(approvedAt ? null : new Date().toISOString());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to update approval");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="space-y-4">
      {/* Approval card */}
      <div
        className={`rounded-xl border p-4 ${
          approvedAt
            ? "border-emerald-300 bg-emerald-50"
            : "border-navy/10 bg-white"
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          <Stamp
            size={16}
            className={approvedAt ? "text-emerald-700" : "text-grey-4"}
          />
          <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-navy">
            Jason approved
          </span>
        </div>
        {approvedAt ? (
          <p className="text-emerald-900 text-sm mb-3">
            Stamped {new Date(approvedAt).toLocaleString()}.
          </p>
        ) : (
          <p className="text-grey-3 text-sm mb-3">
            {openBlockers > 0
              ? `Resolve ${openBlockers} blocker${openBlockers === 1 ? "" : "s"} below before you can stamp this approved.`
              : "No open blockers — ready to stamp."}
          </p>
        )}
        <button
          type="button"
          onClick={() => void toggleApproved()}
          disabled={busy || (!approvedAt && openBlockers > 0)}
          className={`inline-flex items-center gap-1.5 font-bold text-xs uppercase tracking-[0.1em] px-4 py-2 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            approvedAt
              ? "bg-cream text-navy hover:bg-navy hover:text-cream border-2 border-navy/30 hover:border-navy"
              : "bg-emerald-600 text-white hover:bg-emerald-700"
          }`}
        >
          {busy ? (
            <Loader2 size={12} className="animate-spin" />
          ) : approvedAt ? (
            "Revoke approval"
          ) : (
            "Stamp approved"
          )}
        </button>
      </div>

      {/* Compose new redline */}
      <div className="rounded-xl border border-navy/10 bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare size={14} className="text-gold-warm" />
          <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-navy">
            Leave a note
          </span>
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          placeholder="What's not right yet, what needs sharper detail, what's still missing…"
          className="w-full resize-none rounded-lg border border-navy/15 bg-white px-3 py-2 text-sm text-navy placeholder-grey-4 focus:border-gold focus:ring-2 focus:ring-gold/20 outline-none transition mb-3"
        />
        <div className="flex items-center gap-2 mb-3">
          <label className="text-[11px] font-bold uppercase tracking-wider text-grey-3">
            Severity
          </label>
          <select
            value={severity}
            onChange={(e) =>
              setSeverity(e.target.value as "info" | "warning" | "blocker")
            }
            className="text-xs border border-navy/15 bg-white text-navy rounded-md px-2 py-1"
          >
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="blocker">Blocker</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => void leaveNote()}
          disabled={busy || !comment.trim()}
          className="w-full inline-flex items-center justify-center gap-1.5 bg-navy text-cream hover:bg-navy-light disabled:opacity-40 font-bold text-xs uppercase tracking-[0.1em] px-4 py-2.5 rounded-full transition-colors"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : "Save note"}
        </button>
        {err && <p className="text-xs text-red-700 mt-2">{err}</p>}
      </div>

      {/* Existing redlines */}
      {redlines.length > 0 && (
        <div className="rounded-xl border border-navy/10 bg-white p-4 space-y-2">
          <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-navy mb-2">
            Thread ({redlines.length})
          </div>
          {redlines.map((r) => {
            const resolved = !!r.resolved_at;
            const sevColor =
              r.severity === "blocker"
                ? "text-red-700 bg-red-50 border-red-200"
                : r.severity === "warning"
                  ? "text-amber-700 bg-amber-50 border-amber-200"
                  : "text-grey-3 bg-cream/50 border-navy/10";
            return (
              <article
                key={r.id}
                className={`rounded-lg border px-3 py-2 ${
                  resolved ? "opacity-60" : ""
                } ${sevColor}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] uppercase tracking-wider font-bold flex items-center gap-1">
                    {r.severity === "blocker" && <AlertTriangle size={10} />}
                    {resolved && <CheckCircle2 size={10} />}
                    {r.severity}
                    {resolved && " · resolved"}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void toggleResolved(r.id, resolved)}
                      disabled={busy}
                      className="text-[10px] uppercase tracking-wider font-bold text-grey-4 hover:text-navy transition-colors px-1"
                    >
                      {resolved ? "Reopen" : "Resolve"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteRedline(r.id)}
                      disabled={busy}
                      aria-label="Delete"
                      className="text-grey-4 hover:text-red-600 transition-colors p-0.5"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-navy leading-snug whitespace-pre-wrap">
                  {r.comment}
                </p>
                <p className="text-[10px] text-grey-4 mt-1">
                  {r.reviewer_name ?? "Reviewer"} ·{" "}
                  {new Date(r.created_at).toLocaleString()}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </aside>
  );
}

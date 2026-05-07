"use client";

/**
 * Chapter toolbar — renders next to the page-level back arrow at the
 * top of /portal/chapter/[slug].
 *
 * MOCK (Pass E preview): the only thing this component now surfaces is
 * status pills (open redlines, Jason approved). Talk to Jason was
 * removed — voice intake is already available inside the Jason chat
 * dock at the bottom-right. Version history was removed — it lived in
 * an overflow menu that essentially nobody used. View in Blueprint
 * was removed — the new left sidebar's "Blueprint" entry is the
 * primary way to reach the assembled view.
 *
 * Result: top of the chapter page goes from 4 ghost-pill buttons +
 * an overflow menu down to a back arrow + the chapter title. Status
 * pills appear inline if and only if there's something to surface.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Stamp } from "lucide-react";
import { CustomerRedlinesPanel } from "@/components/agent/CustomerRedlinesPanel";
import type { MemoryFileSlug } from "@/lib/memory/files";

type Props = {
  slug: MemoryFileSlug;
};

export function ChapterToolbar({ slug }: Props) {
  const router = useRouter();
  const [redlineSummary, setRedlineSummary] = useState<{
    open: number;
    blockers: number;
    approved: boolean;
    total: number;
  } | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const refreshRedlines = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/agent/redlines?slug=${encodeURIComponent(slug)}`,
      );
      if (!res.ok) return;
      const j = (await res.json()) as {
        redlines?: Array<{ resolved_at: string | null }>;
        openCount?: number;
        blockerCount?: number;
        approved?: boolean;
      };
      setRedlineSummary({
        open: j.openCount ?? 0,
        blockers: j.blockerCount ?? 0,
        approved: !!j.approved,
        total: j.redlines?.length ?? j.openCount ?? 0,
      });
    } catch {
      /* non-fatal */
    }
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      await refreshRedlines();
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshRedlines]);

  // If nothing is worth surfacing, render nothing — let the back arrow
  // and title own the row.
  const hasAnythingToShow =
    redlineSummary !== null &&
    (redlineSummary.approved ||
      redlineSummary.open > 0 ||
      redlineSummary.total > 0);
  if (!hasAnythingToShow) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {redlineSummary?.approved && (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-bold text-[11px] uppercase tracking-[0.1em] px-3 py-2 rounded-full transition-colors"
          title="View Jason's review notes"
        >
          <Stamp size={12} />
          Jason approved
        </button>
      )}
      {redlineSummary && redlineSummary.open > 0 && (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className={`inline-flex items-center gap-1.5 font-bold text-[11px] uppercase tracking-[0.1em] px-3 py-2 rounded-full transition-colors ${
            redlineSummary.blockers > 0
              ? "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
              : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
          }`}
          title="Read Jason's notes and resolve them"
        >
          <MessageSquare size={12} />
          {redlineSummary.open} redline{redlineSummary.open === 1 ? "" : "s"}
          {redlineSummary.blockers > 0
            ? ` · ${redlineSummary.blockers} blocker${redlineSummary.blockers === 1 ? "" : "s"}`
            : ""}
        </button>
      )}
      {redlineSummary &&
        redlineSummary.open === 0 &&
        redlineSummary.total > 0 &&
        !redlineSummary.approved && (
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="inline-flex items-center gap-1.5 text-grey-3 hover:text-navy text-[11px] uppercase tracking-[0.1em] font-bold px-2 py-2 transition-colors"
          >
            <MessageSquare size={12} />
            Review notes
          </button>
        )}

      <CustomerRedlinesPanel
        slug={slug}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onChange={() => {
          void refreshRedlines();
          router.refresh();
        }}
      />
    </div>
  );
}

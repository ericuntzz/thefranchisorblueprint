"use client";

/**
 * Chapter toolbar — wraps the voice-intake button + snapshot
 * version-history button + customer-side redline indicator into a
 * single client-component the chapter page can drop into its top
 * nav. Each piece is its own component so a page that only wants
 * one of them can pull it in directly; this just bundles the common
 * "everything chapter-scoped" pattern.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Stamp, MessageSquare } from "lucide-react";
import { VoiceIntakeButton } from "@/components/agent/VoiceIntakeButton";
import { SnapshotHistoryButton } from "@/components/agent/SnapshotHistoryButton";
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

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <VoiceIntakeButton
        slug={slug}
        onSuccess={() => router.refresh()}
      />
      <SnapshotHistoryButton slug={slug} onRolledBack={() => router.refresh()} />
      {/* Approved stamp — clickable to open the panel even without
          open redlines, so the customer can read what was reviewed. */}
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
      {/* Open-redline pill — click to open the thread. */}
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
      {/* If there are resolved-but-no-open redlines, surface a tiny
          "View past notes" affordance. */}
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
          // Refresh badge counts after customer resolves a note.
          void refreshRedlines();
          // Also refresh the page in case the resolution unblocks
          // an "approved" state change down the line.
          router.refresh();
        }}
      />
    </div>
  );
}

"use client";

/**
 * Chapter toolbar — renders next to the page-level back arrow at the
 * top of /portal/chapter/[slug].
 *
 * Three layers of UI:
 *
 *   1. Status pills (redlines, approved-by-Jason). Inline, always
 *      visible when relevant — these are notifications the customer
 *      should see immediately without a click.
 *
 *   2. Voice intake button — kept inline because its UI changes with
 *      recording state (live REC indicator + stop button). Hiding
 *      that behind a menu would be confusing.
 *
 *   3. Action overflow menu — three-dot button opening a small
 *      popover with the secondary nav: Version history, View in
 *      Blueprint. Hides cleanly until the customer goes looking
 *      for them, replacing the row of standalone pills that used
 *      to crowd the top of the page.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  History,
  MessageSquare,
  MoreHorizontal,
  Stamp,
} from "lucide-react";
import { CustomerRedlinesPanel } from "@/components/agent/CustomerRedlinesPanel";
import { VoiceIntakeButton } from "@/components/agent/VoiceIntakeButton";
import { SnapshotHistoryButton } from "@/components/agent/SnapshotHistoryButton";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

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

  // Close the overflow menu on outside click + Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Status pills — always visible when present. */}
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

      {/* Voice intake — stays inline; its UI shifts with recording
          state and needs to be visible while live. */}
      <VoiceIntakeButton slug={slug} onSuccess={() => router.refresh()} />

      {/* Overflow menu — passive secondary nav. */}
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="More actions"
          className="inline-flex items-center justify-center w-9 h-9 rounded-full text-navy bg-white hover:bg-cream-soft border-2 border-navy/30 hover:border-navy transition-colors"
        >
          <MoreHorizontal size={16} />
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-2 w-[220px] rounded-xl border border-card-border bg-white shadow-[0_16px_36px_rgba(30,58,95,0.18)] overflow-hidden z-20"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setHistoryOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-left text-sm text-navy font-semibold hover:bg-cream-soft transition-colors"
            >
              <History size={14} className="text-gold-warm" />
              Version history
            </button>
            <Link
              role="menuitem"
              href={`/portal/lab/blueprint#chapter-${slug}`}
              onClick={() => setMenuOpen(false)}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-left text-sm text-navy font-semibold hover:bg-cream-soft border-t border-card-border transition-colors"
            >
              <BookOpen size={14} className="text-gold-warm" />
              View in Blueprint
            </Link>
          </div>
        )}
      </div>

      {/* Snapshot history modal is opened from the overflow menu —
          render the component invisibly with a controlled `open` prop. */}
      <SnapshotHistoryButton
        slug={slug}
        onRolledBack={() => router.refresh()}
        externalOpen={historyOpen}
        onExternalOpenChange={setHistoryOpen}
        hideTrigger
      />

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

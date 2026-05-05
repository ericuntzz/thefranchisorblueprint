"use client";

/**
 * Chapter toolbar — wraps the voice-intake button + snapshot
 * version-history button + customer-side redline indicator into a
 * single client-component the chapter page can drop into its top
 * nav. Each piece is its own component so a page that only wants
 * one of them can pull it in directly; this just bundles the common
 * "everything chapter-scoped" pattern.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Stamp, MessageSquare } from "lucide-react";
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
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/agent/redlines?slug=${encodeURIComponent(slug)}`,
        );
        if (!res.ok) return;
        const j = (await res.json()) as {
          openCount?: number;
          blockerCount?: number;
          approved?: boolean;
        };
        if (cancelled) return;
        setRedlineSummary({
          open: j.openCount ?? 0,
          blockers: j.blockerCount ?? 0,
          approved: !!j.approved,
        });
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <VoiceIntakeButton
        slug={slug}
        onSuccess={() => router.refresh()}
      />
      <SnapshotHistoryButton slug={slug} onRolledBack={() => router.refresh()} />
      {redlineSummary?.approved && (
        <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px] uppercase tracking-[0.1em] px-3 py-2 rounded-full">
          <Stamp size={12} />
          Jason approved
        </span>
      )}
      {redlineSummary && redlineSummary.open > 0 && (
        <span
          className={`inline-flex items-center gap-1.5 font-bold text-[11px] uppercase tracking-[0.1em] px-3 py-2 rounded-full ${
            redlineSummary.blockers > 0
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-amber-50 text-amber-700 border border-amber-200"
          }`}
        >
          <MessageSquare size={12} />
          {redlineSummary.open} redline{redlineSummary.open === 1 ? "" : "s"}
          {redlineSummary.blockers > 0
            ? ` · ${redlineSummary.blockers} blocker${redlineSummary.blockers === 1 ? "" : "s"}`
            : ""}
        </span>
      )}
    </div>
  );
}

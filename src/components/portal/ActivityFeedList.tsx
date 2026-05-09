"use client";

/**
 * ActivityFeedList — client island inside ActivityFeed.
 *
 * Renders the row list + the "Show more / Show fewer" disclosure
 * toggle. State stays local; the server component (ActivityFeed)
 * handles data + relative-time formatting.
 *
 * Disclosure rules:
 *   - 5 rows visible by default.
 *   - Click "Show more" → up to 10 rows visible. Anything beyond 10
 *     scrolls inside the card so the feed never dominates the
 *     dashboard.
 *   - Toggle is centered below the list. No toggle when 5 or fewer
 *     events total.
 */

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  CloudDownload,
  FileText,
  Globe,
  Paperclip,
  PenLine,
  Sparkles,
} from "lucide-react";
import type { ActivityFeedRow } from "./ActivityFeed";
// Type-only import is fine — the `server-only` side-effect on
// feed.ts only triggers for value imports. Types are erased at
// compile time and never end up in the client bundle.
import type { ActivityKind } from "@/lib/activity/feed";
import { AnimatedDisclosure } from "@/components/ui/AnimatedDisclosure";

const COLLAPSED_COUNT = 2;
const EXPANDED_VISIBLE_COUNT = 10;

export function ActivityFeedList({ rows }: { rows: ActivityFeedRow[] }) {
  const [expanded, setExpanded] = useState(false);

  const showToggle = rows.length > COLLAPSED_COUNT;
  const alwaysVisible = rows.slice(0, COLLAPSED_COUNT);
  const extraRows = rows.slice(COLLAPSED_COUNT);
  // Cap height to ~10 rows when expanded so a long feed scrolls in
  // place instead of pushing the rest of the dashboard down.
  const extraScrolls = rows.length > EXPANDED_VISIBLE_COUNT;

  return (
    <>
      <ul className="space-y-3">
        {alwaysVisible.map((r) => (
          <ActivityRow key={r.id} row={r} />
        ))}
      </ul>
      {/* Extra rows live in an AnimatedDisclosure so the feed grows
          smoothly when the user expands. Long feeds (>10 events)
          fall back to internal scroll inside the disclosure so the
          dashboard doesn't grow unbounded. */}
      {extraRows.length > 0 && (
        <AnimatedDisclosure open={expanded} duration={320}>
          <ul
            className={
              extraScrolls
                ? "space-y-3 pt-3 max-h-[600px] overflow-y-auto pr-1"
                : "space-y-3 pt-3"
            }
          >
            {extraRows.map((r) => (
              <ActivityRow key={r.id} row={r} />
            ))}
          </ul>
        </AnimatedDisclosure>
      )}
      {showToggle && (
        <div className="mt-4 pt-3 border-t border-card-border flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.1em] font-bold text-grey-3 hover:text-navy transition-colors duration-200 py-1.5 px-3"
          >
            {expanded
              ? "Show fewer"
              : `Show ${Math.min(
                  rows.length - COLLAPSED_COUNT,
                  EXPANDED_VISIBLE_COUNT - COLLAPSED_COUNT,
                )} more`}
            <ChevronDown
              size={13}
              className="transition-transform duration-[320ms] motion-reduce:transition-none"
              style={{
                transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          </button>
        </div>
      )}
    </>
  );
}

function ActivityRow({ row }: { row: ActivityFeedRow }) {
  return (
    <li className="flex items-center gap-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-cream/80 border border-navy/5 flex items-center justify-center text-navy">
        <ActivityIcon kind={row.kind} />
      </div>
      {/* Single-row layout: summary on the left, relative timestamp
          right-aligned. The previous two-row layout existed to host a
          `detail` sub-line (filename, "Inferred — needs review",
          etc.) but Eric removed it 2026-05-09 — the dashboard reads
          cleaner without the secondary text, and the section link is
          one click away if the customer wants the specifics. */}
      <Link
        href={`/portal/section/${row.sectionSlug}`}
        className="flex-1 min-w-0 text-navy text-sm font-semibold hover:underline leading-snug transition-colors"
      >
        {row.summary}
      </Link>
      <span className="text-grey-3 text-xs flex-shrink-0">{row.relative}</span>
    </li>
  );
}

function ActivityIcon({ kind }: { kind: ActivityKind }) {
  switch (kind) {
    case "section_updated":
      return <FileText size={13} />;
    case "fields_extracted_from_upload":
      return <CloudDownload size={13} />;
    case "fields_filled_by_scrape":
      return <Globe size={13} />;
    case "fields_filled_by_user":
      return <PenLine size={13} />;
    case "fields_filled_by_agent":
      return <Sparkles size={13} />;
    case "attachment_uploaded":
      return <Paperclip size={13} />;
  }
}

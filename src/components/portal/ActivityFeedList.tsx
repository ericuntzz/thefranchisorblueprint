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
  ChevronUp,
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

const COLLAPSED_COUNT = 5;
const EXPANDED_VISIBLE_COUNT = 10;

export function ActivityFeedList({ rows }: { rows: ActivityFeedRow[] }) {
  const [expanded, setExpanded] = useState(false);

  const showToggle = rows.length > COLLAPSED_COUNT;
  const visibleRows = expanded ? rows : rows.slice(0, COLLAPSED_COUNT);
  // Cap height to ~10 rows when expanded so a long feed scrolls in
  // place instead of pushing the rest of the dashboard down.
  const ulClass =
    expanded && rows.length > EXPANDED_VISIBLE_COUNT
      ? "space-y-3 max-h-[600px] overflow-y-auto pr-1"
      : "space-y-3";

  return (
    <>
      <ul className={ulClass}>
        {visibleRows.map((r) => (
          <li key={r.id} className="flex items-center gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-cream/80 border border-navy/5 flex items-center justify-center text-navy">
              <ActivityIcon kind={r.kind} />
            </div>
            <div className="flex-1 min-w-0">
              <Link
                href={`/portal/chapter/${r.chapterSlug}`}
                className="text-navy text-sm font-semibold hover:underline block leading-snug"
              >
                {r.summary}
              </Link>
              <div className="flex items-baseline gap-2 mt-0.5">
                {r.detail && (
                  <span className="text-grey-3 text-xs truncate">
                    {r.detail}
                  </span>
                )}
                <span className="text-grey-3 text-xs flex-shrink-0 ml-auto">
                  {r.relative}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {showToggle && (
        <div className="mt-4 pt-3 border-t border-card-border flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.1em] font-bold text-grey-3 hover:text-navy transition-colors py-1.5 px-3"
          >
            {expanded ? (
              <>
                Show fewer
                <ChevronUp size={13} />
              </>
            ) : (
              <>
                Show{" "}
                {Math.min(
                  rows.length - COLLAPSED_COUNT,
                  EXPANDED_VISIBLE_COUNT - COLLAPSED_COUNT,
                )}{" "}
                more
                <ChevronDown size={13} />
              </>
            )}
          </button>
        </div>
      )}
    </>
  );
}

function ActivityIcon({ kind }: { kind: ActivityKind }) {
  switch (kind) {
    case "chapter_updated":
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

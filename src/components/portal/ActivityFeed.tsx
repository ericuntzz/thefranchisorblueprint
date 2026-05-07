/**
 * ActivityFeed — recent Blueprint activity on the Command Center.
 *
 * Read-only summary of what's happened to the customer's Memory in
 * the recent past. Lightweight: each row is one icon + one line + a
 * relative timestamp + a chapter link. Empty state hides the whole
 * card so a brand-new customer doesn't see a vacant feed.
 */

import Link from "next/link";
import {
  CloudDownload,
  FileText,
  Globe,
  Paperclip,
  PenLine,
  Sparkles,
} from "lucide-react";
import {
  formatRelative,
  type ActivityEvent,
  type ActivityKind,
} from "@/lib/activity/feed";

type Props = {
  events: ActivityEvent[];
};

export function ActivityFeed({ events }: Props) {
  if (events.length === 0) return null;

  return (
    <section className="bg-white rounded-2xl border border-card-border p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <span className="text-[10px] uppercase tracking-[0.18em] text-gold-warm font-bold">
          Recent activity
        </span>
        <span className="text-[10px] text-grey-3 font-semibold">
          Last {events.length}
        </span>
      </div>
      <ul className="space-y-3">
        {events.map((e) => (
          <li key={e.id} className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-cream/80 border border-navy/5 flex items-center justify-center text-navy">
              <ActivityIcon kind={e.kind} />
            </div>
            <div className="flex-1 min-w-0">
              <Link
                href={`/portal/chapter/${e.chapterSlug}`}
                className="text-navy text-sm font-semibold hover:underline block leading-snug"
              >
                {e.summary}
              </Link>
              <div className="flex items-baseline gap-2 mt-0.5">
                {e.detail && (
                  <span className="text-grey-3 text-xs truncate">{e.detail}</span>
                )}
                <span className="text-grey-3 text-xs flex-shrink-0 ml-auto">
                  {formatRelative(e.at)}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ActivityIcon({ kind }: { kind: ActivityKind }) {
  switch (kind) {
    case "chapter_updated":
      return <FileText size={14} />;
    case "fields_extracted_from_upload":
      return <CloudDownload size={14} />;
    case "fields_filled_by_scrape":
      return <Globe size={14} />;
    case "fields_filled_by_user":
      return <PenLine size={14} />;
    case "fields_filled_by_agent":
      return <Sparkles size={14} />;
    case "attachment_uploaded":
      return <Paperclip size={14} />;
  }
}

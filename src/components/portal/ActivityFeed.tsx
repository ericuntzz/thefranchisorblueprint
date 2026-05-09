/**
 * ActivityFeed — recent Blueprint activity on the Command Center.
 *
 * Read-only summary of what's happened to the customer's Memory in
 * the recent past. Lightweight: each row is one icon + one line + a
 * relative timestamp + a chapter link. Empty state hides the whole
 * card so a brand-new customer doesn't see a vacant feed.
 *
 * Disclosure: ActivityFeedList (client) shows the 5 most recent rows
 * by default, with a "Show more" button that expands to ~10 visible
 * + scroll. This server-component shell pre-formats the relative
 * timestamps so the client island doesn't have to import anything
 * from the server-only `@/lib/activity/feed` module.
 */

import {
  formatRelative,
  type ActivityEvent,
  type ActivityKind,
} from "@/lib/activity/feed";
import { ActivityFeedList } from "./ActivityFeedList";

type Props = {
  events: ActivityEvent[];
};

export type ActivityFeedRow = {
  id: string;
  kind: ActivityKind;
  summary: string;
  detail: string | null | undefined;
  chapterSlug: string;
  relative: string;
};

export function ActivityFeed({ events }: Props) {
  if (events.length === 0) return null;

  // Pre-format every event server-side so the client list component
  // can stay lean (no date-formatting helpers, no server-only imports).
  const rows: ActivityFeedRow[] = events.map((e) => ({
    id: e.id,
    kind: e.kind,
    summary: e.summary,
    detail: e.detail,
    chapterSlug: e.chapterSlug,
    relative: formatRelative(e.at),
  }));

  return (
    <section className="bg-white rounded-2xl border border-card-border p-5 sm:p-6">
      <div className="text-xs uppercase tracking-[0.14em] text-gold-text font-bold mb-4">
        Recent activity
      </div>
      <ActivityFeedList rows={rows} />
    </section>
  );
}

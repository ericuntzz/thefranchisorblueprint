/**
 * Activity feed — derived from existing Memory state.
 *
 * Pure read-side. Does NOT depend on any new "events" or "activity"
 * table — it scans existing customer_memory rows + their per-field
 * `field_status` provenance + the `attachments` array, and synthesizes
 * a chronological feed of "what's happened recently in your Blueprint."
 *
 * Why this matters: the Command Center showed readiness % + "next
 * question" but not what just happened. A returning customer couldn't
 * see that Jason had drafted three paragraphs, or that the scrape
 * had pre-filled a chapter — the work was invisible until they
 * navigated into the chapter. The feed makes the portal feel inhabited
 * rather than static.
 *
 * Coordination note: this is intentionally read-only and orthogonal to
 * any agent-driven nudge / Proactive Jason work. It only summarizes
 * what's already happened. It does NOT trigger Jason actions or write
 * any rows.
 */

import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { MEMORY_FILE_TITLES, type MemoryFileSlug } from "@/lib/memory/files";
import type { CustomerMemory } from "@/lib/supabase/types";

export type ActivityKind =
  | "chapter_updated"
  | "fields_extracted_from_upload"
  | "fields_filled_by_scrape"
  | "fields_filled_by_user"
  | "fields_filled_by_agent"
  | "attachment_uploaded";

export type ActivityEvent = {
  /** Stable id for React keys — chapter slug + kind + timestamp suffices. */
  id: string;
  kind: ActivityKind;
  /** ISO timestamp — the source "happened at". Newer is later. */
  at: string;
  chapterSlug: MemoryFileSlug;
  chapterTitle: string;
  /** Short, customer-facing one-liner. No exclamation marks per brand. */
  summary: string;
  /** Optional secondary line — count, attachment label, etc. */
  detail?: string;
};

const SOURCE_TO_KIND: Partial<
  Record<CustomerMemory["field_status"][string]["source"], ActivityKind>
> = {
  upload: "fields_extracted_from_upload",
  scraper: "fields_filled_by_scrape",
  user_typed: "fields_filled_by_user",
  user_correction: "fields_filled_by_user",
  agent_inference: "fields_filled_by_agent",
  voice_session: "fields_filled_by_agent",
  form: "fields_filled_by_user",
  research: "fields_filled_by_agent",
};

const LAST_UPDATED_BY_VERB: Record<CustomerMemory["last_updated_by"], string> = {
  agent: "Jason updated the prose in",
  jason: "Coaching note added to",
  user: "You edited",
  scraper: "Pre-filled from your website:",
};

/**
 * Compute the most recent N activity events for a user.
 *
 * Returns events in newest-first order. The synthesis logic is
 * intentionally bucket-y: per-field updates are grouped by chapter +
 * source so the feed doesn't list 22 individual `unit_economics` field
 * writes from one upload as 22 events.
 */
export async function getRecentActivity(
  userId: string,
  limit = 8,
): Promise<ActivityEvent[]> {
  const admin = getSupabaseAdmin();
  const { data: rowsRaw, error } = await admin
    .from("customer_memory")
    .select(
      "file_slug, content_md, field_status, attachments, last_updated_by, updated_at, confidence",
    )
    .eq("user_id", userId);

  if (error) {
    console.error("[activity] query failed:", error.message);
    return [];
  }

  const rows = (rowsRaw ?? []) as Array<
    Pick<
      CustomerMemory,
      | "file_slug"
      | "content_md"
      | "field_status"
      | "attachments"
      | "last_updated_by"
      | "updated_at"
      | "confidence"
    >
  >;

  const events: ActivityEvent[] = [];

  for (const row of rows) {
    const slug = row.file_slug as MemoryFileSlug;
    const title = MEMORY_FILE_TITLES[slug] ?? slug;

    // ── Chapter prose update — only if there's real content + a recent
    // updated_at. Skip when the only change was attachment append or
    // field write (those have their own buckets).
    if (
      (row.content_md ?? "").trim().length >= 80 &&
      row.last_updated_by !== "user" // user typing into the chapter editor
    ) {
      events.push({
        id: `${slug}.chapter_updated.${row.updated_at}`,
        kind: "chapter_updated",
        at: row.updated_at,
        chapterSlug: slug,
        chapterTitle: title,
        summary: `${LAST_UPDATED_BY_VERB[row.last_updated_by] ?? "Updated"} ${title}`,
        detail:
          row.confidence === "verified"
            ? "Verified by you"
            : row.confidence === "inferred"
              ? "Inferred — needs review"
              : "Draft",
      });
    }

    // ── Field updates: bucket by source so we get one row per
    // (chapter, source) per ~recent window rather than one per field.
    const fieldStatus = (row.field_status ?? {}) as CustomerMemory["field_status"];
    const groupedBySource = new Map<
      string,
      { latestAt: string; count: number; source: string }
    >();
    for (const status of Object.values(fieldStatus)) {
      const existing = groupedBySource.get(status.source);
      if (!existing) {
        groupedBySource.set(status.source, {
          latestAt: status.updated_at,
          count: 1,
          source: status.source,
        });
      } else {
        existing.count += 1;
        if (status.updated_at > existing.latestAt) {
          existing.latestAt = status.updated_at;
        }
      }
    }
    for (const group of groupedBySource.values()) {
      const kind = SOURCE_TO_KIND[group.source as CustomerMemory["field_status"][string]["source"]];
      if (!kind) continue;
      events.push({
        id: `${slug}.${kind}.${group.latestAt}`,
        kind,
        at: group.latestAt,
        chapterSlug: slug,
        chapterTitle: title,
        summary: summarizeFieldGroup(kind, group.count, title),
      });
    }

    // ── Attachments: most recent first.
    const attachments = (row.attachments ?? []) as CustomerMemory["attachments"];
    for (const att of attachments) {
      events.push({
        id: `${slug}.attachment.${att.id}`,
        kind: "attachment_uploaded",
        at: att.created_at,
        chapterSlug: slug,
        chapterTitle: title,
        summary: `${att.kind === "file" ? "File" : "Link"} added to ${title}`,
        detail: att.label,
      });
    }
  }

  // Sort newest first, then trim. Stable on ties (same-timestamp events
  // keep their iteration order, which is fine — the user can't tell).
  events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return events.slice(0, limit);
}

function summarizeFieldGroup(kind: ActivityKind, count: number, title: string): string {
  const noun = count === 1 ? "field" : "fields";
  switch (kind) {
    case "fields_extracted_from_upload":
      return `Extracted ${count} ${noun} from a doc into ${title}`;
    case "fields_filled_by_scrape":
      return `Pre-filled ${count} ${noun} in ${title} from your website`;
    case "fields_filled_by_user":
      return `You filled ${count} ${noun} in ${title}`;
    case "fields_filled_by_agent":
      return `Jason filled ${count} ${noun} in ${title}`;
    default:
      return `Updated ${count} ${noun} in ${title}`;
  }
}

/** Format an ISO timestamp as a short relative time ("2 hours ago"). */
export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  const diffWk = Math.floor(diffDay / 7);
  if (diffWk < 5) return `${diffWk} week${diffWk === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

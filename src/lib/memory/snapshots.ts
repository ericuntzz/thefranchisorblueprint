/**
 * Memory snapshot helpers — versioning + rollback over `customer_memory`.
 *
 * Every meaningful write to a section row should snapshot the prior
 * state so the customer (or the agent on their behalf) can roll back.
 * This module centralizes:
 *
 *   - `captureSnapshot()` — call BEFORE a mutating write to record the
 *     current section contents under a labeled reason
 *   - `listSnapshots()` — read snapshot history for a section
 *   - `rollbackToSnapshot()` — restore a snapshot back into
 *     customer_memory; takes a fresh snapshot first so the rollback
 *     itself is reversible
 *   - `pruneOldSnapshots()` — keep at most MAX_PER_SECTION per
 *     (user, section), drop oldest first
 *
 * Row schema lives in migration 0021. Snapshot payloads are jsonb of
 * shape { contentMd, fields, fieldStatus, confidence, attachments }.
 *
 * Capacity: we cap at 20 snapshots per section. A customer iterating
 * heavily over weeks doesn't get unbounded growth, and 20 is more than
 * enough rollback history for the kind of edits that happen in
 * practice — the most-recent ~5 cover 99% of "I want my old text
 * back" cases.
 */

import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { CustomerMemory } from "@/lib/supabase/types";
import { isValidMemoryFileSlug, type MemoryFileSlug } from "./files";

/** How many snapshots we retain per (user, section). Older ones drop. */
export const MAX_SNAPSHOTS_PER_SECTION = 20;

export type SnapshotSource =
  | "pre_draft"
  | "pre_redraft"
  | "pre_scrape"
  | "pre_user_edit"
  | "pre_extract"
  | "pre_field_save"
  | "manual";

export type SnapshotPayload = {
  contentMd: string;
  fields: CustomerMemory["fields"];
  fieldStatus: CustomerMemory["field_status"];
  confidence: CustomerMemory["confidence"];
  attachments: CustomerMemory["attachments"];
};

/**
 * Capture a snapshot of a section's current state. Reads the current
 * `customer_memory` row and stores its contents as a snapshot. Skips
 * cleanly if the row doesn't exist yet — no point snapshotting
 * "nothing".
 *
 * Best-effort: snapshot failures must not block the underlying write
 * the caller is about to do, so we log and return rather than throw.
 */
export async function captureSnapshot(args: {
  userId: string;
  slug: MemoryFileSlug;
  source: SnapshotSource;
  reason?: string;
}): Promise<void> {
  if (!isValidMemoryFileSlug(args.slug)) return;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("customer_memory")
    .select("content_md, fields, field_status, confidence, attachments")
    .eq("user_id", args.userId)
    .eq("file_slug", args.slug)
    .maybeSingle();
  if (error) {
    console.warn("[snapshots] capture read failed:", error.message);
    return;
  }
  if (!data) return; // nothing to snapshot
  const payload: SnapshotPayload = {
    contentMd: data.content_md ?? "",
    fields: (data.fields ?? {}) as CustomerMemory["fields"],
    fieldStatus: (data.field_status ?? {}) as CustomerMemory["field_status"],
    confidence: data.confidence ?? "draft",
    attachments: (data.attachments ?? []) as CustomerMemory["attachments"],
  };
  const { error: insertErr } = await admin
    .from("memory_snapshots")
    .insert({
      user_id: args.userId,
      section_slug: args.slug,
      payload,
      reason: args.reason ?? null,
      source: args.source,
    });
  if (insertErr) {
    console.warn("[snapshots] capture insert failed:", insertErr.message);
    return;
  }
  // Fire-and-forget pruning so the table doesn't grow unbounded.
  void pruneOldSnapshots(args.userId, args.slug).catch((e) => {
    console.warn(
      "[snapshots] prune failed (non-fatal):",
      e instanceof Error ? e.message : e,
    );
  });
}

// listSnapshots + rollbackToSnapshot removed 2026-05-10 — the
// /api/agent/snapshots route + its UI (SnapshotHistoryButton) were
// retired. The capture path (captureSnapshot / pruneOldSnapshots)
// still runs inside upsertMemoryWithProvenance, so the
// memory_snapshots table keeps a record; the public read/restore
// API can be reintroduced when there's a UI consumer again.

/** Trim snapshots beyond MAX_SNAPSHOTS_PER_SECTION, oldest first. */
export async function pruneOldSnapshots(
  userId: string,
  slug: MemoryFileSlug,
): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("memory_snapshots")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .select("id, created_at" as any)
    .eq("user_id", userId)
    .eq("section_slug", slug)
    .order("created_at", { ascending: false });
  if (error || !data || data.length <= MAX_SNAPSHOTS_PER_SECTION) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toDelete = (data as any[])
    .slice(MAX_SNAPSHOTS_PER_SECTION)
    .map((r) => r.id as string);
  if (toDelete.length === 0) return;
  await admin.from("memory_snapshots").delete().in("id", toDelete);
}

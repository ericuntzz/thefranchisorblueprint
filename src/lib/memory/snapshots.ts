/**
 * Memory snapshot helpers — versioning + rollback over `customer_memory`.
 *
 * Every meaningful write to a chapter row should snapshot the prior
 * state so the customer (or the agent on their behalf) can roll back.
 * This module centralizes:
 *
 *   - `captureSnapshot()` — call BEFORE a mutating write to record the
 *     current chapter contents under a labeled reason
 *   - `listSnapshots()` — read snapshot history for a chapter
 *   - `rollbackToSnapshot()` — restore a snapshot back into
 *     customer_memory; takes a fresh snapshot first so the rollback
 *     itself is reversible
 *   - `pruneOldSnapshots()` — keep at most MAX_PER_CHAPTER per
 *     (user, chapter), drop oldest first
 *
 * Row schema lives in migration 0021. Snapshot payloads are jsonb of
 * shape { contentMd, fields, fieldStatus, confidence, attachments }.
 *
 * Capacity: we cap at 20 snapshots per chapter. A customer iterating
 * heavily over weeks doesn't get unbounded growth, and 20 is more than
 * enough rollback history for the kind of edits that happen in
 * practice — the most-recent ~5 cover 99% of "I want my old text
 * back" cases.
 */

import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { CustomerMemory } from "@/lib/supabase/types";
import { isValidMemoryFileSlug, type MemoryFileSlug } from "./files";

/** How many snapshots we retain per (user, chapter). Older ones drop. */
export const MAX_SNAPSHOTS_PER_CHAPTER = 20;

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

export type SnapshotRow = {
  id: string;
  userId: string;
  chapterSlug: MemoryFileSlug;
  payload: SnapshotPayload;
  reason: string | null;
  source: SnapshotSource;
  createdAt: string;
};

/**
 * Capture a snapshot of a chapter's current state. Reads the current
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
      chapter_slug: args.slug,
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

/** Return snapshot history for one chapter, newest first. */
export async function listSnapshots(args: {
  userId: string;
  slug: MemoryFileSlug;
}): Promise<SnapshotRow[]> {
  if (!isValidMemoryFileSlug(args.slug)) return [];
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("memory_snapshots")
    .select("id, user_id, chapter_slug, payload, reason, source, created_at")
    .eq("user_id", args.userId)
    .eq("chapter_slug", args.slug)
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("[snapshots] list failed:", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    chapterSlug: r.chapter_slug as MemoryFileSlug,
    payload: r.payload as SnapshotPayload,
    reason: r.reason ?? null,
    source: r.source as SnapshotSource,
    createdAt: r.created_at,
  }));
}

/**
 * Restore a snapshot's payload back into customer_memory. Captures a
 * fresh snapshot of the current state first so the rollback itself
 * can be reverted.
 */
export async function rollbackToSnapshot(args: {
  userId: string;
  slug: MemoryFileSlug;
  snapshotId: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!isValidMemoryFileSlug(args.slug)) {
    return { ok: false, error: `Invalid slug: ${args.slug}` };
  }
  const admin = getSupabaseAdmin();

  // Read target snapshot.
  const { data: snapData, error: snapErr } = await admin
    .from("memory_snapshots")
    .select("payload")
    .eq("id", args.snapshotId)
    .eq("user_id", args.userId)
    .eq("chapter_slug", args.slug)
    .maybeSingle();
  if (snapErr) return { ok: false, error: snapErr.message };
  if (!snapData) return { ok: false, error: "Snapshot not found" };
  const payload = snapData.payload as SnapshotPayload;

  // Capture current state under "manual" source so the rollback can be undone.
  await captureSnapshot({
    userId: args.userId,
    slug: args.slug,
    source: "manual",
    reason: "Before rollback",
  });

  // Restore.
  const { error: upsertErr } = await admin.from("customer_memory").upsert(
    {
      user_id: args.userId,
      file_slug: args.slug,
      content_md: payload.contentMd,
      fields: payload.fields,
      field_status: payload.fieldStatus,
      confidence: payload.confidence,
      attachments: payload.attachments,
    },
    { onConflict: "user_id,file_slug" },
  );
  if (upsertErr) return { ok: false, error: upsertErr.message };
  return { ok: true };
}

/** Trim snapshots beyond MAX_SNAPSHOTS_PER_CHAPTER, oldest first. */
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
    .eq("chapter_slug", slug)
    .order("created_at", { ascending: false });
  if (error || !data || data.length <= MAX_SNAPSHOTS_PER_CHAPTER) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toDelete = (data as any[])
    .slice(MAX_SNAPSHOTS_PER_CHAPTER)
    .map((r) => r.id as string);
  if (toDelete.length === 0) return;
  await admin.from("memory_snapshots").delete().in("id", toDelete);
}

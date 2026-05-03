/**
 * Server-only Memory helpers.
 *
 * The Memory store is a per-user directory of markdown files
 * (customer_memory) with a parallel per-claim audit table
 * (customer_memory_provenance). Each file double-duty as the agent's
 * source of truth AND the live draft of a chapter in the customer's
 * Franchisor Blueprint.
 *
 * NEVER import this module from a Client Component — it pulls in the
 * service-role Supabase client. Use it from Server Components, Server
 * Actions, Route Handlers, and `src/lib/agent/*`.
 */

import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  ChapterAttachment,
  CustomerMemory,
  CustomerMemoryProvenance,
} from "@/lib/supabase/types";
import {
  type MemoryFileSlug,
  MEMORY_FILE_TITLES,
  isValidMemoryFileSlug,
} from "./files";

export type { MemoryFileSlug } from "./files";
export { MEMORY_FILES, MEMORY_FILE_TITLES, isValidMemoryFileSlug } from "./files";

/** A single claim's provenance — what the agent inserts after a draft. */
export type ProvenanceEntry = {
  /** Anchor embedded in the markdown (e.g. "para-3"). */
  claimId: string;
  sourceType: CustomerMemoryProvenance["source_type"];
  /** URL or storage path; null when source is intrinsic (voice timestamp etc.). */
  sourceRef: string | null;
  /** Quote/line from the source — surfaced on hover. */
  sourceExcerpt: string | null;
};

/**
 * Read one chapter from Memory. Returns null when the chapter doesn't
 * exist yet (empty chapter — the agent has nothing to seed it with yet).
 */
export async function readMemoryFile(
  userId: string,
  slug: MemoryFileSlug,
): Promise<CustomerMemory | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("customer_memory")
    .select("*")
    .eq("user_id", userId)
    .eq("file_slug", slug)
    .maybeSingle();
  if (error) {
    console.error(`[memory] readMemoryFile(${slug}) failed:`, error.message);
    throw new Error(`Memory read failed: ${error.message}`);
  }
  return data;
}

/**
 * Read every chapter the customer has — used for full Memory snapshots
 * fed into the agent's prompt context. Returns rows in slug-defined order
 * (so prompt-cache prefixes stay stable).
 */
export async function readAllMemory(userId: string): Promise<CustomerMemory[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("customer_memory")
    .select("*")
    .eq("user_id", userId);
  if (error) {
    console.error(`[memory] readAllMemory failed:`, error.message);
    throw new Error(`Memory read failed: ${error.message}`);
  }
  return data ?? [];
}

/**
 * Snapshot every Memory chapter for the agent's prompt context. Empty
 * chapters are included with an explicit empty marker so the agent can
 * see what's missing rather than just what's present.
 *
 * Stable ordering matters: the snapshot string is part of the agent's
 * prompt-cache prefix, and any reorder invalidates the cache.
 */
export async function getMemorySnapshotForPrompt(
  userId: string,
): Promise<string> {
  const rows = await readAllMemory(userId);
  const bySlug = new Map(rows.map((r) => [r.file_slug, r]));

  const sections: string[] = [];
  // Iterate the canonical slug list to guarantee deterministic order.
  const { MEMORY_FILES } = await import("./files");
  for (const slug of MEMORY_FILES) {
    const row = bySlug.get(slug);
    const title = MEMORY_FILE_TITLES[slug];
    sections.push(
      `## ${title} (\`${slug}\`)\n\n` +
        (row && row.content_md.trim()
          ? row.content_md.trim()
          : "_(empty — no content yet)_"),
    );
  }
  return sections.join("\n\n---\n\n");
}

/**
 * Atomic upsert: replace a chapter's content + its provenance set in one
 * RPC call. Defers to the SQL function so we can't end up with a draft
 * pointing at provenance for the prior version (or vice versa).
 *
 * `lastUpdatedBy` semantics:
 *   - "agent"   — drafted by the AI
 *   - "user"    — typed/edited by the customer
 *   - "jason"   — a coach (Tier 2/3) edited the draft
 *   - "scraper" — pre-fill from website / external source
 */
export async function upsertMemoryWithProvenance(args: {
  userId: string;
  slug: MemoryFileSlug;
  contentMd: string;
  confidence: CustomerMemory["confidence"];
  lastUpdatedBy: CustomerMemory["last_updated_by"];
  provenance: ProvenanceEntry[];
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.rpc("upsert_memory_with_provenance", {
    p_user_id: args.userId,
    p_file_slug: args.slug,
    p_content_md: args.contentMd,
    p_confidence: args.confidence,
    p_last_updated_by: args.lastUpdatedBy,
    p_provenance: args.provenance.map((p) => ({
      claim_id: p.claimId,
      source_type: p.sourceType,
      source_ref: p.sourceRef,
      source_excerpt: p.sourceExcerpt,
    })),
  });
  if (error) {
    console.error(`[memory] upsertMemoryWithProvenance failed:`, error.message);
    throw new Error(`Memory write failed: ${error.message}`);
  }
}

/**
 * Customer-edit path. Updates content_md only (no provenance changes —
 * the provenance for a customer edit is intrinsic: "user typed this on
 * date X"). last_updated_by is forced to "user".
 *
 * Caller is responsible for auth — pass the actual user_id from
 * `auth.getUser()`. Service-role client is used here (RLS bypass) so we
 * can update from server actions cleanly.
 */
export async function userEditMemoryFile(args: {
  userId: string;
  slug: MemoryFileSlug;
  contentMd: string;
}): Promise<void> {
  if (!isValidMemoryFileSlug(args.slug)) {
    throw new Error(`Unknown memory file slug: ${args.slug}`);
  }
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("customer_memory").upsert(
    {
      user_id: args.userId,
      file_slug: args.slug,
      content_md: args.contentMd,
      last_updated_by: "user",
      // Note: confidence is *not* changed by a user edit. If the agent
      // had drafted at "inferred", a user edit doesn't auto-promote it
      // to "verified" — we leave that as an explicit confirmation step.
    },
    { onConflict: "user_id,file_slug" },
  );
  if (error) {
    console.error(`[memory] userEditMemoryFile failed:`, error.message);
    throw new Error(`Memory write failed: ${error.message}`);
  }
}

/**
 * Write a batch of field values for a single chapter. Replaces the
 * `fields` jsonb wholesale (after merging with what's already there)
 * and updates `field_status` for each field that changed.
 *
 * Use this from the form-save path (server action). The shape mirrors
 * what the editor UI sends: `{ fieldName: value }` for changes,
 * `source` describing where the values came from (`user_typed` for
 * the customer's form, `agent_inference` / `scraper` / etc. for
 * agent-driven writes).
 *
 * `null` values are stored explicitly (cleared field, not "never set").
 * Fields not in the input are left untouched.
 */
export async function writeMemoryFields(args: {
  userId: string;
  slug: MemoryFileSlug;
  /** Field name → new value. `null` means cleared. */
  changes: Record<string, string | number | boolean | string[] | null>;
  /** Where these values came from. Determines `field_status[name].source`. */
  source: CustomerMemory["field_status"][string]["source"];
  /** Optional human-readable note attached to every changed field. */
  note?: string;
}): Promise<void> {
  if (!isValidMemoryFileSlug(args.slug)) {
    throw new Error(`Unknown memory file slug: ${args.slug}`);
  }
  const supabase = getSupabaseAdmin();

  // Read-modify-write: pull the existing row, merge fields, write back.
  // Postgres jsonb has merge operators (`||`) but we want to update
  // field_status entries surgically per changed field, so the JS-side
  // merge is cleaner than a single CTE.
  const { data: existing } = await supabase
    .from("customer_memory")
    .select("fields, field_status")
    .eq("user_id", args.userId)
    .eq("file_slug", args.slug)
    .maybeSingle();

  const currentFields =
    (existing?.fields as CustomerMemory["fields"] | null) ?? {};
  const currentStatus =
    (existing?.field_status as CustomerMemory["field_status"] | null) ?? {};

  const nextFields: CustomerMemory["fields"] = { ...currentFields };
  const nextStatus: CustomerMemory["field_status"] = { ...currentStatus };
  const now = new Date().toISOString();

  for (const [name, value] of Object.entries(args.changes)) {
    nextFields[name] = value;
    nextStatus[name] = {
      source: args.source,
      updated_at: now,
      ...(args.note ? { note: args.note } : {}),
    };
  }

  const { error } = await supabase.from("customer_memory").upsert(
    {
      user_id: args.userId,
      file_slug: args.slug,
      fields: nextFields,
      field_status: nextStatus,
      // last_updated_by reflects who DROVE the change. The agent
      // pipeline overrides this when calling from agent code. For
      // user form submits, "user" is correct.
      last_updated_by: args.source === "user_typed" ? "user" : "agent",
    },
    { onConflict: "user_id,file_slug" },
  );
  if (error) {
    console.error(`[memory] writeMemoryFields failed:`, error.message);
    throw new Error(`Memory field write failed: ${error.message}`);
  }
}

/**
 * Sufficiency check for the chapter-draft pipeline.
 *
 * The agent should NOT attempt a fresh chapter draft if Memory is
 * effectively empty across the entire customer — Opus will dutifully
 * produce a skeleton riddled with `[NEEDS INPUT: ...]` placeholders
 * (Eric's feedback: "this is confusing"). Cheaper and clearer to refuse
 * up-front and route the customer to fill fields, scrape their site, or
 * record a voice intake first.
 *
 * "Sufficient" today means ANY of:
 *   - At least one chapter has ≥100 chars of `content_md` (scrape, prior
 *     draft, or customer prose). 100 chars eliminates near-empty rows
 *     that exist only because some metadata column was set.
 *   - At least 3 structured fields populated across all chapters
 *     (signals the customer has typed at least the basics).
 *
 * Returns the signals so the caller can pass them to the UI for a
 * targeted "what to do next" message.
 */
export async function hasSufficientMemoryForDraft(userId: string): Promise<{
  sufficient: boolean;
  signals: {
    chaptersWithContent: number;
    chaptersWithFields: number;
    totalFieldsPopulated: number;
  };
}> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("customer_memory")
    .select("content_md, fields")
    .eq("user_id", userId);
  if (error) {
    console.error(`[memory] hasSufficientMemoryForDraft failed:`, error.message);
    throw new Error(`Memory read failed: ${error.message}`);
  }

  let chaptersWithContent = 0;
  let chaptersWithFields = 0;
  let totalFieldsPopulated = 0;

  for (const row of (data ?? []) as Array<{
    content_md: string | null;
    fields: Record<string, unknown> | null;
  }>) {
    if ((row.content_md ?? "").trim().length >= 100) chaptersWithContent += 1;
    const fields = row.fields ?? {};
    let countThisRow = 0;
    for (const v of Object.values(fields)) {
      if (v == null) continue;
      if (typeof v === "string" && v.trim() === "") continue;
      if (Array.isArray(v) && v.length === 0) continue;
      countThisRow += 1;
    }
    if (countThisRow > 0) chaptersWithFields += 1;
    totalFieldsPopulated += countThisRow;
  }

  const sufficient = chaptersWithContent >= 1 || totalFieldsPopulated >= 3;
  return {
    sufficient,
    signals: {
      chaptersWithContent,
      chaptersWithFields,
      totalFieldsPopulated,
    },
  };
}

/**
 * Read just the structured-fields layer for one chapter. Returns null
 * if the chapter has no row yet (every field is empty).
 */
export async function readMemoryFields(
  userId: string,
  slug: MemoryFileSlug,
): Promise<{
  fields: CustomerMemory["fields"];
  fieldStatus: CustomerMemory["field_status"];
} | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("customer_memory")
    .select("fields, field_status")
    .eq("user_id", userId)
    .eq("file_slug", slug)
    .maybeSingle();
  if (error) {
    console.error(`[memory] readMemoryFields(${slug}) failed:`, error.message);
    throw new Error(`Memory read failed: ${error.message}`);
  }
  if (!data) return null;
  return {
    fields: (data.fields ?? {}) as CustomerMemory["fields"],
    fieldStatus: (data.field_status ?? {}) as CustomerMemory["field_status"],
  };
}

/**
 * Read the per-chapter attachments list. Returns an empty array when
 * the chapter has no row yet or no attachments. Order matches the
 * stored array (insertion order = newest at the end).
 */
export async function readAttachments(
  userId: string,
  slug: MemoryFileSlug,
): Promise<ChapterAttachment[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("customer_memory")
    .select("attachments")
    .eq("user_id", userId)
    .eq("file_slug", slug)
    .maybeSingle();
  if (error) {
    console.error(`[memory] readAttachments(${slug}) failed:`, error.message);
    throw new Error(`Attachments read failed: ${error.message}`);
  }
  return ((data?.attachments ?? []) as ChapterAttachment[]) ?? [];
}

/**
 * Append one attachment to a chapter. Creates the chapter row if it
 * doesn't exist yet (so attaching is allowed before any prose has
 * been drafted). Atomic at the row level — concurrent appends to the
 * same chapter race in JS, but our UI surfaces are single-customer-
 * per-chapter so the practical risk is nil.
 */
export async function appendAttachment(args: {
  userId: string;
  slug: MemoryFileSlug;
  attachment: ChapterAttachment;
}): Promise<void> {
  if (!isValidMemoryFileSlug(args.slug)) {
    throw new Error(`Unknown memory file slug: ${args.slug}`);
  }
  const supabase = getSupabaseAdmin();
  const existing = await readAttachments(args.userId, args.slug);
  const next = [...existing, args.attachment];
  const { error } = await supabase.from("customer_memory").upsert(
    {
      user_id: args.userId,
      file_slug: args.slug,
      attachments: next,
    },
    { onConflict: "user_id,file_slug" },
  );
  if (error) {
    console.error(`[memory] appendAttachment failed:`, error.message);
    throw new Error(`Attachment write failed: ${error.message}`);
  }
}

/**
 * Remove an attachment by its id. Returns the removed entry (so the
 * caller can also delete the underlying storage object) or null if
 * no match.
 */
export async function deleteAttachment(args: {
  userId: string;
  slug: MemoryFileSlug;
  attachmentId: string;
}): Promise<ChapterAttachment | null> {
  if (!isValidMemoryFileSlug(args.slug)) {
    throw new Error(`Unknown memory file slug: ${args.slug}`);
  }
  const supabase = getSupabaseAdmin();
  const existing = await readAttachments(args.userId, args.slug);
  const removed = existing.find((a) => a.id === args.attachmentId) ?? null;
  if (!removed) return null;
  const next = existing.filter((a) => a.id !== args.attachmentId);
  const { error } = await supabase
    .from("customer_memory")
    .update({ attachments: next })
    .eq("user_id", args.userId)
    .eq("file_slug", args.slug);
  if (error) {
    console.error(`[memory] deleteAttachment failed:`, error.message);
    throw new Error(`Attachment delete failed: ${error.message}`);
  }
  return removed;
}

/**
 * Read the provenance entries for one chapter — used by the on-hover UI
 * to surface "where did this come from?" tooltips.
 */
export async function readProvenance(
  userId: string,
  slug: MemoryFileSlug,
): Promise<CustomerMemoryProvenance[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("customer_memory_provenance")
    .select("*")
    .eq("user_id", userId)
    .eq("file_slug", slug)
    .order("created_at", { ascending: true });
  if (error) {
    console.error(`[memory] readProvenance failed:`, error.message);
    throw new Error(`Provenance read failed: ${error.message}`);
  }
  return data ?? [];
}

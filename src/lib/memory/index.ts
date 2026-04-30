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

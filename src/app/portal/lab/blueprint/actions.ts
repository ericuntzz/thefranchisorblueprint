"use server";

/**
 * Server actions for the Blueprint canvas. Currently just one:
 * `saveMemoryFields` — invoked by the inline field editor when the
 * customer hits Save.
 *
 * Auth: must be logged in + have at least one paid purchase. Same
 * gate as the rest of /portal — the structured-fields editor is a
 * paid feature.
 *
 * The action is intentionally narrow: it accepts a single chapter's
 * field changes and writes them. Cross-chapter saves don't exist
 * (you edit one chapter at a time in the UI).
 */

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { readMemoryFile, writeMemoryFields } from "@/lib/memory";
import { isValidMemoryFileSlug } from "@/lib/memory/files";
import { stripLockMarkers, wrapAsLocked } from "@/lib/memory/locks";
import { replaceSection } from "@/lib/memory/sections";
import type { Purchase } from "@/lib/supabase/types";

type FieldValue = string | number | boolean | string[] | null;

/**
 * Save a batch of structured-field changes for one chapter.
 * Returns nothing on success; throws on failure (Server Actions
 * surface thrown errors to the client `onSave` rejection).
 */
export async function saveMemoryFields(args: {
  slug: string;
  /** Field name → new value. Only changed fields. `null` clears. */
  changes: Record<string, FieldValue>;
}): Promise<void> {
  if (!isValidMemoryFileSlug(args.slug)) {
    throw new Error(`Unknown chapter: ${args.slug}`);
  }

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not signed in.");
  }

  const { data: purchasesData } = await supabase
    .from("purchases")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "paid")
    .limit(1);
  const purchases = (purchasesData ?? []) as Purchase[];
  if (purchases.length === 0) {
    throw new Error("No active purchase.");
  }

  await writeMemoryFields({
    userId: user.id,
    slug: args.slug,
    changes: args.changes,
    source: "user_typed",
  });

  // Refresh the Blueprint canvas so the new values render on next view.
  revalidatePath("/portal/lab/blueprint");
}

/**
 * Save a customer's inline-prose edit for one chapter.
 *
 * Called when the customer types directly into the chapter prose
 * (instead of editing structured fields). The raw textarea content is
 * wrapped in a single user-locked span so future Opus redrafts know to
 * preserve it verbatim. The draft pipeline reads these markers and is
 * explicitly instructed not to paraphrase, shorten, or drop them.
 *
 * v1 model: hand-editing the prose locks the WHOLE chapter. Opus can
 * still append new sections on a redraft, but won't modify the saved
 * text. A v2 enhancement is paragraph-level locking via diff so the
 * agent can re-do untouched paragraphs while leaving edited ones
 * alone.
 */
export async function saveChapterProse(args: {
  slug: string;
  /** Raw markdown the customer typed. We strip any pre-existing
   *  user-locked markers before re-wrapping the whole thing — the user
   *  re-saving means the latest text is the canonical version. */
  contentMd: string;
}): Promise<void> {
  if (!isValidMemoryFileSlug(args.slug)) {
    throw new Error(`Unknown chapter: ${args.slug}`);
  }

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: purchasesData } = await supabase
    .from("purchases")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "paid")
    .limit(1);
  const purchases = (purchasesData ?? []) as Purchase[];
  if (purchases.length === 0) throw new Error("No active purchase.");

  // Normalize: drop any existing locked markers (user is replacing
  // them) and trim trailing whitespace.
  const cleaned = stripLockMarkers(args.contentMd).trim();

  // Empty-save => clear the prose entirely (also clears any prior
  // locked content). Last_updated_by = user so the Blueprint header
  // reflects who wrote it.
  const wrapped = cleaned.length > 0 ? wrapAsLocked(cleaned) : "";

  // Use the admin client to bypass RLS — the userEditMemoryFile path
  // already does this. Auth is enforced above.
  const admin = getSupabaseAdmin();
  const { error } = await admin.from("customer_memory").upsert(
    {
      user_id: user.id,
      file_slug: args.slug,
      content_md: wrapped,
      last_updated_by: "user",
      // We don't auto-promote confidence on a user prose edit; leaves
      // whatever confidence the chapter had.
    },
    { onConflict: "user_id,file_slug" },
  );
  if (error) {
    console.error("[actions] saveChapterProse failed:", error.message);
    throw new Error(`Save failed: ${error.message}`);
  }

  revalidatePath("/portal/lab/blueprint");
}

/**
 * Save a single section's edits — the per-section flavor of the
 * inline-prose path. Splices the new body (and optionally an updated
 * heading) into the chapter's content_md at the specified section
 * index, wraps the new body in a user-locked span so future Opus
 * redrafts preserve it verbatim, and persists.
 *
 * Identifies the section by index, not by heading text — the customer
 * is allowed to rename a heading without breaking the persistence
 * link. If the index is out of range (chapter shape changed under us),
 * the action throws and the client surfaces a "save failed, reload"
 * message.
 */
export async function saveChapterSection(args: {
  slug: string;
  sectionIndex: number;
  /** New body markdown (heading line excluded). Will be re-wrapped in
   *  a fresh user-locked span; any pre-existing markers are stripped. */
  body: string;
  /** Optional new heading line including the `##` markup. Pass to
   *  rename the heading; omit to keep the original. Pass `null` to
   *  un-head a section (rare). */
  heading?: string | null;
}): Promise<void> {
  if (!isValidMemoryFileSlug(args.slug)) {
    throw new Error(`Unknown chapter: ${args.slug}`);
  }

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: purchasesData } = await supabase
    .from("purchases")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "paid")
    .limit(1);
  const purchases = (purchasesData ?? []) as Purchase[];
  if (purchases.length === 0) throw new Error("No active purchase.");

  const existing = await readMemoryFile(user.id, args.slug);
  const previousContent = existing?.content_md ?? "";

  // Strip lock markers from the user-supplied body (they're typing
  // clean text, not the marker syntax) and wrap as a single fresh
  // locked span so future redrafts preserve it.
  const cleanedBody = stripLockMarkers(args.body).trim();
  const wrappedBody = cleanedBody.length > 0 ? wrapAsLocked(cleanedBody) : "";

  const nextContent = replaceSection(previousContent, args.sectionIndex, {
    heading: args.heading,
    body: wrappedBody,
  });

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("customer_memory").upsert(
    {
      user_id: user.id,
      file_slug: args.slug,
      content_md: nextContent,
      last_updated_by: "user",
    },
    { onConflict: "user_id,file_slug" },
  );
  if (error) {
    console.error("[actions] saveChapterSection failed:", error.message);
    throw new Error(`Save failed: ${error.message}`);
  }

  revalidatePath("/portal/lab/blueprint");
}

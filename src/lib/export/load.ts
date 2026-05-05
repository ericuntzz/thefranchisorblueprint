/**
 * Build-context loader for the export pipeline.
 *
 * One round-trip: pulls every customer_memory row + the profile in
 * parallel, then runs the calc lib once to populate cross-chapter
 * computed fields. Returns the BuildContext that every deliverable
 * builder consumes.
 *
 * Service-role client because export is auth-gated upstream and we
 * want one round-trip without re-checking RLS on every chapter.
 */

import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { computeAllFormulas, type MemoryFieldsMap } from "@/lib/calc";
import {
  computeChapterReadiness,
  indexMemoryRows,
  overallReadinessPct,
} from "@/lib/memory/readiness";
import { MEMORY_FILES, type MemoryFileSlug } from "@/lib/memory/files";
import type { BuildContext, ChapterContent } from "./types";
import type { CustomerMemory, Profile } from "@/lib/supabase/types";

export async function loadBuildContext(userId: string): Promise<BuildContext> {
  const admin = getSupabaseAdmin();

  const [memoryRes, profileRes] = await Promise.all([
    admin
      .from("customer_memory")
      .select("user_id, file_slug, content_md, fields, confidence, attachments")
      .eq("user_id", userId),
    admin
      .from("profiles")
      .select("email, full_name, website_url")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  const rows = (memoryRes.data ?? []) as Array<
    Pick<
      CustomerMemory,
      "file_slug" | "content_md" | "fields" | "confidence" | "attachments"
    >
  >;
  const indexed = indexMemoryRows(rows);
  const profileRow = (profileRes.data ?? null) as Pick<
    Profile,
    "email" | "full_name" | "website_url"
  > | null;

  // Build per-chapter content map (only chapters with a row land here;
  // builders treat missing as empty).
  const memory: Partial<Record<MemoryFileSlug, ChapterContent>> = {};
  const fieldsMap: MemoryFieldsMap = {};
  for (const slug of MEMORY_FILES) {
    const row = indexed.get(slug);
    if (!row) continue;
    const fields = (row.fields ?? {}) as ChapterContent["fields"];
    memory[slug] = {
      slug,
      contentMd: row.content_md ?? "",
      fields,
      confidence: row.confidence,
    };
    fieldsMap[slug] = fields;
  }

  // Run the calc lib once — populates EBITDA margin, payback, derived
  // defaults, etc., that builders read instead of recomputing.
  const computed = computeAllFormulas(fieldsMap) as BuildContext["computed"];

  // Readiness % is computed the same way the Command Center does it.
  const chapterReadiness = computeChapterReadiness(indexed);
  const readinessPct = overallReadinessPct(chapterReadiness);

  return {
    userId,
    memory,
    computed,
    profile: {
      fullName: profileRow?.full_name ?? null,
      email: profileRow?.email ?? "",
      websiteUrl: profileRow?.website_url ?? null,
    },
    generatedAt: new Date().toISOString(),
    readinessPct,
  };
}

/**
 * Convenience accessor — pull a chapter's fields without the caller
 * having to type-narrow on the optional. Returns an empty object when
 * the chapter has no row, so builders can call `.fields.foo` without
 * throwing.
 */
export function chapterFields(
  ctx: BuildContext,
  slug: MemoryFileSlug,
): Record<string, string | number | boolean | string[] | null> {
  return ctx.memory[slug]?.fields ?? {};
}

/** Same as above but for the computed (calc lib) values. */
export function computedFields(
  ctx: BuildContext,
  slug: MemoryFileSlug,
): Record<string, number | null> {
  return ctx.computed[slug] ?? {};
}

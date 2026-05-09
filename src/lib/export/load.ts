/**
 * Build-context loader for the export pipeline.
 *
 * One round-trip: pulls every customer_memory row + the profile in
 * parallel, then runs the calc lib once to populate cross-section
 * computed fields. Returns the BuildContext that every deliverable
 * builder consumes.
 *
 * Service-role client because export is auth-gated upstream and we
 * want one round-trip without re-checking RLS on every section.
 */

import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { computeAllFormulas, type MemoryFieldsMap } from "@/lib/calc";
import {
  computeSectionReadiness,
  indexMemoryRows,
  overallReadinessPct,
} from "@/lib/memory/readiness";
import { MEMORY_FILES, type MemoryFileSlug } from "@/lib/memory/files";
import type { BuildContext, SectionContent } from "./types";
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

  // Build per-section content map (only sections with a row land here;
  // builders treat missing as empty).
  const memory: Partial<Record<MemoryFileSlug, SectionContent>> = {};
  const fieldsMap: MemoryFieldsMap = {};
  for (const slug of MEMORY_FILES) {
    const row = indexed.get(slug);
    if (!row) continue;
    const fields = (row.fields ?? {}) as SectionContent["fields"];
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
  const sectionReadiness = computeSectionReadiness(indexed);
  const readinessPct = overallReadinessPct(sectionReadiness);

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

// Pure helpers re-exported for backward compatibility — canonical
// implementations live in context-helpers.ts (no server-only guard,
// safe for client-side import chains).
export { sectionFields, computedFields } from "./context-helpers";

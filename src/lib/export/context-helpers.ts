/**
 * Pure helpers for reading from a BuildContext.
 *
 * Extracted from load.ts so that deliverable builders (which get
 * bundled into the client-side ExportsSection component via the
 * DELIVERABLES registry) don't transitively pull in "server-only".
 * These functions do zero I/O — just property lookups.
 */

import type { MemoryFileSlug } from "@/lib/memory/files";
import type { BuildContext } from "./types";

/**
 * Convenience accessor — pull a section's fields without the caller
 * having to type-narrow on the optional. Returns an empty object when
 * the section has no row, so builders can call `.fields.foo` without
 * throwing.
 */
export function sectionFields(
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

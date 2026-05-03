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
import { writeMemoryFields } from "@/lib/memory";
import { isValidMemoryFileSlug } from "@/lib/memory/files";
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

"use server";

/**
 * Server actions for the Question Queue (`/portal/lab/next`).
 *
 * `saveQueueAnswer` — write one field's answer into Memory and return.
 * The client advances locally (it already knows the queue order) and
 * we revalidate the queue route so a soft refresh shows the next state.
 *
 * Auth: must be logged in + have a paid purchase. Same gate as the
 * rest of /portal/lab.
 */

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import { writeMemoryFields } from "@/lib/memory";
import { isValidMemoryFileSlug } from "@/lib/memory/files";
import type { Purchase } from "@/lib/supabase/types";

type FieldValue = string | number | boolean | string[] | null;

/**
 * Save a single field answer captured from the queue. We deliberately
 * only accept ONE field per call — the queue is question-at-a-time on
 * purpose. Batching would defeat the guided experience.
 */
export async function saveQueueAnswer(args: {
  slug: string;
  fieldName: string;
  value: FieldValue;
}): Promise<void> {
  if (!isValidMemoryFileSlug(args.slug)) {
    throw new Error(`Unknown section: ${args.slug}`);
  }
  if (!args.fieldName || typeof args.fieldName !== "string") {
    throw new Error("fieldName is required");
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

  await writeMemoryFields({
    userId: user.id,
    slug: args.slug,
    changes: { [args.fieldName]: args.value },
    source: "user_typed",
  });

  // Revalidate both the queue route (so the next visit recomputes
  // freshly) and the Blueprint canvas (so the section card's filled-
  // count picks up the change if the customer flips back).
  revalidatePath("/portal/lab/next");
  revalidatePath("/portal/lab/blueprint");
  revalidatePath("/portal");
}

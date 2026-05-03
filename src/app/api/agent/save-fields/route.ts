/**
 * POST /api/agent/save-fields
 *
 * Generic per-chapter field-write endpoint. Used by the pre-draft
 * modal to persist inline blocker answers before kicking off a
 * draft. Different from the chat-tool path (which goes through
 * `update_memory_field` so the model can react to confirmations) —
 * this is a plain client-driven write.
 *
 * Body: { slug: MemoryFileSlug, changes: { [fieldName]: value } }
 *
 * Auth + paid-purchase gated.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isValidMemoryFileSlug, writeMemoryFields } from "@/lib/memory";
import type { Purchase } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 15;

type FieldValue = string | number | boolean | string[] | null;

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { data: purchasesData } = await supabase
    .from("purchases")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "paid")
    .limit(1);
  const purchases = (purchasesData ?? []) as Purchase[];
  if (purchases.length === 0) {
    return NextResponse.json({ error: "No active purchase" }, { status: 403 });
  }

  let body: { slug?: string; changes?: Record<string, FieldValue> };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.slug || !isValidMemoryFileSlug(body.slug)) {
    return NextResponse.json({ error: "Invalid or missing slug" }, { status: 400 });
  }
  if (!body.changes || typeof body.changes !== "object") {
    return NextResponse.json({ error: "changes is required" }, { status: 400 });
  }
  // Defensive: cap the batch size so a misbehaving client can't
  // dump arbitrary JSON into Memory through this endpoint.
  if (Object.keys(body.changes).length > 50) {
    return NextResponse.json({ error: "too many fields in one batch" }, { status: 413 });
  }

  try {
    await writeMemoryFields({
      userId: user.id,
      slug: body.slug,
      changes: body.changes,
      source: "user_typed",
    });
    revalidatePath("/portal/lab/blueprint");
    revalidatePath("/portal/lab/next");
    revalidatePath("/portal");
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "save failed";
    console.error("[agent/save-fields]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

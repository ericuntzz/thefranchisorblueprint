/**
 * GET /api/agent/draft-readiness?slug=<MemoryFileSlug>
 *
 * Returns DraftReadiness for the given chapter. Called by the
 * pre-draft modal on open so it can decide whether to show the
 * normal "notes + attachments" view OR the "answer these blockers
 * first" view.
 *
 * Auth: same gate as everywhere else in /api/agent — must be logged
 * in and have a paid purchase.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { assessDraftReadiness } from "@/lib/agent/draft-readiness";
import { isValidMemoryFileSlug } from "@/lib/memory";
import type { Purchase } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function GET(req: NextRequest) {
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

  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug || !isValidMemoryFileSlug(slug)) {
    return NextResponse.json(
      { error: "Invalid or missing slug" },
      { status: 400 },
    );
  }

  try {
    const readiness = await assessDraftReadiness({
      userId: user.id,
      slug,
    });
    return NextResponse.json(readiness);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "readiness failed";
    console.error("[agent/draft-readiness]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

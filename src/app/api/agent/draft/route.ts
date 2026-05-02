import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { draftChapter } from "@/lib/agent";
import {
  isValidMemoryFileSlug,
  upsertMemoryWithProvenance,
} from "@/lib/memory";
import type { Purchase } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/agent/draft
 *
 * Body: { slug: MemoryFileSlug, instruction?: string, persist?: boolean }
 *
 * Calls the Opus 4.7 chapter-draft pipeline for the requested chapter,
 * using everything the agent currently knows about the customer (their
 * full Memory snapshot + Jason's per-chapter principles + High Point
 * precedent if curated).
 *
 * persist=true (default): writes the result into customer_memory with
 *   the agent-supplied provenance.
 * persist=false: returns the draft without touching Memory — useful for
 *   "show me what you'd draft" previews or A/B comparisons.
 */
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

  let body: { slug?: string; instruction?: string; persist?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.slug || typeof body.slug !== "string") {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }
  if (!isValidMemoryFileSlug(body.slug)) {
    return NextResponse.json(
      { error: `Unknown chapter slug: ${body.slug}` },
      { status: 400 },
    );
  }
  const persist = body.persist !== false; // default true
  const instruction =
    (body.instruction ?? "").trim() ||
    "Draft this chapter from everything we know about the customer so far. Be aggressive — fill in what you can, mark gaps clearly with [NEEDS INPUT: ...].";

  try {
    const result = await draftChapter({
      userId: user.id,
      slug: body.slug,
      instruction,
    });
    if (persist) {
      await upsertMemoryWithProvenance({
        userId: user.id,
        slug: body.slug,
        contentMd: result.contentMd,
        // The agent drafts at "draft" confidence by default. The customer
        // promotes to "verified" by editing or explicitly accepting.
        confidence: "draft",
        lastUpdatedBy: "agent",
        provenance: result.provenance,
      });
    }
    return NextResponse.json({
      ok: true,
      slug: body.slug,
      persisted: persist,
      contentMd: result.contentMd,
      provenanceCount: result.provenance.length,
      usage: result.usage,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "draft failed";
    console.error("[agent/draft]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

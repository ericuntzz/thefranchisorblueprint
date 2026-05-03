import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { draftChapter } from "@/lib/agent";
import {
  hasSufficientMemoryForDraft,
  isValidMemoryFileSlug,
  upsertMemoryWithProvenance,
  writeMemoryFields,
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

  // Pre-flight: refuse to draft when Memory is too thin to produce
  // anything but a skeleton. Returning a structured "insufficient_context"
  // signal lets the UI route the customer to fill fields / scrape their
  // site / record voice intake first, instead of showing them a wall of
  // [NEEDS INPUT] placeholders.
  //
  // This check is global (across the whole customer's Memory), not
  // chapter-local — even an empty chapter is draftable if other chapters
  // have content the agent can reason from. We only refuse when the
  // entire Memory is effectively empty.
  try {
    const sufficiency = await hasSufficientMemoryForDraft(user.id);
    if (!sufficiency.sufficient) {
      return NextResponse.json(
        {
          ok: false,
          reason: "insufficient_context",
          message:
            "Jason needs at least a little context about your business before drafting a chapter. The chapter would be mostly placeholders right now — let's seed it first.",
          signals: sufficiency.signals,
        },
        { status: 422 },
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "sufficiency check failed";
    console.error("[agent/draft] sufficiency check failed:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

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
      // Persist the structured fields Opus extracted from its own
      // draft so "Edit fields" never opens blank when there's a real
      // chapter on the page. source="agent_inference" so the audit
      // log distinguishes these from values the customer typed.
      if (Object.keys(result.extractedFields).length > 0) {
        try {
          await writeMemoryFields({
            userId: user.id,
            slug: body.slug,
            changes: result.extractedFields,
            source: "agent_inference",
          });
        } catch (err) {
          // Non-fatal: prose is the primary deliverable.
          console.error(
            "[agent/draft] writeMemoryFields failed (non-fatal):",
            err instanceof Error ? err.message : err,
          );
        }
      }
    }
    return NextResponse.json({
      ok: true,
      slug: body.slug,
      persisted: persist,
      contentMd: result.contentMd,
      provenanceCount: result.provenance.length,
      extractedFieldCount: Object.keys(result.extractedFields).length,
      usage: result.usage,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "draft failed";
    console.error("[agent/draft]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { DAILY_CAP_CENTS } from "@/lib/intake/cap-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/intake/cap-status
 *
 * Returns whether the URL-prefill lead magnet is currently accepting
 * new requests today, or whether we've hit the $20/day cap and the
 * hero should swap to the assessment CTA.
 *
 * Public, no auth — the hero loads this on mount to decide which
 * variant to render. Cached for 60s in CDN to avoid hammering
 * Supabase on every page load.
 */
export async function GET() {
  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("intake_daily_spend")
    .select("total_cents")
    .eq("date", today)
    .maybeSingle();

  const spentCents = (data?.total_cents as number | undefined) ?? 0;
  const capped = spentCents >= DAILY_CAP_CENTS;

  return NextResponse.json(
    {
      capped,
      spentCents,
      capCents: DAILY_CAP_CENTS,
    },
    {
      headers: {
        // Short cache so we don't hammer Supabase, but short enough
        // that the cap recovery (midnight UTC) propagates quickly.
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    },
  );
}

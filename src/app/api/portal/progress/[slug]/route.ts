import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getCapability } from "@/lib/capabilities";
import type { Purchase, Tier } from "@/lib/supabase/types";

export const runtime = "nodejs";

/**
 * Toggle a capability's completion state for the current user.
 *
 * POST with form field `action=mark` → upsert (idempotent complete)
 * POST with form field `action=unmark` → UPDATE completed_at to NULL,
 *   keeping the started_at/last_viewed_at history (the row stays, so
 *   we don't lose view-tracking data when a customer toggles off).
 *
 * Single endpoint, single button per capability — server flips state and
 * redirects back. RLS on capability_progress enforces user_id = auth.uid().
 *
 * CSRF defense: SameSite=Lax cookies plus an explicit Origin header check
 * (rejects POSTs from other origins even if browser SameSite handling is
 * permissive).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const cap = getCapability(slug);
  if (!cap) return NextResponse.json({ error: "Unknown Mastery" }, { status: 404 });

  // Reject cross-origin form submissions
  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) {
    return NextResponse.json({ error: "Cross-origin POST blocked" }, { status: 403 });
  }

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Guard: user must have a paid purchase that covers this capability's tier.
  // Today every capability is minTier 1, but this check matters as soon as
  // tier-gated content ships.
  const { data: purchasesData } = await supabase
    .from("purchases")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "paid");
  const purchases = (purchasesData ?? []) as Purchase[];
  if (purchases.length === 0) {
    return NextResponse.json({ error: "No active purchase" }, { status: 403 });
  }
  const userTier = Math.max(...purchases.map((p) => p.tier), 1) as Tier;
  if (cap.minTier > userTier) {
    return NextResponse.json({ error: "Tier required" }, { status: 403 });
  }

  const form = await req.formData();
  const action = (form.get("action") || "").toString().toLowerCase();

  if (action === "mark") {
    const now = new Date().toISOString();
    // Upsert. On insert: also set started_at + last_viewed_at = now() so
    // the view-tracking columns stay consistent. On conflict: just bump
    // completed_at + last_viewed_at; preserve started_at.
    const { error } = await supabase.from("capability_progress").upsert(
      {
        user_id: user.id,
        capability_slug: slug,
        started_at: now,
        last_viewed_at: now,
        completed_at: now,
      },
      { onConflict: "user_id,capability_slug" },
    );
    if (error) {
      console.error(`[portal/progress] mark failed: ${error.message}`);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else if (action === "unmark") {
    // UPDATE rather than DELETE — preserves view history (started_at /
    // last_viewed_at) so we still know when they first opened it.
    const { error } = await supabase
      .from("capability_progress")
      .update({ completed_at: null })
      .eq("user_id", user.id)
      .eq("capability_slug", slug);
    if (error) {
      console.error(`[portal/progress] unmark failed: ${error.message}`);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    return NextResponse.json({ error: "Bad action" }, { status: 400 });
  }

  // Validate referer is same-origin before bouncing back; fall back safely
  // to /portal/{slug} otherwise.
  const referer = req.headers.get("referer");
  let redirectTo = `${req.nextUrl.origin}/portal/${slug}`;
  if (referer) {
    try {
      const parsed = new URL(referer);
      if (parsed.origin === req.nextUrl.origin) {
        redirectTo = referer;
      }
    } catch {
      // bad referer URL — keep the safe default
    }
  }
  return NextResponse.redirect(redirectTo, 303);
}

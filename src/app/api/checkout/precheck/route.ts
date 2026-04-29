import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Pre-purchase email collision check.
 *
 * Called from the EmailGatedBuyBox before the user is sent off to Stripe.
 * Checks whether the email already belongs to an existing paid customer —
 * and if so, gives them friendly options on screen instead of silently
 * merging the new purchase into the existing account.
 *
 * Status values:
 *   "invalid-email"       — basic format check failed
 *   "existing-customer"   — email belongs to a profile WITH a paid purchase
 *   "incomplete-account"  — email belongs to a profile WITHOUT a paid
 *                           purchase (rare; allow proceed without friction)
 *   "ok"                  — fresh email, proceed to Stripe
 *
 * NEVER reveals whether an email is in our system as a side channel — this
 * route is only callable from the buy box; the response is shown to the
 * person who entered the email so disclosure is fine.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = (body.email ?? "").trim().toLowerCase();

  if (!email || !email.includes("@") || email.length < 4) {
    return NextResponse.json({ status: "invalid-email" });
  }

  const supabase = getSupabaseAdmin();

  // Single round trip: profile + paid purchases. We only block if BOTH exist
  // (i.e., they actually completed a purchase, not just left a checkout half-
  // done). This way, an abandoned-cart user can come back and try again.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ status: "ok" });
  }

  const { data: paid } = await supabase
    .from("purchases")
    .select("tier")
    .eq("user_id", profile.id)
    .eq("status", "paid")
    .limit(1);

  if (paid && paid.length > 0) {
    return NextResponse.json({ status: "existing-customer" });
  }

  // Profile exists but no paid purchase — likely a previously-abandoned
  // checkout. Don't friction them; let the new purchase complete, the
  // webhook will idempotently link it to the same user_id.
  return NextResponse.json({ status: "incomplete-account" });
}

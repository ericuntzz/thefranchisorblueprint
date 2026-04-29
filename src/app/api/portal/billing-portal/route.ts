import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Creates a Stripe Customer Portal session for the authenticated user
 * and 303-redirects to it. The hosted portal lets customers see all
 * past invoices, manage payment methods, and update billing info — all
 * Stripe-hosted, no UI we have to maintain.
 *
 * Form-friendly: posts from /portal/account redirect through here.
 */
export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(
      `${origin}/portal/login?next=/portal/account`,
      303,
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.stripe_customer_id) {
    // No Stripe customer on file — bounce back with a query param so the
    // account page can show a friendly "no billing data yet" message.
    return NextResponse.redirect(`${origin}/portal/account?err=no_billing`, 303);
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${origin}/portal/account`,
    });
    return NextResponse.redirect(session.url, 303);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error(`[billing-portal] Stripe error: ${message}`);
    return NextResponse.redirect(`${origin}/portal/account?err=portal_failed`, 303);
  }
}

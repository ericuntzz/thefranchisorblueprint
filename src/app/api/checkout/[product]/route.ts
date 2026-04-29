import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getProduct, priceIdFor, type ProductSlug } from "@/lib/products";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getOfferFor, isPromoActive } from "@/lib/upgrade-offers";
import type { Tier } from "@/lib/supabase/types";

export const runtime = "nodejs";

/**
 * Generic checkout entrypoint. Accepts any product slug and creates an
 * appropriate Stripe Checkout Session.
 *
 * For upgrade products, automatically applies the UPGRADE10 coupon if the
 * authenticated user has an active 48-hour promo offer. After the window,
 * the credit-forward base price is still valid (no coupon applied).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ product: string }> },
) {
  const { product: slug } = await params;
  const product = getProduct(slug);
  if (!product) {
    return NextResponse.json({ error: "Unknown product" }, { status: 404 });
  }
  if (!product.buyableDirectly && !slug.startsWith("upgrade-")) {
    return NextResponse.json(
      { error: "This product isn't available for direct purchase" },
      { status: 400 },
    );
  }

  const origin = req.nextUrl.origin;

  // For upgrade products: confirm the user is signed in, validate that the
  // upgrade slug matches their actual current tier (a Tier 1 customer
  // can NOT purchase upgrade-2-3 to skip the proper credit-forward fee),
  // and check for an active 48hr promo offer to decide whether to apply the coupon.
  let applyPromoCoupon = false;
  let userEmail: string | undefined;
  if (slug.startsWith("upgrade-")) {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const loginUrl = new URL("/portal/login", origin);
      loginUrl.searchParams.set("next", "/portal/upgrade");
      return NextResponse.redirect(loginUrl, 303);
    }
    userEmail = user.email ?? undefined;

    // Source-tier validation: prevents revenue leak from crafted upgrade
    // slugs (e.g., a Tier 1 customer hitting /api/checkout/upgrade-2-3 to
    // jump straight to Builder for $21,000 instead of $26,503).
    const { data: purchasesData } = await supabase
      .from("purchases")
      .select("tier")
      .eq("user_id", user.id)
      .eq("status", "paid");
    const purchases = (purchasesData ?? []) as { tier: number }[];
    if (purchases.length === 0) {
      return NextResponse.redirect(`${origin}/portal`, 303);
    }
    const currentTier = Math.max(...purchases.map((p) => p.tier), 1);

    const [src, tgt] = parseUpgradeSlug(slug);
    if (!src || !tgt || src !== currentTier || tgt <= currentTier) {
      // Wrong source for this user, OR target isn't actually higher than current.
      return NextResponse.redirect(`${origin}/portal/upgrade`, 303);
    }
    if ((src === 1 || src === 2) && (tgt === 2 || tgt === 3)) {
      const offer = await getOfferFor(user.id, src, tgt);
      applyPromoCoupon = isPromoActive(offer);
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price: priceIdFor(product.slug),
        quantity: 1,
      },
    ],
    success_url: `${origin}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: slug.startsWith("upgrade-")
      ? `${origin}/portal/upgrade`
      : slug === "sample-call" || slug === "phase-coaching"
        ? `${origin}/portal/coaching`
        // Until /programs/blueprint-plus exists, send Plus cancellers back
        // to the standard Blueprint product page rather than 404ing them.
        : `${origin}/programs/blueprint`,
    allow_promotion_codes: !slug.startsWith("upgrade-"), // upgrades use programmatic coupon
    billing_address_collection: "required",
    customer_creation: "always",
    customer_email: userEmail, // pre-fills for upgrade flows so users don't re-type
    discounts: applyPromoCoupon
      ? [{ coupon: process.env.STRIPE_COUPON_UPGRADE10 ?? "UPGRADE10" }]
      : undefined,
    payment_intent_data: {
      description: product.name,
      metadata: { product: product.slug },
    },
    metadata: { product: product.slug },
  });

  if (!session.url) {
    return new Response("Stripe did not return a checkout URL", { status: 502 });
  }

  return NextResponse.redirect(session.url, 303);
}

function parseUpgradeSlug(slug: string): [Tier | null, Tier | null] {
  const m = slug.match(/^upgrade-(\d)-(\d)$/);
  if (!m) return [null, null];
  const src = Number(m[1]);
  const tgt = Number(m[2]);
  if ((src === 1 || src === 2) && (tgt === 2 || tgt === 3) && src < tgt) {
    return [src as Tier, tgt as Tier];
  }
  return [null, null];
}

// Suppress unused warning until tier-aware error pages reference it.
void (null as unknown as ProductSlug);

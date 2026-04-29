import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
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
 * Behavior matrix:
 *
 *   Anonymous visitor + Blueprint/Plus
 *     → Stripe collects email; we pass customer_creation: 'always'.
 *
 *   Logged-in customer + add-on (sample-call, phase-coaching)
 *     → reuse their existing Stripe customer ID so saved cards are pre-
 *       filled. customer_email defaults from auth user. Returns to /portal.
 *
 *   Logged-in customer + upgrade (upgrade-1-2 etc.)
 *     → same saved-card behavior; validates src tier matches current tier
 *       (prevents revenue leak from crafted slugs); applies UPGRADE10
 *       coupon if their 48hr promo is active. Returns to /portal.
 *
 * Stripe rejects allow_promotion_codes + discounts together — we only set
 * one OR the other, never both.
 *
 * Stripe also rejects customer + customer_creation together — we use
 * customer (saved-card flow) when we have one, customer_creation otherwise.
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
  const isUpgrade = slug.startsWith("upgrade-");
  const isAddOn = slug === "sample-call" || slug === "phase-coaching";
  const requiresAuth = isUpgrade || isAddOn;

  // Anonymous (Blueprint / Plus) purchases route through the email-gate buy
  // box, which posts the user-supplied email as form data. We pre-fill
  // Stripe's email field with it AND store it in session metadata so the
  // webhook can detect cases where the buyer overrides the pre-fill at
  // Stripe (rare but possible — Stripe lets users change pre-filled emails).
  let prechecedEmail: string | undefined;
  if (!requiresAuth) {
    try {
      const form = await req.formData();
      const raw = form.get("email");
      if (typeof raw === "string") {
        const candidate = raw.trim().toLowerCase();
        if (candidate && candidate.includes("@") && candidate.length < 254) {
          prechecedEmail = candidate;
        }
      }
    } catch {
      // Older buy-box clients (or direct API hits) won't send form data.
      // Stripe will collect the email itself; safety net runs without it.
    }
  }

  // Auth check — for upgrades AND add-ons (both happen from inside the portal).
  // For new tier purchases (Blueprint, Plus), the user may be anonymous.
  let userEmail: string | undefined;
  let stripeCustomerId: string | undefined;
  let applyPromoCoupon = false;

  if (requiresAuth) {
    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      const loginUrl = new URL("/portal/login", origin);
      loginUrl.searchParams.set(
        "next",
        isUpgrade ? "/portal/upgrade" : "/portal/coaching",
      );
      return NextResponse.redirect(loginUrl, 303);
    }
    userEmail = user.email ?? undefined;

    // Pull profile + purchases in one round trip for tier validation +
    // saved-card lookup.
    const [{ data: profile }, { data: purchasesData }] = await Promise.all([
      supabase
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("purchases")
        .select("tier")
        .eq("user_id", user.id)
        .eq("status", "paid"),
    ]);
    stripeCustomerId = profile?.stripe_customer_id ?? undefined;
    const purchases = (purchasesData ?? []) as { tier: number }[];
    if (purchases.length === 0) {
      return NextResponse.redirect(`${origin}/portal`, 303);
    }
    const currentTier = Math.max(...purchases.map((p) => p.tier), 1);

    if (isUpgrade) {
      const [src, tgt] = parseUpgradeSlug(slug);
      if (!src || !tgt || src !== currentTier || tgt <= currentTier) {
        // Wrong source for this user, OR target isn't actually higher.
        return NextResponse.redirect(`${origin}/portal/upgrade`, 303);
      }
      if ((src === 1 || src === 2) && (tgt === 2 || tgt === 3)) {
        const offer = await getOfferFor(user.id, src, tgt);
        applyPromoCoupon = isPromoActive(offer);
      }
    }
  }

  // Build session params, branching customer/email handling and promo handling
  // to satisfy Stripe's mutual-exclusivity rules.
  const successUrl = requiresAuth
    ? `${origin}/portal?just_purchased=${slug}&session_id={CHECKOUT_SESSION_ID}`
    : `${origin}/thank-you?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = isUpgrade
    ? `${origin}/portal/upgrade`
    : isAddOn
      ? `${origin}/portal/coaching`
      : `${origin}/programs/blueprint`;

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    line_items: [{ price: priceIdFor(product.slug), quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    billing_address_collection: "required",
    payment_intent_data: {
      description: product.name,
      metadata: {
        product: product.slug,
        ...(prechecedEmail ? { prechecked_email: prechecedEmail } : {}),
      },
    },
    metadata: {
      product: product.slug,
      // Webhook safety net: if `customer_details.email` at session-completion
      // doesn't match this prechecked value, the user changed it on Stripe's
      // side. Worth a heads-up to the team in case of silent collision.
      ...(prechecedEmail ? { prechecked_email: prechecedEmail } : {}),
    },
  };

  // Customer handling (Stripe forbids `customer` + `customer_creation` together)
  if (stripeCustomerId) {
    // Returning customer — reuse their Stripe Customer so saved cards show.
    sessionParams.customer = stripeCustomerId;
    // Stripe ignores customer_email when customer is set; don't pass it.
  } else {
    sessionParams.customer_creation = "always";
    // Anonymous Blueprint/Plus purchase: pre-fill from the buy-box gate if
    // we have it; otherwise let Stripe collect.
    if (userEmail) {
      sessionParams.customer_email = userEmail;
    } else if (prechecedEmail) {
      sessionParams.customer_email = prechecedEmail;
    }
  }

  // Promo handling (Stripe forbids `discounts` + `allow_promotion_codes` together).
  // Upgrades that hit our promo window get a programmatic UPGRADE10 coupon.
  // Public-facing purchases let customers paste promo codes (e.g. WINBACK1K).
  if (applyPromoCoupon) {
    sessionParams.discounts = [
      { coupon: process.env.STRIPE_COUPON_UPGRADE10 ?? "UPGRADE10" },
    ];
  } else if (!isUpgrade) {
    sessionParams.allow_promotion_codes = true;
  }
  // Else (upgrade with no active promo): neither flag — no promo path.

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(sessionParams);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error(`[checkout/${slug}] Stripe error: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }

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

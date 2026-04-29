import type Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  PRODUCTS,
  getProduct,
  type Product,
  type ProductSlug,
} from "@/lib/products";
import {
  PROMO_WINDOW_HOURS,
  createUpgradeOffersForTier,
  markOfferRedeemed,
} from "@/lib/upgrade-offers";
import { enqueueEmail } from "@/lib/email/queue";
import { sendTemplate } from "@/lib/email/dispatch";
import type { Tier } from "@/lib/supabase/types";

/**
 * Idempotent fulfillment for any paid Stripe Checkout Session.
 *
 * Looks up the product by metadata.product slug, grants the right combo of
 * tier + coaching credits, writes the purchase row, redeems any related
 * upgrade offer.
 */
export async function ensureUserAndPurchase(
  session: Stripe.Checkout.Session,
): Promise<string | null> {
  const email = session.customer_details?.email?.toLowerCase() ?? "";
  if (!email) {
    console.error(`[fulfillment] session ${session.id} has no customer email — skipping`);
    return null;
  }
  if (session.payment_status !== "paid") {
    return null;
  }

  const productSlug = (session.metadata?.product ?? "").toLowerCase() as ProductSlug;
  const product = getProduct(productSlug) ?? PRODUCTS.blueprint; // safe default
  const fullName = session.customer_details?.name ?? null;
  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  const supabase = getSupabaseAdmin();

  // 1) get-or-create the auth user
  let userId: string;
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    userId = existing.id;
  } else {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: fullName, source: "stripe_checkout" },
    });
    if (createErr || !created.user) {
      const code = (createErr as { code?: string } | null)?.code;
      const message = createErr?.message ?? "";
      const isAlreadyRegistered =
        code === "email_exists" ||
        /already.*registered|user.*exists|email.*registered/i.test(message);
      if (isAlreadyRegistered) {
        const { data: existingByEmail } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", email)
          .maybeSingle();
        if (existingByEmail) {
          userId = existingByEmail.id;
        } else {
          const { data: listed } = await supabase.auth.admin.listUsers({
            page: 1,
            perPage: 50,
          });
          const match = listed?.users?.find((u) => u.email?.toLowerCase() === email);
          if (!match) {
            console.error(`[fulfillment] race recovery failed for ${email}: ${message}`);
            return null;
          }
          userId = match.id;
        }
      } else {
        console.error(`[fulfillment] auth.admin.createUser failed for ${email}: ${message}`);
        return null;
      }
    } else {
      userId = created.user.id;
    }
  }

  // 2) Compute the new effective tier — only INCREASE, never demote.
  // For tier-granting products, we take max(currentTier, product.grantsTier).
  // For non-tier products (sample-call, phase-coaching), tier stays the same.
  let nextTier: Tier | null = null;
  if (product.grantsTier !== null) {
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("tier")
      .eq("id", userId)
      .maybeSingle();
    const currentTier = (existingProfile?.tier ?? 1) as Tier;
    nextTier = Math.max(currentTier, product.grantsTier) as Tier;
  }

  // 3) Upsert profile with optional tier bump
  const profileUpdate: {
    id: string;
    email: string;
    full_name: string | null;
    stripe_customer_id: string | null;
    tier?: Tier;
  } = {
    id: userId,
    email,
    full_name: fullName,
    stripe_customer_id: stripeCustomerId,
  };
  if (nextTier !== null) profileUpdate.tier = nextTier;

  const { error: profileErr } = await supabase
    .from("profiles")
    .upsert(profileUpdate, { onConflict: "id" });
  if (profileErr) {
    console.error(`[fulfillment] profile upsert failed: ${profileErr.message}`);
  }

  // 4) Bump coaching_credits separately (atomic increment)
  if (product.grantsCoachingCalls > 0) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("coaching_credits")
      .eq("id", userId)
      .maybeSingle();
    const newCredits = (prof?.coaching_credits ?? 0) + product.grantsCoachingCalls;
    await supabase.from("profiles").update({ coaching_credits: newCredits }).eq("id", userId);
  }

  // 5) Insert purchase row
  const { error: purchaseErr } = await supabase.from("purchases").insert({
    user_id: userId,
    stripe_session_id: session.id,
    stripe_payment_intent_id: paymentIntentId,
    product: product.slug,
    tier: (nextTier ?? 1) as Tier,
    amount_cents: session.amount_total ?? 0,
    currency: (session.currency ?? "usd").toLowerCase(),
    status: "paid",
  });
  if (purchaseErr && purchaseErr.code !== "23505") {
    console.error(`[fulfillment] purchase insert failed: ${purchaseErr.message}`);
  }

  // 6) For upgrade products: mark the matching offer redeemed so it disappears from UI.
  if (product.slug === "upgrade-1-2") await markOfferRedeemed(userId, 1, 2);
  if (product.slug === "upgrade-1-3") await markOfferRedeemed(userId, 1, 3);
  if (product.slug === "upgrade-2-3") await markOfferRedeemed(userId, 2, 3);

  return userId;
}

/**
 * Post-purchase lifecycle orchestration. Welcome email immediately, drip
 * emails scheduled into the queue. Called from the webhook after fulfillment.
 */
export async function dispatchPostPurchaseLifecycle(args: {
  userId: string;
  email: string;
  fullName: string | null;
  productSlug: ProductSlug;
  amountCents: number;
  origin: string;
}): Promise<void> {
  const product = getProduct(args.productSlug);
  if (!product) return;

  // Add-on products (sample-call, phase-coaching) don't get a tier-style welcome.
  // We could send a "thanks for your call" email later — for v1, no email.
  const isLifecycleEligible =
    product.grantsTier !== null && product.grantsCoachingCalls === 0
      ? true // pure tier products (blueprint, navigator, builder)
      : product.slug === "blueprint-plus";

  if (!isLifecycleEligible) {
    console.log(`[lifecycle] no welcome scheduled for ${product.slug} (add-on / upgrade)`);
    // Still dispatch the win-back-eligible offers etc. for upgrade products
    if (
      product.slug === "upgrade-1-2" ||
      product.slug === "upgrade-1-3" ||
      product.slug === "upgrade-2-3"
    ) {
      // Upgrade purchases: customer is already logged in, no welcome email needed.
      // We could send a confirmation email here as a v2 polish.
    }
    return;
  }

  const firstName = args.fullName?.split(" ")[0] ?? null;
  const amountFormatted = (args.amountCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });

  // ─── 1. Welcome email — immediate. Includes a magic-link to land them in /portal.
  const supabase = getSupabaseAdmin();
  const { data: linkResult, error: linkErr } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: args.email,
    options: { redirectTo: `${args.origin}/auth/confirm?next=/portal` },
  });
  if (linkErr || !linkResult.properties?.hashed_token) {
    console.error(`[lifecycle] generateLink failed: ${linkErr?.message}`);
    return;
  }
  const magicLink = new URL(`${args.origin}/auth/confirm`);
  magicLink.searchParams.set("token_hash", linkResult.properties.hashed_token);
  magicLink.searchParams.set("type", "magiclink");
  magicLink.searchParams.set("next", "/portal");

  await sendTemplate("welcome", args.email, {
    firstName,
    productName: product.name,
    amountFormatted,
    magicLink: magicLink.toString(),
  });

  // ─── 2. Upgrade offers + drip emails (only for entry tiers, not for upgrades)
  if (product.grantsTier === 1) {
    await createUpgradeOffersForTier(args.userId, 1);
    await scheduleUpgradeDripT1(args, firstName);
  } else if (product.grantsTier === 2) {
    await createUpgradeOffersForTier(args.userId, 2);
    await scheduleUpgradeDripT2(args, firstName);
  }
}

async function scheduleUpgradeDripT1(
  args: {
    userId: string;
    email: string;
    productSlug: ProductSlug;
    origin: string;
  },
  firstName: string | null,
): Promise<void> {
  const product = getProduct(args.productSlug);
  if (!product) return;

  // 24h after purchase: nudge with the 48hr offer
  const upgradeNudgeAt = new Date(Date.now() + 24 * 3600 * 1000);
  const upgradeNudgePayload = {
    firstName,
    currentTierName: product.name,
    targetTierName: "Navigator",
    upgradeUrl: `${args.origin}/portal/upgrade`,
    hoursRemaining: PROMO_WINDOW_HOURS - 24,
    promoPriceFormatted: "$4,953",
    basePriceFormatted: "$5,503",
  };
  await enqueueEmail({
    userId: args.userId,
    recipientEmail: args.email,
    template: "upgrade-nudge",
    payload: upgradeNudgePayload,
    sendAfter: upgradeNudgeAt,
    dedupeKey: `upgrade-nudge:${args.userId}:1->2`,
  });

  // 36h after purchase: 12h-remaining countdown
  const offerExpiringAt = new Date(Date.now() + 36 * 3600 * 1000);
  await enqueueEmail({
    userId: args.userId,
    recipientEmail: args.email,
    template: "offer-expiring",
    payload: {
      firstName,
      hoursRemaining: 12,
      promoPriceFormatted: "$4,953",
      basePriceFormatted: "$5,503",
      upgradeUrl: `${args.origin}/portal/upgrade`,
      targetTierName: "Navigator",
    },
    sendAfter: offerExpiringAt,
    dedupeKey: `offer-expiring:${args.userId}:1->2`,
  });
}

async function scheduleUpgradeDripT2(
  args: {
    userId: string;
    email: string;
    productSlug: ProductSlug;
    origin: string;
  },
  firstName: string | null,
): Promise<void> {
  const product = getProduct(args.productSlug);
  if (!product) return;

  const upgradeNudgeAt = new Date(Date.now() + 24 * 3600 * 1000);
  await enqueueEmail({
    userId: args.userId,
    recipientEmail: args.email,
    template: "upgrade-nudge",
    payload: {
      firstName,
      currentTierName: product.name,
      targetTierName: "Builder",
      upgradeUrl: `${args.origin}/portal/upgrade`,
      hoursRemaining: PROMO_WINDOW_HOURS - 24,
      promoPriceFormatted: "$18,900",
      basePriceFormatted: "$21,000",
    },
    sendAfter: upgradeNudgeAt,
    dedupeKey: `upgrade-nudge:${args.userId}:2->3`,
  });

  const offerExpiringAt = new Date(Date.now() + 36 * 3600 * 1000);
  await enqueueEmail({
    userId: args.userId,
    recipientEmail: args.email,
    template: "offer-expiring",
    payload: {
      firstName,
      hoursRemaining: 12,
      promoPriceFormatted: "$18,900",
      basePriceFormatted: "$21,000",
      upgradeUrl: `${args.origin}/portal/upgrade`,
      targetTierName: "Builder",
    },
    sendAfter: offerExpiringAt,
    dedupeKey: `offer-expiring:${args.userId}:2->3`,
  });
}

/**
 * Refund handler — flips the purchases row + schedules a 14-day win-back email.
 */
export async function markPurchaseRefunded(charge: Stripe.Charge): Promise<void> {
  const piId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id ?? null;
  if (!piId) {
    console.error(`[fulfillment] charge ${charge.id} has no payment_intent`);
    return;
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("purchases")
    .update({
      status: "refunded",
      refunded_at: new Date().toISOString(),
      refund_amount_cents: charge.amount_refunded,
    })
    .eq("stripe_payment_intent_id", piId)
    .select("id, user_id, tier, product");

  if (error) {
    console.error(`[fulfillment] mark refunded failed for pi=${piId}: ${error.message}`);
    return;
  }
  if (!data || data.length === 0) {
    console.warn(`[fulfillment] charge.refunded for unknown PI ${piId}`);
    return;
  }
  const refunded = data[0];
  console.log(
    `[fulfillment] marked refunded user=${refunded.user_id} tier=${refunded.tier} pi=${piId} amount=${charge.amount_refunded}`,
  );

  // Schedule win-back email for +14 days
  const { data: prof } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", refunded.user_id)
    .maybeSingle();
  if (!prof?.email) return;

  const product = getProduct(refunded.product) ?? PRODUCTS.blueprint;
  await enqueueEmail({
    userId: refunded.user_id,
    recipientEmail: prof.email,
    template: "win-back",
    payload: {
      firstName: prof.full_name?.split(" ")[0] ?? null,
      refundedProductName: product.name,
      navigatorUrl: "https://www.thefranchisorblueprint.com/programs",
    },
    sendAfter: new Date(Date.now() + 14 * 24 * 3600 * 1000),
    dedupeKey: `win-back:${refunded.user_id}:${refunded.id}`,
  });
}

/** Backwards-compat shim — kept so old webhook code doesn't break. */
export async function sendWelcomeMagicLinkEmail(
  email: string,
  origin: string,
): Promise<void> {
  // Silent fallback: we now drive the welcome via dispatchPostPurchaseLifecycle.
  // If anything still calls this, it's a no-op.
  void email;
  void origin;
}

// Re-export commonly imported names so call sites don't need to update paths
export type { Product, ProductSlug } from "@/lib/products";

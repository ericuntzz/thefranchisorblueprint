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

  // ─── 1. Get-or-create the auth user ──────────────────────────────────────
  // Try stripe_customer_id first (unambiguous link to existing customer);
  // fall back to email. This prevents fragmenting an existing customer
  // across multiple Supabase accounts if Stripe's collected email differs
  // (e.g., "Eric@…" vs "eric@…" — though we lowercase — or a typo).
  let userId: string | null = null;
  if (stripeCustomerId) {
    const { data: byStripe } = await supabase
      .from("profiles")
      .select("id")
      .eq("stripe_customer_id", stripeCustomerId)
      .maybeSingle();
    if (byStripe) userId = byStripe.id;
  }
  if (!userId) {
    const { data: byEmail } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (byEmail) userId = byEmail.id;
  }
  if (!userId) {
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

  // ─── 2. Idempotency gate: INSERT the purchase row first ──────────────────
  // The unique constraint on stripe_session_id means a re-run (e.g., webhook
  // + thank-you page racing) gets a 23505 conflict. We use that as the
  // signal "already fulfilled" — and skip every side effect below it.
  // Previously side effects (especially add_coaching_credits) ran on every
  // call, double-granting credits. The INSERT is now the SINGLE source of
  // truth for "is this a fresh fulfillment or a replay?"
  const { data: existingProfileForTier } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", userId)
    .maybeSingle();
  const currentTier = (existingProfileForTier?.tier ?? 1) as Tier;
  const purchaseTier = (product.grantsTier ?? currentTier) as Tier;

  const { error: purchaseErr } = await supabase.from("purchases").insert({
    user_id: userId,
    stripe_session_id: session.id,
    stripe_payment_intent_id: paymentIntentId,
    product: product.slug,
    tier: purchaseTier,
    amount_cents: session.amount_total ?? 0,
    currency: (session.currency ?? "usd").toLowerCase(),
    status: "paid",
  });

  if (purchaseErr?.code === "23505") {
    console.log(
      `[fulfillment] session ${session.id} already fulfilled — idempotent skip (no double-credit, no double-redemption)`,
    );
    return userId;
  }
  if (purchaseErr) {
    console.error(`[fulfillment] purchase insert failed: ${purchaseErr.message}`);
    // Couldn't even record the purchase — don't grant any side effects.
    return userId;
  }

  // ─── 3. New purchase recorded — run side effects ─────────────────────────
  // From here down, we know this is the FIRST time we're processing this
  // checkout session. Everything below MUST NOT be retried independently
  // (no redirect, no manual replay) without first deleting the purchase row.

  // 3a. Profile upsert: never demote tier; safe to run on retry too.
  const nextTier =
    product.grantsTier !== null
      ? (Math.max(currentTier, product.grantsTier) as Tier)
      : currentTier;
  const { error: profileErr } = await supabase
    .from("profiles")
    .upsert(
      {
        id: userId,
        email,
        full_name: fullName,
        stripe_customer_id: stripeCustomerId,
        tier: nextTier,
      },
      { onConflict: "id" },
    );
  if (profileErr) {
    console.error(`[fulfillment] profile upsert failed: ${profileErr.message}`);
  }

  // 3b. Atomic coaching credit grant.
  if (product.grantsCoachingCalls > 0) {
    const { error: rpcErr } = await supabase.rpc("add_coaching_credits", {
      uid: userId,
      delta: product.grantsCoachingCalls,
    });
    if (rpcErr) {
      console.error(`[fulfillment] add_coaching_credits failed: ${rpcErr.message}`);
    }
  }

  // 3c. Mark the corresponding upgrade offer redeemed (so it disappears
  // from the upgrade page and isn't double-discounted).
  if (product.slug === "upgrade-1-2") await markOfferRedeemed(userId, 1, 2);
  if (product.slug === "upgrade-1-3") await markOfferRedeemed(userId, 1, 3);
  if (product.slug === "upgrade-2-3") await markOfferRedeemed(userId, 2, 3);

  return userId;
}

/**
 * Post-purchase lifecycle orchestration. Welcome email immediately, drip
 * emails scheduled into the queue. Called from the webhook after fulfillment.
 *
 * Behavior matrix:
 *   blueprint, blueprint-plus → welcome email + Tier 1 offers + drip
 *   navigator                 → welcome email + Tier 2 offers + drip
 *   builder                   → welcome email (no upgrade — already top tier)
 *   upgrade-1-2               → no welcome (already in portal) + Tier 2 offers + drip
 *   upgrade-1-3, upgrade-2-3  → no welcome, no further offers (top tier)
 *   sample-call, phase-coaching → no welcome (just a coaching add-on)
 */
export async function dispatchPostPurchaseLifecycle(args: {
  userId: string;
  email: string;
  fullName: string | null;
  productSlug: ProductSlug;
  amountCents: number;
  origin: string;
  /** Stripe session ID — used as the Resend idempotency key on the welcome
   * email so a webhook retry can't deliver the same welcome twice. */
  sessionId: string;
}): Promise<void> {
  const product = getProduct(args.productSlug);
  if (!product) return;

  const firstName = args.fullName?.split(" ")[0] ?? null;
  const isUpgrade = args.productSlug.startsWith("upgrade-");
  const isAddOn =
    args.productSlug === "sample-call" || args.productSlug === "phase-coaching";

  // 1. Welcome email — for first-time tier purchases only. Upgrades and add-ons
  // skip the welcome (customer is already logged in for those).
  if (!isUpgrade && !isAddOn && product.grantsTier !== null) {
    const amountFormatted = (args.amountCents / 100).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });
    const supabase = getSupabaseAdmin();
    const { data: linkResult, error: linkErr } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: args.email,
      options: { redirectTo: `${args.origin}/auth/confirm?next=/portal` },
    });
    if (linkErr || !linkResult.properties?.hashed_token) {
      console.error(`[lifecycle] generateLink failed: ${linkErr?.message}`);
    } else {
      const magicLink = new URL(`${args.origin}/auth/confirm`);
      magicLink.searchParams.set("token_hash", linkResult.properties.hashed_token);
      magicLink.searchParams.set("type", "magiclink");
      magicLink.searchParams.set("next", "/portal");
      await sendTemplate(
        "welcome",
        args.email,
        {
          firstName,
          productName: product.name,
          amountFormatted,
          magicLink: magicLink.toString(),
        },
        { idempotencyKey: `welcome:${args.sessionId}` },
      );
    }
  }

  // 2. Create upgrade offers + queue drip for the customer's NEW effective tier.
  // The "effective tier" = the tier this product gets them to (or keeps them at).
  // Add-ons (sample-call, phase-coaching) don't change tier, so we don't trigger
  // a fresh offer cycle for them.
  if (isAddOn) return;
  const newTier = product.grantsTier;
  if (newTier === 1) {
    await createUpgradeOffersForTier(args.userId, 1);
    await scheduleUpgradeDripT1(args, firstName);
  } else if (newTier === 2) {
    // Both pure Navigator AND upgrade-1-2 land here — both should have a
    // fresh 48hr promo to reach Builder.
    await createUpgradeOffersForTier(args.userId, 2);
    await scheduleUpgradeDripT2(args, firstName);
  }
  // Tier 3 (builder, upgrade-1-3, upgrade-2-3) — no further upgrade path.
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
      // Plus product page (where they can paste WINBACK1K at Stripe checkout
      // to get $1,000 off). The /programs/blueprint page hosts the inline
      // upsell that toggles to Plus.
      blueprintPlusUrl: "https://www.thefranchisorblueprint.com/programs/blueprint",
      promoCode: "WINBACK1K",
    },
    sendAfter: new Date(Date.now() + 14 * 24 * 3600 * 1000),
    dedupeKey: `win-back:${refunded.user_id}:${refunded.id}`,
  });
}

/**
 * Generates a single-use magic-link URL for an existing user. Used on the
 * /thank-you page so customers can land in /portal in one click without
 * waiting for email. Returns null on any failure (caller renders fallback).
 */
export async function generatePortalAccessUrl(
  email: string,
  origin: string,
): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${origin}/auth/confirm?next=/portal` },
  });
  if (error || !data.properties?.hashed_token) {
    console.error(`[fulfillment] generateLink failed for ${email}: ${error?.message}`);
    return null;
  }
  const url = new URL(`${origin}/auth/confirm`);
  url.searchParams.set("token_hash", data.properties.hashed_token);
  url.searchParams.set("type", "magiclink");
  url.searchParams.set("next", "/portal");
  return url.toString();
}

// Re-export commonly imported names so call sites don't need to update paths
export type { Product, ProductSlug } from "@/lib/products";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { PRODUCTS, upgradeProductFor } from "@/lib/products";
import type { Tier, UpgradeOffer } from "@/lib/supabase/types";

/**
 * 48-hour promo window: how long after the trigger the 10%-off price stays
 * eligible. After the window, the credit-forward base price is still valid
 * forever (lifetime price-paid credit, no expiration).
 */
export const PROMO_WINDOW_HOURS = 48;
export const PROMO_DISCOUNT_PERCENT = 10;

/**
 * Creates the appropriate upgrade offers for a user immediately after they
 * complete a purchase. Tier 1 buyers get offers for Tier 2 and Tier 3;
 * Tier 2 buyers get an offer for Tier 3; Tier 3 buyers get nothing.
 *
 * Idempotent: re-running for the same (user, source, target) updates the
 * promo_expires_at to extend the window. Safe to call from both webhook
 * and thank-you page.
 */
export async function createUpgradeOffersForTier(
  userId: string,
  sourceTier: Tier,
): Promise<void> {
  const targets: Tier[] = sourceTier === 1 ? [2, 3] : sourceTier === 2 ? [3] : [];
  if (targets.length === 0) return;

  const supabase = getSupabaseAdmin();
  const now = Date.now();
  const promoExpiresAt = new Date(now + PROMO_WINDOW_HOURS * 3600 * 1000).toISOString();

  for (const target of targets) {
    const product = upgradeProductFor(sourceTier, target);
    if (!product) continue;
    const baseCents = product.priceCents;
    const promoCents = Math.round(baseCents * (1 - PROMO_DISCOUNT_PERCENT / 100));

    const { error } = await supabase.from("upgrade_offers").upsert(
      {
        user_id: userId,
        source_tier: sourceTier as 1 | 2,
        target_tier: target as 2 | 3,
        base_amount_cents: baseCents,
        promo_amount_cents: promoCents,
        promo_expires_at: promoExpiresAt,
        triggered_by: "purchase",
      },
      { onConflict: "user_id,source_tier,target_tier" },
    );

    if (error) {
      console.error(
        `[upgrade-offers] failed to upsert offer ${sourceTier}->${target} for ${userId}: ${error.message}`,
      );
    } else {
      console.log(
        `[upgrade-offers] created offer ${sourceTier}->${target} for ${userId} (promo expires ${promoExpiresAt})`,
      );
    }
  }
}

/**
 * Looks up a user's active offer for a specific upgrade path.
 * Returns the offer record so the UI can show the right price + countdown.
 */
export async function getOfferFor(
  userId: string,
  sourceTier: 1 | 2,
  targetTier: 2 | 3,
): Promise<UpgradeOffer | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("upgrade_offers")
    .select("*")
    .eq("user_id", userId)
    .eq("source_tier", sourceTier)
    .eq("target_tier", targetTier)
    .is("redeemed_at", null)
    .maybeSingle();
  return (data ?? null) as UpgradeOffer | null;
}

/** Returns all of a user's not-yet-redeemed offers (for /portal/upgrade UI). */
export async function getActiveOffersForUser(userId: string): Promise<UpgradeOffer[]> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("upgrade_offers")
    .select("*")
    .eq("user_id", userId)
    .is("redeemed_at", null);
  return (data ?? []) as UpgradeOffer[];
}

export function isPromoActive(offer: UpgradeOffer | null): boolean {
  if (!offer) return false;
  return new Date(offer.promo_expires_at).getTime() > Date.now();
}

export function effectivePriceCents(offer: UpgradeOffer | null, fallbackCents: number): number {
  if (!offer) return fallbackCents;
  return isPromoActive(offer) ? offer.promo_amount_cents : offer.base_amount_cents;
}

/**
 * Marks an offer redeemed. Called from the webhook when an upgrade purchase
 * completes — so the offer no longer appears in the UI.
 */
export async function markOfferRedeemed(
  userId: string,
  sourceTier: 1 | 2,
  targetTier: 2 | 3,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("upgrade_offers")
    .update({ redeemed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("source_tier", sourceTier)
    .eq("target_tier", targetTier)
    .is("redeemed_at", null);
  if (error) {
    console.error(`[upgrade-offers] mark redeemed failed: ${error.message}`);
  }
}

// Pull product registry into the type space so consumers don't have to
// dual-import (just `import { PRODUCTS } from "./upgrade-offers"`).
export { PRODUCTS };

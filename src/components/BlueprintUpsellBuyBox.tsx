"use client";

import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { track } from "@/lib/analytics";

/**
 * Buy box for The Blueprint with an inline upsell to Blueprint Plus.
 *
 * Single-page upsell pattern — no extra clicks. The customer sees Blueprint
 * priced at $2,997 by default; an optional toggle adds 4 coaching calls
 * (turning the purchase into Blueprint Plus, $4,997) without sending them
 * to a different page. This is the moment they're reaching for their
 * wallet, so the friction to add coaching is approximately zero.
 *
 * On submit:
 *   - Fires GA4 begin_checkout with the appropriate item shape
 *   - POSTs to /api/checkout/blueprint OR /api/checkout/blueprint-plus
 *     based on the toggle state. Both routes are handled by the generic
 *     /api/checkout/[product] dynamic route.
 */
export function BlueprintUpsellBuyBox() {
  const [withCoaching, setWithCoaching] = useState(false);
  const productSlug = withCoaching ? "blueprint-plus" : "blueprint";
  const buttonLabel = withCoaching
    ? "Buy Blueprint Plus — $4,997"
    : "Buy The Blueprint — $2,997";

  function handleSubmit() {
    track("begin_checkout", {
      currency: "USD",
      value: withCoaching ? 4997 : 2997,
      items: [
        withCoaching
          ? {
              item_id: "blueprint-plus",
              item_name: "Blueprint Plus",
              price: 4997,
              quantity: 1,
              item_category: "Tier 1 + Coaching",
            }
          : {
              item_id: "the-blueprint",
              item_name: "The Blueprint",
              price: 2997,
              quantity: 1,
              item_category: "Tier 1",
            },
      ],
      cta_location: "blueprint_product_buy_box",
    });
    // Don't preventDefault — let the form actually POST.
  }

  return (
    <>
      {/* ===== Add-coaching toggle ===== */}
      <button
        type="button"
        onClick={() => setWithCoaching((v) => !v)}
        className={`w-full text-left rounded-2xl border-2 p-4 mb-5 transition-all ${
          withCoaching
            ? "border-gold bg-gradient-to-br from-cream to-white shadow-[0_4px_14px_rgba(212,162,76,0.18)]"
            : "border-navy/15 bg-white hover:border-navy/30"
        }`}
        aria-pressed={withCoaching}
        aria-label="Toggle Blueprint Plus — adds 4 coaching calls for $2,000 more"
      >
        <div className="flex items-start gap-3">
          {/* Custom checkbox */}
          <div
            className={`flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center mt-0.5 transition-colors ${
              withCoaching
                ? "bg-gold border-gold"
                : "bg-white border-navy/30"
            }`}
            aria-hidden
          >
            {withCoaching && <Check size={13} className="text-navy" strokeWidth={3} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5 text-navy font-bold text-sm">
                <Sparkles size={13} className="text-gold-warm" />
                Add 4 coaching calls
              </div>
              <div className="text-navy font-extrabold text-sm tabular-nums whitespace-nowrap">
                +$2,000
              </div>
            </div>
            <p className="text-grey-3 text-xs leading-relaxed">
              Get personal guidance through the hardest phases — Codify Your Operations and Decode the FDD. Becomes <span className="text-navy font-semibold">Blueprint Plus</span>.
            </p>
          </div>
        </div>
      </button>

      {/* ===== Hidden state synced with the form ===== */}
      <form action={`/api/checkout/${productSlug}`} method="POST" onSubmit={handleSubmit}>
        <button
          type="submit"
          className="block w-full text-center bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-6 py-4 rounded-full hover:bg-gold-dark transition-colors cursor-pointer"
        >
          {buttonLabel}
        </button>
      </form>
    </>
  );
}

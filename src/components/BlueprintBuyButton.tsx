"use client";
import { track, TIERS } from "@/lib/analytics";

/**
 * Buy Now form for The Blueprint ($2,997).
 *
 * Posts to /api/checkout/blueprint which creates a Stripe Checkout Session
 * and 303-redirects the browser to Stripe. Before submitting, fires the
 * GA4 `begin_checkout` event so we can attribute checkout opens (vs. just
 * raw button clicks).
 */
export function BlueprintBuyButton({ className = "" }: { className?: string }) {
  function handleSubmit() {
    const item = TIERS["the-blueprint"];
    track("begin_checkout", {
      currency: "USD",
      value: item.price,
      items: [
        {
          item_id: item.item_id,
          item_name: item.item_name,
          price: item.price,
          quantity: 1,
          item_category: item.item_category,
        },
      ],
      cta_location: "blueprint_product_buy_box",
    });
    // Don't preventDefault — let the form actually POST.
  }

  return (
    <form action="/api/checkout/blueprint" method="POST" onSubmit={handleSubmit}>
      <button
        type="submit"
        className={
          className ||
          "block w-full text-center bg-gold text-navy font-bold text-sm uppercase tracking-[0.1em] px-6 py-4 rounded-full hover:bg-gold-dark transition-colors cursor-pointer"
        }
      >
        Buy Now
      </button>
    </form>
  );
}

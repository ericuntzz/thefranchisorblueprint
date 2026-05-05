import Stripe from "stripe";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

let _stripe: Stripe | null = null;

/**
 * Lazy Stripe client — initialized on first call, not at module-import.
 * This prevents Vercel's "collect page data" build step from blowing up
 * when STRIPE_SECRET_KEY isn't set in the environment yet (e.g., before
 * Eric provisions Stripe keys).
 *
 * Usage: `getStripe()` instead of `stripe`.
 */
export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  _stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
    apiVersion: "2026-04-22.dahlia",
    typescript: true,
  });
  return _stripe;
}

/**
 * Backward-compat proxy so existing `import { stripe } from "@/lib/stripe"`
 * keeps working without forcing every call site to use getStripe().
 * The Proxy defers initialization until a property is actually accessed
 * (i.e., when an API route runs, not at module import).
 */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const client = getStripe() as unknown as Record<string | symbol, unknown>;
    return client[prop as string];
  },
});

export const stripeEnv = {
  webhookSecret: () => requireEnv("STRIPE_WEBHOOK_SECRET"),
  blueprintPriceId: () => requireEnv("STRIPE_PRICE_BLUEPRINT"),
  // 5% pay-in-full discount, applied to any tier at checkout when the
  // customer chooses pay-in-full. Falls back to "PAYINFULL5" so dev
  // environments without the env var still work.
  payInFullCouponId: () => process.env.STRIPE_COUPON_PAY_IN_FULL ?? "PAYINFULL5",
  // Installment-plan recurring monthly prices.
  blueprintInstallmentPriceId: () => requireEnv("STRIPE_PRICE_BLUEPRINT_INSTALLMENT"),
  navigatorPriceId: () => requireEnv("STRIPE_PRICE_NAVIGATOR"),
  navigatorInstallmentPriceId: () => requireEnv("STRIPE_PRICE_NAVIGATOR_INSTALLMENT"),
  builderPriceId: () => requireEnv("STRIPE_PRICE_BUILDER"),
  builderInstallmentPriceId: () => requireEnv("STRIPE_PRICE_BUILDER_INSTALLMENT"),
  builderDownPaymentPriceId: () => requireEnv("STRIPE_PRICE_BUILDER_DOWN"),
};

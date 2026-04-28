import Stripe from "stripe";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
  apiVersion: "2026-04-22.dahlia",
  typescript: true,
});

export const stripeEnv = {
  webhookSecret: () => requireEnv("STRIPE_WEBHOOK_SECRET"),
  blueprintPriceId: () => requireEnv("STRIPE_PRICE_BLUEPRINT"),
};

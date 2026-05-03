/**
 * Stripe Agent Toolkit — typed Stripe operations wrapped as tool definitions
 * an LLM-driven agent can route to. Sits ALONGSIDE our existing `stripe` SDK
 * usage (src/lib/stripe.ts) — does not replace any of it. Every existing
 * checkout / webhook / fulfillment code path keeps working untouched.
 *
 * What this enables:
 *   - A future portal-side AI assistant ("ask about your billing") can call
 *     Stripe through the same tool layer the rest of our agent stack uses.
 *   - Backend support flows can ask for a payment link or look up a customer
 *     without us hand-writing the Stripe call in every place.
 *
 * What this does NOT do:
 *   - Mutate any current behavior. Nothing imports this file yet — it's
 *     wired and ready, but inert until we build a feature on top of it.
 *   - Expose Stripe to the browser. This module imports the secret key
 *     and is server-only.
 *
 * Permission model (deliberately read-mostly for v1):
 *   ✓  paymentLinks.create  — generate one-off Payment Links on demand
 *   ✓  customers.read       — support lookups by email / customer id
 *   ✓  products.read        — catalog awareness when answering pricing Qs
 *   ✓  prices.read          — same
 *   ✓  coupons.read         — verify a promo code's status
 *   ✗  everything mutating  — refunds, product create, price create,
 *                              subscription edits, etc. Off by default.
 *
 * To grant a new permission, flip its flag in CONFIGURATION below. Keep
 * mutating actions deliberately enabled per use case rather than turning
 * on whole categories — agents only get the powers they need.
 *
 * To consume from an agent route, pick the adapter that matches your AI
 * SDK (the @stripe/agent-toolkit package ships these subpaths):
 *
 *   import { StripeAgentToolkit } from "@stripe/agent-toolkit/ai-sdk";   // Vercel AI SDK
 *   import { StripeAgentToolkit } from "@stripe/agent-toolkit/openai";   // OpenAI SDK
 *   import { StripeAgentToolkit } from "@stripe/agent-toolkit/langchain";// LangChain
 *
 * Each subpath exposes the same configuration shape. We don't import any
 * adapter here — that decision belongs to the route that builds the agent.
 *
 * Reference:
 *   https://github.com/stripe/agent-toolkit
 *   https://stripe.com/docs/agents
 */

/**
 * The permission configuration shared across every adapter we wire up.
 * Importing this from an agent route gives that route a Stripe Agent
 * Toolkit instance whose tool surface matches what we've decided to allow.
 *
 * Example (Vercel AI SDK):
 *   import { StripeAgentToolkit } from "@stripe/agent-toolkit/ai-sdk";
 *   import { STRIPE_AGENT_CONFIG } from "@/lib/stripe-agent";
 *
 *   const toolkit = new StripeAgentToolkit({
 *     secretKey: process.env.STRIPE_SECRET_KEY!,
 *     configuration: STRIPE_AGENT_CONFIG,
 *   });
 *   const tools = toolkit.getTools();  // wire into the model call
 */
export const STRIPE_AGENT_CONFIG = {
  actions: {
    paymentLinks: { create: true },
    customers: { read: true },
    products: { read: true },
    prices: { read: true },
    coupons: { read: true },
    // Everything below is intentionally off. Flip individual flags ONLY
    // when a specific feature requires them, not preemptively.
    //
    // refunds: { create: true },          // sensitive — always off by default
    // products: { create: true, update: true },
    // prices: { create: true },
    // subscriptions: { read: true, update: true, cancel: true },
    // invoices: { create: true, read: true, finalize: true, send: true },
    // disputes: { read: true, update: true },
  },
} as const;

/**
 * Helper to assert the Stripe key is present at agent-construction time.
 * Mirrors the `requireEnv` pattern in src/lib/stripe.ts so failures
 * surface with a clear message instead of a downstream Stripe 401.
 */
export function requireStripeSecretKey(): string {
  const value = process.env.STRIPE_SECRET_KEY;
  if (!value) {
    throw new Error(
      "Missing STRIPE_SECRET_KEY — required to instantiate the Stripe Agent Toolkit",
    );
  }
  return value;
}

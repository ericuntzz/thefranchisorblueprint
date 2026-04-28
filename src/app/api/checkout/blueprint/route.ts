import { NextRequest } from "next/server";
import { stripe, stripeEnv } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price: stripeEnv.blueprintPriceId(),
        quantity: 1,
      },
    ],
    success_url: `${origin}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/programs/blueprint`,
    allow_promotion_codes: true,
    billing_address_collection: "required",
    customer_creation: "always",
    payment_intent_data: {
      description: "The Blueprint — DIY Franchise Kit (Tier 1)",
      metadata: {
        product: "blueprint",
        tier: "1",
      },
    },
    metadata: {
      product: "blueprint",
      tier: "1",
    },
  });

  if (!session.url) {
    return new Response("Stripe did not return a checkout URL", { status: 502 });
  }

  return Response.redirect(session.url, 303);
}

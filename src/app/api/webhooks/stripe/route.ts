import { NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe, stripeEnv } from "@/lib/stripe";
import {
  ensureUserAndPurchase,
  markPurchaseRefunded,
  sendWelcomeMagicLinkEmail,
} from "@/lib/fulfillment";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      stripeEnv.webhookSecret(),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return new Response(`Signature verification failed: ${message}`, {
      status: 400,
    });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      console.log(
        `[stripe] checkout.session.completed product=${session.metadata?.product ?? "unknown"} session=${session.id} email=${session.customer_details?.email ?? "n/a"} amount=${session.amount_total ?? 0}`,
      );
      const userId = await ensureUserAndPurchase(session);
      const email = session.customer_details?.email?.toLowerCase();
      if (userId && email) {
        await sendWelcomeMagicLinkEmail(email, req.nextUrl.origin);
      }
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object;
      console.log(
        `[stripe] charge.refunded ${charge.id} pi=${charge.payment_intent} amount_refunded=${charge.amount_refunded}`,
      );
      await markPurchaseRefunded(charge);
      break;
    }
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed":
    case "payment_intent.payment_failed":
      console.log(`[stripe] ${event.type} ${event.data.object.id}`);
      break;
    default:
      // Unhandled events are fine — Stripe expects 2xx so it stops retrying.
      break;
  }

  return new Response(null, { status: 200 });
}

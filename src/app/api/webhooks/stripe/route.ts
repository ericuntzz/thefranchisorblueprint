import { NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe, stripeEnv } from "@/lib/stripe";
import { notifyTeamOfSale, sendCustomerWelcome } from "@/lib/notifications";

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
      await fulfillCheckout(session);
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

async function fulfillCheckout(session: Stripe.Checkout.Session): Promise<void> {
  const product = session.metadata?.product ?? "unknown";
  const amount = ((session.amount_total ?? 0) / 100).toLocaleString("en-US", {
    style: "currency",
    currency: (session.currency ?? "usd").toUpperCase(),
  });
  const customerEmail = session.customer_details?.email ?? "";
  const customerName = session.customer_details?.name ?? "";
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? "";

  // Pretty product name lookup (metadata only carries a slug).
  const productName =
    product === "blueprint" ? "The Blueprint — DIY Franchise Kit" : product;

  await Promise.allSettled([
    notifyTeamOfSale({
      product: productName,
      amount,
      customerEmail,
      customerName,
      sessionId: session.id,
      paymentIntentId,
    }),
    sendCustomerWelcome({
      to: customerEmail,
      name: customerName,
      product: productName,
      amount,
      sessionId: session.id,
    }),
  ]);

  // TODO: enroll customer in delivery mechanism (Drive folder share, portal access, etc.)
  // TODO: trigger Calendly invite for the 60-min onboarding call
}

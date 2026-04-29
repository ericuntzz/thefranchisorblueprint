import { NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe, stripeEnv } from "@/lib/stripe";
import {
  ensureUserAndPurchase,
  markPurchaseRefunded,
  dispatchPostPurchaseLifecycle,
} from "@/lib/fulfillment";
import { sendServerEvent, clientIdFor } from "@/lib/ga-measurement-protocol";
import { getProduct, type ProductSlug } from "@/lib/products";

/**
 * Map a Stripe Checkout Session metadata.product to a GA4 item. Falls back to
 * Blueprint if metadata is missing so old sessions still track cleanly.
 */
function itemFromSession(session: Stripe.Checkout.Session) {
  const slug = (session.metadata?.product ?? "blueprint").toLowerCase();
  const product = getProduct(slug) ?? getProduct("blueprint");
  if (!product) {
    return {
      item_id: "blueprint",
      item_name: "The Blueprint",
      price: 2997,
      item_category: "Tier 1",
    };
  }
  return {
    item_id: product.slug,
    item_name: product.name,
    price: product.priceCents / 100,
    item_category: product.grantsTier ? `Tier ${product.grantsTier}` : "Add-on",
  };
}

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
        // Fire welcome email + queue upgrade drip + create offers.
        // Wrapped — lifecycle failure must never break webhook idempotency.
        try {
          await dispatchPostPurchaseLifecycle({
            userId,
            email,
            fullName: session.customer_details?.name ?? null,
            productSlug: ((session.metadata?.product ?? "blueprint").toLowerCase() as ProductSlug),
            amountCents: session.amount_total ?? 0,
            origin: req.nextUrl.origin,
            sessionId: session.id,
          });
        } catch (err) {
          console.error("[stripe] post-purchase lifecycle failed:", err);
        }
      }

      // (Buyer CRM tagging is handled internally — purchase row in Supabase
      // is the source of truth; lifecycle emails are dispatched via the
      // Resend queue from the post-purchase block above. No external CRM.)

      // ─── GA4 server-side `purchase` event ─────────────────────────────
      // Fire-and-forget — never let analytics break the webhook.
      try {
        const item = itemFromSession(session);
        const value = (session.amount_total ?? item.price * 100) / 100;
        const customerId =
          (typeof session.customer === "string" ? session.customer : session.customer?.id) ??
          session.id;
        await sendServerEvent({
          clientId: clientIdFor(customerId),
          userId: userId ?? undefined,
          event: {
            name: "purchase",
            params: {
              transaction_id: session.id,
              currency: "USD",
              value,
              items: [
                {
                  item_id: item.item_id,
                  item_name: item.item_name,
                  price: item.price,
                  quantity: 1,
                  item_category: item.item_category,
                },
              ],
              customer_id: customerId,
            },
          },
        });
      } catch (err) {
        console.error("[stripe] GA4 purchase event failed:", err);
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

import { NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe, stripeEnv } from "@/lib/stripe";
import {
  ensureUserAndPurchase,
  markPurchaseRefunded,
  sendWelcomeMagicLinkEmail,
} from "@/lib/fulfillment";
import { TIERS, type TierId } from "@/lib/analytics";
import { sendServerEvent, clientIdFor } from "@/lib/ga-measurement-protocol";
import { acUpsertContact, AC_MASTER_LIST_ID } from "@/lib/activecampaign";

/**
 * Map a Stripe Checkout Session metadata.product → our internal TierId.
 * Falls back to "the-blueprint" since that's currently the only Stripe-purchasable
 * tier (Tier 2/3 are sold via consult call, not checkout).
 */
function tierFromSession(session: Stripe.Checkout.Session): TierId {
  const p = session.metadata?.product?.toLowerCase();
  if (p === "navigator") return "navigator";
  if (p === "builder") return "builder";
  return "the-blueprint";
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
        await sendWelcomeMagicLinkEmail(email, req.nextUrl.origin);
      }

      // ─── ActiveCampaign: add buyer to Master list with tier tag ───────
      // Fire-and-forget — never let CRM sync break the webhook.
      try {
        if (email) {
          const tierId = tierFromSession(session);
          // customer_details.name format is usually "First Last" — best-effort split
          const fullName = session.customer_details?.name?.trim() ?? "";
          const [firstName, ...rest] = fullName.split(/\s+/);
          const lastName = rest.join(" ");
          await acUpsertContact({
            email,
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            listIds: AC_MASTER_LIST_ID ? [AC_MASTER_LIST_ID] : [],
            tags: [`customer-${tierId}`, "source-stripe-purchase"],
          });
        }
      } catch (err) {
        console.error("[stripe] AC sync failed:", err);
      }

      // ─── GA4 server-side `purchase` event ─────────────────────────────
      // Fire-and-forget — never let analytics break the webhook.
      try {
        const tierId = tierFromSession(session);
        const tier = TIERS[tierId];
        const value = (session.amount_total ?? tier.price * 100) / 100;
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
                  item_id: tier.item_id,
                  item_name: tier.item_name,
                  price: tier.price,
                  quantity: 1,
                  item_category: tier.item_category,
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

import { NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe, stripeEnv } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Tier } from "@/lib/supabase/types";

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
      await fulfillCheckout(session, req.nextUrl.origin);
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

async function fulfillCheckout(
  session: Stripe.Checkout.Session,
  origin: string,
): Promise<void> {
  const email = session.customer_details?.email?.toLowerCase() ?? "";
  if (!email) {
    console.error(`[fulfill] session ${session.id} has no customer email — skipping`);
    return;
  }

  const product = session.metadata?.product ?? "unknown";
  const tier = parseTier(session.metadata?.tier);
  const fullName = session.customer_details?.name ?? null;
  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  const supabase = getSupabaseAdmin();

  // 1) Get-or-create the auth user. createUser is not idempotent, so we
  //    look first and only create if missing.
  let userId: string;
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    userId = existing.id;
  } else {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true, // they paid via Stripe — that's their verification
      user_metadata: { full_name: fullName, source: "stripe_checkout" },
    });
    if (createErr || !created.user) {
      console.error(`[fulfill] auth.admin.createUser failed for ${email}: ${createErr?.message}`);
      return;
    }
    userId = created.user.id;
  }

  // 2) Upsert profile (write all known fields; safe to overwrite same values)
  const { error: profileErr } = await supabase
    .from("profiles")
    .upsert(
      {
        id: userId,
        email,
        full_name: fullName,
        stripe_customer_id: stripeCustomerId,
        tier,
      },
      { onConflict: "id" },
    );
  if (profileErr) {
    console.error(`[fulfill] profile upsert failed: ${profileErr.message}`);
  }

  // 3) Insert purchase row (unique on stripe_session_id — silently no-ops on retry)
  const { error: purchaseErr } = await supabase.from("purchases").insert({
    user_id: userId,
    stripe_session_id: session.id,
    stripe_payment_intent_id: paymentIntentId,
    product,
    tier,
    amount_cents: session.amount_total ?? 0,
    currency: (session.currency ?? "usd").toLowerCase(),
    status: "paid",
  });
  if (purchaseErr && !purchaseErr.message.includes("duplicate")) {
    console.error(`[fulfill] purchase insert failed: ${purchaseErr.message}`);
  }

  // 4) Send the magic-link "welcome to your portal" email. This is what
  //    the customer actually clicks to enter the portal for the first time.
  const { error: linkErr } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/callback?next=/portal`,
    },
  });
  if (linkErr) {
    console.error(`[fulfill] signInWithOtp failed for ${email}: ${linkErr.message}`);
  }

  console.log(`[fulfill] ok user=${userId} email=${email} tier=${tier} product=${product}`);
}

function parseTier(raw: string | undefined): Tier {
  const n = Number(raw);
  if (n === 2 || n === 3) return n;
  return 1;
}

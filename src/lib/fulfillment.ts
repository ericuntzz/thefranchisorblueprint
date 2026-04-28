import type Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Tier } from "@/lib/supabase/types";

/**
 * Idempotent fulfillment for a paid Stripe Checkout Session.
 *
 * Creates the auth user (if missing), upserts the profile row, and inserts
 * the purchase row. Safe to call from both the Stripe webhook AND the
 * /thank-you page — whichever runs first wins, the second is a no-op.
 *
 * Returns the Supabase user id (always — fulfillment is the contract).
 */
export async function ensureUserAndPurchase(
  session: Stripe.Checkout.Session,
): Promise<string | null> {
  const email = session.customer_details?.email?.toLowerCase() ?? "";
  if (!email) {
    console.error(`[fulfillment] session ${session.id} has no customer email — skipping`);
    return null;
  }
  if (session.payment_status !== "paid") {
    return null;
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

  // 1) get-or-create the auth user
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
      email_confirm: true,
      user_metadata: { full_name: fullName, source: "stripe_checkout" },
    });
    if (createErr || !created.user) {
      console.error(`[fulfillment] auth.admin.createUser failed for ${email}: ${createErr?.message}`);
      return null;
    }
    userId = created.user.id;
  }

  // 2) upsert profile
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
    console.error(`[fulfillment] profile upsert failed: ${profileErr.message}`);
  }

  // 3) insert purchase (silent no-op on retry — unique constraint on stripe_session_id)
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
    console.error(`[fulfillment] purchase insert failed: ${purchaseErr.message}`);
  }

  return userId;
}

/**
 * Generates a single-use magic link for an existing user, returning a URL
 * that lands them in the portal in one click. Used on the /thank-you page
 * so customers don't have to wait for email.
 */
export async function generatePortalAccessUrl(
  email: string,
  origin: string,
): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: `${origin}/auth/confirm?next=/portal`,
    },
  });
  if (error || !data.properties?.hashed_token) {
    console.error(`[fulfillment] generateLink failed for ${email}: ${error?.message}`);
    return null;
  }
  const url = new URL(`${origin}/auth/confirm`);
  url.searchParams.set("token_hash", data.properties.hashed_token);
  url.searchParams.set("type", "magiclink");
  url.searchParams.set("next", "/portal");
  return url.toString();
}

/**
 * Sends the welcome magic-link email through Supabase's mailer using the
 * configured email template. Server-issued magic links are token_hash flow.
 * Backup pathway in case the customer doesn't click through from /thank-you.
 */
export async function sendWelcomeMagicLinkEmail(
  email: string,
  origin: string,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/confirm?next=/portal`,
    },
  });
  if (error) {
    console.error(`[fulfillment] signInWithOtp failed for ${email}: ${error.message}`);
  }
}

function parseTier(raw: string | undefined): Tier {
  const n = Number(raw);
  if (n === 2 || n === 3) return n;
  return 1;
}

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import type { Purchase } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Stripe ↔ Portal reconciliation cron.
 *
 * Runs every 6 hours. Pulls the last 7 days of Stripe checkout sessions
 * and refunds, then cross-checks against the `purchases` table to detect
 * drift caused by dropped webhooks, partial failures, or race conditions.
 *
 * Three drift types:
 *   paid_no_purchase   — Stripe has a paid session, but no matching
 *                         `purchases` row exists (webhook drop).
 *   refund_not_applied — Stripe has a refund, but the purchase row
 *                         still shows status = 'paid'.
 *   amount_mismatch    — The Stripe charge amount doesn't match
 *                         what we recorded in `purchases`.
 *
 * Each detected issue is upserted into `stripe_reconciliation_issues`
 * (keyed on stripe_session_id or stripe_refund_id). The daily ops
 * digest reads unresolved issues from this table.
 *
 * Auth: Bearer ${CRON_SECRET} — standard Vercel Cron pattern.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Guard: if Stripe isn't configured, skip gracefully.
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "STRIPE_SECRET_KEY not set",
    });
  }

  const stripe = getStripe();
  const admin = getSupabaseAdmin();

  const sevenDaysAgo = Math.floor(
    (Date.now() - 7 * 24 * 3600 * 1000) / 1000,
  );

  // 1) Pull completed checkout sessions from Stripe (last 7 days).
  const sessions: Array<{
    id: string;
    payment_intent: string | null;
    amount_total: number | null;
    customer_email: string | null;
    payment_status: string;
  }> = [];

  for await (const session of stripe.checkout.sessions.list({
    created: { gte: sevenDaysAgo },
    limit: 100,
    expand: [],
  })) {
    if (session.payment_status === "paid") {
      sessions.push({
        id: session.id,
        payment_intent:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? null,
        amount_total: session.amount_total,
        customer_email: session.customer_details?.email ?? null,
        payment_status: session.payment_status,
      });
    }
  }

  // 2) Pull refunds from Stripe (last 7 days).
  const refunds: Array<{
    id: string;
    payment_intent: string | null;
    amount: number;
    status: string | null;
  }> = [];

  for await (const refund of stripe.refunds.list({
    created: { gte: sevenDaysAgo },
    limit: 100,
  })) {
    if (refund.status === "succeeded") {
      refunds.push({
        id: refund.id,
        payment_intent:
          typeof refund.payment_intent === "string"
            ? refund.payment_intent
            : refund.payment_intent?.id ?? null,
        amount: refund.amount,
        status: refund.status,
      });
    }
  }

  // 3) Pull our purchase records for the same window.
  const { data: purchasesRaw } = await admin
    .from("purchases")
    .select(
      "id, user_id, stripe_session_id, stripe_payment_intent_id, amount_cents, status, refunded_at",
    )
    .gte(
      "created_at",
      new Date(sevenDaysAgo * 1000).toISOString(),
    );
  const purchases = (purchasesRaw ?? []) as Array<
    Pick<
      Purchase,
      | "id"
      | "user_id"
      | "stripe_session_id"
      | "stripe_payment_intent_id"
      | "amount_cents"
      | "status"
      | "refunded_at"
    >
  >;

  const purchaseBySessionId = new Map(
    purchases.map((p) => [p.stripe_session_id, p]),
  );
  const purchaseByPaymentIntent = new Map(
    purchases
      .filter((p) => p.stripe_payment_intent_id)
      .map((p) => [p.stripe_payment_intent_id, p]),
  );

  type Issue = {
    issue_type: string;
    stripe_ref: string;
    details: Record<string, unknown>;
  };

  const issues: Issue[] = [];

  // 4) Detect paid-but-no-purchase (webhook drops).
  for (const session of sessions) {
    const purchase =
      purchaseBySessionId.get(session.id) ??
      (session.payment_intent
        ? purchaseByPaymentIntent.get(session.payment_intent)
        : undefined);

    if (!purchase) {
      issues.push({
        issue_type: "paid_no_purchase",
        stripe_ref: session.id,
        details: {
          stripe_session_id: session.id,
          payment_intent: session.payment_intent,
          amount_cents: session.amount_total,
          customer_email: session.customer_email,
        },
      });
      continue;
    }

    // 5) Detect amount mismatch.
    if (
      session.amount_total !== null &&
      purchase.amount_cents !== session.amount_total
    ) {
      issues.push({
        issue_type: "amount_mismatch",
        stripe_ref: session.id,
        details: {
          stripe_session_id: session.id,
          stripe_amount: session.amount_total,
          db_amount: purchase.amount_cents,
          user_id: purchase.user_id,
        },
      });
    }
  }

  // 6) Detect refund-not-applied.
  for (const refund of refunds) {
    if (!refund.payment_intent) continue;
    const purchase = purchaseByPaymentIntent.get(refund.payment_intent);
    if (purchase && purchase.status === "paid") {
      issues.push({
        issue_type: "refund_not_applied",
        stripe_ref: refund.id,
        details: {
          stripe_refund_id: refund.id,
          payment_intent: refund.payment_intent,
          refund_amount: refund.amount,
          purchase_id: purchase.id,
          user_id: purchase.user_id,
        },
      });
    }
  }

  // 7) Upsert issues into the ledger.
  for (const issue of issues) {
    await admin.from("stripe_reconciliation_issues").upsert(
      {
        stripe_ref: issue.stripe_ref,
        issue_type: issue.issue_type,
        details: issue.details,
        resolved: false,
      },
      { onConflict: "stripe_ref" },
    );
  }

  return NextResponse.json({
    ok: true,
    stripeSessionsChecked: sessions.length,
    stripeRefundsChecked: refunds.length,
    purchaseRowsChecked: purchases.length,
    issuesFound: issues.length,
    issues: issues.map((i) => ({
      type: i.issue_type,
      ref: i.stripe_ref,
    })),
  });
}

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendTemplate } from "@/lib/email/dispatch";
import { SITE_URL } from "@/lib/site";
import type { OpsDigestPayload } from "@/lib/ops/types";
import { collect as collectRescueResults } from "@/lib/ops/rescue-results";
import { collect as collectNewCustomers } from "@/lib/ops/new-customers";
import { collect as collectAssessmentLeads } from "@/lib/ops/assessment-leads";
import { collect as collectMissedWarmLeads } from "@/lib/ops/missed-warm-leads";
import { collect as collectRefundWatchlist } from "@/lib/ops/refund-watchlist";
import { collect as collectEmailHealth } from "@/lib/ops/email-health";
import { collect as collectStripeReconciliation } from "@/lib/ops/stripe-reconciliation";
import { collect as collectPlatformHealth } from "@/lib/ops/platform-health";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const today = new Date();
  const dateLabel = today.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Denver",
  });

  const [
    rescueResults,
    newCustomers,
    assessmentLeads,
    missedWarmLeads,
    refundWatchlist,
    emailHealth,
    stripeReconciliation,
    platformHealth,
  ] = await Promise.all([
    collectRescueResults(admin),
    collectNewCustomers(admin),
    collectAssessmentLeads(admin),
    collectMissedWarmLeads(admin),
    collectRefundWatchlist(admin),
    collectEmailHealth(admin),
    collectStripeReconciliation(admin),
    collectPlatformHealth(admin),
  ]);

  const payload: OpsDigestPayload = {
    dateLabel,
    rescueResults,
    newCustomers,
    assessmentLeads,
    missedWarmLeads,
    refundWatchlist,
    emailHealth,
    stripeReconciliation,
    platformHealth,
    siteUrl: SITE_URL,
  };

  const recipient =
    process.env.OPS_DIGEST_EMAIL ??
    process.env.INTERNAL_NOTIFICATION_EMAIL ??
    "team@thefranchisorblueprint.com";

  const dateKey = today.toISOString().slice(0, 10);

  const result = await sendTemplate("team-ops-digest", recipient, payload, {
    idempotencyKey: `ops-digest:${dateKey}`,
  });

  if (result.ok) {
    await admin.from("ops_digest_sends").insert({
      sent_to: recipient,
      payload: payload as unknown as Record<string, unknown>,
    });
  }

  return NextResponse.json({
    ok: result.ok,
    sentTo: recipient,
    date: dateKey,
    signals: {
      rescueResults: rescueResults.length,
      newCustomers: newCustomers.length,
      assessmentLeads: assessmentLeads.length,
      missedWarmLeads: missedWarmLeads.length,
      refundWatchlist: refundWatchlist.length,
      emailsSent24h: emailHealth.sent24h,
      emailsFailed24h: emailHealth.failed24h,
      stripeReconciliation: stripeReconciliation.status,
      platformHealth: platformHealth.status,
    },
    ...(result.ok ? {} : { error: result.error }),
  });
}

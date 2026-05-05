import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { StripeReconciliationSummary } from "./types";

/**
 * Reads unresolved drift from the `stripe_reconciliation_issues` table.
 * The Stripe reconciliation cron (/api/cron/stripe-reconcile) populates
 * that table every 6 hours. This collector summarizes it for the daily
 * ops digest.
 */
export async function collect(
  admin: SupabaseClient<Database>,
): Promise<StripeReconciliationSummary> {
  // If Stripe isn't configured, report as such.
  if (!process.env.STRIPE_SECRET_KEY) {
    return { status: "not_configured" };
  }

  const { count, error } = await admin
    .from("stripe_reconciliation_issues")
    .select("*", { count: "exact", head: true })
    .eq("resolved", false);

  if (error) {
    // Table might not exist yet — treat as not configured.
    return { status: "not_configured" };
  }

  const issueCount = count ?? 0;
  return issueCount === 0
    ? { status: "ok", issueCount: 0 }
    : { status: "drift_detected", issueCount };
}

/**
 * Normalize an email for case-insensitive matching across systems.
 *
 * Used at every ingestion point — assessment-complete, Calendly webhook,
 * Stripe webhook, contact form, fulfillment — so a lead who enters
 * `Eric@Foo.com` in the assessment matches the `eric@foo.com` they enter
 * at Stripe checkout, and the lead-status helper can confidently join
 * across all four tables on a single normalized email.
 *
 * Returns "" for null/undefined/blank input — callers should validate
 * the result is non-empty (and ideally `.includes("@")`) before using it.
 */
export function normalizeEmail(input: string | null | undefined): string {
  return (input ?? "").trim().toLowerCase();
}

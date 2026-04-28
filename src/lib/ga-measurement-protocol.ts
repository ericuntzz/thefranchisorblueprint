/**
 * Server-side GA4 event tracking via the Measurement Protocol.
 *
 * Use this for events that MUST fire even when the browser can't
 * (purchases, server-side conversions). Bypasses ad-blockers, privacy
 * extensions, and JS-disabled clients.
 *
 * Setup checklist (one-time):
 *   1. Open https://analytics.google.com → Admin → Data Streams → Web →
 *      The Franchisor Blueprint stream → "Measurement Protocol API secrets"
 *   2. Create a secret named e.g. "Stripe webhook server-side"
 *   3. Add to Vercel env vars (production + preview):
 *        GA4_MP_API_SECRET=<the secret value>
 *
 * Reference: https://developers.google.com/analytics/devguides/collection/protocol/ga4
 */

import type { GA4Event } from "@/lib/analytics";

const MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA4_ID;
const API_SECRET = process.env.GA4_MP_API_SECRET;

const ENDPOINT = "https://www.google-analytics.com/mp/collect";

type ServerEventOptions = {
  /**
   * GA4 client_id — should be stable per browser to keep sessions intact.
   * For server-side events we don't have it, so we synthesize one from the
   * customer or order ID. Format: a unique-enough random-looking string.
   */
  clientId: string;
  /**
   * Optional GA4 user_id for cross-device tracking. Use the buyer's
   * email-hash or your internal user UUID. NEVER pass raw email/PII.
   */
  userId?: string;
  /** A single event to send (use `events` for multiple). */
  event?: GA4Event;
  /** Multiple events to batch in a single request. */
  events?: GA4Event[];
};

/**
 * Send one or more events to GA4 server-side. Resolves true on success.
 * Logs and returns false on misconfig or failure — never throws (we don't
 * want analytics failures to break a webhook).
 */
export async function sendServerEvent(opts: ServerEventOptions): Promise<boolean> {
  if (!MEASUREMENT_ID) {
    console.warn("[ga-mp] NEXT_PUBLIC_GA4_ID not set — skipping server event");
    return false;
  }
  if (!API_SECRET) {
    console.warn(
      "[ga-mp] GA4_MP_API_SECRET not set in env — skipping server event. " +
        "Create one at GA4 Admin → Data Streams → Measurement Protocol API secrets.",
    );
    return false;
  }

  const events = opts.events ?? (opts.event ? [opts.event] : []);
  if (events.length === 0) {
    console.warn("[ga-mp] No events provided — skipping");
    return false;
  }

  const body = {
    client_id: opts.clientId,
    ...(opts.userId ? { user_id: opts.userId } : {}),
    events: events.map((e) => ({ name: e.name, params: e.params })),
  };

  try {
    const url = `${ENDPOINT}?measurement_id=${encodeURIComponent(MEASUREMENT_ID)}&api_secret=${encodeURIComponent(API_SECRET)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`[ga-mp] HTTP ${res.status}: ${await res.text().catch(() => "")}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[ga-mp] Send failed:", err);
    return false;
  }
}

/**
 * Synthesize a GA4-compatible client_id from a stable identifier.
 * Use the Stripe customer ID or order ID for de-dup safety.
 *
 * GA4 client_id format is two dot-separated random-looking ints; we hash
 * the input to produce something equally opaque.
 */
export function clientIdFor(stableId: string): string {
  // Cheap, deterministic, no crypto import needed for this purpose.
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < stableId.length; i++) {
    const c = stableId.charCodeAt(i);
    h1 = ((h1 << 5) + h1) ^ c;
    h2 = ((h2 << 5) + h2) ^ (c * 31);
  }
  // GA4 expects unsigned ints separated by a dot, e.g. "1234567890.987654321"
  const left = (h1 >>> 0).toString();
  const right = (h2 >>> 0).toString();
  return `${left}.${right}`;
}

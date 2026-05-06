import { NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/**
 * Public health-check endpoint for external uptime monitoring
 * (UptimeRobot, BetterStack, Pingdom, etc.).
 *
 * Returns 200 + minimal JSON when the Next.js runtime is serving
 * traffic. Intentionally cheap: no DB query, no external calls,
 * just "the app booted." Anything heavier belongs in the cron
 * health-check (which writes incidents to Supabase for the daily
 * ops digest to surface).
 *
 * UptimeRobot setup:
 *   1. Sign in at uptimerobot.com (free tier: 50 monitors, 5-min intervals)
 *   2. + New Monitor → HTTP(s)
 *   3. URL: https://www.thefranchisorblueprint.com/api/health
 *   4. Monitoring interval: 5 minutes (free tier minimum)
 *   5. Alert contacts: add your email + (optionally) SMS
 *   6. Save. UptimeRobot pings every 5 min and emails on any non-200.
 *
 * Why edge runtime: lower cold-start latency = fewer false-positive
 * "slow response" alerts. Edge functions also don't count against the
 * Hobby plan's serverless-function execution time.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "thefranchisorblueprint",
    },
    {
      status: 200,
      headers: {
        // Don't let CDNs cache the health response — UptimeRobot
        // pinging a stale 200 from cache would mask a real outage.
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}

// HEAD support — UptimeRobot defaults to GET but some monitors
// (especially "Keyword" monitors) use HEAD; this is a 1-line freebie.
export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

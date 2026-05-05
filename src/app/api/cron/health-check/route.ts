import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Platform health-check cron.
 *
 * Runs every 5 minutes (Vercel Pro plan). Checks:
 *   1. Supabase DB — connection + latency via a timed ping query
 *   2. Vercel — latest deployment status via the Vercel REST API
 *
 * Threshold logic:
 *   - Supabase latency > 2000ms → incident
 *   - Supabase query failure → incident
 *   - Vercel deploy in ERROR or CANCELED state → incident
 *
 * Only writes a row to `health_check_incidents` when something
 * crosses a threshold. Quiet runs = no writes = cheap. The daily
 * ops digest reads from that table to show "all clear" or
 * "N incidents in the last 24h".
 *
 * Real-time alert: if an incident is detected AND
 * HEALTH_ALERT_EMAIL is set, fires an immediate email via Resend.
 * This is the ONE place we break the "pile into the digest" rule —
 * production-down alerts must be real-time.
 *
 * Auth: Bearer ${CRON_SECRET}
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();

  type Check = {
    name: string;
    status: "ok" | "degraded" | "down";
    latencyMs?: number;
    detail?: string;
  };

  const checks: Check[] = [];

  // ── 1. Supabase DB health ──
  try {
    const start = Date.now();
    const { error } = await admin.from("profiles").select("id", {
      count: "exact",
      head: true,
    });
    const latencyMs = Date.now() - start;

    if (error) {
      checks.push({
        name: "supabase_db",
        status: "down",
        latencyMs,
        detail: error.message,
      });
    } else if (latencyMs > 2000) {
      checks.push({
        name: "supabase_db",
        status: "degraded",
        latencyMs,
        detail: `Query latency ${latencyMs}ms exceeds 2000ms threshold`,
      });
    } else {
      checks.push({
        name: "supabase_db",
        status: "ok",
        latencyMs,
      });
    }
  } catch (err) {
    checks.push({
      name: "supabase_db",
      status: "down",
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  // ── 2. Supabase Auth health ──
  try {
    const start = Date.now();
    // A lightweight auth call — getSession on an admin client
    // will resolve quickly and proves the auth service is up.
    const { error } = await admin.auth.getUser(
      "00000000-0000-0000-0000-000000000000",
    );
    const latencyMs = Date.now() - start;
    // getUser with a bogus ID returns an error ("User not found")
    // but that proves the auth service responded. An actual network
    // failure would throw.
    if (latencyMs > 3000) {
      checks.push({
        name: "supabase_auth",
        status: "degraded",
        latencyMs,
        detail: `Auth latency ${latencyMs}ms exceeds 3000ms threshold`,
      });
    } else {
      checks.push({
        name: "supabase_auth",
        status: "ok",
        latencyMs,
      });
    }
  } catch (err) {
    checks.push({
      name: "supabase_auth",
      status: "down",
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  // ── 3. Vercel deployment health ──
  const vercelToken = process.env.VERCEL_API_TOKEN;
  const vercelProjectId = process.env.VERCEL_PROJECT_ID;

  if (vercelToken && vercelProjectId) {
    try {
      const res = await fetch(
        `https://api.vercel.com/v6/deployments?projectId=${vercelProjectId}&limit=1&state=ERROR,CANCELED`,
        {
          headers: { Authorization: `Bearer ${vercelToken}` },
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!res.ok) {
        checks.push({
          name: "vercel_deploy",
          status: "degraded",
          detail: `Vercel API returned ${res.status}`,
        });
      } else {
        const body = (await res.json()) as {
          deployments?: Array<{ state: string; url: string; created: number }>;
        };
        const recent = body.deployments?.[0];
        // Only flag if the failed deploy is from the last 2 hours
        // (older failures are stale — the site is probably fine).
        const twoHoursAgo = Date.now() - 2 * 3600 * 1000;
        if (recent && recent.created > twoHoursAgo) {
          checks.push({
            name: "vercel_deploy",
            status: "down",
            detail: `Latest deploy is ${recent.state}: ${recent.url}`,
          });
        } else {
          checks.push({
            name: "vercel_deploy",
            status: "ok",
          });
        }
      }
    } catch (err) {
      checks.push({
        name: "vercel_deploy",
        status: "degraded",
        detail: `Vercel API check failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  } else {
    checks.push({
      name: "vercel_deploy",
      status: "ok",
      detail: "VERCEL_API_TOKEN or VERCEL_PROJECT_ID not set — skipped",
    });
  }

  // ── Record incidents ──
  const incidents = checks.filter((c) => c.status !== "ok");

  for (const inc of incidents) {
    await admin.from("health_check_incidents").insert({
      check_name: inc.name,
      severity: inc.status,
      latency_ms: inc.latencyMs ?? null,
      detail: inc.detail ?? null,
    });
  }

  // ── Real-time alert for "down" ──
  const downChecks = incidents.filter((c) => c.status === "down");
  const alertEmail = process.env.HEALTH_ALERT_EMAIL;

  if (downChecks.length > 0 && alertEmail) {
    // Use the low-level sendEmail to avoid template overhead for
    // a pure operational alert. Import lazily to keep the happy
    // path (no incidents) as cheap as possible.
    const { sendEmail } = await import("@/lib/email/send");
    const lines = downChecks.map(
      (c) => `• ${c.name}: ${c.detail ?? "no detail"}`,
    );
    await sendEmail({
      to: alertEmail,
      subject: `🚨 TFB Platform Alert — ${downChecks.length} check${downChecks.length === 1 ? "" : "s"} DOWN`,
      html: `<p>The following health checks are reporting <strong>DOWN</strong>:</p><pre>${lines.join("\n")}</pre><p>Checked at ${new Date().toISOString()}</p>`,
      text: `TFB Platform Alert\n\n${lines.join("\n")}\n\nChecked at ${new Date().toISOString()}`,
      tag: "health-alert",
      idempotencyKey: `health-alert:${new Date().toISOString().slice(0, 16)}`,
    });
  }

  return NextResponse.json({
    ok: incidents.length === 0,
    checks,
    incidentsRecorded: incidents.length,
  });
}

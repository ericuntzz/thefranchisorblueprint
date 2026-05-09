import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  canonicalizeDomain,
  checkCapAndRateLimit,
  findCachedIntakeForDomain,
  hashIp,
  recordDailySpend,
} from "@/lib/intake/cap-guard";
import {
  runIntake,
  type IntakeEvent,
  type IntakeSnapshot,
} from "@/lib/intake/orchestrator";

export const runtime = "nodejs";
export const maxDuration = 90;

const INTAKE_COOKIE = "tfb_intake_session";
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

function newToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * POST /api/intake/start
 *
 * Body: { url: string }
 *
 * Behavior:
 *   1. Hard-rejects anything that fails domain canonicalization.
 *   2. Checks per-IP rate limit (5/hour) + daily cap ($20/day).
 *      - If cap hit: returns 429 with `{ reason: "daily-cap" }` so the
 *        hero UI can swap to the assessment CTA.
 *   3. Checks per-domain cache (7 days) — instant return if cached.
 *   4. Otherwise: creates intake_sessions row, sets HttpOnly cookie,
 *      streams NDJSON events from the orchestrator. Each line is one
 *      IntakeEvent object. The final line is `{kind:"complete", snapshot, sessionId}`.
 *
 * Auth: anonymous (this is a public lead-magnet endpoint).
 */
export async function POST(req: NextRequest) {
  // ─── Parse + validate input ──────────────────────────────────────
  let body: { url?: unknown };
  try {
    body = (await req.json()) as { url?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.url !== "string" || body.url.length < 4 || body.url.length > 2000) {
    return NextResponse.json({ error: "Missing or invalid URL" }, { status: 400 });
  }
  const domain = canonicalizeDomain(body.url);
  if (!domain) {
    return NextResponse.json({ error: "Couldn't parse that URL" }, { status: 400 });
  }
  // Ban obvious garbage / localhost / IP-only domains.
  if (
    domain === "localhost" ||
    /^\d+\.\d+\.\d+\.\d+$/.test(domain) ||
    domain.length < 4 ||
    !domain.includes(".")
  ) {
    return NextResponse.json({ error: "Please enter a real public URL" }, { status: 400 });
  }
  const url = body.url.startsWith("http") ? body.url : `https://${domain}`;

  // ─── Identity (anonymous + IP-hashed for rate limit) ─────────────
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;
  const ipHash = ip ? hashIp(ip) : null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

  // ─── Cap + rate-limit checks ─────────────────────────────────────
  const cap = await checkCapAndRateLimit({ ipHash });
  if (!cap.ok) {
    return NextResponse.json(
      { error: "Capacity limit reached", reason: cap.reason },
      { status: 429 },
    );
  }

  // ─── Per-domain cache hit ────────────────────────────────────────
  const cached = await findCachedIntakeForDomain(domain);
  if (cached) {
    // Don't run the pipeline. Return a tiny "cached" payload that the
    // client can use to re-fetch the snapshot from /api/intake/snapshot/[id].
    const res = NextResponse.json({
      cached: true,
      sessionId: cached.id,
    });
    res.cookies.set(INTAKE_COOKIE, cached.cookieToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE_SECONDS,
    });
    return res;
  }

  // ─── Insert pending session row ──────────────────────────────────
  const supabase = getSupabaseAdmin();
  const cookieToken = newToken();
  const { data: inserted, error: insertErr } = await supabase
    .from("intake_sessions")
    .insert({
      cookie_token: cookieToken,
      ip_hash: ipHash,
      user_agent: userAgent,
      url,
      domain,
      status: "analyzing",
    })
    .select("id")
    .single();
  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: "Couldn't create intake session" },
      { status: 500 },
    );
  }
  const sessionId = inserted.id as string;

  // ─── Build the streaming response ────────────────────────────────
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Helper to write one NDJSON line + flush.
      const write = (event: IntakeEvent | { kind: "complete"; snapshot: IntakeSnapshot; sessionId: string }) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      let snapshot: IntakeSnapshot | null = null;
      let costCents = 0;
      const partialUpdates: Record<string, unknown> = {};

      try {
        for await (const event of runIntake({ url })) {
          // Mirror phase-done outputs into the DB so a partial run
          // is recoverable + auditable.
          if (event.kind === "phase-done" && event.data !== undefined) {
            switch (event.phase) {
              case "scrape":
                partialUpdates.scrape_data = event.data;
                break;
              case "business":
                partialUpdates.business_data = event.data;
                break;
              case "geocode":
                partialUpdates.market_data = {
                  ...(partialUpdates.market_data as Record<string, unknown> | undefined),
                  sourceLocation: event.data,
                };
                break;
              case "demographics":
                partialUpdates.market_data = {
                  ...(partialUpdates.market_data as Record<string, unknown> | undefined),
                  prototype: event.data,
                };
                break;
              case "expansion":
                partialUpdates.expansion_data = event.data;
                break;
              case "score":
                partialUpdates.score_data = event.data;
                break;
            }
          }

          if (event.kind === "complete") {
            // Capture the snapshot but DON'T forward this event to the
            // client. The route emits its own complete event (below)
            // with the sessionId attached, which the client needs.
            snapshot = event.snapshot;
            costCents = event.snapshot.costCents;
            continue;
          }

          write(event);
        }

        if (snapshot) {
          await supabase
            .from("intake_sessions")
            .update({
              ...partialUpdates,
              status: "complete",
              cost_cents: costCents,
              // Bundle the final snapshot into score_data so /api/intake/snapshot
              // can return it as a single read instead of reconstructing it from
              // the split columns.
              score_data: {
                ...(partialUpdates.score_data as Record<string, unknown> | undefined),
                snapshot,
              },
            })
            .eq("id", sessionId);
          await recordDailySpend({ costCents, capped: false });
          // Final event with the session ID so the client can deep-link
          // / reload / proceed to the save step.
          write({ kind: "complete", snapshot, sessionId });
        } else {
          // Generator finished without emitting complete — orchestrator
          // hit an error. Mark failed.
          await supabase
            .from("intake_sessions")
            .update({ status: "failed", error: "Orchestrator did not complete" })
            .eq("id", sessionId);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await supabase
          .from("intake_sessions")
          .update({ status: "failed", error: msg.slice(0, 500) })
          .eq("id", sessionId);
        write({ kind: "error", phase: "scrape", message: msg });
      } finally {
        controller.close();
      }
    },
  });

  const res = new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
      "X-Intake-Session-Id": sessionId,
    },
  });
  res.cookies.set(INTAKE_COOKIE, cookieToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
  return res;
}

import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createHash } from "node:crypto";

/**
 * Hard daily ceiling — the home page hero degrades to "swap URL input
 * for assessment CTA" once we cross this. Reset at midnight UTC.
 */
export const DAILY_CAP_CENTS = 2000; // $20.00

/**
 * Per-domain cache window — if the same canonical domain has been
 * analyzed in the last 7 days, return the cached intake snapshot
 * instead of running the pipeline again. Cost = 0 on cache hit.
 */
export const PER_DOMAIN_CACHE_DAYS = 7;

/**
 * Cache freshness floor. Bump this ISO timestamp whenever the
 * orchestrator's scoring, narrative, or business-extraction logic
 * changes — older cached snapshots will be skipped and a fresh run
 * will replace them. Acts as a manual cache-busting key.
 *
 * Last bumped:
 *   2026-05-10  Round 3: dropped "prototype" language sitewide,
 *               replaced hardcoded franchise-readiness gap checklist
 *               with website-specific LLM observations, added
 *               same-state / same-region geographic proximity bonus
 *               (UT business → UT/CO/AZ markets first, not Atlanta).
 *               Snapshot copy materially different from previous run.
 *   2026-05-09  Round 2: top-5 candidate selection now dedupes by
 *               metro before taking the top 5.
 *   2026-05-09  Round 1: saturation-aware scoring + geographic
 *               diversity + plain-English narratives + page-title
 *               fallback for business name.
 */
export const CACHE_FRESHNESS_FLOOR_ISO = "2026-05-10T18:00:00Z";

/**
 * Per-IP rate limit — N distinct intake starts per hour. Stops
 * scrapers cold without throttling legitimate "I want to show this
 * to my partner" repeat visits (the per-domain cache covers those
 * for free anyway).
 */
export const PER_IP_HOURLY_LIMIT = 5;

/** Hash an IP for the rate-limit key — never store raw IPs. */
export function hashIp(ip: string): string {
  return createHash("sha256")
    .update(ip + (process.env.IP_HASH_SALT ?? "tfb-intake-salt-v1"))
    .digest("hex");
}

/** Canonicalize a user-supplied URL into a comparable host string. */
export function canonicalizeDomain(url: string): string | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.host.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Check both the daily cap and the per-IP rate limit. Returns
 * { ok: true } if the request can proceed, or { ok: false, reason }
 * if it should be refused.
 */
export async function checkCapAndRateLimit(args: {
  ipHash: string | null;
}): Promise<
  | { ok: true; spentCents: number }
  | { ok: false; reason: "daily-cap" | "rate-limit"; spentCents?: number }
> {
  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  // ─── Daily cap ──
  const { data: spendRow } = await supabase
    .from("intake_daily_spend")
    .select("total_cents")
    .eq("date", today)
    .maybeSingle();
  const spentCents = (spendRow?.total_cents as number | undefined) ?? 0;
  if (spentCents >= DAILY_CAP_CENTS) {
    return { ok: false, reason: "daily-cap", spentCents };
  }

  // ─── Per-IP rate limit (last hour) ──
  if (args.ipHash) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("intake_sessions")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", args.ipHash)
      .gte("created_at", oneHourAgo);
    if ((count ?? 0) >= PER_IP_HOURLY_LIMIT) {
      return { ok: false, reason: "rate-limit", spentCents };
    }
  }

  return { ok: true, spentCents };
}

/**
 * Look up a cached completed intake for the same canonical domain
 * within the cache window. Returns the cached session ID if found.
 *
 * Cache hits are zero-cost. They also let us answer "I want to show
 * my partner the snapshot we got yesterday" without making the user
 * re-enter the URL.
 */
export async function findCachedIntakeForDomain(
  domain: string,
): Promise<{ id: string; cookieToken: string } | null> {
  const supabase = getSupabaseAdmin();
  // Two cutoffs: the rolling 7-day window AND the freshness floor that
  // gets bumped on logic-changing deploys. Use the LATER of the two so
  // a recent deploy invalidates older snapshots even if they're still
  // inside the rolling window.
  const rollingCutoff = new Date(
    Date.now() - PER_DOMAIN_CACHE_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const freshnessFloor = CACHE_FRESHNESS_FLOOR_ISO;
  const cutoff = rollingCutoff > freshnessFloor ? rollingCutoff : freshnessFloor;

  const { data } = await supabase
    .from("intake_sessions")
    .select("id, cookie_token")
    .eq("domain", domain)
    .eq("status", "complete")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id as string, cookieToken: data.cookie_token as string };
}

/**
 * Atomically increment the daily spend counter. Called at the END of
 * a successful pipeline run so we only book costs for completed work
 * (errored runs that didn't make it to API calls don't bill).
 */
export async function recordDailySpend(args: {
  costCents: number;
  capped?: boolean;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  // Upsert + increment in one round trip via RPC-style SQL. Supabase JS
  // doesn't have a native increment helper, so we do read-modify-write
  // here. Acceptable for our volume (low contention on a single row).
  const { data: existing } = await supabase
    .from("intake_daily_spend")
    .select("total_cents, request_count, capped_count")
    .eq("date", today)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("intake_daily_spend")
      .update({
        total_cents: (existing.total_cents as number) + args.costCents,
        request_count: (existing.request_count as number) + 1,
        capped_count:
          (existing.capped_count as number) + (args.capped ? 1 : 0),
        updated_at: new Date().toISOString(),
      })
      .eq("date", today);
  } else {
    await supabase.from("intake_daily_spend").insert({
      date: today,
      total_cents: args.costCents,
      request_count: 1,
      capped_count: args.capped ? 1 : 0,
    });
  }
}

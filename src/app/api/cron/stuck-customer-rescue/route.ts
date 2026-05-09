import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendTemplate } from "@/lib/email/dispatch";
import {
  computeQuestionQueue,
  summarizeQueue,
} from "@/lib/memory/queue";
import {
  indexMemoryRows,
  memoryFieldsFromRows,
  computeSectionReadiness,
  overallReadinessPct,
} from "@/lib/memory/readiness";
import { MEMORY_FILES, MEMORY_FILE_TITLES } from "@/lib/memory/files";
import type {
  CustomerMemory as CM,
  Profile,
  Purchase,
} from "@/lib/supabase/types";
import { SITE_URL } from "@/lib/site";

export const runtime = "nodejs";
// Max execution per Vercel Cron — we batch by user, so the wall-clock
// scales with paid-customer count. Pro plan gives us 60s; we cap the
// batch at 100 users per run to stay well under that.
export const maxDuration = 60;

/**
 * Stuck-customer rescue cron.
 *
 * Detects paying customers whose Memory hasn't moved in 7+ days, picks
 * the next section they should pick up, and sends a Jason-voice rescue
 * email via Resend. Pure code — no LLM call per customer. Personalization
 * is mechanical: name + days idle + next section + (optionally) a
 * blocker hint derived from where the customer has the most unanswered
 * questions.
 *
 * Idempotency: writes a row to `customer_rescue_sends` per (user_id,
 * sent_on::date) so re-running the cron same-day doesn't re-send. The
 * cooldown between rescues is 14 days — we don't want to nag a customer
 * who already got a rescue and stayed idle.
 *
 * Auth: same Bearer ${CRON_SECRET} pattern as /api/cron/drip. Vercel Cron
 * sends the header automatically when the env var is set.
 *
 * Internal observability: at the end of the run, posts a summary to
 * INTERNAL_NOTIFICATION_EMAIL (typically team@thefranchisorblueprint.com)
 * via the existing internal-lead-notification template, so Eric/Jason
 * can see who got pinged and why without reading 50 sent-email rows.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const STUCK_DAYS_MIN = 7;
  const STUCK_DAYS_MAX = 60; // beyond this, escalate differently — out of scope here
  const RESCUE_COOLDOWN_DAYS = 14;
  const BATCH_LIMIT = 100;

  // 1) Pull every paid customer + their profile (RLS would also work
  // but we want to scan all users in one query). Filter to active access
  // (at least one paid, non-refunded purchase).
  const { data: paidPurchasesRaw, error: purchaseErr } = await admin
    .from("purchases")
    .select("user_id, status, created_at")
    .eq("status", "paid");
  if (purchaseErr) {
    console.error("[rescue-cron] purchases query failed", purchaseErr);
    return NextResponse.json({ error: "purchases query failed" }, { status: 500 });
  }
  const paidUserIds = Array.from(
    new Set(((paidPurchasesRaw ?? []) as Pick<Purchase, "user_id">[]).map((p) => p.user_id)),
  );
  if (paidUserIds.length === 0) {
    return NextResponse.json({ ok: true, examined: 0, sent: 0 });
  }

  // 2) Profiles + Memory rows in two index-friendly queries.
  const [{ data: profilesRaw }, { data: memoryRaw }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, email, created_at, tier, coaching_credits")
      .in("id", paidUserIds),
    admin
      .from("customer_memory")
      .select(
        "user_id, file_slug, content_md, fields, confidence, attachments, updated_at",
      )
      .in("user_id", paidUserIds),
  ]);
  const profiles = (profilesRaw ?? []) as Array<
    Pick<
      Profile,
      | "id"
      | "full_name"
      | "email"
      | "created_at"
      | "tier"
      | "coaching_credits"
    >
  >;
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  // 3) Group memory rows by user.
  const memoryByUser = new Map<
    string,
    Array<
      Pick<
        CM,
        | "file_slug"
        | "content_md"
        | "fields"
        | "confidence"
        | "attachments"
        | "updated_at"
      >
    >
  >();
  for (const row of (memoryRaw ?? []) as Array<
    Pick<
      CM,
      | "user_id"
      | "file_slug"
      | "content_md"
      | "fields"
      | "confidence"
      | "attachments"
      | "updated_at"
    >
  >) {
    const list = memoryByUser.get(row.user_id) ?? [];
    list.push(row);
    memoryByUser.set(row.user_id, list);
  }

  // 4) Pull recent rescue sends for the cooldown check.
  const cooldownCutoff = new Date(
    Date.now() - RESCUE_COOLDOWN_DAYS * 24 * 3600 * 1000,
  ).toISOString();
  const { data: recentSendsRaw } = await admin
    .from("customer_rescue_sends")
    .select("user_id, sent_at")
    .in("user_id", paidUserIds)
    .gte("sent_at", cooldownCutoff);
  const inCooldown = new Set(
    ((recentSendsRaw ?? []) as Array<{ user_id: string }>).map((r) => r.user_id),
  );

  // 5) For each candidate, compute idle-days + next section + blocker hint.
  type Candidate = {
    userId: string;
    email: string;
    firstName: string | null;
    daysIdle: number;
    nextSectionSlug: string;
    nextSectionTitle: string;
    questionsRemaining: number;
    blockerHint: string | null;
    bookJasonUrl: string | null;
    coachingCreditsRemaining: number | null;
  };

  const candidates: Candidate[] = [];
  const now = Date.now();
  // Calendly URL — null when not configured. We only surface the
  // book-Jason CTA when (a) the env is set AND (b) the customer has
  // tier ≥ 2 OR a positive coaching_credits balance. Tier-1 customers
  // without credits don't get the CTA — it'd only frustrate them.
  const calendlyUrl = process.env.CALENDLY_COACHING_URL ?? null;

  for (const userId of paidUserIds) {
    if (inCooldown.has(userId)) continue;
    const profile = profileById.get(userId);
    if (!profile?.email) continue;

    const rows = memoryByUser.get(userId) ?? [];

    // Skip brand-new customers with no Memory yet — they belong to the
    // Day-1 onboarding hero on the dashboard, not the rescue flow. Day
    // 1 itself isn't "stuck."
    if (rows.length === 0) continue;

    const lastTouched = rows
      .map((r) => (r.updated_at ? new Date(r.updated_at).getTime() : 0))
      .reduce((a, b) => Math.max(a, b), 0);
    if (!lastTouched) continue;
    const daysIdle = Math.floor((now - lastTouched) / (24 * 3600 * 1000));
    if (daysIdle < STUCK_DAYS_MIN || daysIdle > STUCK_DAYS_MAX) continue;

    // Compute the queue to pick the next section.
    const indexed = indexMemoryRows(
      rows.map((r) => ({
        file_slug: r.file_slug,
        content_md: r.content_md,
        fields: r.fields,
        confidence: r.confidence,
        attachments: r.attachments ?? [],
      })),
    );
    const fieldsMap = memoryFieldsFromRows(indexed);
    const queue = computeQuestionQueue(fieldsMap);
    const summary = summarizeQueue(queue);

    // If the queue is empty AND readiness is high, the customer isn't
    // stuck — they're done. Don't ping.
    const readinessPct = overallReadinessPct(computeSectionReadiness(indexed));
    if (queue.length === 0 && readinessPct >= 95) continue;

    // Pick the next section: the one carrying the queue's first item.
    // Fallback (unlikely): first MEMORY_FILES slug with empty content.
    const next = summary.next;
    const nextSlug = (next?.slug ??
      MEMORY_FILES.find((s) => {
        const r = rows.find((rr) => rr.file_slug === s);
        return !r?.content_md || !r.content_md.trim();
      }) ??
      MEMORY_FILES[0]) as string;
    const nextTitle =
      MEMORY_FILE_TITLES[nextSlug as keyof typeof MEMORY_FILE_TITLES];

    // Blocker hint: which section has the most unanswered questions?
    // If it's not the same as nextSlug, name it specifically — that's
    // often where the actual blockage is.
    const counts = new Map<string, number>();
    for (const item of queue) {
      counts.set(item.slug, (counts.get(item.slug) ?? 0) + 1);
    }
    const heaviestSlug = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const blockerHint =
      heaviestSlug && heaviestSlug !== nextSlug
        ? `The section that's had the most stuck questions is ${MEMORY_FILE_TITLES[heaviestSlug as keyof typeof MEMORY_FILE_TITLES]} (${counts.get(heaviestSlug) ?? 0} unanswered). If that's the wall, tell me.`
        : null;

    // Book-Jason eligibility: env must be configured AND customer
    // either has Tier 2/3 access OR coaching credits remaining.
    const credits = profile.coaching_credits ?? 0;
    const eligibleForCalendly =
      !!calendlyUrl && (profile.tier >= 2 || credits > 0);
    candidates.push({
      userId,
      email: profile.email,
      firstName: profile.full_name?.split(/\s+/)[0]?.trim() || null,
      daysIdle,
      nextSectionSlug: nextSlug,
      nextSectionTitle: nextTitle,
      questionsRemaining: summary.totalRequired,
      blockerHint,
      bookJasonUrl: eligibleForCalendly ? calendlyUrl : null,
      coachingCreditsRemaining: eligibleForCalendly ? credits : null,
    });
    if (candidates.length >= BATCH_LIMIT) break;
  }

  // 6) Send + record.
  type SendResult = {
    userId: string;
    email: string;
    firstName: string | null;
    daysIdle: number;
    nextSectionTitle: string;
    sent: boolean;
    reason?: string;
  };
  const results: SendResult[] = [];
  for (const c of candidates) {
    try {
      const r = await sendTemplate(
        "stuck-customer-rescue",
        c.email,
        {
          firstName: c.firstName,
          daysIdle: c.daysIdle,
          nextSectionSlug: c.nextSectionSlug,
          nextSectionTitle: c.nextSectionTitle,
          questionsRemaining: c.questionsRemaining,
          blockerHint: c.blockerHint,
          siteUrl: SITE_URL,
          bookJasonUrl: c.bookJasonUrl,
          coachingCreditsRemaining: c.coachingCreditsRemaining,
        },
        {
          // De-dupe on the day — same key Resend will see if the worker
          // restarts mid-batch.
          idempotencyKey: `rescue:${c.userId}:${new Date().toISOString().slice(0, 10)}`,
        },
      );
      if (r.ok) {
        await admin.from("customer_rescue_sends").insert({
          user_id: c.userId,
          section_slug: c.nextSectionSlug,
          days_idle: c.daysIdle,
        });
        results.push({
          userId: c.userId,
          email: c.email,
          firstName: c.firstName,
          daysIdle: c.daysIdle,
          nextSectionTitle: c.nextSectionTitle,
          sent: true,
        });
      } else {
        results.push({
          userId: c.userId,
          email: c.email,
          firstName: c.firstName,
          daysIdle: c.daysIdle,
          nextSectionTitle: c.nextSectionTitle,
          sent: false,
          reason: r.error,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({
        userId: c.userId,
        email: c.email,
        firstName: c.firstName,
        daysIdle: c.daysIdle,
        nextSectionTitle: c.nextSectionTitle,
        sent: false,
        reason: msg,
      });
    }
  }

  // Internal observability is handled via:
  //   1. The `customer_rescue_sends` table — Eric can query this for an
  //      audit trail of who got pinged and when.
  //   2. The Resend dashboard — every send is logged there with delivery
  //      status, opens, clicks.
  //   3. The forthcoming daily team@ digest cron, which rolls this and
  //      every other ops signal into one branded morning email.
  //
  // We deliberately don't fire a separate notification email per cron
  // run — that would be 365 noise emails per year for a signal Eric
  // gets in the daily digest anyway.

  return NextResponse.json({
    ok: true,
    examined: paidUserIds.length,
    candidates: candidates.length,
    sent: results.filter((r) => r.sent).length,
    failed: results.filter((r) => !r.sent).length,
    results,
  });
}

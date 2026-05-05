import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendTemplate } from "@/lib/email/dispatch";
import { SITE_URL } from "@/lib/site";
import {
  indexMemoryRows,
  computeChapterReadiness,
  overallReadinessPct,
} from "@/lib/memory/readiness";
import type { CustomerMemory, Purchase, Profile } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Early-customer proactive outreach cron.
 *
 * Daily at 10am MDT (16:00 UTC). Detects customers in their first
 * 30 days with low Memory engagement and sends a Jason-voice
 * "how's it going?" email. (The cron name and audit table still
 * say "refund_outreach" for legacy reasons — the 30-day refund
 * guarantee was retired 2026-05-05; the outreach itself is still
 * useful for catching at-risk new customers before they churn.)
 *
 * Detection:
 *   - Purchase created 20–30 days ago (status = 'paid')
 *   - Blueprint readiness < 25% (they haven't engaged)
 *   - Not already sent an outreach in the last 30 days
 *
 * One email per customer per 30-day period. Idempotent via
 * `refund_outreach_sends` audit table + Resend idempotency key.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();

  const REFUND_WINDOW_DAYS = 30;
  const OUTREACH_START_DAY = 20; // start reaching out at day 20
  const READINESS_THRESHOLD = 25; // only reach out if readiness < 25%
  const COOLDOWN_DAYS = 30;
  const BATCH_LIMIT = 50;

  const now = Date.now();
  const windowStart = new Date(
    now - REFUND_WINDOW_DAYS * 24 * 3600 * 1000,
  ).toISOString();
  const windowEnd = new Date(
    now - OUTREACH_START_DAY * 24 * 3600 * 1000,
  ).toISOString();

  // 1) Find purchases in the outreach window (day 20–30).
  const { data: purchasesRaw } = await admin
    .from("purchases")
    .select("user_id, tier, amount_cents, created_at")
    .eq("status", "paid")
    .gte("created_at", windowStart)
    .lte("created_at", windowEnd);

  if (!purchasesRaw || purchasesRaw.length === 0) {
    return NextResponse.json({ ok: true, examined: 0, sent: 0 });
  }

  const purchases = purchasesRaw as Pick<
    Purchase,
    "user_id" | "tier" | "amount_cents" | "created_at"
  >[];
  const userIds = [...new Set(purchases.map((p) => p.user_id))];

  // 2) Check cooldown — who already got an outreach recently?
  const cooldownCutoff = new Date(
    now - COOLDOWN_DAYS * 24 * 3600 * 1000,
  ).toISOString();
  const { data: recentSendsRaw } = await admin
    .from("refund_outreach_sends")
    .select("user_id")
    .in("user_id", userIds)
    .gte("sent_at", cooldownCutoff);
  const inCooldown = new Set(
    ((recentSendsRaw ?? []) as Array<{ user_id: string }>).map(
      (r) => r.user_id,
    ),
  );

  // 3) Pull profiles + memory rows.
  const [{ data: profilesRaw }, { data: memoryRaw }] = await Promise.all([
    admin.from("profiles").select("id, full_name, email").in("id", userIds),
    admin
      .from("customer_memory")
      .select("user_id, file_slug, content_md, fields, confidence, attachments")
      .in("user_id", userIds),
  ]);

  const profileMap = new Map(
    ((profilesRaw ?? []) as Pick<Profile, "id" | "full_name" | "email">[]).map(
      (p) => [p.id, p],
    ),
  );

  const memoryByUser = new Map<string, typeof memoryRaw>();
  for (const row of memoryRaw ?? []) {
    const list = memoryByUser.get(row.user_id) ?? [];
    list.push(row);
    memoryByUser.set(row.user_id, list);
  }

  // 4) Evaluate each candidate.
  type SendResult = {
    userId: string;
    email: string;
    daysRemaining: number;
    readinessPct: number;
    sent: boolean;
    reason?: string;
  };

  const results: SendResult[] = [];
  const seenUsers = new Set<string>();

  for (const p of purchases) {
    if (seenUsers.has(p.user_id)) continue;
    seenUsers.add(p.user_id);
    if (inCooldown.has(p.user_id)) continue;

    const profile = profileMap.get(p.user_id);
    if (!profile?.email) continue;

    const daysSincePurchase = Math.floor(
      (now - new Date(p.created_at).getTime()) / (24 * 3600 * 1000),
    );
    const daysRemaining = Math.max(0, REFUND_WINDOW_DAYS - daysSincePurchase);

    // Compute readiness.
    const rows = memoryByUser.get(p.user_id) ?? [];
    const indexed = indexMemoryRows(
      rows.map((r) => ({
        file_slug: r.file_slug,
        content_md: r.content_md,
        fields: r.fields as CustomerMemory["fields"],
        confidence: r.confidence as CustomerMemory["confidence"],
        attachments: (r.attachments ?? []) as CustomerMemory["attachments"],
      })),
    );
    const readinessPct = overallReadinessPct(computeChapterReadiness(indexed));

    if (readinessPct >= READINESS_THRESHOLD) continue;

    // Send.
    try {
      const firstName = profile.full_name?.split(/\s+/)[0]?.trim() ?? null;
      const dateKey = new Date().toISOString().slice(0, 10);

      const r = await sendTemplate(
        "refund-window-outreach",
        profile.email,
        {
          firstName,
          daysRemaining,
          readinessPct,
          siteUrl: SITE_URL,
        },
        {
          idempotencyKey: `refund-outreach:${p.user_id}:${dateKey}`,
        },
      );

      if (r.ok) {
        await admin.from("refund_outreach_sends").insert({
          user_id: p.user_id,
          days_remaining: daysRemaining,
          readiness_pct: readinessPct,
        });
        results.push({
          userId: p.user_id,
          email: profile.email,
          daysRemaining,
          readinessPct,
          sent: true,
        });
      } else {
        results.push({
          userId: p.user_id,
          email: profile.email,
          daysRemaining,
          readinessPct,
          sent: false,
          reason: r.error,
        });
      }
    } catch (err) {
      results.push({
        userId: p.user_id,
        email: profile.email,
        daysRemaining,
        readinessPct,
        sent: false,
        reason: err instanceof Error ? err.message : String(err),
      });
    }

    if (results.length >= BATCH_LIMIT) break;
  }

  return NextResponse.json({
    ok: true,
    examined: seenUsers.size,
    sent: results.filter((r) => r.sent).length,
    failed: results.filter((r) => !r.sent).length,
    results,
  });
}

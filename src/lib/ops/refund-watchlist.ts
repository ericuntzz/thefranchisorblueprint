import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, CustomerMemory } from "@/lib/supabase/types";
import {
  indexMemoryRows,
  computeSectionReadiness,
  overallReadinessPct,
} from "@/lib/memory/readiness";
import type { RefundWatchItem } from "./types";

const TIER_NAMES: Record<number, string> = {
  1: "The Blueprint",
  2: "Navigator",
  3: "Builder",
};

const REFUND_WINDOW_DAYS = 30;
const WATCH_THRESHOLD_DAYS = 10;

export async function collect(
  admin: SupabaseClient<Database>,
): Promise<RefundWatchItem[]> {
  const windowStart = new Date(
    Date.now() - REFUND_WINDOW_DAYS * 24 * 3600 * 1000,
  ).toISOString();

  const { data: purchases } = await admin
    .from("purchases")
    .select("user_id, tier, amount_cents, created_at")
    .eq("status", "paid")
    .gte("created_at", windowStart);

  if (!purchases || purchases.length === 0) return [];

  const userIds = [...new Set(purchases.map((p) => p.user_id))];

  const [{ data: profiles }, { data: memoryRows }] = await Promise.all([
    admin.from("profiles").select("id, full_name, email").in("id", userIds),
    admin
      .from("customer_memory")
      .select("user_id, file_slug, content_md, fields, confidence, attachments")
      .in("user_id", userIds),
  ]);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p]),
  );

  const memoryByUser = new Map<string, typeof memoryRows>();
  for (const row of memoryRows ?? []) {
    const list = memoryByUser.get(row.user_id) ?? [];
    list.push(row);
    memoryByUser.set(row.user_id, list);
  }

  const now = Date.now();
  const watchlist: RefundWatchItem[] = [];

  const seenUsers = new Set<string>();
  for (const p of purchases) {
    if (seenUsers.has(p.user_id)) continue;
    seenUsers.add(p.user_id);

    const daysRemaining = Math.max(
      0,
      REFUND_WINDOW_DAYS -
        Math.floor(
          (now - new Date(p.created_at).getTime()) / (24 * 3600 * 1000),
        ),
    );
    if (daysRemaining > WATCH_THRESHOLD_DAYS) continue;

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
    const readinessPct = overallReadinessPct(computeSectionReadiness(indexed));

    if (readinessPct >= 50) continue;

    const profile = profileMap.get(p.user_id);
    watchlist.push({
      firstName: profile?.full_name?.split(/\s+/)[0]?.trim() ?? null,
      email: profile?.email ?? "unknown",
      tier: p.tier as 1 | 2 | 3,
      tierName: TIER_NAMES[p.tier] ?? `Tier ${p.tier}`,
      daysRemaining,
      readinessPct,
    });
  }

  watchlist.sort((a, b) => a.daysRemaining - b.daysRemaining);
  return watchlist;
}
